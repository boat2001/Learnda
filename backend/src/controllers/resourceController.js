const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const { Op } = require('sequelize');
const { ResourceFile, User, ContentEngagement } = require('../models');
const { uploadDir, getFileUrl, isR2, r2Client } = require('../config/upload');
const {
  extractTitleFromFileName,
  buildResourceDisplayKey,
  pickBestResourceCandidate,
  resolveResourceDiskPath
} = require('../utils/resourceClassifier');

const toSafeNumber = (value, fallback = 0) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
};

const toTimestamp = (value) => {
  const timestamp = new Date(value || '').getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const getResourceRecencyBoost = (item = {}) => {
  const timestamp = toTimestamp(item.created_at || item.uploaded_at || item.updated_at);
  if (!timestamp) return 0;
  const dayAge = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
  return Math.max(0, 180 - dayAge);
};

const getResourceSortMetric = (item = {}, sortBy = 'recent') => {
  const views = toSafeNumber(item.views, 0);
  const downloads = toSafeNumber(item.downloads, 0);
  const recencyBoost = getResourceRecencyBoost(item);

  switch (String(sortBy || 'recent').trim().toLowerCase()) {
    case 'trending':
      return views * 0.65 + downloads * 1.2 + recencyBoost * 4;
    case 'most_accessed':
      return views * 1.1 + downloads * 0.55;
    case 'top':
      return downloads * 1.15 + views * 0.7 + recencyBoost * 2;
    case 'recent':
    case 'recently_added':
      return toTimestamp(item.created_at || item.uploaded_at || item.updated_at);
    default:
      return 0;
  }
};

const sortResourceFiles = (files = [], sortBy = 'recent', sortOrder = 'desc') => {
  const normalizedSortBy = String(sortBy || 'recent').trim().toLowerCase();
  const normalizedSortOrder = String(sortOrder || '').trim().toLowerCase();
  const descendingMetricSort = normalizedSortOrder !== 'asc';

  return [...files].sort((left, right) => {
    if (normalizedSortBy === 'title') {
      const titleCompare = String(left?.title || '').localeCompare(String(right?.title || ''));
      if (titleCompare !== 0) {
        return normalizedSortOrder === 'desc' ? -titleCompare : titleCompare;
      }
    } else {
      const leftMetric = getResourceSortMetric(left, normalizedSortBy);
      const rightMetric = getResourceSortMetric(right, normalizedSortBy);
      if (leftMetric !== rightMetric) {
        return descendingMetricSort ? rightMetric - leftMetric : leftMetric - rightMetric;
      }
    }

    return String(left?.title || '').localeCompare(String(right?.title || ''));
  });
};

const resolveExistingResourceFilePath = (file = {}) => {
  const uploadRoot = path.resolve(uploadDir);
  const backendUploadsRoot = path.resolve(__dirname, '..', '..', 'uploads');
  const allowedRoots = [...new Set([uploadRoot, backendUploadsRoot])];
  const baseNameFromUrl = path.basename(String(file.file_url || '').split('?')[0] || '');
  const baseNameFromFileName = path.basename(String(file.file_name || ''));
  const candidates = [
    file.file_path,
    baseNameFromUrl ? path.join(uploadDir, baseNameFromUrl) : null,
    baseNameFromFileName ? path.join(uploadDir, baseNameFromFileName) : null,
    baseNameFromUrl ? path.join(process.cwd(), 'backend', 'uploads', baseNameFromUrl) : null,
    baseNameFromFileName ? path.join(process.cwd(), 'backend', 'uploads', baseNameFromFileName) : null
  ].filter(Boolean);

  for (const candidate of candidates) {
    const normalized = path.resolve(String(candidate));
    const insideAllowedRoot = allowedRoots.some(
      (root) => normalized === root || normalized.startsWith(`${root}${path.sep}`)
    );
    if (insideAllowedRoot && fs.existsSync(normalized)) {
      return normalized;
    }

    const resolvedPath = resolveResourceDiskPath(candidate, uploadDir);
    if (resolvedPath && fs.existsSync(resolvedPath)) {
      return resolvedPath;
    }
  }

  return null;
};

const toPosixPath = (value = '') => String(value || '').trim().replace(/\\/g, '/');

const pushUnique = (items, value) => {
  const normalized = toPosixPath(value).replace(/^\/+/, '');
  if (normalized && !items.includes(normalized)) items.push(normalized);
};

const addUploadKeyCandidate = (items, value) => {
  const normalized = toPosixPath(value);
  if (!normalized) return;

  const withoutQuery = normalized.split('?')[0].split('#')[0];
  const uploadMarkerMatch = withoutQuery.match(/(?:^|\/)uploads\/(.+)$/i);
  if (uploadMarkerMatch?.[1]) {
    pushUnique(items, `uploads/${uploadMarkerMatch[1]}`);
    return;
  }

  if (/^resources\//i.test(withoutQuery)) {
    pushUnique(items, `uploads/${withoutQuery}`);
  }
};

const getR2KeyCandidates = (file = {}) => {
  const candidates = [];
  const filePath = String(file.file_path || '');
  const fileUrl = String(file.file_url || '');

  addUploadKeyCandidate(candidates, filePath);

  if (filePath && !path.isAbsolute(filePath)) {
    addUploadKeyCandidate(candidates, filePath.replace(/^\/+/, ''));
  }

  if (/^https?:\/\//i.test(fileUrl)) {
    try {
      const parsedUrl = new URL(fileUrl);
      addUploadKeyCandidate(candidates, parsedUrl.pathname);

      const r2PublicBase = String(process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
      if (r2PublicBase && fileUrl.startsWith(r2PublicBase)) {
        addUploadKeyCandidate(candidates, fileUrl.slice(r2PublicBase.length));
      }
    } catch {
      addUploadKeyCandidate(candidates, fileUrl);
    }
  } else {
    addUploadKeyCandidate(candidates, fileUrl);
  }

  return candidates;
};

class ResourceController {
  async list(req, res) {
    try {
      const {
        search,
        q,
        course,
        level,
        semester,
        year,
        category,
        type,
        page = 1,
        limit,
        sort_by = 'recent',
        sort_order = 'desc'
      } = req.query;

      const normalizedPage = Math.max(1, Number.parseInt(page, 10) || 1);
      const requestedLimit = Number.parseInt(limit, 10) || 0;
      const normalizedLimit = requestedLimit > 0 ? Math.min(Math.max(requestedLimit, 1), 100) : 0;
      const queryLimit = normalizedLimit > 0 ? Math.min(normalizedLimit * 6, 400) : null;
      const queryOffset =
        normalizedLimit > 0 ? Math.max(0, (normalizedPage - 1) * queryLimit) : 0;
      const normalizedSortBy = String(sort_by || 'recent').trim().toLowerCase();
      const normalizedSortOrder = String(sort_order || '').trim().toLowerCase() === 'asc' ? 'ASC' : 'DESC';

      const where = {};

      if (course && course !== 'all') where.course = course;
      if (level && level !== 'all') where.level = level;
      if (semester && semester !== 'all') where.semester = semester;
      if (year && year !== 'all') where.year = year;
      if (category && category !== 'all') {
        const categories = String(category)
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
        if (categories.length > 1) {
          where.category = { [Op.in]: categories };
        } else if (categories.length === 1) {
          where.category = categories[0];
        }
      }
      if (type && type !== 'all') where.file_type = type;

      const query = (search || q || '').trim();
      if (query) {
        where[Op.or] = [
          { title: { [Op.iLike]: `%${query}%` } },
          { file_name: { [Op.iLike]: `%${query}%` } },
          { description: { [Op.iLike]: `%${query}%` } },
          { course: { [Op.iLike]: `%${query}%` } },
          { category: { [Op.iLike]: `%${query}%` } }
        ];
      }

      const files = await ResourceFile.findAll({
        where,
        include: [{ model: User, as: 'uploader', attributes: ['id', 'full_name'] }],
        order:
          normalizedSortBy === 'most_accessed'
            ? [['views', normalizedSortOrder], ['downloads', normalizedSortOrder], ['created_at', 'DESC']]
            : normalizedSortBy === 'top'
              ? [['downloads', normalizedSortOrder], ['views', normalizedSortOrder], ['created_at', 'DESC']]
              : normalizedSortBy === 'trending'
                ? [['views', normalizedSortOrder], ['downloads', normalizedSortOrder], ['created_at', 'DESC']]
                : normalizedSortBy === 'title'
                  ? [['title', normalizedSortOrder], ['created_at', 'DESC']]
                  : [['created_at', normalizedSortOrder]],
        ...(queryLimit ? { limit: queryLimit, offset: queryOffset } : {})
      });
      const hasPremiumAccess = req.user?.subscription?.plan?.name && req.user.subscription.plan.name !== 'Basic Student';
      const grouped = new Map();

      files.forEach((fileModel) => {
        const file = fileModel.toJSON();
        file.title = file.title || extractTitleFromFileName(file.file_name);
        const key = buildResourceDisplayKey(file);
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(file);
      });

      const deduped = Array.from(grouped.values())
        .map((group) => pickBestResourceCandidate(group, hasPremiumAccess))
        .filter(Boolean)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const sortedFiles = sortResourceFiles(deduped, normalizedSortBy, sort_order);
      const pagedFiles = normalizedLimit > 0 ? sortedFiles.slice(0, normalizedLimit) : sortedFiles;

      res.json({
        success: true,
        files: pagedFiles,
        total: deduped.length,
        page: normalizedPage,
        limit: normalizedLimit || deduped.length
      });
    } catch (error) {
      console.error('List resources error:', error);
      res.status(500).json({ success: false, error: 'Failed to load resources' });
    }
  }

  async upload(req, res) {
    try {
      const userId = req.user?.id || null;
      const file = req.file;
      if (!file) {
        return res.status(400).json({ success: false, error: 'File is required' });
      }

      const {
        title,
        description,
        course,
        level,
        semester,
        year,
        category,
        is_premium
      } = req.body || {};

      const fileUrl = getFileUrl(file);
      const record = await ResourceFile.create({
        title: title || file.originalname,
        description: description || '',
        file_name: file.originalname,
        file_url: fileUrl,
        file_path: file.path || file.key || null,
        file_type: file.mimetype,
        file_size: file.size,
        course: course || null,
        level: level || null,
        semester: semester || null,
        year: year || null,
        category: category || null,
        is_premium: is_premium === 'true' || is_premium === true,
        uploader_id: userId
      });

      res.status(201).json({ success: true, file: record });
    } catch (error) {
      console.error('Upload resource error:', error);
      res.status(500).json({ success: false, error: 'Failed to upload resource' });
    }
  }

  async download(req, res) {
    try {
      const { id } = req.params;
      const file = await ResourceFile.findByPk(id);
      if (!file) {
        return res.status(404).json({ success: false, error: 'Resource not found' });
      }

      if (file.is_premium) {
        const planName = req.user?.subscription?.plan?.name || req.user?.current_plan || 'Basic Student';
        const hasPremium = planName && planName !== 'Basic Student';
        if (!hasPremium) {
          return res.status(403).json({ success: false, error: 'Premium plan required' });
        }
      }

      // Prefer disk — covers local dev and files uploaded before R2 was configured.
      const resolvedPath = resolveExistingResourceFilePath(file);
      if (resolvedPath) {
        file.downloads += 1;
        file.last_downloaded_at = new Date();
        await file.save();
        return res.download(resolvedPath, file.file_name);
      }

      const r2KeyCandidates = isR2 && r2Client ? getR2KeyCandidates(file) : [];
      if (!r2KeyCandidates.length) {
        return res.status(404).json({ success: false, error: 'File not found' });
      }

      // Fetch directly from R2 using credentials — works even without public bucket access.
      let s3Response;
      let lastStorageError = null;
      try {
        const { GetObjectCommand } = require('@aws-sdk/client-s3');
        for (const r2Key of r2KeyCandidates) {
          try {
            s3Response = await r2Client.send(
              new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: r2Key })
            );
            break;
          } catch (candidateError) {
            const status = candidateError?.$metadata?.httpStatusCode;
            if (status === 404 || candidateError?.name === 'NoSuchKey') {
              lastStorageError = candidateError;
              continue;
            }
            throw candidateError;
          }
        }
      } catch (s3Err) {
        const status = s3Err?.$metadata?.httpStatusCode;
        if (status === 404 || s3Err?.name === 'NoSuchKey') {
          return res.status(404).json({ success: false, error: 'File not available in storage' });
        }
        console.error('[download] R2 GetObject error:', s3Err?.name, s3Err?.message);
        return res.status(502).json({ success: false, error: 'File not available in storage' });
      }

      if (!s3Response) {
        if (lastStorageError) {
          return res.status(404).json({ success: false, error: 'File not available in storage' });
        }
        return res.status(404).json({ success: false, error: 'File not found' });
      }

      file.downloads += 1;
      file.last_downloaded_at = new Date();
      await file.save();

      const contentType = s3Response.ContentType || 'application/octet-stream';
      const contentLength = s3Response.ContentLength;
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.file_name || 'file')}`);
      if (contentLength) res.setHeader('Content-Length', String(contentLength));

      try {
        await pipeline(s3Response.Body, res);
      } catch {
        // Client disconnected mid-stream — not a server error
        if (!res.writableEnded) res.destroy();
      }
    } catch (error) {
      console.error('Download resource error:', error);
      res.status(500).json({ success: false, error: 'Failed to download resource' });
    }
  }

  async remove(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const file = await ResourceFile.findByPk(id);
      if (!file) {
        return res.status(404).json({ success: false, error: 'Resource not found' });
      }

      if (userRole !== 'admin' && file.uploader_id !== userId) {
        return res.status(403).json({ success: false, error: 'Not authorized to delete this file' });
      }

      try {
        if (file.file_path && fs.existsSync(file.file_path)) {
          fs.unlinkSync(file.file_path);
        }
      } catch (fileError) {
        console.warn('Failed to remove file from disk', fileError);
      }

      await file.destroy();
      res.json({ success: true });
    } catch (error) {
      console.error('Remove resource error:', error);
      res.status(500).json({ success: false, error: 'Failed to delete resource' });
    }
  }

  async trackView(req, res) {
    try {
      const { id } = req.params;
      const file = await ResourceFile.findByPk(id);
      if (!file) {
        return res.status(404).json({ success: false, error: 'Resource not found' });
      }

      file.views = (file.views || 0) + 1;
      file.last_viewed_at = new Date();
      await file.save();

      if (req.user?.id) {
        try {
          await ContentEngagement.create({
            user_id: req.user.id,
            content_id: id,
            action: 'view'
          });
        } catch (engagementError) {
          console.error('Track view engagement error:', engagementError);
        }
      }

      res.json({ success: true, views: file.views });
    } catch (error) {
      console.error('Track view error:', error);
      res.status(500).json({ success: false, error: 'Failed to track view' });
    }
  }

  async getAccessedFileIds(req, res) {
    try {
      const rows = await ContentEngagement.findAll({
        where: { user_id: req.user.id, action: 'view' },
        attributes: ['content_id'],
        group: ['content_id']
      });

      res.json({ success: true, data: { file_ids: rows.map((row) => row.content_id) } });
    } catch (error) {
      console.error('Get accessed file ids error:', error);
      res.status(500).json({ success: false, error: 'Failed to load accessed files' });
    }
  }
}

module.exports = new ResourceController();

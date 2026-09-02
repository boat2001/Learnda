// src/controllers/contributionController.js
const path = require('path');
const db = require('../models');
const { Contribution } = db;
const rewardService = require('../services/rewardService');

const resolveContributionFileUrl = (storedPath) => {
  const value = String(storedPath || '').trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/uploads/')) return value;
  return `/uploads/${path.basename(value)}`;
};

/**
 * Create the correct model record from a Contribution based on kind.
 * Returns { model: 'Lesson'|'TextItem'|..., record }.
 */
const createContentFromContribution = async (item, fileUrl) => {
  const kind = item.kind || 'file';
  const baseFields = {
    creator_id: item.uploader_id,
    status: 'published',
    tags: item.tags || [],
    published_at: new Date(),
  };

  if (kind === 'lesson' || kind === 'file') {
    const record = await db.Lesson.create({
      ...baseFields,
      title: item.title,
      description: item.description,
      depth_level: item.level,
      metadata: { ...(item.metadata || {}), course: item.course, body: item.body },
      file_url: fileUrl,
    });
    return record;
  }

  if (kind === 'quiz') {
    const record = await db.TextItem.create({
      ...baseFields,
      subtype: 'quiz',
      title: item.title,
      description: item.description,
      body: item.body,
      category: item.course || null,
      metadata: { ...(item.metadata || {}), course: item.course },
    });
    return record;
  }

  if (kind === 'blog') {
    const record = await db.TextItem.create({
      ...baseFields,
      subtype: 'blog_post',
      title: item.title,
      description: item.description,
      body: item.body,
      metadata: { ...(item.metadata || {}), course: item.course },
    });
    return record;
  }

  // Default: treat as text_lesson (Lesson)
  const record = await db.Lesson.create({
    ...baseFields,
    title: item.title,
    description: item.description,
    depth_level: item.level,
    metadata: { ...(item.metadata || {}), course: item.course, body: item.body },
    file_url: fileUrl,
  });
  return record;
};

module.exports = {
  async create(req, res) {
    const { kind = 'file', title, description, course, level, tags, body, metadata } = req.body || {};
    if (!title) return res.status(400).json({ success: false, error: 'title is required' });

    let file_path = null;
    let original_name = null;
    let mime_type = null;
    let file_size = null;

    if (req.file) {
      file_path = req.file.path || req.file.location || req.file.key || null;
      original_name = req.file.originalname;
      mime_type = req.file.mimetype;
      file_size = req.file.size;
    }

    const contribution = await Contribution.create({
      uploader_id: req.user.id,
      kind,
      title,
      description: description || null,
      course: course || null,
      level: level || null,
      tags: tags ? (Array.isArray(tags) ? tags : String(tags).split(',').map(s => s.trim()).filter(Boolean)) : [],
      body: body || null,
      metadata: metadata ? (typeof metadata === 'string' ? JSON.parse(metadata) : metadata) : {},
      file_path,
      original_name,
      mime_type,
      file_size,
      status: 'pending'
    });

    res.status(201).json({ success: true, contribution });
  },

  async getMine(req, res) {
    const rows = await Contribution.findAll({
      where: { uploader_id: req.user.id },
      order: [['created_at', 'DESC']]
    });
    res.json({ success: true, contributions: rows });
  },

  async list(req, res) {
    const { status = 'pending', page = 1, limit = 30 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const { rows, count } = await Contribution.findAndCountAll({
      where: { status },
      order: [['created_at', 'DESC']],
      limit: Number(limit),
      offset
    });
    res.json({ success: true, contributions: rows, total: count });
  },

  async approve(req, res) {
    const item = await Contribution.findByPk(req.params.id);
    if (!item) return res.status(404).json({ success: false, error: 'Contribution not found' });
    if (item.status !== 'pending') return res.status(400).json({ success: false, error: 'Already reviewed' });

    // Create the correct model record from the contribution
    const fileUrl = resolveContributionFileUrl(item.file_path);
    const content = await createContentFromContribution(item, fileUrl);

    await item.update({
      status: 'approved',
      reviewed_by: req.user.id,
      reviewed_at: new Date(),
      content_id: content.id
    });

    try {
      await rewardService.claimReward(item.uploader_id, 'contribute_bonus');
    } catch (rewardError) {
      // Ignore if already claimed or not eligible
    }

    try {
      const gamificationService = require('../services/gamificationService');
      await gamificationService.recordContributionApproved(item.uploader_id);
    } catch (_progressErr) {
      // Progress counter is best-effort; approval already succeeded.
    }

    res.json({ success: true, contribution: item, content });
  },

  async reject(req, res) {
    const item = await Contribution.findByPk(req.params.id);
    if (!item) return res.status(404).json({ success: false, error: 'Contribution not found' });
    if (item.status !== 'pending') return res.status(400).json({ success: false, error: 'Already reviewed' });

    const { review_notes } = req.body || {};
    await item.update({
      status: 'rejected',
      review_notes: review_notes || null,
      reviewed_by: req.user.id,
      reviewed_at: new Date()
    });

    res.json({ success: true, contribution: item });
  }
};

const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const db = require('../models');
const { EduvhibeCgpaEntry, EduvhibeNote, ResourceFile, User } = db;
const { uploadDir, getFileUrl } = require('../config/upload');
const { resolveResourceDiskPath } = require('../utils/resourceClassifier');
const { hasContributorAccess } = require('../utils/contributorAccess');

const EDUVHIBE_VIDEO_TAGS = ['eduvhibe', 'eduvhibe_video'];
const EDUVHIBE_GUIDE_TAGS = ['eduvhibe', 'eduvhibe_guide'];

const formatFileSizeLabel = (bytes) => {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return 'Unknown size';
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${value} B`;
};

const isEduvhibeEditor = (user) => hasContributorAccess(user);

const mapNote = (note) => ({
  id: note.id,
  title: note.title,
  description: note.description || '',
  level: note.level || '100',
  file_name: note.file_name,
  file_type: note.file_type || '',
  file_size: formatFileSizeLabel(note.file_size),
  file_size_bytes: note.file_size || 0,
  course: note.course || 'Eduvhibe',
  semester: note.semester || '',
  views: note.views || 0,
  downloads: note.downloads || 0,
  created_at: note.created_at
});

const mapVideo = (item) => ({
  id: item.id,
  title: item.title,
  description: '',
  level: item.level || item.metadata?.level || '100',
  video_url: item.video_url || item.metadata?.video_url || item.file_url || '',
  created_at: item.created_at
});

const mapGuide = (item) => ({
  id: item.id,
  title: item.title,
  author: item.metadata?.author || item.creator?.full_name || 'Eduvhibe Team',
  category: item.metadata?.category || 'Academic',
  image_url: item.metadata?.image_url || item.thumbnail_url || '',
  content: item.metadata?.content || item.metadata?.body || item.description || '',
  read_time: item.metadata?.read_time || '3 min read',
  created_at: item.created_at
});

const mapCgpaEntry = (entry) => ({
  id: entry.id,
  semester: Number(entry.semester),
  courseName: entry.course_name,
  credits: Number(entry.credits),
  grade: entry.grade,
  gradePoints: Number(entry.grade_points)
});

class EduvhibeController {
  async listNotes(req, res) {
    try {
      const notes = await EduvhibeNote.findAll({
        attributes: ['id', 'title', 'description', 'level', 'semester', 'course', 'file_name', 'file_type', 'file_size', 'views', 'downloads', 'created_at'],
        order: [['created_at', 'DESC']],
        limit: 300,
      });

      res.json({ success: true, notes: notes.map((note) => mapNote(note.toJSON())) });
    } catch (error) {
      console.error('Eduvhibe list notes error:', error);
      res.status(500).json({ success: false, error: 'Failed to load Eduvhibe notes' });
    }
  }

  async uploadNote(req, res) {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ success: false, error: 'File is required' });
      }

      const { title, description, level } = req.body || {};
      const record = await EduvhibeNote.create({
        title: title || file.originalname,
        description: description || '',
        file_name: file.originalname,
        file_url: getFileUrl(file),
        file_path: file.path || file.key || null,
        file_type: file.mimetype,
        file_size: file.size,
        course: 'Eduvhibe',
        level: level || '100',
        is_premium: false,
        uploader_id: req.user.id
      });

      res.status(201).json({ success: true, note: mapNote(record.toJSON()) });
    } catch (error) {
      console.error('Eduvhibe upload note error:', error);
      res.status(500).json({ success: false, error: 'Failed to upload note' });
    }
  }

  async downloadNote(req, res) {
    try {
      const note = await EduvhibeNote.findOne({
        where: { id: req.params.id }
      });

      if (!note) {
        return res.status(404).json({ success: false, error: 'Note not found' });
      }

      if (/^https?:\/\//i.test(String(note.file_url || ''))) {
        note.downloads = (note.downloads || 0) + 1;
        note.last_downloaded_at = new Date();
        await note.save();
        return res.redirect(note.file_url);
      }

      const filePath = note.file_path || path.join(uploadDir, path.basename(note.file_url));
      const resolvedPath = resolveResourceDiskPath(filePath, uploadDir);
      if (!resolvedPath || !fs.existsSync(resolvedPath)) {
        return res.status(404).json({ success: false, error: 'File not found' });
      }

      note.downloads = (note.downloads || 0) + 1;
      note.last_downloaded_at = new Date();
      await note.save();

      res.download(resolvedPath, note.file_name);
    } catch (error) {
      console.error('Eduvhibe download note error:', error);
      res.status(500).json({ success: false, error: 'Failed to download note' });
    }
  }

  async deleteNote(req, res) {
    try {
      const note = await EduvhibeNote.findOne({
        where: { id: req.params.id }
      });

      if (!note) {
        return res.status(404).json({ success: false, error: 'Note not found' });
      }

      const canDelete = isEduvhibeEditor(req.user) || String(note.uploader_id) === String(req.user.id);
      if (!canDelete) {
        return res.status(403).json({ success: false, error: 'Not authorized to delete this note' });
      }

      if (note.file_path && fs.existsSync(note.file_path)) {
        fs.unlinkSync(note.file_path);
      }

      await note.destroy();
      res.json({ success: true });
    } catch (error) {
      console.error('Eduvhibe delete note error:', error);
      res.status(500).json({ success: false, error: 'Failed to delete note' });
    }
  }

  async listVideos(req, res) {
    try {
      const videos = await db.EduvhibeVideo.findAll({
        where: {
          status: 'published',
          [Op.or]: [
            { section: 'eduvhibe' },
            { tags: { [Op.overlap]: EDUVHIBE_VIDEO_TAGS } },
          ],
        },
        attributes: ['id', 'title', 'description', 'level', 'video_url', 'file_url', 'metadata', 'created_at'],
        order: [['created_at', 'DESC']],
        limit: 200,
      });

      res.json({ success: true, videos: videos.map((item) => mapVideo(item.toJSON())) });
    } catch (error) {
      console.error('Eduvhibe list videos error:', error);
      res.status(500).json({ success: false, error: 'Failed to load videos' });
    }
  }

  async createVideo(req, res) {
    try {
      const { title, description, video_url, level } = req.body || {};
      if (!title || !video_url) {
        return res.status(400).json({ success: false, error: 'Title and video URL are required' });
      }

      const item = await db.EduvhibeVideo.create({
        title,
        description: description || '',
        creator_id: req.user.id,
        status: 'published',
        file_url: video_url,
        video_url,
        level: level || '100',
        section: 'eduvhibe',
        tags: EDUVHIBE_VIDEO_TAGS,
        metadata: { video_url, level: level || '100', section: 'eduvhibe' }
      });

      res.status(201).json({ success: true, video: mapVideo(item.toJSON()) });
    } catch (error) {
      console.error('Eduvhibe create video error:', error);
      res.status(500).json({ success: false, error: 'Failed to create video' });
    }
  }

  async deleteVideo(req, res) {
    try {
      const item = await db.EduvhibeVideo.findOne({
        where: {
          id: req.params.id,
          tags: { [Op.overlap]: EDUVHIBE_VIDEO_TAGS }
        }
      });

      if (!item) {
        return res.status(404).json({ success: false, error: 'Video not found' });
      }

      const canDelete = isEduvhibeEditor(req.user) || String(item.creator_id) === String(req.user.id);
      if (!canDelete) {
        return res.status(403).json({ success: false, error: 'Not authorized to delete this video' });
      }

      await item.destroy();
      res.json({ success: true });
    } catch (error) {
      console.error('Eduvhibe delete video error:', error);
      res.status(500).json({ success: false, error: 'Failed to delete video' });
    }
  }

  async listGuides(req, res) {
    try {
      const guides = await db.TextItem.findAll({
        where: {
          subtype: { [Op.in]: ['blog_post', 'guide'] },
          status: 'published',
          [Op.or]: [
            { tags: { [Op.overlap]: EDUVHIBE_GUIDE_TAGS } },
            { category: { [Op.iLike]: '%eduvhibe%' } },
          ],
        },
        attributes: ['id', 'title', 'author', 'category', 'metadata', 'thumbnail_url', 'description', 'created_at'],
        include: [{ model: User, as: 'creator', attributes: ['id', 'full_name'] }],
        order: [['created_at', 'DESC']],
        limit: 100,
      });

      res.json({ success: true, guides: guides.map((item) => mapGuide(item.toJSON())) });
    } catch (error) {
      console.error('Eduvhibe list guides error:', error);
      res.status(500).json({ success: false, error: 'Failed to load guides' });
    }
  }

  async createGuide(req, res) {
    try {
      const { title, author, category, image_url, content, read_time } = req.body || {};
      if (!title || !content) {
        return res.status(400).json({ success: false, error: 'Title and content are required' });
      }

      const item = await db.TextItem.create({
        subtype: 'guide',
        title,
        description: content.slice(0, 280),
        body: content,
        author: author || req.user.full_name || 'Eduvhibe Team',
        category: category || 'Academic',
        creator_id: req.user.id,
        status: 'published',
        thumbnail_url: image_url || null,
        tags: EDUVHIBE_GUIDE_TAGS,
        metadata: {
          author: author || req.user.full_name || 'Eduvhibe Team',
          category: category || 'Academic',
          image_url: image_url || '',
          content,
          body: content,
          read_time: read_time || '3 min read',
          section: 'eduvhibe'
        }
      });

      const created = await db.TextItem.findByPk(item.id, {
        include: [{ model: User, as: 'creator', attributes: ['id', 'full_name'] }]
      });

      res.status(201).json({ success: true, guide: mapGuide(created.toJSON()) });
    } catch (error) {
      console.error('Eduvhibe create guide error:', error);
      res.status(500).json({ success: false, error: 'Failed to publish guide' });
    }
  }

  async deleteGuide(req, res) {
    try {
      const item = await db.TextItem.findOne({
        where: {
          id: req.params.id,
          subtype: { [Op.in]: ['blog_post', 'guide'] },
          tags: { [Op.overlap]: EDUVHIBE_GUIDE_TAGS }
        }
      });

      if (!item) {
        return res.status(404).json({ success: false, error: 'Guide not found' });
      }

      const canDelete = isEduvhibeEditor(req.user) || String(item.creator_id) === String(req.user.id);
      if (!canDelete) {
        return res.status(403).json({ success: false, error: 'Not authorized to delete this guide' });
      }

      await item.destroy();
      res.json({ success: true });
    } catch (error) {
      console.error('Eduvhibe delete guide error:', error);
      res.status(500).json({ success: false, error: 'Failed to delete guide' });
    }
  }

  async listCgpaEntries(req, res) {
    try {
      const entries = await EduvhibeCgpaEntry.findAll({
        where: { user_id: req.user.id },
        order: [['semester', 'ASC'], ['created_at', 'ASC']]
      });

      res.json({ success: true, entries: entries.map((entry) => mapCgpaEntry(entry.toJSON())) });
    } catch (error) {
      console.error('Eduvhibe list CGPA error:', error);
      res.status(500).json({ success: false, error: 'Failed to load CGPA entries' });
    }
  }

  async createCgpaEntry(req, res) {
    try {
      const { semester, courseName, credits, grade, gradePoints } = req.body || {};
      if (!semester || !courseName || !credits || !grade) {
        return res.status(400).json({ success: false, error: 'Missing CGPA entry fields' });
      }

      const entry = await EduvhibeCgpaEntry.create({
        user_id: req.user.id,
        semester: Number(semester),
        course_name: courseName,
        credits: Number(credits),
        grade,
        grade_points: Number(gradePoints)
      });

      res.status(201).json({ success: true, entry: mapCgpaEntry(entry.toJSON()) });
    } catch (error) {
      console.error('Eduvhibe create CGPA error:', error);
      res.status(500).json({ success: false, error: 'Failed to save CGPA entry' });
    }
  }

  async importCgpaEntries(req, res) {
    try {
      const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
      if (!entries.length) {
        return res.json({ success: true, entries: [] });
      }

      const created = await EduvhibeCgpaEntry.bulkCreate(
        entries.map((entry) => ({
          user_id: req.user.id,
          semester: Number(entry.semester),
          course_name: entry.courseName,
          credits: Number(entry.credits),
          grade: entry.grade,
          grade_points: Number(entry.gradePoints)
        }))
      );

      res.status(201).json({
        success: true,
        entries: created.map((entry) => mapCgpaEntry(entry.toJSON()))
      });
    } catch (error) {
      console.error('Eduvhibe import CGPA error:', error);
      res.status(500).json({ success: false, error: 'Failed to import CGPA entries' });
    }
  }

  async deleteCgpaEntry(req, res) {
    try {
      const entry = await EduvhibeCgpaEntry.findOne({
        where: { id: req.params.id, user_id: req.user.id }
      });

      if (!entry) {
        return res.status(404).json({ success: false, error: 'CGPA entry not found' });
      }

      await entry.destroy();
      res.json({ success: true });
    } catch (error) {
      console.error('Eduvhibe delete CGPA error:', error);
      res.status(500).json({ success: false, error: 'Failed to delete CGPA entry' });
    }
  }

  async clearCgpaSemester(req, res) {
    try {
      const semester = Number(req.params.semester);
      await EduvhibeCgpaEntry.destroy({
        where: { user_id: req.user.id, semester }
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Eduvhibe clear CGPA semester error:', error);
      res.status(500).json({ success: false, error: 'Failed to clear semester' });
    }
  }

  async clearAllCgpa(req, res) {
    try {
      await EduvhibeCgpaEntry.destroy({
        where: { user_id: req.user.id }
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Eduvhibe clear all CGPA error:', error);
      res.status(500).json({ success: false, error: 'Failed to clear CGPA' });
    }
  }
}

module.exports = new EduvhibeController();

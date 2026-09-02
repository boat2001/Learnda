const { Op } = require('sequelize');
const { CommunityPost, CommunityReply, User } = require('../models');
const { getFileUrl } = require('../config/upload');

/** Internal marker for the single site-wide student chat anchor post (replies = chat messages). */
const STUDENT_CHAT_ANCHOR_CATEGORY = '__learnda_student_chat_anchor__';

const { processMessage, MAX_LENGTH: MESSAGE_BODY_MAX } = require('../utils/chatFilter');
const LINK_CAPTION_MAX = 50_000;
const isVoiceUploadMime = (mime) => {
  const value = String(mime || '').toLowerCase();
  return value.startsWith('audio/') || value === 'video/mp4' || value === 'video/webm';
};

const sanitizeLinkPayload = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const kind = String(raw.kind || '').toLowerCase();
  if (!['lesson', 'practice', 'edutainment'].includes(kind)) return null;
  const title = String(raw.title || '').trim().slice(0, 240);
  const url = String(raw.url || '').trim().slice(0, 2048);
  if (!title || !url) return null;
  if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) return null;
  const subtitle = String(raw.subtitle || '').trim().slice(0, 240);
  return { kind, title, url, ...(subtitle ? { subtitle } : {}) };
};

const extractLinkFromMetadata = (metadata) => {
  if (!metadata || typeof metadata !== 'object') return null;
  if (metadata.link && typeof metadata.link === 'object') {
    return sanitizeLinkPayload(metadata.link);
  }
  return sanitizeLinkPayload(metadata);
};

const normalizeMetadataStored = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {};

async function findOrCreateLoungePost() {
  let post = await CommunityPost.findOne({
    where: { category: STUDENT_CHAT_ANCHOR_CATEGORY },
    order: [['created_at', 'ASC']]
  });
  if (post) return post;

  const firstUser = await User.findOne({
    attributes: ['id'],
    order: [['created_at', 'ASC']]
  });
  if (!firstUser) return null;

  post = await CommunityPost.create({
    user_id: firstUser.id,
    title: 'Student community',
    body:
      'Welcome to the Learnda student community. Chat below — everyone sees the same room. For course-specific live chat, use study groups.',
    category: STUDENT_CHAT_ANCHOR_CATEGORY,
    last_activity_at: new Date()
  });
  return post;
}

async function createCommunityChatMessage({ lounge, userId, body, metadata = {} }) {
  const meta = normalizeMetadataStored(metadata);
  const row = await CommunityReply.create({
    post_id: lounge.id,
    user_id: userId,
    body,
    metadata: meta
  });

  lounge.replies_count += 1;
  lounge.last_activity_at = new Date();
  await lounge.save();

  const enriched = await CommunityReply.findByPk(row.id, {
    include: [{ model: User, as: 'author', attributes: ['id', 'full_name', 'avatar_url'] }]
  });
  const j = enriched ? enriched.toJSON() : row.toJSON();
  j.metadata = normalizeMetadataStored(j.metadata);
  return j;
}

function normalizeMessageRow(row) {
  const j = row.toJSON ? row.toJSON() : { ...row };
  j.metadata = normalizeMetadataStored(j.metadata);
  return j;
}

class CommunityController {
  async getChatRoom(req, res) {
    try {
      const lounge = await findOrCreateLoungePost();
      if (!lounge) {
        return res.status(503).json({ success: false, error: 'Community chat is not available yet.' });
      }

      const rawLimit = parseInt(req.query.limit, 10);
      const limit = Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(rawLimit, 50_000)
        : 10_000;
      const rows = await CommunityReply.findAll({
        where: { post_id: lounge.id },
        include: [{ model: User, as: 'author', attributes: ['id', 'full_name', 'avatar_url'] }],
        order: [['created_at', 'DESC']],
        limit
      });
      const messages = rows.map((r) => normalizeMessageRow(r)).reverse();
      res.json({
        success: true,
        message_count_total: lounge.replies_count,
        messages
      });
    } catch (error) {
      console.error('Get community chat room error:', error);
      res.status(500).json({ success: false, error: 'Failed to load community chat.' });
    }
  }

  async postChatMessage(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const { body: rawBody, metadata: rawMeta } = req.body || {};
      const text = typeof rawBody === 'string' ? rawBody.replace(/\r\n/g, '\n').trim() : String(rawBody ?? '').trim();

      const link = extractLinkFromMetadata(rawMeta || {});
      const mergedMeta = {
        ...(link ? { link } : {})
      };

      if (!text && !mergedMeta.link) {
        return res.status(400).json({ success: false, error: 'Message cannot be empty' });
      }

      const filtered = processMessage(text, userId, 'community');
      if (!filtered.valid) {
        return res.status(400).json({ success: false, error: filtered.error });
      }

      const lounge = await findOrCreateLoungePost();
      if (!lounge) {
        return res.status(503).json({ success: false, error: 'Community chat is not available yet.' });
      }

      const storedBody = filtered.body || (mergedMeta.link ? `📎 ${mergedMeta.link.title}` : '');
      if (!storedBody) {
        return res.status(400).json({ success: false, error: 'Message cannot be empty' });
      }
      if (filtered.linksNeutralized) mergedMeta.linksNeutralized = true;

      const message = await createCommunityChatMessage({
        lounge,
        userId,
        body: storedBody,
        metadata: mergedMeta
      });

      res.status(201).json({ success: true, message });
    } catch (error) {
      console.error('Post community chat message error:', error);
      res.status(500).json({ success: false, error: 'Failed to send message.' });
    }
  }

  async postChatVoice(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'Attach an audio file (field name: audio).' });
      }
      const mime = String(req.file.mimetype || '');
      if (!isVoiceUploadMime(mime)) {
        return res.status(400).json({ success: false, error: 'Only audio files are allowed.' });
      }

      const lounge = await findOrCreateLoungePost();
      if (!lounge) {
        return res.status(503).json({ success: false, error: 'Community chat is not available yet.' });
      }

      const url = getFileUrl(req.file);
      const caption = String(req.body?.caption ?? '').trim().slice(0, LINK_CAPTION_MAX);
      const body = caption || '🎤 Voice message';
      const metadata = {
        voice: {
          url,
          mime_type: mime || 'audio/webm'
        }
      };

      const message = await createCommunityChatMessage({ lounge, userId, body, metadata });
      res.status(201).json({ success: true, message });
    } catch (error) {
      console.error('Post community voice error:', error);
      res.status(500).json({ success: false, error: 'Failed to upload voice note.' });
    }
  }

  async postChatFile(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'Attach a file (field name: file).' });
      }
      const FILE_SIZE_LIMIT = 200 * 1024 * 1024;
      if (req.file.size > FILE_SIZE_LIMIT) {
        return res.status(400).json({ success: false, error: 'File exceeds the 200 MB limit.' });
      }

      const lounge = await findOrCreateLoungePost();
      if (!lounge) {
        return res.status(503).json({ success: false, error: 'Community chat is not available yet.' });
      }

      const url = getFileUrl(req.file);
      const caption = String(req.body?.caption ?? '').trim().slice(0, LINK_CAPTION_MAX);
      const name = req.file.originalname || 'attachment';
      const body = caption || `📎 ${name}`;
      const metadata = {
        file: {
          url,
          name,
          mime_type: req.file.mimetype || 'application/octet-stream',
          size: req.file.size || 0
        }
      };

      const message = await createCommunityChatMessage({ lounge, userId, body, metadata });
      res.status(201).json({ success: true, message });
    } catch (error) {
      console.error('Post community file error:', error);
      res.status(500).json({ success: false, error: 'Failed to upload file.' });
    }
  }

  async listPosts(req, res) {
    try {
      const posts = await CommunityPost.findAll({
        where: {
          [Op.or]: [{ category: null }, { category: '' }, { category: { [Op.ne]: STUDENT_CHAT_ANCHOR_CATEGORY } }]
        },
        include: [{ model: User, as: 'author', attributes: ['id', 'full_name', 'avatar_url'] }],
        order: [['last_activity_at', 'DESC'], ['created_at', 'DESC']]
      });
      res.json({ success: true, posts });
    } catch (error) {
      console.error('List community posts error:', error);
      res.status(500).json({ success: false, error: 'Failed to load posts' });
    }
  }

  async createPost(req, res) {
    try {
      const userId = req.user?.id;
      const { title, body, category } = req.body || {};
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }
      if (!title || !body) {
        return res.status(400).json({ success: false, error: 'Title and body are required' });
      }

      const post = await CommunityPost.create({
        user_id: userId,
        title,
        body,
        category,
        last_activity_at: new Date()
      });

      res.status(201).json({ success: true, post });
    } catch (error) {
      console.error('Create community post error:', error);
      res.status(500).json({ success: false, error: 'Failed to create post' });
    }
  }

  async getPost(req, res) {
    try {
      const { id } = req.params;
      const post = await CommunityPost.findByPk(id, {
        include: [
          { model: User, as: 'author', attributes: ['id', 'full_name', 'avatar_url'] },
          {
            model: CommunityReply,
            as: 'replies',
            include: [{ model: User, as: 'author', attributes: ['id', 'full_name', 'avatar_url'] }],
            order: [['created_at', 'ASC']]
          }
        ]
      });
      if (!post) {
        return res.status(404).json({ success: false, error: 'Post not found' });
      }
      res.json({ success: true, post });
    } catch (error) {
      console.error('Get community post error:', error);
      res.status(500).json({ success: false, error: 'Failed to load post' });
    }
  }

  async addReply(req, res) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;
      const { body } = req.body || {};
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }
      if (!body) {
        return res.status(400).json({ success: false, error: 'Reply body is required' });
      }

      const post = await CommunityPost.findByPk(id);
      if (!post) {
        return res.status(404).json({ success: false, error: 'Post not found' });
      }

      const reply = await createCommunityChatMessage({
        lounge: post,
        userId,
        body,
        metadata: {}
      });

      res.status(201).json({ success: true, reply });
    } catch (error) {
      console.error('Add community reply error:', error);
      res.status(500).json({ success: false, error: 'Failed to add reply' });
    }
  }
}

module.exports = new CommunityController();

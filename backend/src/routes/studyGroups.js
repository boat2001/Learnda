const express = require('express');
const { authenticate } = require('../middleware/auth');
const { upload, getFileUrl } = require('../config/upload');
const {
  fetchCurrentStudyGroups,
  discoverStudyGroups,
  joinStudyGroup,
  leaveStudyGroup,
  fetchStudyGroupRoom,
  listStudyGroupMessages,
  postStudyGroupMessage,
  postStudyGroupVoiceMessage,
  postStudyGroupFileMessage
} = require('../services/studyGroupService');

const router = express.Router();

const RESERVED_GROUP_SEGMENTS = new Set(['current', 'discover', 'join', 'leave', 'messages']);
const isVoiceUploadMime = (mime) => {
  const value = String(mime || '').toLowerCase();
  return value.startsWith('audio/') || value === 'video/mp4' || value === 'video/webm';
};

const respondWithCurrentGroups = async (req, res) => {
  try {
    const payload = await fetchCurrentStudyGroups({
      user: req.user,
      query: req.query
    });

    return res.json({
      success: true,
      data: {
        groups: payload.groups,
        academic_profile: payload.academicProfile,
        resolved_program_categories: payload.resolvedProgramCategories,
        missing_profile: payload.missingProfile
      }
    });
  } catch (error) {
    console.error('Current study groups error:', error);
    return res.status(500).json({ success: false, error: 'Failed to load study groups' });
  }
};

router.get('/', authenticate, respondWithCurrentGroups);
router.get('/current', authenticate, respondWithCurrentGroups);

router.get('/discover', authenticate, async (req, res) => {
  try {
    const payload = await discoverStudyGroups({
      user: req.user,
      query: req.query
    });
    return res.json({ success: true, data: payload });
  } catch (error) {
    console.error('Discover study groups error:', error);
    return res.status(500).json({ success: false, error: 'Failed to load study groups' });
  }
});

router.post('/:groupId/join', authenticate, async (req, res) => {
  try {
    const group = await joinStudyGroup({
      user: req.user,
      groupId: req.params.groupId
    });
    return res.json({ success: true, data: { group } });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to join study group'
    });
  }
});

router.post('/:groupId/leave', authenticate, async (req, res) => {
  try {
    const group = await leaveStudyGroup({
      user: req.user,
      groupId: req.params.groupId
    });
    return res.json({ success: true, data: { group } });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to leave study group'
    });
  }
});

router.get('/:groupId/messages', authenticate, async (req, res) => {
  if (RESERVED_GROUP_SEGMENTS.has(String(req.params.groupId || '').toLowerCase())) {
    return res.status(404).json({ success: false, error: 'Not found' });
  }
  try {
    const messages = await listStudyGroupMessages({
      user: req.user,
      groupId: req.params.groupId,
      before: req.query.before || null
    });
    return res.json({ success: true, data: { messages } });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to load messages'
    });
  }
});

router.post('/:groupId/messages', authenticate, async (req, res) => {
  if (RESERVED_GROUP_SEGMENTS.has(String(req.params.groupId || '').toLowerCase())) {
    return res.status(404).json({ success: false, error: 'Not found' });
  }
  try {
    const message = await postStudyGroupMessage({
      user: req.user,
      groupId: req.params.groupId,
      body: req.body?.body,
      metadata: req.body?.metadata || {}
    });
    return res.status(201).json({ success: true, data: { message } });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to send message'
    });
  }
});

router.post(
  '/:groupId/messages/voice',
  authenticate,
  upload.single('audio'),
  async (req, res) => {
    if (RESERVED_GROUP_SEGMENTS.has(String(req.params.groupId || '').toLowerCase())) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'Attach an audio file (field name: audio).' });
      }
      const mime = String(req.file.mimetype || '');
      if (!isVoiceUploadMime(mime)) {
        return res.status(400).json({ success: false, error: 'Only audio files are allowed.' });
      }
      const url = getFileUrl(req.file);
      const message = await postStudyGroupVoiceMessage({
        user: req.user,
        groupId: req.params.groupId,
        fileUrl: url,
        mimeType: mime,
        caption: req.body?.caption
      });
      return res.status(201).json({ success: true, data: { message } });
    } catch (error) {
      return res.status(error.status || 500).json({
        success: false,
        error: error.message || 'Failed to upload voice note'
      });
    }
  }
);

router.post(
  '/:groupId/messages/file',
  authenticate,
  upload.single('file'),
  async (req, res) => {
    if (RESERVED_GROUP_SEGMENTS.has(String(req.params.groupId || '').toLowerCase())) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'Attach a file (field name: file).' });
      }
      const FILE_SIZE_LIMIT = 20 * 1024 * 1024; // 20 MB
      if (req.file.size > FILE_SIZE_LIMIT) {
        return res.status(400).json({ success: false, error: 'File exceeds the 20 MB limit.' });
      }
      const url = getFileUrl(req.file);
      const message = await postStudyGroupFileMessage({
        user: req.user,
        groupId: req.params.groupId,
        fileUrl: url,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        caption: req.body?.caption
      });
      return res.status(201).json({ success: true, data: { message } });
    } catch (error) {
      return res.status(error.status || 500).json({
        success: false,
        error: error.message || 'Failed to upload file'
      });
    }
  }
);

router.get('/:groupId', authenticate, async (req, res) => {
  if (RESERVED_GROUP_SEGMENTS.has(String(req.params.groupId || '').toLowerCase())) {
    return res.status(404).json({ success: false, error: 'Not found' });
  }
  try {
    const room = await fetchStudyGroupRoom({
      user: req.user,
      groupId: req.params.groupId
    });
    return res.json({ success: true, data: room });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to load study group'
    });
  }
});

module.exports = router;

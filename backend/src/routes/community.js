const router = require('express').Router();
const communityController = require('../controllers/communityController');
const { authenticate } = require('../middleware/auth');
const { upload, uploadCommunity } = require('../config/upload');

router.get('/chat-room', communityController.getChatRoom);
router.post(
  '/chat-room/messages',
  authenticate,
  communityController.postChatMessage
);
router.post(
  '/chat-room/messages/voice',
  authenticate,
  upload.single('audio'),
  communityController.postChatVoice
);
router.post(
  '/chat-room/messages/file',
  authenticate,
  uploadCommunity.single('file'),
  communityController.postChatFile
);

router.get('/posts', communityController.listPosts);
router.post('/posts', authenticate, communityController.createPost);
router.get('/posts/:id', communityController.getPost);
router.post('/posts/:id/replies', authenticate, communityController.addReply);

module.exports = router;

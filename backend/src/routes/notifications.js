const router = require('express').Router();
const notificationController = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, notificationController.list);
router.post('/read-all', authenticate, notificationController.markAllRead);
router.post('/:id/read', authenticate, notificationController.markRead);
router.post('/push-token', authenticate, notificationController.registerPushToken);

module.exports = router;

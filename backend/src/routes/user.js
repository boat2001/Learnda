const router = require('express').Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');
const { upload, handleUploadError } = require('../config/upload');

router.get('/preferences', authenticate, userController.getPreferences);
router.post('/preferences', authenticate, userController.updatePreferences);
router.post('/change-password', authenticate, userController.changePassword);
router.delete('/account', authenticate, userController.deleteAccount);
router.post('/avatar', authenticate, upload.single('avatar'), handleUploadError, userController.updateAvatar);

module.exports = router;

const router = require('express').Router();
const resourceController = require('../controllers/resourceController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { upload } = require('../config/upload');

router.get('/files', optionalAuth, resourceController.list);
router.get('/accessed-ids', authenticate, resourceController.getAccessedFileIds);
router.post('/:id/view', optionalAuth, resourceController.trackView);
router.post('/upload', authenticate, upload.single('file'), resourceController.upload);
router.get('/download/:id', optionalAuth, resourceController.download);
router.delete('/:id', authenticate, resourceController.remove);

module.exports = router;

const router = require('express').Router();
const eduvhibeController = require('../controllers/eduvhibeController');
const { authenticate, checkRole, optionalAuth } = require('../middleware/auth');
const { upload } = require('../config/upload');

router.get('/notes', optionalAuth, eduvhibeController.listNotes);
router.post('/notes', authenticate, checkRole('admin', 'contributor'), upload.single('file'), eduvhibeController.uploadNote);
router.get('/notes/:id/download', optionalAuth, eduvhibeController.downloadNote);
router.delete('/notes/:id', authenticate, eduvhibeController.deleteNote);

router.get('/videos', optionalAuth, eduvhibeController.listVideos);
router.post('/videos', authenticate, checkRole('admin', 'contributor'), eduvhibeController.createVideo);
router.delete('/videos/:id', authenticate, eduvhibeController.deleteVideo);

router.get('/guides', optionalAuth, eduvhibeController.listGuides);
router.post('/guides', authenticate, checkRole('admin', 'contributor'), eduvhibeController.createGuide);
router.delete('/guides/:id', authenticate, eduvhibeController.deleteGuide);

router.get('/cgpa', authenticate, eduvhibeController.listCgpaEntries);
router.post('/cgpa', authenticate, eduvhibeController.createCgpaEntry);
router.post('/cgpa/import', authenticate, eduvhibeController.importCgpaEntries);
router.delete('/cgpa/:id', authenticate, eduvhibeController.deleteCgpaEntry);
router.delete('/cgpa/semester/:semester', authenticate, eduvhibeController.clearCgpaSemester);
router.delete('/cgpa', authenticate, eduvhibeController.clearAllCgpa);

module.exports = router;

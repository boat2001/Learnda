const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const meController = require('../controllers/meController');

router.get('/', authenticate, meController.getMe);
router.get('/academic-catalog', authenticate, meController.getAcademicCatalog);
router.patch('/profile', authenticate, authLimiter, meController.updateProfile);
router.patch('/academic', authenticate, authLimiter, meController.updateAcademic);
router.post('/academic-state-notice/seen', authenticate, authLimiter, meController.markAcademicStateNoticeSeen);
router.patch('/password', authenticate, authLimiter, meController.updatePassword);
router.post('/select-plan', authenticate, authLimiter, meController.selectPlan);

module.exports = router;

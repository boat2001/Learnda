const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const meController = require('../controllers/meController');

router.get('/', authenticate, meController.getMe);
router.patch('/profile', authenticate, authLimiter, meController.updateProfile);
// PUT, not PATCH: class placement is set once, never edited (§1.4).
router.put('/class-placement', authenticate, authLimiter, meController.setClassPlacement);
router.post('/promotion-notice/seen', authenticate, authLimiter, meController.markPromotionNoticeSeen);
router.patch('/password', authenticate, authLimiter, meController.updatePassword);
router.post('/select-plan', authenticate, authLimiter, meController.selectPlan);

module.exports = router;

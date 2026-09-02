const router = require('express').Router();
const commentController = require('../controllers/commentController');
const { authenticate } = require('../middleware/auth');
const { requirePlanFeature } = require('../middleware/planAccess');

router.post('/:id/upvote', authenticate, requirePlanFeature('commenting'), commentController.upvote);
router.delete('/:id', authenticate, commentController.remove);

module.exports = router;

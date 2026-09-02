const router = require('express').Router();
const supportController = require('../controllers/supportController');
const { optionalAuth } = require('../middleware/auth');

router.get('/success-stories', supportController.listSuccessStories);
router.post('/report', optionalAuth, supportController.submitReport);

module.exports = router;

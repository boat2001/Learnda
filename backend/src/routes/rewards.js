const router = require('express').Router();
const rewardController = require('../controllers/rewardController');
const { authenticate } = require('../middleware/auth');

router.get('/summary', authenticate, rewardController.summary);
router.get('/transactions', authenticate, rewardController.transactions);
router.get('/payouts', authenticate, rewardController.payouts);
router.post('/claim', authenticate, rewardController.claim);
router.post('/payout-contact', authenticate, rewardController.setPayoutContact);
router.post('/payout', authenticate, rewardController.requestPayout);
router.post('/referral-download', rewardController.trackReferralDownload);

module.exports = router;

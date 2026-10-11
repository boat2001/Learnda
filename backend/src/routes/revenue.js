const express = require('express');
const router = express.Router();
const { authenticate, checkRole } = require('../middleware/auth');
const revenueService = require('../services/revenueService');
const logger = require('../config/logger');
const { Subscription, Plan, RewardPayout, User } = require('../models');
const { findById } = require('../utils/contentLookup');

router.get('/earnings', authenticate, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const subscription = await Subscription.findOne({
      where: { user_id: req.user.id, status: 'active' },
      include: [{ model: Plan, as: 'plan' }]
    });

    const planName = subscription?.plan?.name || req.user.current_plan || 'Basic Student';
    const sharePercentage = revenueService.getRevenueSharePercentage(planName);
    if (sharePercentage === 0) {
      return res.status(403).json({
        success: false,
        error: 'Your current plan does not support contributor earnings. Upgrade to Serious Student or Master Student.'
      });
    }

    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date();

    const earnings = await revenueService.calculateContributorEarnings(req.user.id, planName, start, end);

    res.json({ success: true, data: earnings });
  } catch (error) {
    logger.error('Error fetching earnings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/stats', authenticate, async (req, res) => {
  try {
    const stats = await revenueService.getContributorStats(req.user.id);
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Error fetching contributor stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/payouts', authenticate, async (req, res) => {
  try {
    const { limit = 12 } = req.query;
    const payouts = await revenueService.getPayoutHistory(req.user.id, parseInt(limit, 10));
    res.json({ success: true, data: payouts });
  } catch (error) {
    logger.error('Error fetching payout history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/content/:contentId/earnings', authenticate, async (req, res) => {
  try {
    const { contentId } = req.params;

    const db = require('../models');
    const content = await findById(db, contentId);
    if (!content) {
      return res.status(404).json({ success: false, error: 'Content not found' });
    }

    if (String(content.creator_id) !== String(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const earnings = await revenueService.calculateContentEarnings(contentId);
    res.json({ success: true, data: earnings });
  } catch (error) {
    logger.error('Error fetching content earnings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/process-payouts', authenticate, checkRole(['admin']), async (req, res) => {
  try {
    const result = await revenueService.processMonthlyPayouts();
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error processing payouts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/pending-payouts', authenticate, checkRole(['admin']), async (req, res) => {
  try {
    const pendingPayouts = await RewardPayout.findAll({
      where: { status: 'requested' },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'full_name', 'email']
      }],
      order: [['requested_at', 'DESC']]
    });

    res.json({ success: true, data: pendingPayouts });
  } catch (error) {
    logger.error('Error fetching pending payouts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/payouts/:payoutId', authenticate, checkRole(['admin']), async (req, res) => {
  try {
    const { payoutId } = req.params;
    const { status } = req.body;

    const payout = await RewardPayout.findByPk(payoutId);
    if (!payout) {
      return res.status(404).json({ success: false, error: 'Payout not found' });
    }

    payout.status = status || 'paid';
    payout.processed_at = new Date();
    await payout.save();

    res.json({ success: true, data: payout });
  } catch (error) {
    logger.error('Error updating payout:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

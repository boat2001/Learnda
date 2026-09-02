const express = require('express');
const analyticsService = require('../services/analyticsService');
const { authenticate, optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/event', async (req, res) => {
  try {
    const { eventName, properties } = req.body || {};

    await analyticsService.trackEvent({
      event_type: eventName || 'event',
      event_data: properties || {},
      user_id: properties?.user_id,
      visitor_id: properties?.visitor_id,
      session_id: properties?.session_id,
      page_url: properties?.url,
      referrer_url: properties?.referrer,
      user_agent: properties?.user_agent,
      ip_address: req.ip
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Analytics event error:', error);
    res.status(500).json({ success: false, error: 'Failed to track event' });
  }
});

router.post('/pageview', async (req, res) => {
  try {
    const { page, properties } = req.body || {};

    await analyticsService.trackEvent({
      event_type: 'page_view',
      event_data: { page, ...(properties || {}) },
      user_id: properties?.user_id,
      visitor_id: properties?.visitor_id,
      session_id: properties?.session_id,
      page_url: properties?.url,
      referrer_url: properties?.referrer,
      user_agent: properties?.user_agent,
      ip_address: req.ip
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Analytics pageview error:', error);
    res.status(500).json({ success: false, error: 'Failed to track pageview' });
  }
});

router.get('/usage', optionalAuth, async (req, res) => {
  try {
    const range = req.query.range || '30d';
    const data = await analyticsService.getPlatformAnalytics(range);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Analytics usage error:', error);
    res.status(500).json({ success: false, error: 'Failed to load usage analytics' });
  }
});

router.get('/learning', authenticate, async (req, res) => {
  try {
    const data = await analyticsService.getUserLearningPatterns(req.user.id);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Analytics learning error:', error);
    res.status(500).json({ success: false, error: 'Failed to load learning analytics' });
  }
});

module.exports = router;

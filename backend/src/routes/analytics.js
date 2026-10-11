const express = require('express');
const analyticsService = require('../services/analyticsService');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { sequelize } = require('../models');

const router = express.Router();

router.get('/rating-summary', async (req, res) => {
  try {
    const [rows] = await sequelize.query(`
      SELECT COUNT(rating)::integer AS count, ROUND(AVG(rating), 1) AS average
      FROM (
        SELECT CASE WHEN event_data->>'rating' ~ '^[1-5]$'
          THEN (event_data->>'rating')::integer ELSE NULL END AS rating
        FROM events WHERE event_type = 'platform_rating'
      ) AS ratings
    `);
    const count = Number(rows[0]?.count || 0);
    res.json({ success: true, count, average: count ? Number(rows[0].average) : null });
  } catch (error) {
    console.error('Rating summary error:', error);
    res.status(500).json({ success: false, error: 'Unable to load ratings' });
  }
});

router.post('/event', async (req, res) => {
  try {
    const { eventName, properties } = req.body || {};

    if (eventName === 'platform_rating' && (!Number.isInteger(properties?.rating) || properties.rating < 1 || properties.rating > 5)) {
      return res.status(400).json({ success: false, error: 'Choose a rating from 1 to 5' });
    }

    const event = await analyticsService.trackEvent({
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

    if (eventName === 'platform_rating' && !event) {
      return res.status(500).json({ success: false, error: 'Failed to save rating' });
    }

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

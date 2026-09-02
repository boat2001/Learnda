const express = require('express');
const crypto = require('crypto');
const subscriptionLifecycleScheduler = require('../services/subscriptionLifecycleScheduler');

const router = express.Router();

const safeEqual = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const requireCronSecret = (req, res, next) => {
  const secret = String(process.env.CRON_SECRET || '');
  const authorization = String(req.headers.authorization || '');
  const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';

  if (!secret || !safeEqual(supplied, secret)) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  return next();
};

router.get('/subscriptions', requireCronSecret, async (req, res, next) => {
  try {
    await subscriptionLifecycleScheduler.runSweep();
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

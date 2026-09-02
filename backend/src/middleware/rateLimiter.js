const logger = require('../config/logger');

const createRateLimiter = ({
  windowMs,
  max,
  keyGenerator = (req) => req.ip,
  message,
  skip,
  skipSuccessfulRequests = false,
}) => {
  const store = new Map();
  let lastCleanup = Date.now();

  const cleanup = (now) => {
    if (now - lastCleanup < windowMs) return;
    lastCleanup = now;
    for (const [key, entry] of store.entries()) {
      if (now > entry.resetAt) {
        store.delete(key);
      }
    }
  };

  return (req, res, next) => {
    try {
      if (skip && skip(req)) {
        return next();
      }

      const now = Date.now();
      cleanup(now);

      const key = keyGenerator(req) || req.ip;
      const existing = store.get(key);
      let entry = existing;

      if (!entry || now > entry.resetAt) {
        entry = { count: 0, resetAt: now + windowMs };
      }

      const remaining = Math.max(0, max - entry.count);
      res.set('RateLimit-Limit', String(max));
      res.set('RateLimit-Remaining', String(remaining));
      res.set('RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

      if (entry.count >= max) {
        return res.status(429).json(
          message || {
            success: false,
            error: 'Too many requests, please try again later.'
          }
        );
      }

      if (skipSuccessfulRequests) {
        res.on('finish', () => {
          if (res.statusCode >= 400) {
            const current = store.get(key) || entry;
            current.count += 1;
            store.set(key, current);
          }
        });
        store.set(key, entry);
        return next();
      }

      entry.count += 1;
      store.set(key, entry);
      return next();
    } catch (error) {
      logger.error('Rate limiter error:', error);
      return next();
    }
  };
};

const authLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 8,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    error: 'Too many login attempts, please try again later.'
  }
});

const subscriptionLimiter = createRateLimiter({
  windowMs: 24 * 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: {
    success: false,
    error: 'Too many subscription changes, please try again tomorrow.'
  }
});

const visitorLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 50,
  skip: (req) => !!req.user,
  message: {
    success: false,
    error: 'Too many requests, please sign in for higher limits.'
  }
});

module.exports = {
  authLimiter,
  subscriptionLimiter,
  visitorLimiter
};

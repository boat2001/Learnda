const jwt = require('jsonwebtoken');
const { User, Subscription, Plan } = require('../models');
const subscriptionService = require('../services/subscriptionService');
const config = require('../config/env');
const { hasContributorAccess } = require('../utils/contributorAccess');

// How often we refresh last_active_at for an authenticated user. Keeps DAU/WAU/MAU
// analytics accurate (real activity, not just fresh logins) without a write per request.
const LAST_ACTIVE_THROTTLE_MS = 10 * 60 * 1000;

const touchLastActive = (user) => {
  if (!user?.id) return;
  const now = Date.now();
  const last = user.last_active_at ? new Date(user.last_active_at).getTime() : 0;
  if (now - last < LAST_ACTIVE_THROTTLE_MS) return;
  const stamp = new Date(now);
  user.last_active_at = stamp;
  // Fire-and-forget: analytics freshness must never block or break the request.
  User.update({ last_active_at: stamp }, { where: { id: user.id } }).catch(() => {});
};

const getAccountAccessError = (user) => {
  if (!user) return null;
  const status = user.account_status || 'active';
  if (status === 'deleted') return 'This account has been removed.';
  if (status === 'blocked') return 'This account has been blocked.';
  if (status === 'suspended') {
    const until = user.suspended_until ? new Date(user.suspended_until) : null;
    if (!until || until > new Date()) {
      return until
        ? `This account is suspended until ${until.toISOString()}.`
        : 'This account is suspended.';
    }
  }
  return null;
};

const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch {
      return res.status(401).json({ success: false, error: 'Invalid authentication token' });
    }

    const user = await User.findByPk(decoded.userId, {
      include: [
        {
          model: Subscription,
          as: 'subscription',
          include: [{ model: Plan, as: 'plan' }]
        }
      ]
    });

    if (!user || !decoded.sessionToken) {
      return res.status(401).json({ success: false, error: 'Invalid authentication token' });
    }

    if (decoded.sessionToken !== user.session_token) {
      return res.status(401).json({ success: false, error: 'Session replaced by new login' });
    }

    const accessError = getAccountAccessError(user);
    if (accessError) {
      return res.status(403).json({ success: false, error: accessError });
    }

    if (user.subscription?.expires_at && new Date(user.subscription.expires_at) < new Date()) {
      await subscriptionService.handleExpiredSubscription(user.subscription);
      const refreshed = await User.findByPk(decoded.userId, {
        include: [
          {
            model: Subscription,
            as: 'subscription',
            include: [{ model: Plan, as: 'plan' }]
          }
        ]
      });
      req.user = refreshed || user;
    } else {
      req.user = user;
    }

    touchLastActive(req.user);

    req.token = token;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid authentication token'
    });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      const decoded = jwt.verify(token, config.jwt.secret);
      const user = await User.findByPk(decoded.userId, {
        include: [
          {
            model: Subscription,
            as: 'subscription',
            include: [{ model: Plan, as: 'plan' }]
          }
        ]
      });

      if (user && decoded.sessionToken && decoded.sessionToken === user.session_token) {
        if (getAccountAccessError(user)) {
          return next();
        }
        if (user.subscription?.expires_at && new Date(user.subscription.expires_at) < new Date()) {
          await subscriptionService.handleExpiredSubscription(user.subscription);
          const refreshed = await User.findByPk(decoded.userId, {
            include: [
              {
                model: Subscription,
                as: 'subscription',
                include: [{ model: Plan, as: 'plan' }]
              }
            ]
          });
          req.user = refreshed || user;
        } else {
          req.user = user;
        }
        touchLastActive(req.user);
        req.token = token;
      }
    }

    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
};

const checkRole = (...roles) => {
  const allowedRoles = roles.flatMap((role) => (Array.isArray(role) ? role : [role]));

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const hasRole = allowedRoles.some((role) => {
      if (role === 'contributor') return hasContributorAccess(req.user);
      return req.user.role === role;
    });

    if (!hasRole) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    next();
  };
};

module.exports = {
  authenticate,
  optionalAuth,
  checkRole
};

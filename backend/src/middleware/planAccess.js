const { Op } = require('sequelize');
const { PLSItem, Contribution } = require('../models');
const subscriptionService = require('../services/subscriptionService');

const normalizePlan = (plan) => {
  if (!plan) return null;
  const features = Array.isArray(plan.features) ? plan.features : [];
  const hasFeature =
    typeof plan.hasFeature === 'function'
      ? (key) => plan.hasFeature(key)
      : (key) => features.some((f) => f.feature_key === key && f.enabled);
  const getFeatureConfig =
    typeof plan.getFeatureConfig === 'function'
      ? (key) => plan.getFeatureConfig(key)
      : (key) => features.find((f) => f.feature_key === key)?.config || null;
  return {
    ...plan,
    features,
    hasFeature,
    getFeatureConfig
  };
};

const requirePlanFeature = (featureKey) => async (req, res, next) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (String(req.user.role || '').toLowerCase() === 'admin') {
      return next();
    }

    const plan = req.userPlan || normalizePlan(await subscriptionService.getUserPlan(req.user.id));
    req.userPlan = plan;

    if (!plan?.hasFeature?.(featureKey)) {
      return res.status(403).json({
        success: false,
        error: `Your plan does not include "${featureKey}". Please upgrade to continue.`
      });
    }

    return next();
  } catch (error) {
    console.error('Plan feature check error:', error);
    return res.status(500).json({ success: false, error: 'Failed to validate plan feature' });
  }
};

const enforcePlsLimit = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (String(req.user.role || '').toLowerCase() === 'admin') {
      return next();
    }

    const plan = req.userPlan || normalizePlan(await subscriptionService.getUserPlan(req.user.id));
    req.userPlan = plan;

    const limit = plan?.max_pls_items;
    if (limit == null) return next();

    const currentCount = await PLSItem.count({ where: { user_id: req.user.id } });
    if (currentCount >= Number(limit)) {
      return res.status(403).json({
        success: false,
        error: 'PLS item limit reached. Please upgrade your plan.'
      });
    }

    return next();
  } catch (error) {
    console.error('PLS limit check error:', error);
    return res.status(500).json({ success: false, error: 'Failed to check PLS limit' });
  }
};

const enforceContributionLimit = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (String(req.user.role || '').toLowerCase() === 'admin') {
      return next();
    }

    const plan = req.userPlan || normalizePlan(await subscriptionService.getUserPlan(req.user.id));
    req.userPlan = plan;

    const limit = plan?.max_contributions;
    if (limit == null) return next();

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const contributionCount = await Contribution.count({
      where: {
        uploader_id: req.user.id,
        created_at: { [Op.gte]: startOfMonth }
      }
    });

    if (contributionCount >= Number(limit)) {
      return res.status(403).json({
        success: false,
        error: 'Monthly contribution limit reached. Please upgrade your plan.'
      });
    }

    return next();
  } catch (error) {
    console.error('Contribution limit check error:', error);
    return res.status(500).json({ success: false, error: 'Failed to check contribution limit' });
  }
};

module.exports = {
  requirePlanFeature,
  enforcePlsLimit,
  enforceContributionLimit
};

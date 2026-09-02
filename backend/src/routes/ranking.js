// routes/ranking.js
const express = require('express');
const router = express.Router();
const { optionalAuth, authenticate, checkRole } = require('../middleware/auth');
const { requirePlanFeature } = require('../middleware/planAccess');
const contentRankerService = require('../services/contentRankerService');
const subscriptionService = require('../services/subscriptionService');
const logger = require('../config/logger');

/**
 * Get ranked content
 * GET /ranking/content
 * Query: { limit?: 50, offset?: 0, trending?: boolean }
 */
router.get('/content', optionalAuth, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const user = req.user;

    let content;

    if (user) {
      const plan = await subscriptionService.getUserPlan(user.id);
      const hasPersonalization = plan?.hasFeature
        ? plan.hasFeature('personalization')
        : plan?.features?.some((f) => f.feature_key === 'personalization' && f.enabled);

      if (hasPersonalization) {
        content = await contentRankerService.getPersonalizedRanking(
          user.id,
          parseInt(limit),
          parseInt(offset)
        );
      } else {
        content = await contentRankerService.getGenericRanking(
          parseInt(limit),
          parseInt(offset)
        );
      }
    } else {
      content = await contentRankerService.getGenericRanking(
        parseInt(limit),
        parseInt(offset)
      );
    }

    res.json({
      success: true,
      data: {
        content,
        count: content.length,
        userAuthenticated: !!user
      }
    });
  } catch (error) {
    logger.error('Error getting ranked content:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Get trending content
 * GET /ranking/trending
 * Query: { period?: '24h|7d|30d', limit?: 20 }
 */
router.get('/trending', async (req, res) => {
  try {
    const { period = '7d', limit = 20 } = req.query;

    const trending = await contentRankerService.getTrendingContent(period, parseInt(limit));

    res.json({
      success: true,
      data: {
        period,
        trending,
        count: trending.length
      }
    });
  } catch (error) {
    logger.error('Error getting trending content:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Get recommended content for user
 * GET /ranking/recommended
 * Query: { limit?: 10 }
 */
router.get('/recommended', authenticate, requirePlanFeature('personalization'), async (req, res) => {
  try {
    const user = req.user;
    const { limit = 10 } = req.query;

    const recommended = await contentRankerService.getRecommendedContent(
      user.id,
      parseInt(limit)
    );

    res.json({
      success: true,
      data: recommended
    });
  } catch (error) {
    logger.error('Error getting recommended content:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Get content by category
 * GET /ranking/category/:category
 * Query: { limit?: 50, offset?: 0 }
 */
router.get('/category/:category', optionalAuth, async (req, res) => {
  try {
    const { category } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const user = req.user;

    const db = require('../models');
    const { Op } = require('sequelize');
    const { sequelize } = db;

    const conditions = [
      `ac.status = 'published'`,
      `ac.category ILIKE :catSearch`
    ];
    const replacements = { catSearch: `%${category}%`, lim: parseInt(limit), off: parseInt(offset) };

    // Apply subscription depth level filtering
    if (user) {
      const subscription = await db.Subscription.findOne({
        where: { user_id: user.id },
        include: [{ model: db.Plan, as: 'plan' }]
      });

      if (subscription && subscription.plan) {
        const depthLevels = contentRankerService.getAllowedDepthLevels(subscription.plan.name);
        conditions.push(`ac.depth_level = ANY(:depthLevels::text[])`);
        replacements.depthLevels = depthLevels;
      }
    } else {
      conditions.push(`ac.depth_level = 'basic'`);
    }

    const content = await sequelize.query(
      `SELECT ac.*, cs.total_views, cs.like_count, cs.save_count
       FROM all_content ac
       LEFT JOIN content_stats cs ON cs.content_id = ac.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ac.created_at DESC
       LIMIT :lim OFFSET :off`,
      { replacements, type: sequelize.QueryTypes.SELECT }
    );

    res.json({
      success: true,
      data: {
        category,
        content,
        count: content.length
      }
    });
  } catch (error) {
    logger.error('Error getting category content:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Get college rankings with real platform signals
 * GET /ranking/colleges
 * Query: { limit?: 50, offset?: 0, search?: string }
 */
router.get('/colleges', optionalAuth, async (req, res) => {
  try {
    const { limit = 50, offset = 0, search } = req.query;
    const db = require('../models');
    const sequelize = db.sequelize;
    const models = sequelize.models;
    const { Op, QueryTypes } = require('sequelize');

    const where = {};
    if (search) {
      where.name = { [Op.iLike]: `%${search}%` };
    }

    // Fetch institutions and platform signal aggregates in parallel
    const [rows, userCountRows, contentCountRows] = await Promise.all([
      models.Institution.findAll({
        where,
        order: [['name', 'ASC']],
        limit: parseInt(limit),
        offset: parseInt(offset),
      }),
      sequelize.query(
        `SELECT institution_id::text, COUNT(id)::int AS user_count
         FROM users
         WHERE institution_id IS NOT NULL
         GROUP BY institution_id`,
        { type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT u.institution_id::text, COUNT(ac.id)::int AS content_count
         FROM all_content ac
         JOIN users u ON ac.creator_id = u.id
         WHERE u.institution_id IS NOT NULL
         GROUP BY u.institution_id`,
        { type: QueryTypes.SELECT }
      ),
    ]);

    const userCountMap = Object.fromEntries(userCountRows.map((r) => [r.institution_id, r.user_count]));
    const contentCountMap = Object.fromEntries(contentCountRows.map((r) => [r.institution_id, r.content_count]));

    const colleges = rows.map((item) => {
      const meta = item.metadata || {};
      const signals = meta.signals || {};
      return {
        id: item.id,
        name: item.name,
        alias: meta.alias || null,
        index_code: meta.index_code || meta.college_code || meta.short_code || meta.abbr || null,
        affiliate_university: meta.affiliate_university || meta.affiliated_university || null,
        motto: meta.motto || null,
        description: meta.brief || meta.description || null,
        image_url: meta.image_url || null,
        image_alt: meta.image_alt || null,
        est_date: meta.est_date || null,
        region: meta.region || null,
        location_label: meta.location_label || meta.region || null,
        programs: meta.programs || [],
        // Tier 1: live platform signals
        user_count: userCountMap[item.id] || 0,
        content_count: contentCountMap[item.id] || 0,
        // Tier 3: admin-curated verified signals
        signals: {
          ntc_pass_rate: signals.ntc_pass_rate ?? null,
          accreditation_tier: signals.accreditation_tier ?? null,
          enrollment_count: signals.enrollment_count ?? null,
          staff_count: signals.staff_count ?? null,
          founding_year_verified: signals.founding_year_verified ?? null,
          google_maps_rating: signals.google_maps_rating ?? null,
        },
      };
    });

    res.json({
      success: true,
      data: { colleges, count: colleges.length },
    });
  } catch (error) {
    logger.error('Error getting college rankings:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Update admin-curated signals for a college
 * PATCH /ranking/colleges/:id/signals
 * Auth: admin only
 */
router.patch('/colleges/:id/signals', authenticate, checkRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { ntc_pass_rate, accreditation_tier, enrollment_count, staff_count, founding_year_verified, google_maps_rating } = req.body;

    const models = require('../models').sequelize.models;
    const institution = await models.Institution.findByPk(id);
    if (!institution) {
      return res.status(404).json({ success: false, error: 'Institution not found' });
    }

    const meta = institution.metadata || {};
    const prev = meta.signals || {};

    const toNum = (v) => (v === '' || v == null ? null : Number(v));

    const updated = {
      ...prev,
      ...(ntc_pass_rate !== undefined && { ntc_pass_rate: toNum(ntc_pass_rate) }),
      ...(accreditation_tier !== undefined && { accreditation_tier: accreditation_tier || null }),
      ...(enrollment_count !== undefined && { enrollment_count: toNum(enrollment_count) }),
      ...(staff_count !== undefined && { staff_count: toNum(staff_count) }),
      ...(founding_year_verified !== undefined && { founding_year_verified: toNum(founding_year_verified) }),
      ...(google_maps_rating !== undefined && { google_maps_rating: toNum(google_maps_rating) }),
    };

    await institution.update({ metadata: { ...meta, signals: updated } });

    res.json({ success: true, signals: updated });
  } catch (error) {
    logger.error('Error updating college signals:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Update personalized rankings (admin)
 * POST /ranking/update-personalizations
 */
router.post('/update-personalizations', authenticate, checkRole(['admin']), async (req, res) => {
  try {
    const { batchSize = 100 } = req.body;

    const result = await contentRankerService.updatePersonalizedRankings(batchSize);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error updating personalizations:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;

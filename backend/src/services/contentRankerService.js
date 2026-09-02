// services/contentRankerService.js
const { sequelize } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');

class ContentRankerService {
  /**
   * Get personalized content ranking for authenticated user
   * Based on:
   * - User's learning history
   * - Engagement patterns
   * - Course progress
   * - Peer learning patterns
   */
  async getPersonalizedRanking(userId, limit = 50, offset = 0) {
    try {
      const models = sequelize.models;

      // Get user's subscription and learning history
      const user = await models.User.findByPk(userId, {
        include: [
          { model: models.Subscription, as: 'subscription' },
          { model: models.Progress, as: 'progress' }
        ]
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Get user engagement patterns
      const userEngagements = await sequelize.query(`
        SELECT content_id, COUNT(*) as engagement_count, AVG(duration_seconds) as avg_duration
        FROM events
        WHERE user_id = ? AND event_type IN ('content_open', 'content_view')
        GROUP BY content_id
        ORDER BY engagement_count DESC
        LIMIT 50
      `, {
        replacements: [userId],
        type: sequelize.QueryTypes.SELECT
      });

      const userContentIds = new Set(userEngagements.map(e => e.content_id));

      // Get similar content based on learning category/subject
      const userProgress = user.progress || [];
      const subjects = new Set(userProgress.map(p => p.subject));

      let query = {
        where: {
          status: 'published',
          is_premium: { [Op.or]: [false, true] } // Both premium and free
        }
      };

      // Filter by subscription plan capabilities
      if (user.subscription && user.subscription.plan) {
        query.where.depth_level = this.getAllowedDepthLevels(user.subscription.plan.name);
      }

      // Get all ranked content from all_content view
      const contents = await sequelize.query(`
        SELECT ac.*, cs.total_views AS view_count, cs.like_count, cs.avg_rating
        FROM all_content ac
        LEFT JOIN content_stats cs ON cs.content_id = ac.id
        WHERE ac.status = 'published'
        LIMIT :lim OFFSET :off
      `, {
        replacements: { lim: limit * 2, off: offset },
        type: sequelize.QueryTypes.SELECT,
      });

      // Rank by personalization score (contents are plain objects from raw SQL)
      const rankedContents = contents.map(content => {
        const score = this.calculatePersonalizationScore(
          content,
          userEngagements,
          userContentIds,
          subjects,
          user
        );
        return { ...content, personalizationScore: score };
      });

      // Sort by score descending
      rankedContents.sort((a, b) => b.personalizationScore - a.personalizationScore);

      return rankedContents.slice(0, limit);
    } catch (error) {
      logger.error('Error getting personalized ranking:', error);
      // Fallback to generic ranking
      return this.getGenericRanking(limit, offset);
    }
  }

  /**
   * Get generic ranking for visitors (unauthenticated)
   * Based on:
   * - Overall popularity (views, likes)
   * - Recency
   * - Quality (ratings)
   */
  async getGenericRanking(limit = 50, offset = 0) {
    try {
      // Get trending content based on views, likes, and ratings from all_content view
      const contents = await sequelize.query(`
        SELECT
          ac.*,
          cs.total_views AS view_count,
          cs.like_count,
          cs.save_count,
          ROUND(
            COALESCE(cs.total_views, 0) * 0.3
            + COALESCE(cs.like_count, 0) * 0.5
          ) AS ranking_score
        FROM all_content ac
        LEFT JOIN content_stats cs ON ac.id = cs.content_id
        WHERE ac.status = 'published' AND ac.is_premium = false
        ORDER BY ranking_score DESC, ac.created_at DESC
        LIMIT :lim OFFSET :off
      `, {
        replacements: { lim: limit, off: offset },
        type: sequelize.QueryTypes.SELECT
      });

      return contents;
    } catch (error) {
      logger.error('Error getting generic ranking:', error);
      throw error;
    }
  }

  /**
   * Calculate personalization score for content
   * Score formula:
   * - Base score: popularity (views, likes, rating)
   * - Relevance bonus: matches user's subjects (+30)
   * - Engagement bonus: user engaged with similar content (+20)
   * - Recency bonus: recent content (+10)
   * - Novelty bonus: content not previously seen (+15)
   */
  calculatePersonalizationScore(content, userEngagements, userContentIds, userSubjects, user) {
    let score = 0;

    // Base popularity score
    const stats = content.stats || {};
    const viewScore = Math.min(stats.view_count * 0.01, 30);
    const likeScore = Math.min(stats.like_count * 0.05, 20);
    const ratingScore = (stats.avg_rating || 0) * 10;
    
    score += viewScore + likeScore + ratingScore;

    // Relevance to user's learning subjects
    if (userSubjects.size > 0) {
      const contentSubjects = (content.subject || '').split(',').map(s => s.trim());
      const relevantSubjects = contentSubjects.filter(s => userSubjects.has(s)).length;
      score += relevantSubjects * 30;
    }

    // User engagement with similar content
    const userEngagedCount = userEngagements.filter(e => 
      e.content_id !== content.id && e.engagement_count > 0
    ).length;
    
    if (userEngagedCount > 0) {
      score += Math.min(userEngagedCount * 2, 20); // Max 20 points
    }

    // Recency bonus (prefer content from last 30 days)
    const daysSinceCreation = Math.floor(
      (Date.now() - new Date(content.created_at)) / (1000 * 60 * 60 * 24)
    );
    
    if (daysSinceCreation < 30) {
      score += 10 * (1 - daysSinceCreation / 30); // Decreasing bonus
    }

    // Novelty bonus (haven't seen this before)
    if (!userContentIds.has(content.id)) {
      score += 15;
    }

    // Depth level appropriateness
    const allowedDepths = this.getAllowedDepthLevels(user.subscription?.plan?.name);
    if (allowedDepths.includes(content.depth_level)) {
      score += 5;
    }

    return parseFloat(score.toFixed(2));
  }

  /**
   * Get allowed depth levels based on subscription plan
   */
  getAllowedDepthLevels(planName) {
    const planUpper = planName?.toUpperCase() || '';

    if (planUpper.includes('MASTER')) {
      return ['basic', 'enhanced', 'advanced'];
    } else if (planUpper.includes('SERIOUS')) {
      return ['basic', 'enhanced'];
    }
    // Basic or default
    return ['basic'];
  }

  /**
   * Recalculate and cache personalized rankings
   * Run periodically (e.g., daily or weekly)
   */
  async updatePersonalizedRankings(batchSize = 100) {
    try {
      const models = sequelize.models;

      // Get all active users
      const users = await models.User.findAll({
        where: { is_active: true },
        attributes: ['id'],
        limit: batchSize
      });

      logger.info(`Updating rankings for ${users.length} users`);

      const updates = [];

      for (const user of users) {
        try {
          // Get personalized ranking
          const rankedContent = await this.getPersonalizedRanking(user.id, 50);

          // Store in cache or database (could use Redis for faster access)
          updates.push({
            userId: user.id,
            timestamp: new Date(),
            rankedContentIds: rankedContent.map(c => c.id)
          });
        } catch (error) {
          logger.error(`Error updating ranking for user ${user.id}:`, error);
        }
      }

      return {
        usersProcessed: updates.length,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Error updating personalized rankings:', error);
      throw error;
    }
  }

  /**
   * Get trending content across platform
   */
  async getTrendingContent(period = '7d', limit = 20) {
    try {
      // Calculate days from period
      const days = period === '24h' ? 1 : period === '7d' ? 7 : 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const trending = await sequelize.query(`
        SELECT
          ac.id, ac.title, ac.content_type AS type, ac.subtype,
          COUNT(DISTINCT ce.id) AS interaction_count,
          SUM(CASE WHEN ce.action = 'like' THEN 1 ELSE 0 END) AS likes,
          SUM(CASE WHEN ce.action = 'complete' THEN 1 ELSE 0 END) AS completions
        FROM all_content ac
        LEFT JOIN content_engagements ce ON ac.id = ce.content_id AND ce.created_at >= :startDate
        WHERE ac.status = 'published'
        GROUP BY ac.id, ac.title, ac.content_type, ac.subtype
        ORDER BY interaction_count DESC, likes DESC
        LIMIT :lim
      `, {
        replacements: { startDate, lim: limit },
        type: sequelize.QueryTypes.SELECT
      });

      return trending;
    } catch (error) {
      logger.error('Error getting trending content:', error);
      throw error;
    }
  }

  /**
   * Get recommended content for user based on learning path
   */
  async getRecommendedContent(userId, limit = 10) {
    try {
      const models = sequelize.models;

      const user = await models.User.findByPk(userId, {
        include: [{ model: models.Progress, as: 'progress' }]
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Get next recommended content based on current progress from all_content view
      const recommended = await sequelize.query(`
        SELECT ac.*, cs.total_views AS view_count,
          CASE WHEN p.id IS NOT NULL THEN 1 ELSE 0 END AS in_progress
        FROM all_content ac
        LEFT JOIN content_stats cs ON ac.id = cs.content_id
        LEFT JOIN progress p ON ac.id = p.content_id AND p.user_id = :userId
        WHERE ac.status = 'published'
        AND ac.id NOT IN (
          SELECT content_id FROM progress WHERE user_id = :userId AND completed = true
        )
        ORDER BY ac.created_at DESC
        LIMIT :lim
      `, {
        replacements: { userId, lim: limit },
        type: sequelize.QueryTypes.SELECT
      });

      return recommended;
    } catch (error) {
      logger.error('Error getting recommended content:', error);
      throw error;
    }
  }
}

module.exports = new ContentRankerService();

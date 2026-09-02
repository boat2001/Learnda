// services/analyticsService.js
const { Op } = require('sequelize');
const db = require('../models');
const {
  sequelize,
  ContentEngagement,
  ContentStats,
  Event,
  PaymentTransaction,
  Plan,
  Subscription,
  User
} = db;

class AnalyticsService {
  // Track generic event
  async trackEvent(eventData) {
    try {
      const event = await Event.create({
        user_id: eventData.user_id,
        visitor_id: eventData.visitor_id,
        session_id: eventData.session_id,
        event_type: eventData.event_type,
        event_data: eventData.event_data || {},
        page_url: eventData.page_url,
        referrer_url: eventData.referrer_url,
        user_agent: eventData.user_agent,
        ip_address: eventData.ip_address,
        device_type: eventData.device_type,
        country: eventData.country,
        created_at: new Date()
      });

      return event;
    } catch (error) {
      console.error('Track event error:', error);
      // Don't throw, analytics shouldn't break the app
    }
  }

  // Track content engagement
  async trackContentEngagement(engagementData) {
    try {
      const engagement = await ContentEngagement.create({
        content_id: engagementData.content_id,
        user_id: engagementData.user_id,
        action: engagementData.action,
        duration_seconds: engagementData.duration_seconds,
        progress_percentage: engagementData.progress_percentage,
        metadata: engagementData.metadata || {},
        created_at: new Date()
      });

      // Update content stats in real-time
      await this.updateContentStats(
        engagementData.content_id,
        engagementData.action,
        engagementData.duration_seconds,
        engagementData.progress_percentage
      );

      return engagement;
    } catch (error) {
      console.error('Track content engagement error:', error);
    }
  }

  // Update content stats in real-time
  async updateContentStats(contentId, action, durationSeconds) {
    try {
      const stats = await ContentStats.findOne({ where: { content_id: contentId } });
      
      if (!stats) {
        // Initialize stats if they don't exist
        await ContentStats.create({
          content_id: contentId,
          total_views: 0,
          unique_viewers: 0,
          total_completions: 0,
          avg_time_spent: 0,
          completion_rate: 0,
          rating_avg: 0,
          rating_count: 0,
          like_count: 0,
          save_count: 0,
          share_count: 0
        });
        return;
      }

      // Update based on action
      switch (action) {
        case 'view':
          stats.total_views += 1;
          
          // Update average time spent (exponential moving average)
          if (durationSeconds > 0) {
            const alpha = 0.1; // Smoothing factor
            stats.avg_time_spent = Math.round(
              alpha * durationSeconds + (1 - alpha) * stats.avg_time_spent
            );
          }
          break;

        case 'complete':
          stats.total_completions += 1;
          
          // Update completion rate
          if (stats.total_views > 0) {
            stats.completion_rate = Math.round(
              (stats.total_completions / stats.total_views) * 100
            );
          }
          break;

        case 'like':
          stats.like_count += 1;
          break;

        case 'save':
          stats.save_count += 1;
          break;

        case 'share':
          stats.share_count += 1;
          break;

        case 'rate':
          // Handle rating updates separately
          break;
      }

      // Update last_updated timestamp
      stats.last_updated = new Date();
      await stats.save();
    } catch (error) {
      console.error('Update content stats error:', error);
    }
  }

  // Get content analytics
  async getContentAnalytics(contentId, timeframe = '30d') {
    try {
      const startDate = this.getStartDate(timeframe);
      
      const engagements = await ContentEngagement.findAll({
        where: {
          content_id: contentId,
          created_at: { [Op.gte]: startDate }
        },
        attributes: [
          'action',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          [sequelize.fn('AVG', sequelize.col('duration_seconds')), 'avg_duration'],
          [sequelize.fn('AVG', sequelize.col('progress_percentage')), 'avg_progress']
        ],
        group: ['action'],
        raw: true
      });

      // Get time series data
      const timeSeries = await ContentEngagement.findAll({
        where: {
          content_id: contentId,
          created_at: { [Op.gte]: startDate }
        },
        attributes: [
          [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'views'],
          [
            sequelize.fn('SUM', 
              sequelize.literal("CASE WHEN action = 'complete' THEN 1 ELSE 0 END")
            ), 
            'completions'
          ]
        ],
        group: [sequelize.fn('DATE', sequelize.col('created_at'))],
        order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']],
        raw: true
      });

      return {
        engagements,
        time_series: timeSeries,
        timeframe
      };
    } catch (error) {
      console.error('Get content analytics error:', error);
      throw error;
    }
  }

  // Get user learning patterns
  async getUserLearningPatterns(userId) {
    try {
      // Get user's engagement data joined with all_content view
      const engagements = await sequelize.query(`
        SELECT ce.*, ac.content_type AS ct, ac.subtype
        FROM content_engagements ce
        LEFT JOIN all_content ac ON ac.id = ce.content_id
        WHERE ce.user_id = :userId
        ORDER BY ce.created_at DESC
        LIMIT 1000
      `, { replacements: { userId }, type: sequelize.QueryTypes.SELECT });

      // Analyze patterns
      const patterns = {
        preferred_subjects: [],
        preferred_content_types: [],
        average_session_minutes: 0,
        peak_hours: {},
        completion_rates: {}
      };

      // Extract subjects from metadata
      const subjectCount = {};
      const contentTypeCount = {};
      const sessionDurations = [];
      const hourCount = {};

      engagements.forEach(engagement => {
        const contentMeta = engagement.content_metadata || {};

        // Count subjects
        if (contentMeta.course) {
          subjectCount[contentMeta.course] = (subjectCount[contentMeta.course] || 0) + 1;
        }

        // Count content types (use normalized type)
        const ctType = engagement.ct || 'unknown';
        contentTypeCount[ctType] = (contentTypeCount[ctType] || 0) + 1;

        // Track session durations
        if (engagement.duration_seconds) {
          sessionDurations.push(engagement.duration_seconds);
        }

        // Track hour of day
        const hour = new Date(engagement.created_at).getHours();
        hourCount[hour] = (hourCount[hour] || 0) + 1;
      });

      // Calculate averages and patterns
      patterns.preferred_subjects = Object.entries(subjectCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([subject]) => subject);

      patterns.preferred_content_types = Object.entries(contentTypeCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([type]) => type);

      if (sessionDurations.length > 0) {
        const totalSeconds = sessionDurations.reduce((a, b) => a + b, 0);
        patterns.average_session_minutes = Math.round(totalSeconds / sessionDurations.length / 60);
      }

      // Find peak hours
      patterns.peak_hours = Object.entries(hourCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .reduce((obj, [hour, count]) => {
          obj[hour] = count;
          return obj;
        }, {});

      return patterns;
    } catch (error) {
      console.error('Get user learning patterns error:', error);
      throw error;
    }
  }

  // Get platform-wide analytics (admin only)
  async getPlatformAnalytics(timeframe = '30d') {
    try {
      const startDate = this.getStartDate(timeframe);

      // Get total users
      const totalUsers = await User.count({
        where: { created_at: { [Op.gte]: startDate } }
      });

      // Get active users (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const activeUsers = await User.count({
        where: { last_active_at: { [Op.gte]: sevenDaysAgo } }
      });

      // Get total content from all_content view
      const [{ totalContent }] = await sequelize.query(
        `SELECT COUNT(*)::int AS "totalContent" FROM all_content WHERE status = 'published'${startDate ? ` AND created_at >= '${startDate.toISOString()}'` : ''}`,
        { type: sequelize.QueryTypes.SELECT }
      );

      // Get engagement metrics
      const totalEngagements = await ContentEngagement.count({
        where: { created_at: { [Op.gte]: startDate } }
      });

      // Get subscription stats
      const subscriptionStats = await Subscription.findAll({
        where: { 
          status: 'active',
          started_at: { [Op.gte]: startDate }
        },
        attributes: [
          'plan_id',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['plan_id'],
        include: [
          {
            model: Plan,
            as: 'plan',
            attributes: ['name', 'price']
          }
        ],
        raw: true
      });

      // Get revenue
      const revenue = await PaymentTransaction.sum('amount', {
        where: { 
          status: 'success',
          created_at: { [Op.gte]: startDate }
        }
      });

      return {
        timeframe,
        users: {
          total: totalUsers,
          active: activeUsers,
          growth_rate: await this.calculateGrowthRate('users', timeframe)
        },
        content: {
          total: totalContent,
          published: totalContent,
          engagement: totalEngagements
        },
        subscriptions: subscriptionStats,
        revenue: revenue || 0,
        completion_rate: await this.getAverageCompletionRate(timeframe)
      };
    } catch (error) {
      console.error('Get platform analytics error:', error);
      throw error;
    }
  }

  // Helper methods
  getStartDate(timeframe) {
    const now = new Date();
    const startDate = new Date(now);

    switch (timeframe) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    return startDate;
  }

  getPreviousPeriod(timeframe) {
    const currentStart = this.getStartDate(timeframe);
    const durationMs = Date.now() - currentStart.getTime();
    return {
      start: new Date(currentStart.getTime() - durationMs),
      end: currentStart
    };
  }

  async getMetricCount(metric, timeframeOrRange) {
    const range = typeof timeframeOrRange === 'object' && timeframeOrRange
      ? timeframeOrRange
      : { start: this.getStartDate(timeframeOrRange), end: null };
    const createdAt = {
      ...(range.start ? { [Op.gte]: range.start } : {}),
      ...(range.end ? { [Op.lt]: range.end } : {})
    };
    const where = Object.keys(createdAt).length ? { created_at: createdAt } : {};

    switch (metric) {
      case 'users':
        return User.count({ where });
      case 'content': {
        const cond = Object.keys(where).length
          ? ` AND created_at >= '${(where.created_at?.[Op.gte] || new Date(0)).toISOString()}'`
          : '';
        const [{ cnt }] = await sequelize.query(
          `SELECT COUNT(*)::int AS cnt FROM all_content WHERE status = 'published'${cond}`,
          { type: sequelize.QueryTypes.SELECT }
        );
        return cnt || 0;
      }
      case 'engagements':
        return ContentEngagement.count({ where });
      default:
        return 0;
    }
  }

  async calculateGrowthRate(metric, timeframe) {
    // Calculate growth rate compared to previous period
    const currentPeriod = await this.getMetricCount(metric, timeframe);
    const previousPeriod = await this.getMetricCount(metric, this.getPreviousPeriod(timeframe));
    
    if (previousPeriod === 0) return 100;
    
    return ((currentPeriod - previousPeriod) / previousPeriod) * 100;
  }

  async getAverageCompletionRate(timeframe) {
    const startDate = this.getStartDate(timeframe);
    
    const stats = await ContentEngagement.findAll({
      where: { 
        created_at: { [Op.gte]: startDate },
        action: { [Op.in]: ['view', 'complete'] }
      },
      attributes: [
        'content_id',
        [sequelize.fn('COUNT', 
          sequelize.literal("CASE WHEN action = 'view' THEN 1 END")
        ), 'views'],
        [sequelize.fn('COUNT', 
          sequelize.literal("CASE WHEN action = 'complete' THEN 1 END")
        ), 'completions']
      ],
      group: ['content_id'],
      raw: true
    });

    if (stats.length === 0) return 0;

    const totalViews = stats.reduce((sum, item) => sum + (parseInt(item.views) || 0), 0);
    const totalCompletions = stats.reduce((sum, item) => sum + (parseInt(item.completions) || 0), 0);

    return totalViews > 0 ? (totalCompletions / totalViews) * 100 : 0;
  }

}

module.exports = new AnalyticsService();

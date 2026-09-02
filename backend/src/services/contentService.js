const { Op, Sequelize } = require('sequelize');
const db = require('../models');
const {
  ContentMetadata,
  ContentStats,
  User,
  ContentEngagement,
  Comment,
  Contribution,
  sequelize
} = db;
const { findById, findModelInstance, normalizeRow } = require('../utils/contentLookup');
const subscriptionService = require('./subscriptionService');
const analyticsService = require('./analyticsService');
const logger = require('../config/logger');

class ContentService {
  async createContent(contentData, userId) {
    try {
      // Check user's subscription for contribution limits
      const userPlan = await subscriptionService.getUserPlan(userId);
      const canCreate = this.checkCreatePermission(contentData, userPlan);

      if (!canCreate.allowed) {
        throw new Error(canCreate.reason);
      }

      // Determine target model
      const type = contentData.type || 'text_lesson';
      let content;
      if (type === 'text_lesson' || type === 'lesson') {
        content = await db.Lesson.create({ ...contentData, creator_id: userId, status: 'draft' });
      } else if (type === 'video') {
        content = await db.VideoLesson.create({ ...contentData, creator_id: userId, status: 'draft' });
      } else {
        content = await db.TextItem.create({
          ...contentData,
          subtype: type,
          creator_id: userId,
          status: 'draft',
        });
      }

      // Initialize stats
      await ContentStats.create({ content_id: content.id });

      logger.info(`Content created: ${content.id} by user ${userId}`);
      return content;
    } catch (error) {
      logger.error('Create content error:', error);
      throw error;
    }
  }

  async updateContent(contentId, updates, userId) {
    try {
      const content = await findModelInstance(db, contentId);

      if (!content) {
        throw new Error('Content not found');
      }

      // Check ownership or admin rights
      if (content.creator_id !== userId) {
        const user = await User.findByPk(userId);
        if (user.role !== 'admin') {
          throw new Error('Not authorized to update this content');
        }
      }

      await content.update(updates);

      logger.info(`Content updated: ${contentId} by user ${userId}`);
      return content;
    } catch (error) {
      logger.error('Update content error:', error);
      throw error;
    }
  }

  async getContentById(contentId, userId = null) {
    try {
      const row = await findById(db, contentId);
      if (!row) throw new Error('Content not found');

      const content = normalizeRow(row);

      // Check access permissions
      const userPlan = userId ? await subscriptionService.getUserPlan(userId) : null;
      const canAccess = this.checkContentAccess(content, userPlan);
      if (!canAccess) {
        throw new Error('Access denied. Upgrade your plan to view this content.');
      }

      // Fetch supplemental data
      const [stats, creator, engagement] = await Promise.all([
        ContentStats.findOne({ where: { content_id: contentId } }),
        row.creator_id ? User.findByPk(row.creator_id, { attributes: ['id', 'full_name', 'avatar_url'] }) : null,
        userId
          ? ContentEngagement.findOne({
              where: { content_id: contentId, user_id: userId },
              order: [['created_at', 'DESC']],
            })
          : null,
      ]);

      return {
        ...content,
        stats: stats || null,
        creator: creator ? creator.toJSON() : null,
        user_engagement: engagement ? engagement.toJSON() : null,
        can_access: true,
      };
    } catch (error) {
      logger.error('Get content by ID error:', error);
      throw error;
    }
  }

  async getContentList(filters = {}, userId = null) {
    try {
      const {
        type,
        depth_level,
        is_premium,
        status = 'published',
        course,
        level,
        search,
        page = 1,
        limit = 20,
        sort_by = 'created_at',
        sort_order = 'desc'
      } = filters;

      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Build raw SQL against all_content view
      const conditions = [`status = :status`];
      const replacements = { status };

      if (type) {
        if (type === 'text_lesson') conditions.push(`content_type = 'lesson'`);
        else if (type === 'video') conditions.push(`content_type IN ('video_lesson','eduvhibe_video')`);
        else { conditions.push(`content_type = 'text_item' AND subtype = :filterType`); replacements.filterType = type; }
      }
      if (depth_level) { conditions.push(`depth_level = :depth_level`); replacements.depth_level = depth_level; }
      if (is_premium !== undefined) { conditions.push(`is_premium = :is_premium`); replacements.is_premium = !!is_premium; }
      if (search) { conditions.push(`(title ILIKE :search OR description ILIKE :search)`); replacements.search = `%${search}%`; }
      if (course) {
        conditions.push(`(
          course_id::text = :course
          OR metadata->>'course_id' = :course
          OR metadata->>'course' ILIKE :courseText
          OR metadata->>'course_title' ILIKE :courseText
          OR metadata->>'course_code' ILIKE :courseText
        )`);
        replacements.course = course;
        replacements.courseText = `%${course}%`;
      }
      if (level) { conditions.push(`level = :level`); replacements.level = level; }

      const userPlan = userId ? await subscriptionService.getUserPlan(userId) : null;
      const canAccessPremium = userPlan?.hasFeature ? userPlan.hasFeature('premium_content') : false;
      if (!canAccessPremium) conditions.push(`is_premium = false`);

      const whereClause = conditions.join(' AND ');

      const direction = String(sort_order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
      let orderClause;
      switch (sort_by) {
        case 'popularity': orderClause = `cs.total_views ${direction}`; break;
        case 'trending': orderClause = `(COALESCE(cs.total_views,0) + COALESCE(cs.like_count,0)*2 + COALESCE(cs.save_count,0)*3) ${direction}`; break;
        case 'created_at': default: orderClause = `ac.created_at ${direction}`; break;
      }

      const [countRow] = await sequelize.query(
        `SELECT COUNT(*)::int AS total FROM all_content WHERE ${whereClause}`,
        { replacements, type: sequelize.QueryTypes.SELECT }
      );
      const total = countRow.total || 0;

      const rows = await sequelize.query(
        `SELECT ac.*, cs.total_views, cs.like_count, cs.save_count, cs.share_count, cs.total_completions
         FROM all_content ac
         LEFT JOIN content_stats cs ON cs.content_id = ac.id
         WHERE ${whereClause}
         ORDER BY ${orderClause}
         LIMIT :lim OFFSET :off`,
        { replacements: { ...replacements, lim: parseInt(limit), off: offset }, type: sequelize.QueryTypes.SELECT }
      );

      const { normalizeRow: nr } = require('../utils/contentLookup');
      const data = rows.map((row) => ({
        ...nr(row),
        stats: { total_views: row.total_views || 0, like_count: row.like_count || 0, save_count: row.save_count || 0 },
        can_access: this.checkContentAccess(row, userPlan),
      }));

      return {
        data,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      };
    } catch (error) {
      logger.error('Get content list error:', error);
      throw error;
    }
  }

  async trackEngagement(contentId, userId, action, data = {}) {
    try {
      const engagement = await ContentEngagement.create({
        content_id: contentId,
        user_id: userId,
        action,
        duration_seconds: data.duration_seconds,
        progress_percentage: data.progress_percentage,
        metadata: data.metadata || {}
      });

      // Update content stats
      await analyticsService.updateContentStats(
        contentId,
        action,
        data.duration_seconds,
        data.progress_percentage
      );

      // Award XP for completions
      if (action === 'complete') {
        await this.awardCompletionXP(userId, contentId);
      }

      logger.info(`Content engagement tracked: ${action} on ${contentId} by ${userId}`);

      return engagement;
    } catch (error) {
      logger.error('Track engagement error:', error);
      throw error;
    }
  }

  async awardCompletionXP(userId, contentId) {
    try {
      const content = await findById(db, contentId);
      if (!content) return;

      const gamificationService = require('./gamificationService');
      
      let xpAward = 10; // Base XP
      
      // Bonus for premium content
      if (content.is_premium) {
        xpAward += 5;
      }
      
      // Bonus for higher depth levels
      if (content.depth_level === 'enhanced') {
        xpAward += 5;
      } else if (content.depth_level === 'advanced') {
        xpAward += 10;
      }
      
      await gamificationService.addXP(userId, xpAward, 'content_completion', {
        content_id: contentId,
        content_type: content.content_type || content.type
      });
    } catch (error) {
      logger.error('Award completion XP error:', error);
    }
  }

  checkContentAccess(content, userPlan) {
    // Always allow basic content
    if (content.depth_level === 'basic' && !content.is_premium) {
      return true;
    }

    // Visitors can only access basic, non-premium content
    if (!userPlan) {
      return content.depth_level === 'basic' && !content.is_premium;
    }

    // Check premium access
    if (content.is_premium && !userPlan.hasFeature('premium_content')) {
      return false;
    }

    // Check depth level access
    const featureConfig = userPlan.getFeatureConfig('text_lessons');
    if (featureConfig) {
      const depthLevels = { 'basic': 1, 'enhanced': 2, 'advanced': 3 };
      const visualLevels = { 'static': 1, 'animated': 2, 'interactive': 3 };
      
      const allowedDepth = depthLevels[featureConfig.depth] || 1;
      const allowedVisual = visualLevels[featureConfig.visual] || 1;
      
      if (depthLevels[content.depth_level] > allowedDepth) {
        return false;
      }
      
      if (visualLevels[content.visual_type] > allowedVisual) {
        return false;
      }
    }

    return true;
  }

  checkCreatePermission(contentData, userPlan) {
    if (!userPlan) {
      return { allowed: false, reason: 'Authentication required' };
    }

    const type = contentData.type;
    const depthLevel = contentData.depth_level || 'basic';

    // Basic students cannot contribute
    if (userPlan.name === 'Basic Student') {
      return { allowed: false, reason: 'Upgrade your plan to contribute content' };
    }

    // Serious students can contribute files and edutainment
    if (userPlan.name === 'Serious Student') {
      const allowedTypes = ['past_question', 'edutainment'];
      if (!allowedTypes.includes(type)) {
        return { 
          allowed: false, 
          reason: 'Your plan allows contributions of files and edutainment content only' 
        };
      }
      
      // Serious students can only create basic content
      if (depthLevel !== 'basic') {
        return {
          allowed: false,
          reason: 'Your plan only allows creation of basic content'
        };
      }
    }

    // Master students can contribute all allowed types
    if (userPlan.name === 'Master Student') {
      const allowedTypes = ['text_lesson', 'video', 'past_question', 'edutainment', 'quote'];
      if (!allowedTypes.includes(type)) {
        return { 
          allowed: false, 
          reason: 'Content type not allowed' 
        };
      }
    }

    return { allowed: true };
  }

  async getContentAnalytics(contentId, timeframe = '30d') {
    try {
      return await analyticsService.getContentAnalytics(contentId, timeframe);
    } catch (error) {
      logger.error('Get content analytics error:', error);
      throw error;
    }
  }

  async searchContent(query, filters = {}, userId = null) {
    try {
      const conditions = [
        `status = 'published'`,
        `(title ILIKE :q OR description ILIKE :q OR tags::text[] && ARRAY[:qExact]::text[])`
      ];
      const replacements = { q: `%${query}%`, qExact: query };

      if (filters.type) {
        if (filters.type === 'text_lesson') conditions.push(`content_type = 'lesson'`);
        else if (filters.type === 'video') conditions.push(`content_type IN ('video_lesson','eduvhibe_video')`);
        else { conditions.push(`subtype = :fType`); replacements.fType = filters.type; }
      }
      if (filters.course) {
        conditions.push(`(
          course_id::text = :fCourse
          OR metadata->>'course_id' = :fCourse
          OR metadata->>'course' ILIKE :fCourseText
          OR metadata->>'course_title' ILIKE :fCourseText
          OR metadata->>'course_code' ILIKE :fCourseText
        )`);
        replacements.fCourse = filters.course;
        replacements.fCourseText = `%${filters.course}%`;
      }

      const userPlan = userId ? await subscriptionService.getUserPlan(userId) : null;
      const canAccessPremium = userPlan?.hasFeature ? userPlan.hasFeature('premium_content') : false;
      if (!canAccessPremium) conditions.push(`is_premium = false`);

      const rows = await sequelize.query(
        `SELECT ac.*, cs.total_views, cs.like_count, cs.save_count
         FROM all_content ac
         LEFT JOIN content_stats cs ON cs.content_id = ac.id
         WHERE ${conditions.join(' AND ')}
         ORDER BY ac.created_at DESC
         LIMIT 50`,
        { replacements, type: sequelize.QueryTypes.SELECT }
      );

      const { normalizeRow: nr } = require('../utils/contentLookup');
      return rows
        .map((row) => ({ ...nr(row), stats: { total_views: row.total_views || 0 } }))
        .filter((item) => this.checkContentAccess(item, userPlan));
    } catch (error) {
      logger.error('Search content error:', error);
      throw error;
    }
  }

  async submitForReview(contentId, userId) {
    try {
      const content = await findModelInstance(db, contentId);

      if (!content) {
        throw new Error('Content not found');
      }

      if (content.creator_id !== userId) {
        throw new Error('Not authorized to submit this content for review');
      }

      if (content.status !== 'draft') {
        throw new Error('Content must be in draft status to submit for review');
      }

      content.status = 'review';
      await content.save();

      // TODO: Notify admins for review
      logger.info(`Content submitted for review: ${contentId}`);

      return content;
    } catch (error) {
      logger.error('Submit for review error:', error);
      throw error;
    }
  }
}

module.exports = new ContentService();

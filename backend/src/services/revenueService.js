const { Op } = require('sequelize');
const db = require('../models');
const {
  ContentStats,
  ContentEngagement,
  Comment,
  RewardPayout,
  Subscription,
  Plan,
  User,
  sequelize: revSequelize
} = db;
const { findById } = require('../utils/contentLookup');
const logger = require('../config/logger');

class RevenueService {
  getRevenueSharePercentage(planName) {
    const planUpper = String(planName || '').toUpperCase().replace(/\s/g, '_');
    if (planUpper.includes('MASTER')) {
      return 0.6;
    }
    if (planUpper.includes('SERIOUS')) {
      return 0.5;
    }
    return 0;
  }

  async calculateContentEarnings(contentId, startDate = null, endDate = null) {
    try {
      const wherePeriod = {};
      if (startDate || endDate) {
        wherePeriod.created_at = {};
        if (startDate) wherePeriod.created_at[Op.gte] = startDate;
        if (endDate) wherePeriod.created_at[Op.lte] = endDate;
      }

      const [content, stats, engagements, commentsCount] = await Promise.all([
        findById(db, contentId),
        ContentStats.findOne({ where: { content_id: contentId } }),
        ContentEngagement.findAll({
          where: {
            content_id: contentId,
            ...(wherePeriod.created_at ? { created_at: wherePeriod.created_at } : {})
          }
        }),
        Comment.count({
          where: {
            content_id: contentId,
            ...(wherePeriod.created_at ? { created_at: wherePeriod.created_at } : {})
          }
        })
      ]);

      if (!content) {
        return {
          contentId,
          views: 0,
          completions: 0,
          likes: 0,
          comments: 0,
          reactions: 0,
          timeSpent: 0,
          earnings: 0
        };
      }

      const aggregateFromEngagements = engagements.reduce((acc, row) => {
        const action = row.action || row.type;
        if (action === 'view') acc.views += 1;
        if (action === 'complete') acc.completions += 1;
        if (action === 'like') acc.likes += 1;
        acc.timeSpent += Number(row.duration_seconds || 0);
        return acc;
      }, {
        views: 0,
        completions: 0,
        likes: 0,
        timeSpent: 0
      });

      const views = Math.max(aggregateFromEngagements.views, Number(stats?.total_views || 0));
      const completions = Math.max(aggregateFromEngagements.completions, Number(stats?.total_completions || 0));
      const likes = Math.max(aggregateFromEngagements.likes, Number(stats?.like_count || 0));
      const timeSpent = Math.max(aggregateFromEngagements.timeSpent, Number(stats?.avg_time_spent || 0));
      const reactions = likes + commentsCount;

      const earnings = (
        (views * 0.01) +
        (completions * 0.05) +
        (likes * 0.02) +
        (commentsCount * 0.03) +
        ((timeSpent / 60) * 0.005)
      );

      return {
        contentId,
        title: content.title,
        type: content.type,
        views,
        completions,
        likes,
        comments: commentsCount,
        reactions,
        timeSpent,
        earnings: Number(earnings.toFixed(2))
      };
    } catch (error) {
      logger.error('Error calculating content earnings:', error);
      throw error;
    }
  }

  async calculateContributorEarnings(contributorId, planName, startDate = null, endDate = null) {
    try {
      const contents = await revSequelize.query(
        `SELECT id FROM all_content WHERE creator_id = :creatorId AND status = 'published' ORDER BY published_at DESC NULLS LAST`,
        { replacements: { creatorId: contributorId }, type: revSequelize.QueryTypes.SELECT }
      );

      const contentEarnings = await Promise.all(
        contents.map((content) => this.calculateContentEarnings(content.id, startDate, endDate))
      );

      const totalGrossEarnings = contentEarnings.reduce((sum, item) => sum + Number(item.earnings || 0), 0);
      const revenueShare = this.getRevenueSharePercentage(planName);
      const totalPayable = totalGrossEarnings * revenueShare;

      return {
        contributorId,
        period: { startDate, endDate },
        totalGrossEarnings: Number(totalGrossEarnings.toFixed(2)),
        revenueSharePercentage: Number((revenueShare * 100).toFixed(2)),
        totalPayable: Number(totalPayable.toFixed(2)),
        contents: contentEarnings
      };
    } catch (error) {
      logger.error('Error calculating contributor earnings:', error);
      throw error;
    }
  }

  async getPayoutHistory(contributorId, limit = 12) {
    try {
      return RewardPayout.findAll({
        where: { user_id: contributorId },
        order: [['requested_at', 'DESC']],
        limit
      });
    } catch (error) {
      logger.error('Error fetching payout history:', error);
      throw error;
    }
  }

  async getContributorStats(contributorId) {
    try {
      const [statsRows, [commentsCountRow], pendingPayouts, completedPayouts] = await Promise.all([
        revSequelize.query(
          `SELECT cs.total_views, cs.total_completions, cs.like_count, cs.avg_time_spent
           FROM content_stats cs
           JOIN all_content ac ON ac.id = cs.content_id
           WHERE ac.creator_id = :cid AND ac.status = 'published'`,
          { replacements: { cid: contributorId }, type: revSequelize.QueryTypes.SELECT }
        ),
        revSequelize.query(
          `SELECT COUNT(c.id)::int AS cnt
           FROM comments c
           JOIN all_content ac ON ac.id = c.content_id
           WHERE ac.creator_id = :cid AND ac.status = 'published'`,
          { replacements: { cid: contributorId }, type: revSequelize.QueryTypes.SELECT }
        ),
        RewardPayout.findAll({ where: { user_id: contributorId, status: { [Op.in]: ['requested', 'approved'] } } }),
        RewardPayout.findAll({ where: { user_id: contributorId, status: 'paid' } })
      ]);

      const contentTotals = statsRows.reduce((acc, row) => {
        acc.total += 1;
        acc.views += Number(row.total_views || 0);
        acc.completions += Number(row.total_completions || 0);
        acc.likes += Number(row.like_count || 0);
        acc.timeSpent += Number(row.avg_time_spent || 0);
        return acc;
      }, {
        total: 0,
        views: 0,
        completions: 0,
        likes: 0,
        timeSpent: 0
      });

      const commentsCount = Number(commentsCountRow?.cnt || 0);
      const pending = pendingPayouts.reduce((sum, payout) => sum + Number(payout.amount || 0), 0);
      const completed = completedPayouts.reduce((sum, payout) => sum + Number(payout.amount || 0), 0);

      return {
        content: {
          total: contentTotals.total,
          totalViews: contentTotals.views,
          totalCompletions: contentTotals.completions,
          totalLikes: contentTotals.likes,
          totalComments: commentsCount,
          totalReactions: contentTotals.likes + commentsCount,
          totalTimeSpentSeconds: contentTotals.timeSpent
        },
        earnings: {
          pending: Number(pending.toFixed(2)),
          completedLifetime: Number(completed.toFixed(2))
        }
      };
    } catch (error) {
      logger.error('Error fetching contributor stats:', error);
      throw error;
    }
  }

  async processMonthlyPayouts() {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 1, 1);
      const actualEndDate = new Date(endDate.getFullYear(), endDate.getMonth(), 0);

      const contributors = await User.findAll({
        where: { is_contributor: true },
        include: [{
          model: Subscription,
          as: 'subscription',
          include: [{ model: Plan, as: 'plan' }]
        }]
      });

      const payouts = [];
      for (const contributor of contributors) {
        const planName = contributor.subscription?.plan?.name;
        const share = this.getRevenueSharePercentage(planName);
        if (!share) continue;

        const earnings = await this.calculateContributorEarnings(
          contributor.id,
          planName,
          startDate,
          actualEndDate
        );

        if (earnings.totalPayable <= 0) continue;

        const payout = await RewardPayout.create({
          user_id: contributor.id,
          amount: earnings.totalPayable,
          destination: contributor.payout_contact || null,
          destination_telco: contributor.payout_telco || null,
          status: 'requested',
          insights: {
            source: 'monthly_engine',
            period: { startDate, endDate: actualEndDate },
            earnings
          },
          requested_at: new Date()
        });

        payouts.push(payout);
      }

      return {
        processedDate: new Date(),
        period: { startDate, endDate: actualEndDate },
        payoutsCreated: payouts.length,
        payouts
      };
    } catch (error) {
      logger.error('Error processing monthly payouts:', error);
      throw error;
    }
  }
}

module.exports = new RevenueService();

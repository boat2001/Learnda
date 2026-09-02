const { Op } = require('sequelize');
const { UserProgress, Badge, UserBadge, Contribution } = require('../models');
const logger = require('../config/logger');

class GamificationService {
  async initializeDefaultBadges() {
    const badges = [
      {
        name: 'First Step',
        description: 'Completed your first lesson',
        icon_url: '/badges/first-step.svg',
        xp_reward: 50,
        criteria: { type: 'first_lesson', value: 1, rarity: 'common' },
        is_hidden: false,
      },
      {
        name: 'Warm-Up Streak',
        description: 'Maintained a 3-day learning streak',
        icon_url: '/badges/streak-3.svg',
        xp_reward: 35,
        criteria: { type: 'streak', value: 3, rarity: 'common' },
        is_hidden: false,
      },
      {
        name: 'Weekly Warrior',
        description: 'Maintained a 7-day learning streak',
        icon_url: '/badges/weekly-warrior.svg',
        xp_reward: 100,
        criteria: { type: 'streak', value: 7, rarity: 'uncommon' },
        is_hidden: false,
      },
      {
        name: 'Fortnight Focus',
        description: 'Maintained a 14-day learning streak',
        icon_url: '/badges/streak-14.svg',
        xp_reward: 200,
        criteria: { type: 'streak', value: 14, rarity: 'rare' },
        is_hidden: false,
      },
      {
        name: 'Monthly Master',
        description: 'Maintained a 30-day learning streak',
        icon_url: '/badges/monthly-master.svg',
        xp_reward: 500,
        criteria: { type: 'streak', value: 30, rarity: 'epic' },
        is_hidden: false,
      },
      {
        name: 'Rising Student',
        description: 'Reached account level 3',
        icon_url: '/badges/level-3.svg',
        xp_reward: 40,
        criteria: { type: 'level', value: 3, rarity: 'common' },
        is_hidden: false,
      },
      {
        name: 'Campus Scholar',
        description: 'Reached account level 5',
        icon_url: '/badges/level-5.svg',
        xp_reward: 80,
        criteria: { type: 'level', value: 5, rarity: 'uncommon' },
        is_hidden: false,
      },
      {
        name: 'Deep Learner',
        description: 'Reached account level 7',
        icon_url: '/badges/level-7.svg',
        xp_reward: 150,
        criteria: { type: 'level', value: 7, rarity: 'rare' },
        is_hidden: false,
      },
      {
        name: 'Top Performer',
        description: 'Reached account level 8',
        icon_url: '/badges/level-8.svg',
        xp_reward: 220,
        criteria: { type: 'level', value: 8, rarity: 'epic' },
        is_hidden: false,
      },
      {
        name: 'Contributor',
        description: 'Had your first contribution approved',
        icon_url: '/badges/contributor.svg',
        xp_reward: 200,
        criteria: { type: 'first_contribution', value: 1, rarity: 'rare' },
        is_hidden: false,
      },
      {
        name: 'Quiz Master',
        description: 'Achieved perfect scores on 10 quizzes',
        icon_url: '/badges/quiz-master.svg',
        xp_reward: 300,
        criteria: { type: 'perfect_quizzes', value: 10, rarity: 'epic' },
        is_hidden: false,
      },
      {
        name: 'Speed Learner',
        description: 'Completed 5 lessons in one day',
        icon_url: '/badges/speed-learner.svg',
        xp_reward: 150,
        criteria: { type: 'lessons_per_day', value: 5, rarity: 'legendary' },
        is_hidden: false,
      },
    ];

    for (const badgeData of badges) {
      const [badge, created] = await Badge.findOrCreate({
        where: { name: badgeData.name },
        defaults: badgeData,
      });
      if (!created) {
        const nextCriteria = { ...(badge.criteria || {}), ...(badgeData.criteria || {}) };
        await badge.update({
          description: badgeData.description || badge.description,
          icon_url: badgeData.icon_url || badge.icon_url,
          xp_reward: badgeData.xp_reward ?? badge.xp_reward,
          criteria: nextCriteria,
          is_hidden: typeof badgeData.is_hidden === 'boolean' ? badgeData.is_hidden : badge.is_hidden,
        }).catch(() => null);
      }
    }

    logger.info('Default badges initialized');
  }

  // Returns midnight of a date in local server time for day-boundary comparisons
  _dayStart(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  async updateStreak(userId) {
    try {
      let progress = await UserProgress.findOne({ where: { user_id: userId } });
      if (!progress) {
        progress = await UserProgress.create({
          user_id: userId,
          xp: 0,
          level: 1,
          streak: 0,
          last_activity_date: new Date()
        });
        return { streak: 1, updated: true };
      }

      const today = this._dayStart(new Date());
      const lastActivity = progress.last_activity_date
        ? this._dayStart(new Date(progress.last_activity_date))
        : null;

      const diffDays = lastActivity
        ? Math.round((today - lastActivity) / (1000 * 60 * 60 * 24))
        : null;

      let newStreak = progress.streak;

      if (diffDays === null || diffDays > 1) {
        // No previous activity or gap > 1 day: reset streak
        newStreak = 1;
      } else if (diffDays === 1) {
        // Consecutive day: extend streak
        newStreak = (progress.streak || 0) + 1;
      }
      // diffDays === 0 means already active today: keep streak as-is

      progress.streak = newStreak;
      progress.last_activity_date = new Date();
      await progress.save();

      logger.info(`Streak updated for user ${userId}: ${newStreak}`);
      return { streak: newStreak, updated: true };
    } catch (error) {
      logger.error('Update streak error:', error);
      return { streak: 0, updated: false };
    }
  }

  _activityCounterKind(source, metadata = {}) {
    const s = String(source || '').trim();
    const contentType = String(
      metadata?.content_type || metadata?.contentType || ''
    ).trim().toLowerCase();

    if (s === 'lesson_complete' || /^lesson:/i.test(s)) return 'lesson';
    if (s === 'quiz_complete' || s === 'practice_complete' || /^practice:/i.test(s)) {
      return 'quiz';
    }
    if (s === 'content_completion') {
      if (contentType === 'quiz' || contentType === 'past_question') return 'quiz';
      if (contentType === 'text_lesson' || contentType === 'video') return 'lesson';
    }
    if (s === 'contribution') return 'contribution';
    return null;
  }

  async recordContributionApproved(userId) {
    try {
      const approvedCount = Contribution
        ? await Contribution.count({ where: { uploader_id: userId, status: 'approved' } })
        : 0;

      let progress = await UserProgress.findOne({ where: { user_id: userId } });
      if (!progress) {
        progress = await UserProgress.create({
          user_id: userId,
          xp: 0,
          level: 1,
          streak: 0,
          last_activity_date: new Date()
        });
      }
      progress.total_contributions = Math.max(0, Number(approvedCount) || 0);
      await progress.save();
      await this.checkAndAwardBadges(userId, 'contribution', {});
      return progress;
    } catch (error) {
      logger.error('Record contribution approved error:', error);
      throw error;
    }
  }

  async addXP(userId, xpAmount, source, metadata = {}) {
    try {
      let progress = await UserProgress.findOne({ where: { user_id: userId } });

      if (!progress) {
        progress = await UserProgress.create({
          user_id: userId,
          xp: 0,
          level: 1,
          streak: 0,
          last_activity_date: new Date()
        });
      }

      const oldXP = progress.xp;
      const oldLevel = progress.level;

      progress.xp += xpAmount;

      const counterKind = this._activityCounterKind(source, metadata);
      if (counterKind === 'lesson') {
        progress.total_lessons_completed = (progress.total_lessons_completed || 0) + 1;
      } else if (counterKind === 'quiz') {
        progress.total_quizzes_completed = (progress.total_quizzes_completed || 0) + 1;
      } else if (counterKind === 'contribution') {
        progress.total_contributions = (progress.total_contributions || 0) + 1;
      }

      const newLevel = this.calculateLevel(progress.xp);
      const didLevelUp = newLevel > oldLevel;
      if (didLevelUp) {
        progress.level = newLevel;
      }

      await progress.save();

      if (didLevelUp) {
        await this.handleLevelUp(userId, newLevel, oldLevel);
      }

      logger.info(`XP added: ${xpAmount} to user ${userId}, source: ${source}`);

      return {
        old_xp: oldXP,
        new_xp: progress.xp,
        old_level: oldLevel,
        new_level: progress.level,
        level_up: didLevelUp
      };
    } catch (error) {
      logger.error('Add XP error:', error);
      throw error;
    }
  }

  calculateLevel(xp) {
    const levels = [
      { level: 1, xp_required: 0 },
      { level: 2, xp_required: 100 },
      { level: 3, xp_required: 250 },
      { level: 4, xp_required: 500 },
      { level: 5, xp_required: 1000 },
      { level: 6, xp_required: 2000 },
      { level: 7, xp_required: 4000 },
      { level: 8, xp_required: 8000 },
      { level: 9, xp_required: 16000 },
      { level: 10, xp_required: 32000 }
    ];

    for (let i = levels.length - 1; i >= 0; i--) {
      if (xp >= levels[i].xp_required) {
        return levels[i].level;
      }
    }

    return 1;
  }

  async handleLevelUp(userId, newLevel, oldLevel) {
    try {
      logger.info(`User ${userId} leveled up from ${oldLevel} to ${newLevel}`);
    } catch (error) {
      logger.error('Handle level up error:', error);
    }
  }

  async awardBadge(userId, badgeName) {
    try {
      const badge = await Badge.findOne({ where: { name: badgeName } });

      if (!badge) return { already_earned: false, badge: null };

      const existingBadge = await UserBadge.findOne({
        where: { user_id: userId, badge_id: badge.id }
      });

      if (existingBadge) {
        return { already_earned: true, badge };
      }

      await UserBadge.create({
        user_id: userId,
        badge_id: badge.id,
        earned_at: new Date(),
        metadata: {}
      });

      // Award badge XP without triggering another badge check (avoids recursion)
      if (badge.xp_reward > 0) {
        let progress = await UserProgress.findOne({ where: { user_id: userId } });
        if (progress) {
          progress.xp += badge.xp_reward;
          const newLevel = this.calculateLevel(progress.xp);
          if (newLevel > progress.level) {
            progress.level = newLevel;
          }
          await progress.save();
        }
      }

      logger.info(`Badge awarded: ${badge.name} to user ${userId}`);
      return { awarded: true, badge };
    } catch (error) {
      logger.error('Award badge error:', error);
      return { awarded: false, badge: null };
    }
  }

  async checkAndAwardBadges(userId, action, metadata = {}) {
    try {
      const allBadges = await Badge.findAll();
      const progress = await UserProgress.findOne({ where: { user_id: userId } });
      if (!progress) return [];

      const userBadges = await UserBadge.findAll({ where: { user_id: userId } });
      const earnedBadgeIds = new Set(userBadges.map((ub) => String(ub.badge_id)));

      const newlyEarned = [];

      for (const badge of allBadges) {
        if (earnedBadgeIds.has(String(badge.id))) continue;

        const meets = this.checkBadgeCriteria(badge, progress, action, metadata);
        if (meets) {
          const result = await this.awardBadge(userId, badge.name);
          if (result.awarded) {
            newlyEarned.push(badge);
          }
        }
      }

      return newlyEarned;
    } catch (error) {
      logger.error('Check and award badges error:', error);
      return [];
    }
  }

  checkBadgeCriteria(badge, userProgress, action, metadata) {
    const criteria = badge.criteria;
    if (!criteria) return false;

    switch (criteria.type) {
      case 'first_lesson':
        return (
          (action === 'lesson_complete' || /^lesson:/i.test(String(action || ''))) &&
          userProgress.total_lessons_completed >= 1
        );

      case 'streak':
        return userProgress.streak >= criteria.value;

      case 'first_contribution':
        return action === 'contribution' && userProgress.total_contributions >= 1;

      case 'perfect_quizzes':
        return (
          (action === 'quiz_complete' || action === 'practice_complete') &&
          metadata.is_perfect === true &&
          userProgress.total_quizzes_completed >= criteria.value
        );

      case 'lessons_per_day':
        return (
          (action === 'lesson_complete' || /^lesson:/i.test(String(action || ''))) &&
          typeof metadata.lessons_today === 'number' &&
          metadata.lessons_today >= criteria.value
        );

      case 'level':
        return userProgress.level >= criteria.value;

      default:
        return false;
    }
  }

  async getUserProgress(userId) {
    try {
      let progress = await UserProgress.findOne({ where: { user_id: userId } });

      if (!progress) {
        progress = await UserProgress.create({
          user_id: userId,
          xp: 0,
          level: 1,
          streak: 0,
          last_activity_date: new Date()
        });
      }

      const syncedLevel = this.calculateLevel(Math.max(0, Number(progress.xp) || 0));
      if (syncedLevel !== Number(progress.level)) {
        progress.level = syncedLevel;
        await progress.save({ fields: ['level'] });
      }

      const nextLevelXP = this.getXPForLevel(progress.level + 1);
      const currentLevelXP = this.getXPForLevel(progress.level);
      const xpForNextLevel = nextLevelXP - currentLevelXP;
      const xpInCurrentLevel = progress.xp - currentLevelXP;
      const progressPercentage = xpForNextLevel > 0
        ? Math.min(100, Math.max(0, (xpInCurrentLevel / xpForNextLevel) * 100))
        : 100;

      return {
        ...progress.toJSON(),
        next_level_xp: nextLevelXP,
        xp_for_next_level: xpForNextLevel,
        xp_in_current_level: xpInCurrentLevel,
        progressPercentage
      };
    } catch (error) {
      logger.error('Get user progress error:', error);
      throw error;
    }
  }

  getXPForLevel(level) {
    const levelRequirements = {
      1: 0,
      2: 100,
      3: 250,
      4: 500,
      5: 1000,
      6: 2000,
      7: 4000,
      8: 8000,
      9: 16000,
      10: 32000
    };

    return levelRequirements[level] || 32000 + (level - 10) * 10000;
  }

  async resetWeeklyLeaderboards() {
    logger.info('Weekly leaderboard reset (no-op: using UserProgress XP directly)');
  }
}

module.exports = new GamificationService();

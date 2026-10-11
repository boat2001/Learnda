const express = require('express');
const { getClassLevel } = require('../config/educationStructure');
const { Op } = require('sequelize');

const router = express.Router();

const { authenticate, optionalAuth } = require('../middleware/auth');
const db = require('../models');
const {
  Badge, User, UserBadge, UserProgress,
  StudyGroupMember, StudyGroupMessage, CommunityPost, CommunityReply, ContentEngagement,
  ContentStats, Comment, Notification, SpotlightAward, SpotlightReaction, Contribution, Event,
  sequelize: gamSeq,
} = db;
const gamificationService = require('../services/gamificationService');
const notificationService = require('../services/notificationService');

const toPositiveInteger = (value, fallback) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.round(numeric);
};

const formatLeaderboardEntry = (progress, rank, currentUserId = null) => ({
  id: progress.user_id,
  user_id: progress.user_id,
  rank,
  xp: Math.max(0, Number(progress.xp) || 0),
  score: Math.max(0, Number(progress.xp) || 0),
  level: Math.max(1, Number(progress.level) || 1),
  streak: Math.max(0, Number(progress.streak) || 0),
  is_current_user: currentUserId ? String(progress.user_id) === String(currentUserId) : false,
  user: progress.user
    ? {
        id: progress.user.id,
        full_name: progress.user.full_name,
        avatar_url: progress.user.avatar_url,
      }
    : null,
});

const GHANA_UTC_OFFSET_MINUTES = 0;
const STUDENT_SPOTLIGHT_PUBLISH_HOUR = 18;
const CONTRIBUTOR_SPOTLIGHT_PUBLISH_HOUR = 18;

const addMinutes = (date, minutes) => new Date(date.getTime() + (minutes * 60 * 1000));

async function loadProgressActivityTotals(userId) {
  if (!gamSeq) return null;

  const [{ lessonsFromEngagements }] = await gamSeq.query(
    `SELECT COUNT(DISTINCT ce.content_id)::int AS "lessonsFromEngagements"
     FROM content_engagements ce
     JOIN all_content ac ON ac.id = ce.content_id
     WHERE ce.user_id = :uid AND ce.action = 'complete'
       AND ac.content_type IN ('lesson','video_lesson')`,
    { replacements: { uid: userId }, type: gamSeq.QueryTypes.SELECT }
  );

  const [{ quizzesFromEngagements }] = await gamSeq.query(
    `SELECT COUNT(DISTINCT ce.content_id)::int AS "quizzesFromEngagements"
     FROM content_engagements ce
     JOIN all_content ac ON ac.id = ce.content_id
     WHERE ce.user_id = :uid AND ce.action = 'complete'
       AND ac.content_type = 'text_item' AND ac.subtype IN ('quiz','past_question')`,
    { replacements: { uid: userId }, type: gamSeq.QueryTypes.SELECT }
  );

  const contributionsApproved = Contribution
    ? await Contribution.count({ where: { uploader_id: userId, status: 'approved' } })
    : 0;

  return {
    lessonsFromEngagements: Math.max(0, Number(lessonsFromEngagements) || 0),
    quizzesFromEngagements: Math.max(0, Number(quizzesFromEngagements) || 0),
    contributionsApproved: Math.max(0, Number(contributionsApproved) || 0),
  };
}

const startOfGhanaDayUtc = (date) => {
  const local = addMinutes(date, GHANA_UTC_OFFSET_MINUTES);
  return addMinutes(
    new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 0, 0, 0, 0)),
    -GHANA_UTC_OFFSET_MINUTES
  );
};

const getWeeklySpotlightWindow = (now = new Date()) => {
  const localNow = addMinutes(now, GHANA_UTC_OFFSET_MINUTES);
  const todayStart = startOfGhanaDayUtc(now);
  const day = localNow.getUTCDay();
  const daysSinceSaturday = (day + 1) % 7;
  let publishAt = new Date(todayStart.getTime() - (daysSinceSaturday * 24 * 60 * 60 * 1000));
  publishAt.setUTCHours(STUDENT_SPOTLIGHT_PUBLISH_HOUR, 0, 0, 0);

  if (now < publishAt) {
    publishAt = new Date(publishAt.getTime() - (7 * 24 * 60 * 60 * 1000));
  }

  const periodEnd = new Date(publishAt);
  periodEnd.setUTCHours(23, 59, 59, 999);
  const periodStart = new Date(periodEnd.getTime() - (6 * 24 * 60 * 60 * 1000));
  periodStart.setUTCHours(0, 0, 0, 0);

  return { periodStart, periodEnd, publishedAt: publishAt };
};

const getMonthlySpotlightWindow = (now = new Date()) => {
  const localNow = addMinutes(now, GHANA_UTC_OFFSET_MINUTES);
  let year = localNow.getUTCFullYear();
  let month = localNow.getUTCMonth();
  const publishAt = new Date(Date.UTC(year, month + 1, 0, CONTRIBUTOR_SPOTLIGHT_PUBLISH_HOUR, 0, 0, 0));

  if (now < publishAt) {
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
  }

  const periodStart = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const periodEnd = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
  const actualPublishAt = new Date(Date.UTC(year, month + 1, 0, CONTRIBUTOR_SPOTLIGHT_PUBLISH_HOUR, 0, 0, 0));

  return { periodStart, periodEnd, publishedAt: actualPublishAt };
};

const formatSpotlightDate = (date) =>
  date ? date.toISOString().slice(0, 10) : null;

const formatSpotlightUser = (user = {}) => {
  const profile = user.academic_profile || null;
  const classLevel = profile?.class_level || null;
  return {
    id: user.id || null,
    name: user.full_name || 'Learnda learner',
    // A learner's public identity is their class, not an institution (§1.2).
    class_level: classLevel,
    class_label: classLevel ? getClassLevel(classLevel)?.label || classLevel : null,
    level_group: profile?.level_group || null,
    image: user.avatar_url || null,
  };
};

const getSpotlightShareUrl = (awardId) => `/home?spotlight=${encodeURIComponent(awardId)}`;

const buildSpotlightShareText = (award) => {
  if (!award) return 'Learnda is celebrating student achievement. Join the applause.';
  if (award.award_type === 'student') {
    return `${award.name} just topped Learnda's weekly XP leaderboard with ${Number(award.xp || award.score || 0).toLocaleString()} XP. Celebrate this win with the community.`;
  }
  return `${award.name} is Learnda's Contributor of the Month after creating real impact for learners. Celebrate and share the win.`;
};

const decorateSpotlightAward = async (award, currentUserId = null) => {
  if (!award) return null;
  const celebrationCount = SpotlightReaction
    ? await SpotlightReaction.count({ where: { award_id: award.award_id, action: 'celebrate' } }).catch(() => 0)
    : 0;
  const hasCelebrated = currentUserId && SpotlightReaction
    ? Boolean(await SpotlightReaction.findOne({
        where: { award_id: award.award_id, user_id: currentUserId, action: 'celebrate' },
        attributes: ['id'],
      }).catch(() => null))
    : false;

  return {
    ...award,
    celebration_count: celebrationCount,
    has_celebrated: hasCelebrated,
    share_url: getSpotlightShareUrl(award.award_id),
    share_text: buildSpotlightShareText(award),
  };
};

const getStableSpotlightAward = async (award, cycleKey) => {
  if (!award || !SpotlightAward || !cycleKey) return award;

  try {
    const snapshot = {
      ...award,
      cycle_key: cycleKey,
    };

    const [record] = await SpotlightAward.findOrCreate({
      where: {
        award_type: award.award_type,
        cycle_key: cycleKey,
      },
      defaults: {
        award_id: award.award_id,
        award_type: award.award_type,
        cycle_key: cycleKey,
        user_id: award.user_id || null,
        period_start: award.period_start || null,
        period_end: award.period_end || null,
        published_at: award.published_at || null,
        snapshot,
      },
    });

    const storedSnapshot = record.snapshot && typeof record.snapshot === 'object'
      ? record.snapshot
      : {};

    return {
      ...storedSnapshot,
      award_id: record.award_id,
      award_type: record.award_type,
      cycle_key: record.cycle_key,
      user_id: record.user_id || storedSnapshot.user_id || null,
      period_start: record.period_start?.toISOString?.() || storedSnapshot.period_start || null,
      period_end: record.period_end?.toISOString?.() || storedSnapshot.period_end || null,
      published_at: record.published_at?.toISOString?.() || storedSnapshot.published_at || null,
    };
  } catch {
    return award;
  }
};

const updateSpotlightCelebrationNotification = async ({ awardId, awardType, targetUserId, celebrationCount }) => {
  if (!Notification || !targetUserId) return;

  const title = awardType === 'student'
    ? 'Your Student of the Week spotlight is getting love'
    : 'Your Contributor of the Month spotlight is getting love';
  const body = `${celebrationCount.toLocaleString()} ${celebrationCount === 1 ? 'person has' : 'people have'} celebrated your spotlight so far.`;
  const actionUrl = getSpotlightShareUrl(awardId);

  const existing = await Notification.findOne({
    where: {
      user_id: targetUserId,
      type: 'spotlight_celebration_summary',
      action_url: actionUrl,
    },
    order: [['created_at', 'DESC']],
  }).catch(() => null);

  const data = {
    award_id: awardId,
    award_type: awardType,
    celebration_count: celebrationCount,
  };

  if (existing) {
    await existing.update({ title, body, data, is_read: false, read_at: null }).catch(() => null);
    return;
  }

  await notificationService.createNotification({
    userId: targetUserId,
    title,
    body,
    type: 'spotlight_celebration_summary',
    action_url: actionUrl,
    data,
  }).catch(() => null);
};

router.get('/progress', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const progress = await gamificationService.getUserProgress(userId);

    let derived = null;
    try {
      derived = await loadProgressActivityTotals(userId);
    } catch (_e) {
      derived = null;
    }

    const storedLessons = Math.max(0, Number(progress.total_lessons_completed) || 0);
    const storedQuizzes = Math.max(0, Number(progress.total_quizzes_completed) || 0);
    const storedContributions = Math.max(0, Number(progress.total_contributions) || 0);

    const totalLessons = derived != null ? derived.lessonsFromEngagements : storedLessons;
    const totalQuizzes = derived != null ? derived.quizzesFromEngagements : storedQuizzes;
    const totalContributions = derived != null ? derived.contributionsApproved : storedContributions;

    if (derived != null) {
      await UserProgress.update(
        {
          total_lessons_completed: totalLessons,
          total_quizzes_completed: totalQuizzes,
          total_contributions: totalContributions,
        },
        { where: { user_id: userId } }
      ).catch(() => null);
    }

    res.json({
      success: true,
      xp: Math.max(0, Number(progress.xp) || 0),
      currentXP: Math.max(0, Number(progress.xp) || 0),
      level: Math.max(1, Number(progress.level) || 1),
      streak: Math.max(0, Number(progress.streak) || 0),
      next_level_xp: Math.max(0, Number(progress.next_level_xp) || 0),
      xp_for_next_level: Math.max(0, Number(progress.xp_for_next_level) || 0),
      xp_in_current_level: Math.max(0, Number(progress.xp_in_current_level) || 0),
      progress_percentage: Math.max(0, Number(progress.progressPercentage) || 0),
      progressPercentage: Math.max(0, Number(progress.progressPercentage) || 0),
      total_lessons_completed: totalLessons,
      total_quizzes_completed: totalQuizzes,
      total_contributions: totalContributions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to load gamification progress',
    });
  }
});

router.get('/overview', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const safe = (promise) => promise.catch(() => 0);

    // Raw SQL helper: count DISTINCT edutainment items the user has consumed (viewed or completed)
    // matching the joined all_content condition. Counting distinct content_id — not distinct ce.id —
    // avoids inflating the number when a user views/likes/saves the same item multiple times.
    const edutEngagementSql = (sqlCondition) => gamSeq.query(
      `SELECT COUNT(DISTINCT ce.content_id)::int AS cnt
       FROM content_engagements ce
       JOIN all_content ac ON ac.id = ce.content_id
       WHERE ce.user_id = :uid AND ce.action IN ('view','complete') AND (${sqlCondition})`,
      { replacements: { uid: userId }, type: gamSeq.QueryTypes.SELECT }
    ).then(([row]) => Number(row?.cnt || 0));

    const [
      groupsCount,
      studyGroupMessagesCount,
      communityPostsCount,
      communityRepliesCount,
      filesViewedCount,
      filesDownloadedCount,
      resourcePreviewEventsCount,
      resourceDownloadEventsCount,
      edutArticlesCount,
      edutStoriesCount,
      edutFactsCount,
      edutQuotesCount,
      edutJocularCount,
    ] = await Promise.all([
      safe(StudyGroupMember
        ? StudyGroupMember.count({ where: { user_id: userId, status: 'active' } })
        : Promise.resolve(0)),
      safe(StudyGroupMessage
        ? StudyGroupMessage.count({ where: { user_id: userId } })
        : Promise.resolve(0)),
      safe(CommunityPost
        ? CommunityPost.count({ where: { user_id: userId } })
        : Promise.resolve(0)),
      safe(CommunityReply
        ? CommunityReply.count({ where: { user_id: userId } })
        : Promise.resolve(0)),
      safe(ContentEngagement
        ? ContentEngagement.count({ where: { user_id: userId, action: 'view' }, distinct: true, col: 'content_id' })
        : Promise.resolve(0)),
      safe(ContentEngagement
        ? ContentEngagement.count({ where: { user_id: userId, action: ['save', 'bookmark'] }, distinct: true, col: 'content_id' })
        : Promise.resolve(0)),
      safe(Event
        ? Event.count({ where: { user_id: userId, event_type: 'resources_file_preview_open' } })
        : Promise.resolve(0)),
      safe(Event
        ? Event.count({ where: { user_id: userId, event_type: 'resource_downloaded' } })
        : Promise.resolve(0)),
      // Articles — blog_post subtype
      safe(edutEngagementSql(`ac.subtype = 'blog_post'`)),
      // Stories — edutainment tagged 'story' or 'stories'
      safe(edutEngagementSql(`ac.subtype = 'edutainment' AND ac.tags && ARRAY['story','stories']`)),
      // Facts — edutainment tagged 'fact', 'facts', 'did-you-know', 'did_you_know'
      safe(edutEngagementSql(`ac.subtype = 'edutainment' AND ac.tags && ARRAY['fact','facts','did-you-know','did_you_know']`)),
      // Quotes — subtype 'quote' OR edutainment tagged 'quote'
      safe(edutEngagementSql(`ac.subtype = 'quote' OR (ac.subtype = 'edutainment' AND ac.tags && ARRAY['quote'])`)),
      // Joculars — edutainment tagged 'joke', 'humor', or 'jocular'
      safe(edutEngagementSql(`ac.subtype = 'edutainment' AND ac.tags && ARRAY['joke','humor','jocular']`)),
    ]);

    const communityEngagementScore = (communityPostsCount * 3) + communityRepliesCount;
    const networkActivenessScore = (groupsCount * 5) + studyGroupMessagesCount;

    res.json({
      success: true,
      groups_joined: groupsCount,
      network_activeness_score: networkActivenessScore,
      community_posts: communityPostsCount,
      community_replies: communityRepliesCount,
      community_engagement_score: communityEngagementScore,
      files_viewed: filesViewedCount + resourcePreviewEventsCount,
      files_downloaded: filesDownloadedCount + resourceDownloadEventsCount,
      edutainment_articles: edutArticlesCount,
      edutainment_stories: edutStoriesCount,
      edutainment_facts: edutFactsCount,
      edutainment_quotes: edutQuotesCount,
      edutainment_joculars: edutJocularCount,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to load overview' });
  }
});

router.get('/leaderboard', optionalAuth, async (req, res) => {
  try {
    const limit = Math.min(250, toPositiveInteger(req.query.limit, 100));

    const rows = await UserProgress.findAll({
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'full_name', 'avatar_url'],
        },
      ],
      order: [
        ['xp', 'DESC'],
        ['level', 'DESC'],
        ['streak', 'DESC'],
      ],
    });

    const currentUserId = req.user?.id || null;
    const rankedRows = rows.map((row, index) => formatLeaderboardEntry(row, index + 1, currentUserId));
    const leaderboard = rankedRows.slice(0, limit);
    const currentUserEntry = rankedRows.find((entry) => entry.is_current_user) || null;

    res.json({
      success: true,
      leaderboard,
      current_user_rank: currentUserEntry?.rank || null,
      type: req.query.type || 'global',
      timeFrame: req.query.timeFrame || 'weekly',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to load leaderboard',
    });
  }
});

router.get('/spotlights', optionalAuth, async (req, res) => {
  try {
    const now = new Date();
    const weeklyWindow = getWeeklySpotlightWindow(now);
    const monthlyWindow = getMonthlySpotlightWindow(now);

    const topProgress = await UserProgress.findOne({
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'full_name', 'avatar_url'],
        },
      ],
      order: [
        ['xp', 'DESC'],
        ['level', 'DESC'],
        ['streak', 'DESC'],
      ],
    });

    let student = null;
    if (topProgress?.user) {
      const profile = formatSpotlightUser(topProgress.user);
      const xp = Math.max(0, Number(topProgress.xp) || 0);
      student = {
        ...profile,
        award_id: `student:${formatSpotlightDate(weeklyWindow.periodEnd)}:${profile.id || 'unknown'}`,
        award_type: 'student',
        user_id: profile.id || null,
        title: 'Student of the Week',
        score: xp,
        xp,
        rank: 1,
        published_at: weeklyWindow.publishedAt.toISOString(),
        period_start: weeklyWindow.periodStart.toISOString(),
        period_end: weeklyWindow.periodEnd.toISOString(),
        body: `${profile.name} finished first on the weekly XP leaderboard with ${xp.toLocaleString()} XP for the week ending ${formatSpotlightDate(weeklyWindow.periodEnd)}.`,
        achievement_label: `${xp.toLocaleString()} XP`,
        badge_label: 'Weekly #1',
      };
    }

    // Fetch published content in monthly window from all_content view, joined with creator and stats
    const publishedContentRaw = await gamSeq.query(
      `SELECT ac.*, u.id AS creator_id_u, u.full_name, u.avatar_url,
              cs.total_views, cs.like_count, cs.save_count, cs.total_completions
       FROM all_content ac
       LEFT JOIN users u ON u.id = ac.creator_id
       LEFT JOIN content_stats cs ON cs.content_id = ac.id
       WHERE ac.status = 'published'
         AND ac.published_at >= :start AND ac.published_at <= :end`,
      {
        replacements: { start: monthlyWindow.periodStart, end: monthlyWindow.periodEnd },
        type: gamSeq.QueryTypes.SELECT,
      }
    );
    // Shape into the same structure the rest of the code expects
    const publishedContent = publishedContentRaw.map((row) => ({
      id: row.id,
      creator_id: row.creator_id,
      creator: row.full_name ? { id: row.creator_id, full_name: row.full_name, avatar_url: row.avatar_url } : null,
      stats: { total_views: row.total_views || 0, like_count: row.like_count || 0, save_count: row.save_count || 0, total_completions: row.total_completions || 0 },
      comments: [],
    }));

    const engagementRows = ContentEngagement && publishedContent.length
      ? await ContentEngagement.findAll({
          where: {
            content_id: publishedContent.map((item) => item.id),
            action: { [Op.in]: ['view', 'complete', 'like', 'save', 'share', 'bookmark', 'rate'] },
          },
          attributes: ['content_id', 'action'],
        })
      : [];

    const engagementByContent = new Map();
    engagementRows.forEach((row) => {
      const key = String(row.content_id);
      const current = engagementByContent.get(key) || {
        views: 0,
        completions: 0,
        likes: 0,
        saves: 0,
        shares: 0,
        reactions: 0,
      };
      if (row.action === 'view') current.views += 1;
      else if (row.action === 'complete') current.completions += 1;
      else if (row.action === 'like') current.likes += 1;
      else if (row.action === 'save' || row.action === 'bookmark') current.saves += 1;
      else if (row.action === 'share') current.shares += 1;
      else if (row.action === 'rate') current.reactions += 1;
      engagementByContent.set(key, current);
    });

    const contributorScores = new Map();
    publishedContent.forEach((content) => {
      const creator = content.creator;
      if (!creator?.id) return;

      const key = String(creator.id);
      const current = contributorScores.get(key) || {
        user: creator,
        content_count: 0,
        views: 0,
        completions: 0,
        likes: 0,
        saves: 0,
        shares: 0,
        reactions: 0,
        comments: 0,
        comment_likes: 0,
      };
      const stats = content.stats || {};
      const liveEngagement = engagementByContent.get(String(content.id)) || {};
      const comments = Array.isArray(content.comments) ? content.comments : [];

      current.content_count += 1;
      current.views += Math.max(Number(stats.total_views) || 0, Number(liveEngagement.views) || 0);
      current.completions += Math.max(Number(stats.total_completions) || 0, Number(liveEngagement.completions) || 0);
      current.likes += Math.max(Number(stats.like_count) || 0, Number(liveEngagement.likes) || 0);
      current.saves += Math.max(Number(stats.save_count) || 0, Number(liveEngagement.saves) || 0);
      current.shares += Math.max(Number(stats.share_count) || 0, Number(liveEngagement.shares) || 0);
      current.reactions += Number(liveEngagement.reactions) || 0;
      current.comments += comments.length;
      current.comment_likes += comments.reduce((sum, comment) => sum + (Number(comment.likes) || 0), 0);

      contributorScores.set(key, current);
    });

    const scoreWeights = {
      content: 100,
      view: 1,
      completion: 5,
      like: 4,
      save: 3,
      share: 6,
      reaction: 4,
      comment: 5,
      comment_like: 2,
    };

    const topContributor = [...contributorScores.values()]
      .map((entry) => ({
        ...entry,
        score:
          (entry.content_count * scoreWeights.content) +
          (entry.views * scoreWeights.view) +
          (entry.completions * scoreWeights.completion) +
          (entry.likes * scoreWeights.like) +
          (entry.saves * scoreWeights.save) +
          (entry.shares * scoreWeights.share) +
          (entry.reactions * scoreWeights.reaction) +
          (entry.comments * scoreWeights.comment) +
          (entry.comment_likes * scoreWeights.comment_like),
      }))
      .sort((a, b) => b.score - a.score || b.content_count - a.content_count)[0] || null;

    let contributor = null;
    if (topContributor?.user) {
      const profile = formatSpotlightUser(topContributor.user);
      contributor = {
        ...profile,
        award_id: `contributor:${monthlyWindow.periodStart.toISOString().slice(0, 7)}:${profile.id || 'unknown'}`,
        award_type: 'contributor',
        user_id: profile.id || null,
        title: 'Contributor of the Month',
        score: topContributor.score,
        contributor_score: topContributor.score,
        content_count: topContributor.content_count,
        reach: topContributor.views + topContributor.completions,
        engagement:
          topContributor.likes +
          topContributor.saves +
          topContributor.shares +
          topContributor.reactions +
          topContributor.comments +
          topContributor.comment_likes,
        published_at: monthlyWindow.publishedAt.toISOString(),
        period_start: monthlyWindow.periodStart.toISOString(),
        period_end: monthlyWindow.periodEnd.toISOString(),
        body: `${profile.name} led contributor impact for ${monthlyWindow.periodStart.toLocaleString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' })}, with ${topContributor.content_count.toLocaleString()} published item${topContributor.content_count === 1 ? '' : 's'} and a contributor score of ${topContributor.score.toLocaleString()}.`,
        achievement_label: `${topContributor.score.toLocaleString()} pts`,
        badge_label: 'Monthly impact',
        score_breakdown: {
          uploads: topContributor.content_count,
          views: topContributor.views,
          completions: topContributor.completions,
          likes: topContributor.likes,
          saves: topContributor.saves,
          shares: topContributor.shares,
          reactions: topContributor.reactions,
          comments: topContributor.comments,
          comment_likes: topContributor.comment_likes,
          weights: scoreWeights,
        },
      };
    }

    const studentCycleKey = `week:${formatSpotlightDate(weeklyWindow.periodEnd)}`;
    const contributorCycleKey = `month:${monthlyWindow.periodStart.toISOString().slice(0, 7)}`;
    const [stableStudent, stableContributor] = await Promise.all([
      getStableSpotlightAward(student, studentCycleKey),
      getStableSpotlightAward(contributor, contributorCycleKey),
    ]);

    const [decoratedStudent, decoratedContributor, studentCount, contributorCount] = await Promise.all([
      decorateSpotlightAward(stableStudent, req.user?.id || null),
      decorateSpotlightAward(stableContributor, req.user?.id || null),
      UserProgress.count().catch(() => 0),
      gamSeq.query(
        `SELECT COUNT(DISTINCT creator_id)::int AS cnt FROM all_content WHERE status = 'published'`,
        { type: gamSeq.QueryTypes.SELECT }
      ).then(([row]) => Number(row?.cnt || 0)).catch(() => 0),
    ]);

    if (decoratedStudent) decoratedStudent.rank_of = studentCount;
    if (decoratedContributor) decoratedContributor.rank_of = contributorCount;

    const currentUserId = req.user?.id ? String(req.user.id) : null;
    const isStudentWinner = Boolean(currentUserId && decoratedStudent?.user_id && String(decoratedStudent.user_id) === currentUserId);
    const isContributorWinner = Boolean(currentUserId && decoratedContributor?.user_id && String(decoratedContributor.user_id) === currentUserId);

    // Send a one-time "you won" notification to the winner
    if (currentUserId && Notification) {
      const winnerCandidates = [
        isStudentWinner ? { award: decoratedStudent, type: 'student' } : null,
        isContributorWinner ? { award: decoratedContributor, type: 'contributor' } : null,
      ].filter(Boolean);

      for (const { award, type } of winnerCandidates) {
        const winActionUrl = `/progress?award=${encodeURIComponent(award.award_id)}`;
        const alreadyNotified = await Notification.findOne({
          where: { user_id: req.user.id, type: 'spotlight_win', action_url: winActionUrl },
        }).catch(() => null);

        if (!alreadyNotified) {
          const isStudent = type === 'student';
          await notificationService.createNotification({
            userId: req.user.id,
            title: isStudent ? "You've won Student of the Week! 🎉" : "You've won Contributor of the Month! 🎉",
            body: isStudent
              ? 'Congratulations! You topped the weekly XP leaderboard. Head to your Progress page to see your achievement under Achievements.'
              : "Congratulations! You're this month's top contributor. Head to your Progress page to see your achievement under Achievements.",
            type: 'spotlight_win',
            action_url: winActionUrl,
            data: { award_id: award.award_id, award_type: type },
          }).catch(() => null);
        }
      }
    }

    res.json({
      success: true,
      student: decoratedStudent,
      contributor: decoratedContributor,
      is_student_winner: isStudentWinner,
      is_contributor_winner: isContributorWinner,
      rules: {
        student_of_week: {
          source: 'weekly XP leaderboard',
          publish_cadence: 'Saturday evening',
          publish_hour_local: STUDENT_SPOTLIGHT_PUBLISH_HOUR,
          period_start: weeklyWindow.periodStart.toISOString(),
          period_end: weeklyWindow.periodEnd.toISOString(),
          published_at: weeklyWindow.publishedAt.toISOString(),
        },
        contributor_of_month: {
          source: 'published content uploads and engagement',
          publish_cadence: 'End of month',
          publish_hour_local: CONTRIBUTOR_SPOTLIGHT_PUBLISH_HOUR,
          period_start: monthlyWindow.periodStart.toISOString(),
          period_end: monthlyWindow.periodEnd.toISOString(),
          published_at: monthlyWindow.publishedAt.toISOString(),
          score_weights: scoreWeights,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to load spotlights',
    });
  }
});

router.get('/spotlights/counts', async (req, res) => {
  try {
    if (!SpotlightReaction) {
      return res.json({ success: true, counts: {} });
    }
    const rawIds = String(req.query.ids || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 4);
    if (!rawIds.length) {
      return res.json({ success: true, counts: {} });
    }
    const results = await Promise.all(
      rawIds.map((awardId) =>
        SpotlightReaction.count({ where: { award_id: awardId, action: 'celebrate' } })
          .then((count) => ({ awardId, count }))
          .catch(() => ({ awardId, count: 0 }))
      )
    );
    const counts = {};
    results.forEach(({ awardId, count }) => { counts[awardId] = count; });
    res.json({ success: true, counts });
  } catch {
    res.json({ success: true, counts: {} });
  }
});

router.post('/spotlights/:awardId/celebrate', authenticate, async (req, res) => {
  try {
    if (!SpotlightReaction) {
      return res.status(503).json({
        success: false,
        error: 'Spotlight celebrations are not available',
      });
    }

    const awardId = String(req.params.awardId || '').trim();
    const storedAward = SpotlightAward
      ? await SpotlightAward.findOne({
          where: { award_id: awardId },
          attributes: ['award_type', 'user_id'],
        }).catch(() => null)
      : null;
    const awardType = String(storedAward?.award_type || req.body?.award_type || req.body?.awardType || 'spotlight').trim().toLowerCase();
    const targetUserId = storedAward?.user_id || req.body?.target_user_id || req.body?.targetUserId || null;

    if (!awardId) {
      return res.status(400).json({
        success: false,
        error: 'Spotlight award id is required',
      });
    }

    const [, created] = await SpotlightReaction.findOrCreate({
      where: {
        award_id: awardId,
        user_id: req.user.id,
        action: 'celebrate',
      },
      defaults: {
        award_id: awardId,
        award_type: awardType,
        user_id: req.user.id,
        target_user_id: targetUserId,
        action: 'celebrate',
        metadata: {
          user_name: req.user.full_name || req.user.name || null,
        },
      },
    });

    const celebrationCount = await SpotlightReaction.count({
      where: { award_id: awardId, action: 'celebrate' },
    });

    // Award XP to the spotlight winner for each new celebration they receive
    if (created && targetUserId && String(targetUserId) !== String(req.user.id)) {
      await gamificationService.addXP(
        targetUserId,
        5,
        'spotlight_celebration',
        { award_id: awardId, award_type: awardType, celebrated_by: req.user.id }
      ).catch(() => null);
    }

    await updateSpotlightCelebrationNotification({
      awardId,
      awardType,
      targetUserId,
      celebrationCount,
    });

    res.json({
      success: true,
      award_id: awardId,
      award_type: awardType,
      celebration_count: celebrationCount,
      has_celebrated: true,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to celebrate spotlight',
    });
  }
});

router.post('/xp', authenticate, async (req, res) => {
  try {
    const amount = toPositiveInteger(req.body?.amount, 0);
    const reason = String(req.body?.reason || 'manual_award').trim() || 'manual_award';

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'XP amount must be greater than zero',
      });
    }

    const metadata = req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {};
    const xpResult = await gamificationService.addXP(req.user.id, amount, reason, metadata);

    const badgeAction = /^lesson:/i.test(reason)
      ? 'lesson_complete'
      : /^practice:/i.test(reason)
        ? 'practice_complete'
        : reason;

    // Update streak and check for newly earned badges on every XP event
    const [streakResult, newBadges] = await Promise.all([
      gamificationService.updateStreak(req.user.id),
      gamificationService.checkAndAwardBadges(req.user.id, badgeAction, metadata),
    ]);

    const progress = await gamificationService.getUserProgress(req.user.id);

    res.json({
      success: true,
      xp: Math.max(0, Number(progress.xp) || 0),
      currentXP: Math.max(0, Number(progress.xp) || 0),
      level: Math.max(1, Number(progress.level) || 1),
      streak: Math.max(0, Number(streakResult.streak) || Number(progress.streak) || 0),
      levelUp: Boolean(xpResult.level_up),
      level_up: Boolean(xpResult.level_up),
      newLevel: Math.max(1, Number(xpResult.new_level) || Number(progress.level) || 1),
      new_level: Math.max(1, Number(xpResult.new_level) || Number(progress.level) || 1),
      oldXP: Math.max(0, Number(xpResult.old_xp) || 0),
      newXP: Math.max(0, Number(xpResult.new_xp) || 0),
      newBadges: newBadges.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        icon_url: b.icon_url,
        xp_reward: b.xp_reward,
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to add XP',
    });
  }
});

router.get('/badges', optionalAuth, async (req, res) => {
  try {
    const badges = await Badge.findAll({
      order: [['created_at', 'ASC']],
    });

    res.json({
      success: true,
      badges,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to load badges',
    });
  }
});

router.get('/badges/earned', authenticate, async (req, res) => {
  try {
    const badges = await UserBadge.findAll({
      where: { user_id: req.user.id },
      include: [{ model: Badge, as: 'badge' }],
      order: [['earned_at', 'DESC']],
    });

    res.json({
      success: true,
      badges,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to load earned badges',
    });
  }
});

router.get('/achievements', authenticate, async (req, res) => {
  try {
    const progress = await gamificationService.getUserProgress(req.user.id);

    res.json({
      success: true,
      achievements: [
        {
          id: 'xp-progress',
          title: 'XP Progress',
          detail: `${Math.max(0, Number(progress.xp) || 0).toLocaleString()} XP collected so far.`,
        },
        {
          id: 'lesson-progress',
          title: 'Lessons Completed',
          detail: `${Math.max(0, Number(progress.total_lessons_completed) || 0)} lessons completed.`,
        },
      ],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to load achievements',
    });
  }
});

module.exports = router;

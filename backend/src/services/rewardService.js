const { Op } = require('sequelize');
const db = require('../models');
const {
  RewardTransaction,
  RewardPayout,
  User,
  UserProgress,
  ContentStats,
  ReferralDownload,
  sequelize: rewardSeq
} = db;
const config = require('../config/env');
const notificationService = require('./notificationService');

const REWARD_AMOUNTS = {
  invite_download: config.rewards.inviteDownloadAmount,
  invite_register: config.rewards.inviteRegisterAmount,
  streak_7_day: config.rewards.streakRewardAmount,
  contribute_bonus: config.rewards.contributeRewardAmount
};

const PAYOUT_THRESHOLD = config.rewards.payoutThreshold;

const TELCO_PREFIXES = [
  { name: 'MTN', prefixes: ['024', '025', '053', '054', '055', '059'] },
  { name: 'Telecel', prefixes: ['020', '050'] },
  { name: 'AT', prefixes: ['026', '027', '056', '057'] }
];

const normalizePhone = (value) => {
  const digitsOnly = String(value || '').replace(/\D/g, '');
  if (!digitsOnly) return null;

  if (digitsOnly.startsWith('233') && digitsOnly.length >= 12) {
    return `0${digitsOnly.slice(3, 12)}`;
  }
  if (digitsOnly.length === 9) {
    return `0${digitsOnly}`;
  }
  if (digitsOnly.length >= 10) {
    return digitsOnly.slice(-10);
  }
  return null;
};

const detectTelcoFromPhone = (phone) => {
  const normalized = normalizePhone(phone);
  if (!normalized || normalized.length < 3) return null;
  const prefix = normalized.slice(0, 3);
  const match = TELCO_PREFIXES.find((item) => item.prefixes.includes(prefix));
  return match ? match.name : null;
};

async function getReferralCounts(userId, type) {
  let referralCount = 0;

  if (type === 'invite_download') {
    referralCount = await ReferralDownload.count({
      where: { referrer_id: userId }
    });
  } else {
    referralCount = await User.count({
      where: { referred_by_user_id: userId }
    });
  }

  const rewardedCount = await RewardTransaction.count({
    where: {
      user_id: userId,
      type,
      status: { [Op.not]: 'rejected' }
    }
  });

  return { referralCount, rewardedCount };
}

async function recordTransaction({ userId, type, amount, status = 'approved', metadata = {} }) {
  const user = await User.findByPk(userId);
  const previousBalance = Number(user?.rewards_balance || 0);

  const transaction = await RewardTransaction.create({
    user_id: userId,
    type,
    amount,
    status,
    metadata,
    approved_at: status === 'approved' ? new Date() : null
  });

  if (!user) return transaction;

  const numericAmount = Number(amount);
  if (status === 'approved') {
    user.rewards_balance = previousBalance + numericAmount;
    user.rewards_lifetime = Number(user.rewards_lifetime || 0) + numericAmount;
  } else if (status === 'pending') {
    user.rewards_pending = Number(user.rewards_pending || 0) + numericAmount;
  }
  await user.save();

  try {
    await notificationService.createNotification({
      userId,
      title: 'Reward credited',
      body: `GHS ${Number(amount).toFixed(2)} added to your rewards balance.`,
      type: 'reward',
      action_url: '/settings?tab=account',
      data: { reward_type: type, amount }
    });
  } catch (error) {
    // Non-blocking
  }

  const currentBalance = Number(user.rewards_balance || 0);
  const crossedThreshold =
    status === 'approved' &&
    previousBalance < PAYOUT_THRESHOLD &&
    currentBalance >= PAYOUT_THRESHOLD;

  if (crossedThreshold && !user.payout_contact) {
    try {
      await notificationService.createNotification({
        userId,
        title: 'Payout setup available',
        body: `Your balance reached GHS ${PAYOUT_THRESHOLD}. Set payout contact in Account settings.`,
        type: 'reward_payout',
        action_url: '/settings?tab=account',
        data: {
          payout_threshold: PAYOUT_THRESHOLD,
          current_balance: currentBalance
        }
      });
    } catch (error) {
      // Non-blocking
    }
  }

  return transaction;
}

async function getSummary(userId) {
  const user = await User.findByPk(userId);
  const progress = await UserProgress.findOne({ where: { user_id: userId } });

  const downloadCounts = await getReferralCounts(userId, 'invite_download');
  const registerCounts = await getReferralCounts(userId, 'invite_register');

  const streakReward = await RewardTransaction.findOne({
    where: { user_id: userId, type: 'streak_7_day', status: { [Op.not]: 'rejected' } }
  });

  const contributeReward = await RewardTransaction.findOne({
    where: { user_id: userId, type: 'contribute_bonus', status: { [Op.not]: 'rejected' } }
  });

  const [{ publishedCount }] = await rewardSeq.query(
    `SELECT COUNT(*)::int AS "publishedCount" FROM all_content WHERE creator_id = :uid AND status = 'published'`,
    { replacements: { uid: userId }, type: rewardSeq.QueryTypes.SELECT }
  );

  const streakDays = progress?.streak || 0;
  const streakReady = streakDays >= 7 && !streakReward;
  const contributeReady = publishedCount > 0 && !contributeReward;
  const balance = Number(user?.rewards_balance || 0);
  const canSetPayoutContact = balance >= PAYOUT_THRESHOLD;
  const hasPayoutContact = Boolean(user?.payout_contact);

  return {
    balance,
    pending: Number(user?.rewards_pending || 0),
    lifetime: Number(user?.rewards_lifetime || 0),
    payout_threshold: PAYOUT_THRESHOLD,
    payout_contact: user?.payout_contact || null,
    payout_telco: user?.payout_telco || null,
    can_set_payout_contact: canSetPayoutContact,
    needs_payout_contact_setup: canSetPayoutContact && !hasPayoutContact,
    stages: {
      invite: {
        download: {
          status: downloadCounts.referralCount > downloadCounts.rewardedCount
            ? 'ready'
            : (downloadCounts.rewardedCount > 0 ? 'claimed' : 'locked'),
          available: Math.max(downloadCounts.referralCount - downloadCounts.rewardedCount, 0)
        },
        register: {
          status: registerCounts.referralCount > registerCounts.rewardedCount
            ? 'ready'
            : (registerCounts.rewardedCount > 0 ? 'claimed' : 'locked'),
          available: Math.max(registerCounts.referralCount - registerCounts.rewardedCount, 0)
        }
      },
      streak: {
        days: streakDays,
        status: streakReady ? 'ready' : (streakReward ? 'claimed' : 'locked')
      },
      contribute: {
        published_count: publishedCount,
        status: contributeReady ? 'ready' : (contributeReward ? 'claimed' : 'locked')
      }
    }
  };
}

async function claimReward(userId, type) {
  if (!REWARD_AMOUNTS[type]) {
    throw new Error('Unknown reward type');
  }

  if (type === 'streak_7_day') {
    const progress = await UserProgress.findOne({ where: { user_id: userId } });
    const streakDays = progress?.streak || 0;
    if (streakDays < 7) {
      throw new Error('Streak not completed yet');
    }
    const existing = await RewardTransaction.findOne({ where: { user_id: userId, type } });
    if (existing) {
      throw new Error('Streak reward already claimed');
    }
    return recordTransaction({ userId, type, amount: REWARD_AMOUNTS[type] });
  }

  if (type === 'contribute_bonus') {
    const [{ publishedCount }] = await rewardSeq.query(
      `SELECT COUNT(*)::int AS "publishedCount" FROM all_content WHERE creator_id = :uid AND status = 'published'`,
      { replacements: { uid: userId }, type: rewardSeq.QueryTypes.SELECT }
    );
    if (!publishedCount) {
      throw new Error('No approved contributions yet');
    }
    const existing = await RewardTransaction.findOne({ where: { user_id: userId, type } });
    if (existing) {
      throw new Error('Contribution reward already claimed');
    }
    return recordTransaction({ userId, type, amount: REWARD_AMOUNTS[type] });
  }

  if (type === 'invite_download' || type === 'invite_register') {
    const { referralCount, rewardedCount } = await getReferralCounts(userId, type);
    if (referralCount <= rewardedCount) {
      throw new Error('No eligible referrals yet');
    }
    return recordTransaction({ userId, type, amount: REWARD_AMOUNTS[type] });
  }

  throw new Error('Reward type not supported');
}

async function setPayoutContact(userId, contact, telco = null) {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const balance = Number(user.rewards_balance || 0);
  if (balance < PAYOUT_THRESHOLD) {
    throw new Error(`You can set payout contact only after reaching GHS ${PAYOUT_THRESHOLD}`);
  }

  const normalizedContact = normalizePhone(contact);
  if (!normalizedContact) {
    throw new Error('Provide a valid phone number');
  }

  const resolvedTelco = telco || detectTelcoFromPhone(normalizedContact) || 'Unknown';
  user.payout_contact = normalizedContact;
  user.payout_telco = resolvedTelco;
  user.payout_contact_set_at = new Date();
  await user.save();

  return {
    payout_contact: user.payout_contact,
    payout_telco: user.payout_telco,
    payout_contact_set_at: user.payout_contact_set_at
  };
}

async function buildRewardInsights(userId) {
  const [transactions, contentStatsRows, referralDownloads, referrals] = await Promise.all([
    RewardTransaction.findAll({
      where: {
        user_id: userId,
        status: { [Op.not]: 'rejected' }
      }
    }),
    rewardSeq.query(
      `SELECT cs.*, ac.id AS content_id_ref, ac.title AS content_title, ac.content_type AS content_type_ref, ac.subtype AS content_subtype
       FROM content_stats cs
       JOIN all_content ac ON ac.id = cs.content_id
       WHERE ac.creator_id = :uid AND ac.status = 'published'
       ORDER BY cs.total_views DESC
       LIMIT 10`,
      { replacements: { uid: userId }, type: rewardSeq.QueryTypes.SELECT }
    ),
    ReferralDownload.count({ where: { referrer_id: userId } }),
    User.count({ where: { referred_by_user_id: userId } })
  ]);

  const rewardBreakdown = transactions.reduce((acc, row) => {
    const key = row.type || 'other';
    if (!acc[key]) {
      acc[key] = { count: 0, total: 0 };
    }
    acc[key].count += 1;
    acc[key].total += Number(row.amount || 0);
    return acc;
  }, {});

  const engagement = contentStatsRows.reduce((acc, row) => {
    acc.views += Number(row.total_views || 0);
    acc.completions += Number(row.total_completions || 0);
    acc.likes += Number(row.like_count || 0);
    acc.saves += Number(row.save_count || 0);
    acc.shares += Number(row.share_count || 0);
    acc.avg_time_spent += Number(row.avg_time_spent || 0);
    return acc;
  }, {
    views: 0,
    completions: 0,
    likes: 0,
    saves: 0,
    shares: 0,
    avg_time_spent: 0
  });

  const topContent = contentStatsRows.slice(0, 5).map((row) => {
    let legacyType = row.content_type_ref || 'unknown';
    if (legacyType === 'lesson') legacyType = 'text_lesson';
    else if (legacyType === 'eduvhibe_video' || legacyType === 'video_lesson') legacyType = 'video';
    else if (legacyType === 'text_item') legacyType = row.content_subtype || 'text_item';
    return {
      content_id: row.content_id || row.content_id_ref,
      title: row.content_title || 'Untitled',
      type: legacyType,
      views: Number(row.total_views || 0),
      completions: Number(row.total_completions || 0),
      likes: Number(row.like_count || 0),
      saves: Number(row.save_count || 0),
      shares: Number(row.share_count || 0),
      avg_time_spent: Number(row.avg_time_spent || 0)
    };
  });

  const contentCount = contentStatsRows.length;
  const avgTimePerContent = contentCount ? Math.round(engagement.avg_time_spent / contentCount) : 0;

  return {
    generated_at: new Date(),
    reward_breakdown: rewardBreakdown,
    referral_metrics: {
      downloads: referralDownloads,
      registrations: referrals
    },
    engagement_metrics: {
      content_items: contentCount,
      views: engagement.views,
      completions: engagement.completions,
      likes: engagement.likes,
      saves: engagement.saves,
      shares: engagement.shares,
      avg_time_spent_seconds: avgTimePerContent
    },
    top_content: topContent
  };
}

async function requestPayout(userId, destination) {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const balance = Number(user.rewards_balance || 0);
  if (balance < PAYOUT_THRESHOLD) {
    throw new Error(`Minimum payout threshold is GHS ${PAYOUT_THRESHOLD}`);
  }

  const rawContact = destination || user.payout_contact;
  const normalizedContact = normalizePhone(rawContact);
  if (!normalizedContact) {
    throw new Error('Set payout contact before requesting payout');
  }

  const telco = user.payout_telco || detectTelcoFromPhone(normalizedContact) || null;
  const insights = await buildRewardInsights(userId);

  const payout = await RewardPayout.create({
    user_id: userId,
    amount: balance,
    destination: normalizedContact,
    destination_telco: telco,
    insights,
    status: 'requested',
    requested_at: new Date()
  });

  user.rewards_balance = 0;
  user.rewards_pending = Number(user.rewards_pending || 0) + balance;
  if (!user.payout_contact) {
    user.payout_contact = normalizedContact;
  }
  if (!user.payout_telco && telco) {
    user.payout_telco = telco;
  }
  await user.save();

  try {
    await notificationService.createNotification({
      userId,
      title: 'Payout request submitted',
      body: `Your payout request for GHS ${balance.toFixed(2)} is awaiting admin approval.`,
      type: 'reward_payout',
      action_url: '/settings?tab=account',
      data: { payout_id: payout.id, amount: balance }
    });
  } catch (error) {
    // Non-blocking
  }

  try {
    const admins = await User.findAll({
      where: { role: 'admin' },
      attributes: ['id']
    });

    await Promise.all(
      admins.map((admin) => notificationService.createNotification({
        userId: admin.id,
        title: 'New payout request',
        body: `${user.full_name || user.email} requested payout for GHS ${balance.toFixed(2)}.`,
        type: 'admin_payout_request',
        action_url: '/admin',
        data: {
          payout_id: payout.id,
          requester_user_id: userId,
          amount: balance
        }
      }))
    );
  } catch (error) {
    // Non-blocking
  }

  return payout;
}

async function listTransactions(userId) {
  return RewardTransaction.findAll({
    where: { user_id: userId },
    order: [['created_at', 'DESC']]
  });
}

async function listPayouts(userId) {
  return RewardPayout.findAll({
    where: { user_id: userId },
    order: [['requested_at', 'DESC']]
  });
}

async function trackReferralDownload({ referralCode, visitorId, source, ipAddress, userAgent }) {
  if (!referralCode) return null;

  const referrer = await User.findOne({ where: { invite_code: referralCode } });
  if (!referrer) return null;

  if (visitorId) {
    const existing = await ReferralDownload.findOne({
      where: { referrer_id: referrer.id, visitor_id: visitorId }
    });
    if (existing) return existing;
  }

  const download = await ReferralDownload.create({
    referrer_id: referrer.id,
    referral_code: referralCode,
    visitor_id: visitorId || null,
    ip_address: ipAddress || null,
    user_agent: userAgent || null,
    source: source || null
  });

  return download;
}

module.exports = {
  getSummary,
  claimReward,
  setPayoutContact,
  requestPayout,
  listTransactions,
  listPayouts,
  trackReferralDownload
};

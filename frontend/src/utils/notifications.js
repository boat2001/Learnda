const TYPE_LABELS = {
  subscription_expired: 'Contribution',
  subscription_auto_renewed: 'Contribution',
  subscription_renewal_reminder: 'Contribution',
  reward_earned: 'Rewards',
  reward_claimed: 'Rewards',
  reward_payout_requested: 'Rewards',
  reward_payout_approved: 'Rewards',
  reward_payout_rejected: 'Rewards',
  welcome_signup: 'Welcome',
  learning_reminder: 'Learning',
  reengagement: 'Learning',
  study_tip: 'Study tip',
  sharether_tip: 'Sharether tip',
};

const TITLE_SMALL = new Set(['a','an','the','and','but','or','nor','for','so','yet','at','by','in','of','on','to','up','as','into','onto','with','from','over','via']);
const toTitleCase = (value) => {
  const words = String(value || '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  return words.map((w, i) => {
    const l = w.toLowerCase();
    return i > 0 && i < words.length - 1 && TITLE_SMALL.has(l) ? l : w[0].toUpperCase() + w.slice(1);
  }).join(' ');
};

export const getNotificationTypeLabel = (type) =>
  TYPE_LABELS[type] || toTitleCase(type) || 'Update';

export const getNotificationData = (notification) => {
  const rawData = notification?.data;
  if (!rawData) return {};
  if (typeof rawData === 'object') return rawData;
  if (typeof rawData !== 'string') return {};

  try {
    const parsed = JSON.parse(rawData);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    return {};
  }
};

export const formatNotificationTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatDataDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const getNotificationFallbackBody = (notification, data) => {
  const planName = data.plan_name || data.plan || 'your plan';

  switch (notification?.type) {
    case 'subscription_expired':
      return `Your ${planName} contribution ended and your account was moved to Friend.`;
    case 'subscription_auto_renewed':
      return `Your ${planName} contribution was renewed successfully.`;
    case 'subscription_renewal_reminder':
      return `Your ${planName} active period is ending soon.`;
    default:
      return '';
  }
};

export const getNotificationDisplay = (notification) => {
  const data = getNotificationData(notification);
  const typeLabel = getNotificationTypeLabel(notification?.type);
  const title = String(notification?.title || typeLabel || 'Notification').trim();
  const body =
    String(notification?.body || '').trim() ||
    getNotificationFallbackBody(notification, data);
  const contextParts = [];

  if (data.plan_name) contextParts.push(`Plan: ${data.plan_name}`);
  if (data.reminder_days) contextParts.push(`${data.reminder_days} days left`);
  if (data.renewal_date) {
    const renewalDate = formatDataDate(data.renewal_date);
    if (renewalDate) contextParts.push(`Renewal: ${renewalDate}`);
  }
  if (data.points) contextParts.push(`${data.points} points`);
  if (data.amount) contextParts.push(`Amount: ${data.amount}`);

  return {
    title,
    body,
    typeLabel,
    context: contextParts.join(' • '),
    time: formatNotificationTime(notification?.created_at || notification?.createdAt),
  };
};

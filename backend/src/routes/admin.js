const express = require('express');
const path = require('path');
const fs = require('fs');
const { Op, fn, col, literal } = require('sequelize');
const {
  User,
  Notification,
  Subscription,
  Plan,
  ResourceFile,
  Contribution,
  Lesson,
  TextItem,
  ContentEngagement,
  ContentStats,
  UserProgress,
  Event,
  RewardPayout,
  SupportReport,
  NewsletterSubscription,
  StudyGroupMessage,
  CommunityPost,
  AcademicProfile,
  AdminAuditLog,
  PushToken,
  sequelize: dbSequelize,
} = require('../models');
const crypto = require('crypto');
const { authenticate, checkRole } = require('../middleware/auth');
const notificationService = require('../services/notificationService');
const { sendEmail } = require('../services/emailService');
const adminEngagementService = require('../services/adminEngagementService');
const {
  USER_NOTIFICATION_TYPE,
  USER_NOTIFICATION_TITLE,
  REENGAGEMENT_MESSAGE_TEMPLATES,
  resolveMessageTemplate,
} = require('../utils/reengagementContent');
const {
  STUDY_TIPS,
  LEARNDA_TIPS,
  resolveEngagementTip,
} = require('../utils/engagementTips');
const { sendOtpSms, sendSms } = require('../services/smsService');
const {
  ADMIN_SECTIONS,
  normalizeAdminPermissions,
  isSuperAdmin,
  getAdminPermissions,
  requireSuperAdmin,
  requireAdminPermission,
  auditAdminAction,
  createAuditLog,
} = require('../utils/adminAccess');

const EXPENSES_FILE         = path.join(__dirname, '../data/admin_expenses.json');
const REENGAGEMENT_FILE     = path.join(__dirname, '../data/reengagement_log.json');
const TIPS_SEND_LOG_FILE    = path.join(__dirname, '../data/tips_send_log.json');
const LECTURER_INVITES_FILE = path.join(__dirname, '../data/lecturer_invites.json');
const REENGAGEMENT_SETTINGS_FILE = path.join(__dirname, '../data/reengagement_settings.json');
const TRIGGER_LOG_FILE      = path.join(__dirname, '../data/trigger_notifications_log.json');
const TEAM_LINKS_FILE       = path.join(__dirname, '../data/team_links.json');
const APPLICATIONS_FILE     = path.join(__dirname, '../data/applications.json');
const ROADMAP_FILE          = path.join(__dirname, '../data/roadmap.json');
const SERVICES_FILE         = path.join(__dirname, '../data/services.json');
const SOCIAL_LINKS_FILE     = path.join(__dirname, '../data/social_links.json');
const ACADEMIC_STATE_ACTIONS = new Set(['semester_switch', 'level_upgrade']);
const PLACEHOLDER_EMAIL_RE = /^phone\.\d+@auth\.learnda\.(app|local)$/i;

const isDeliverableEmail = (email) => {
  const value = String(email || '').trim().toLowerCase();
  return Boolean(value && value.includes('@') && !PLACEHOLDER_EMAIL_RE.test(value) && !value.endsWith('@guest.learnda.local'));
};

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const notifyUserModeration = async (user, { title, body, action }) => {
  const tasks = [];
  if (isDeliverableEmail(user.email)) {
    tasks.push(sendEmail({
      to: user.email,
      subject: title,
      text: body,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;">
          <h2 style="margin:0 0 12px;color:#0f172a;">${escapeHtml(title)}</h2>
          <p>${escapeHtml(body)}</p>
          <p style="color:#64748b;font-size:13px;">This message was sent by Learnda account support.</p>
        </div>
      `,
    }));
  }
  if (user.phone_number) {
    tasks.push(sendSms(user.phone_number, body));
  }
  const results = await Promise.allSettled(tasks);
  results.forEach((result) => {
    if (result.status === 'rejected') {
      console.error(`Moderation ${action || 'notice'} delivery error:`, result.reason);
    }
  });
  return results;
};

const DEFAULT_ROADMAP = [
  { id: 'v1',        label: 'Foundation', version: 'v1.0', years: '2026',        items: ['KG-SHS class structure', 'NaCCA-aligned subjects', 'Class-scoped lessons', 'Academic year progression'] },
  { id: 'v2',        label: 'Learning',   version: 'v2.0', years: '2026 - 2027', items: ['Audio-first KG lessons', 'Animated explainers', 'Practice sets per class', 'BECE preparation', 'Offline access'] },
  { id: 'platform',  label: 'Platform',   version: 'v3.0', years: '2027 - 2028', items: ['SHS pathways and electives', 'WASSCE preparation', 'My Space', 'Parent accounts', 'Progress reports'] },
  { id: 'ecosystem', label: 'Ecosystem',  version: 'v4.0', years: '2028 - 2029', items: ['Schools onboard', 'Teacher content tools', 'Ghanaian language lessons', 'Live sessions', 'AI study help'] },
  { id: 'expansion', label: 'Expansion',  version: 'v5.0', years: '2029 - 2032', items: ['Beyond Ghana', 'Anglophone Africa', 'Francophone Africa', 'Curriculum partnerships'] },
];

const DEFAULT_SOCIAL_LINKS = [
  { id: 'x',         name: 'X (Twitter)',      handle: '@learnda', href: 'https://x.com/learnda',                                  purpose: 'Fast conversations, public announcements' },
  { id: 'facebook',  name: 'Facebook',         handle: 'Learnda',  href: 'https://www.facebook.com/learnda', purpose: 'Community posts, page updates' },
  { id: 'telegram',  name: 'Telegram',         handle: '@learnda', href: 'https://t.me/learnda',                                   purpose: 'Learning tips and launch notes' },
  { id: 'youtube',   name: 'YouTube',          handle: '@learnda', href: 'https://www.youtube.com/@learnda',                       purpose: 'Tutorials and walkthroughs' },
  { id: 'tiktok',    name: 'TikTok',           handle: '@learnda', href: 'https://tiktok.com/@learnda',                            purpose: 'Short study tips and product moments' },
  { id: 'instagram', name: 'Instagram',        handle: '@learnda', href: 'https://instagram.com/learnda',                          purpose: 'Photos, reels, community stories' },
];

const DEFAULT_SERVICES = [
  { id: 'urhitech',               name: 'Urhitech',              link: 'https://urhitech.com',                               description: 'Development partner – builds and maintains the platform' },
  { id: 'render',                 name: 'Render',                link: 'https://render.com',                                 description: 'Cloud hosting and deployment (backend, web services)' },
  { id: 'cloudflare',             name: 'Cloudflare',            link: 'https://cloudflare.com',                             description: 'CDN, DNS, R2 object storage, domain proxy' },
  { id: 'paystack',               name: 'Paystack',              link: 'https://paystack.com',                               description: 'Payment processing for subscriptions and contributions' },
  { id: 'resend',                 name: 'Resend',                link: 'https://resend.com',                                 description: 'Transactional email delivery' },
  { id: 'arkesel',                name: 'Arkesel',               link: 'https://arkesel.com',                                description: 'SMS and OTP delivery (Ghana)' },
  { id: 'hubtel',                 name: 'Hubtel',                link: 'https://hubtel.com',                                 description: 'Mobile money payment gateway' },
  { id: 'google-analytics',       name: 'Google Analytics',      link: 'https://analytics.google.com',                       description: 'Web analytics and user behaviour tracking' },
  { id: 'google-search-console',  name: 'Google Search Console', link: 'https://search.google.com/search-console',           description: 'SEO monitoring and search performance' },
  { id: 'google-cloud',           name: 'Google Cloud Console',  link: 'https://console.cloud.google.com',                   description: 'Google OAuth, APIs, and cloud infrastructure' },
];

const DEFAULT_TEAM_LINKS = {
  contributor: { whatsapp: '' },
  ambassador:  { whatsapp: '' },
  developer:   { whatsapp: '' },
  designer:    { whatsapp: '' },
};


function loadJsonFile(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch { return fallback; }
}
function saveJsonFile(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

const EXPENSES_FILE_PATH = path.join(__dirname, '../data/admin_expenses.json');
const DEFAULT_EXPENSES = [
  { id: 'domain',   label: 'Domain',            category: 'infrastructure', amount: 0, frequency: 'yearly',  notes: '' },
  { id: 'hosting',  label: 'Hosting / VPS',      category: 'infrastructure', amount: 0, frequency: 'monthly', notes: '' },
  { id: 'database', label: 'Database (Postgres)', category: 'infrastructure', amount: 0, frequency: 'monthly', notes: '' },
  { id: 'storage',  label: 'Storage (R2)',        category: 'infrastructure', amount: 0, frequency: 'monthly', notes: '' },
  { id: 'ssl',      label: 'SSL Certificate',     category: 'infrastructure', amount: 0, frequency: 'yearly',  notes: '' },
  { id: 'email',    label: 'Email (Resend)',       category: 'services',       amount: 0, frequency: 'monthly', notes: '' },
  { id: 'sms',      label: 'SMS (Arkesel)',        category: 'services',       amount: 0, frequency: 'monthly', notes: '' },
];
const loadExpenses = () => {
  try { return JSON.parse(fs.readFileSync(EXPENSES_FILE, 'utf8')); } catch { return DEFAULT_EXPENSES; }
};
const saveExpenses = (expenses) => {
  const dir = path.dirname(EXPENSES_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(EXPENSES_FILE, JSON.stringify(expenses, null, 2));
};

const router = express.Router();

// One-time bootstrap: promote a user to admin without requiring existing admin auth.
// Protected by ADMIN_BOOTSTRAP_SECRET env var. Remove the var after first use.
router.post('/bootstrap', async (req, res) => {
  const secret = process.env.ADMIN_BOOTSTRAP_SECRET;
  if (!secret) return res.status(404).json({ success: false, error: 'Not found' });
  const { email, bootstrap_secret } = req.body;
  // Compare digests so the check is constant-time regardless of input length.
  const providedDigest = crypto.createHash('sha256').update(String(bootstrap_secret || '')).digest();
  const expectedDigest = crypto.createHash('sha256').update(secret).digest();
  if (!crypto.timingSafeEqual(providedDigest, expectedDigest)) {
    return res.status(403).json({ success: false, error: 'Invalid secret' });
  }
  if (!email) return res.status(400).json({ success: false, error: 'email required' });
  try {
    const [updated] = await User.update({
      role: 'admin',
      is_contributor: true,
      is_superadmin: true,
      admin_permissions: null,
      admin_title: 'Superadmin'
    }, { where: { email } });
    if (!updated) return res.status(404).json({ success: false, error: 'User not found' });
    return res.json({ success: true, message: `${email} is now an admin.` });
  } catch (err) {
    console.error('Admin bootstrap error:', err);
    return res.status(500).json({ success: false, error: 'Failed to promote user' });
  }
});

// Public read-only endpoint — no auth required
router.get('/roadmap/public', (req, res) => {
  const phases = loadJsonFile(ROADMAP_FILE, DEFAULT_ROADMAP);
  res.json({ success: true, phases });
});

router.get('/services/public', (req, res) => {
  const services = loadJsonFile(SERVICES_FILE, DEFAULT_SERVICES);
  res.json({ success: true, services });
});

router.use(authenticate, checkRole(['admin']));

const serializeAdminUser = (user) => ({
  id: user.id,
  full_name: user.full_name,
  name: user.name,
  email: user.email,
  role: user.role,
  is_superadmin: isSuperAdmin(user),
  admin_title: user.admin_title || (isSuperAdmin(user) ? 'Superadmin' : 'Administrator'),
  admin_permissions: getAdminPermissions(user),
  created_at: user.created_at,
  updated_at: user.updated_at,
});

router.get('/me', async (req, res) => {
  await createAuditLog(req, {
    action: 'admin_console_access',
    section: 'overview',
    status_code: 200,
  });
  res.json({
    success: true,
    admin: serializeAdminUser(req.user),
    sections: ADMIN_SECTIONS,
  });
});

router.get('/admins', requireSuperAdmin, async (_req, res) => {
  try {
    const admins = await User.findAll({
      where: { role: 'admin' },
      attributes: ['id', 'full_name', 'email', 'role', 'is_superadmin', 'admin_permissions', 'admin_title', 'created_at', 'updated_at'],
      order: [['created_at', 'ASC']],
    });
    res.json({ success: true, admins: admins.map(serializeAdminUser), sections: ADMIN_SECTIONS });
  } catch (error) {
    console.error('Admin list error:', error);
    res.status(500).json({ success: false, error: 'Failed to load admins' });
  }
});

router.patch('/admins/:id/access', requireSuperAdmin, async (req, res) => {
  try {
    const target = await User.findByPk(req.params.id);
    if (!target) return res.status(404).json({ success: false, error: 'Admin not found' });
    if (target.role !== 'admin') return res.status(400).json({ success: false, error: 'User is not an admin' });
    if (String(target.id) === String(req.user.id) && req.body?.is_superadmin === false) {
      return res.status(400).json({ success: false, error: 'You cannot remove your own superadmin access' });
    }

    const nextIsSuperadmin = Boolean(req.body?.is_superadmin);
    const patch = {
      is_superadmin: nextIsSuperadmin,
      admin_permissions: nextIsSuperadmin ? null : normalizeAdminPermissions(req.body?.admin_permissions),
      admin_title: String(req.body?.admin_title || '').trim() || (nextIsSuperadmin ? 'Superadmin' : 'Administrator'),
    };
    await target.update(patch);
    await createAuditLog(req, {
      action: 'update_admin_access',
      section: 'admin-access',
      status_code: 200,
      target_type: 'user',
      target_id: target.id,
      metadata: {
        target_email: target.email,
        is_superadmin: patch.is_superadmin,
        admin_permissions: patch.admin_permissions,
      },
    });
    res.json({ success: true, admin: serializeAdminUser(target) });
  } catch (error) {
    console.error('Admin access update error:', error);
    res.status(500).json({ success: false, error: 'Failed to update admin access' });
  }
});

router.get('/audit-logs', requireSuperAdmin, async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);
    const page = Math.max(Number(req.query.page || 1), 1);
    const offset = (page - 1) * limit;
    const where = {};
    if (req.query.adminUserId) where.admin_user_id = req.query.adminUserId;
    if (req.query.section) where.section = req.query.section;

    const { rows, count } = await AdminAuditLog.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });
    res.json({ success: true, logs: rows, total: count });
  } catch (error) {
    console.error('Admin audit log error:', error);
    res.status(500).json({ success: false, error: 'Failed to load admin logs' });
  }
});

router.use(requireAdminPermission());
router.use(auditAdminAction());

const buildCreatedAtRange = ({ start = null, end = null } = {}) => {
  if (start && end) return { [Op.gte]: start, [Op.lt]: end };
  if (start) return { [Op.gte]: start };
  if (end) return { [Op.lt]: end };
  return null;
};

const countLearningContentItems = async ({ start = null, end = null } = {}) => {
  // Count from all_content view (excludes site_info/team_profile)
  let dateCond = '';
  const replacements = {};
  if (start) { dateCond += ` AND created_at >= :start`; replacements.start = start; }
  if (end) { dateCond += ` AND created_at < :end`; replacements.end = end; }

  const [{ cnt }] = await dbSequelize.query(
    `SELECT COUNT(*)::int AS cnt FROM all_content
     WHERE status = 'published'
       AND (subtype IS NULL OR subtype NOT IN ('site_info','team_profile'))
       ${dateCond}`,
    { replacements, type: dbSequelize.QueryTypes.SELECT }
  );

  const resourceWhere = {};
  const createdAt = buildCreatedAtRange({ start, end });
  if (createdAt) resourceWhere.created_at = createdAt;
  const fileCount = await ResourceFile.count({ where: resourceWhere });

  return Number(cnt || 0) + Number(fileCount || 0);
};

const getRange = (range = '30d') => {
  const end = new Date();
  if (range === 'all') {
    return { start: null, end };
  }

  const start = new Date(end);
  switch (range) {
    case '7d':
      start.setDate(end.getDate() - 7);
      break;
    case '90d':
      start.setDate(end.getDate() - 90);
      break;
    case '1y':
      start.setFullYear(end.getFullYear() - 1);
      break;
    case '30d':
    default:
      start.setDate(end.getDate() - 30);
      break;
  }
  return { start, end };
};

const getPreviousRange = (range = '30d') => {
  const current = getRange(range);
  if (!current.start) return null;
  const diff = current.end.getTime() - current.start.getTime();
  return {
    start: new Date(current.start.getTime() - diff),
    end: current.start,
  };
};

const percentChange = (current, previous) => {
  if (!previous) return 0;
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
};

const formatDateKey = (value) => new Date(value).toISOString().split('T')[0];

const normalizeSeries = (series) => {
  if (!series.length) return [];
  const max = Math.max(...series.map((item) => item.value));
  if (!max) return series.map((item) => ({ ...item, value: 0 }));
  return series.map((item) => ({
    ...item,
    value: Math.round((item.value / max) * 100),
  }));
};

const timeAgo = (value) => {
  const diffMs = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diffMs / (1000 * 60));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString();
};


const toNum = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const safePercent = (value, total) => {
  if (!total) return 0;
  return Math.round((toNum(value) / toNum(total)) * 100);
};

const toDateKey = (value) => formatDateKey(value);

const resolvePathFromEvent = (event) => {
  const rawPath =
    event?.event_data?.path ||
    event?.event_data?.page ||
    event?.event_data?.route ||
    event?.page_url ||
    '';

  if (!rawPath) {
    return event?.event_type || 'unknown';
  }

  try {
    if (rawPath.startsWith('/')) return rawPath;
    const parsed = new URL(rawPath);
    return parsed.pathname || event?.event_type || 'unknown';
  } catch (error) {
    return rawPath;
  }
};

const resolvePlatformFromEvent = (event) => {
  const platformHint = String(
    event?.event_data?.platform ||
    event?.event_data?.client_platform ||
    event?.event_data?.app_platform ||
    ''
  ).toLowerCase();

  const ua = String(event?.user_agent || event?.event_data?.user_agent || '').toLowerCase();
  const hasWebUrl = Boolean(event?.event_data?.url || event?.page_url);

  if (platformHint.includes('mobile') || platformHint.includes('android') || platformHint.includes('ios')) {
    return 'mobile';
  }
  if (platformHint.includes('web') || platformHint.includes('browser')) {
    return 'web';
  }
  if (ua.includes('reactnative') || ua.includes('react-native') || ua.includes('okhttp') || ua.includes('expo')) {
    return 'mobile';
  }
  if (hasWebUrl) {
    return 'web';
  }
  if (event?.device_type === 'mobile') {
    return 'mobile';
  }
  if (event?.device_type === 'desktop') {
    return 'web';
  }
  return 'unknown';
};

const FEATURE_RULES = [
  { id: 'learning', label: 'Learning', matchers: ['/learn', '/courses', '/lesson', 'content_'] },
  { id: 'resources', label: 'Resources', matchers: ['/resources', '/files', 'resource_'] },
  { id: 'study_space', label: 'PLS / Study Space', matchers: ['/pls', 'pls_'] },
  { id: 'community', label: 'Community', matchers: ['/community', '/forum', '/study-groups'] },
  { id: 'edutainment', label: 'Edutainment & Blog', matchers: ['/edutainment', '/blog', '/trending', '/events'] },
  { id: 'search', label: 'Search & Discovery', matchers: ['/search', 'search_'] },
  { id: 'subscription', label: 'Subscription & Payments', matchers: ['/subscription', '/payment', 'subscription_', 'conversion'] },
  { id: 'auth', label: 'Auth & Onboarding', matchers: ['/auth', 'auth_', '/register', '/login', '/invite'] },
  { id: 'admin', label: 'Admin', matchers: ['/admin'] },
  { id: 'support', label: 'Support & Comms', matchers: ['/support', '/report', '/contact', '/newsletter'] },
];

const resolveFeatureId = (event) => {
  const eventType = String(event?.event_type || '').toLowerCase();
  const path = String(resolvePathFromEvent(event) || '').toLowerCase();
  const source = `${path} ${eventType}`;

  const matched = FEATURE_RULES.find((rule) =>
    rule.matchers.some((matcher) => source.includes(String(matcher).toLowerCase()))
  );

  return matched ? matched.id : 'other';
};

const featureLabelById = FEATURE_RULES.reduce((acc, item) => {
  acc[item.id] = item.label;
  return acc;
}, { other: 'Other' });

const filterEventsBySegment = (events, segment) => {
  if (segment === 'all') return events;
  return events.filter((event) => resolvePlatformFromEvent(event) === segment);
};

const buildRevenueSeries = (subscriptions) => {
  const byDay = subscriptions.reduce((acc, sub) => {
    const key = toDateKey(sub.started_at);
    acc[key] = (acc[key] || 0) + Number(sub.plan?.price || 0);
    return acc;
  }, {});

  return Object.entries(byDay)
    .sort((a, b) => new Date(a[0]) - new Date(b[0]))
    .map(([label, value]) => ({ label, value: Number(value.toFixed(2)) }));
};

const buildAnalyticsSnapshot = async ({ range = '30d', segment = 'all' }) => {
  const { start } = getRange(range);
  const prevRange = getPreviousRange(range);
  const whereRange = start ? { created_at: { [Op.gte]: start } } : {};
  const prevWhereRange = prevRange
    ? { created_at: { [Op.gte]: prevRange.start, [Op.lt]: prevRange.end } }
    : null;

  const [
    totalUsers,
    newUsers,
    prevNewUsers,
    activeUsers,
    newContent,
    newSubscriptions,
    activeSubscriptions,
    currentSubscriptions,
    previousSubscriptions,
    engagementCount,
    prevEngagementCount,
    activeEngagersRows,
    avgSessionRows,
    signupSeriesRows,
    engagementSeriesRows,
    allRangeEvents,
    topContentRows,
    underusedContentRows,
    dau,
    wau,
    mau,
  ] = await Promise.all([
    User.count(),
    start ? User.count({ where: whereRange }) : User.count(),
    prevWhereRange ? User.count({ where: prevWhereRange }) : 0,
    start
      ? User.count({ where: { last_active_at: { [Op.gte]: start } } })
      : User.count({ where: { last_active_at: { [Op.ne]: null } } }),
    start
      ? countLearningContentItems({ start })
      : countLearningContentItems(),
    start
      ? Subscription.count({ where: { status: 'active', started_at: { [Op.gte]: start } } })
      : Subscription.count({ where: { status: 'active' } }),
    Subscription.count({ where: { status: 'active' } }),
    Subscription.findAll({
      where: start ? { started_at: { [Op.gte]: start } } : {},
      include: [{ model: Plan, as: 'plan', attributes: ['name', 'price'] }],
    }),
    prevWhereRange
      ? Subscription.findAll({
          where: { started_at: { [Op.gte]: prevRange.start, [Op.lt]: prevRange.end } },
          include: [{ model: Plan, as: 'plan', attributes: ['name', 'price'] }],
        })
      : [],
    start
      ? ContentEngagement.count({ where: { created_at: { [Op.gte]: start } } })
      : ContentEngagement.count(),
    prevWhereRange ? ContentEngagement.count({ where: prevWhereRange }) : 0,
    start
      ? ContentEngagement.findAll({
          attributes: [[fn('COUNT', fn('DISTINCT', col('user_id'))), 'count']],
          where: { created_at: { [Op.gte]: start } },
          raw: true,
        })
      : ContentEngagement.findAll({
          attributes: [[fn('COUNT', fn('DISTINCT', col('user_id'))), 'count']],
          raw: true,
        }),
    ContentEngagement.findAll({
      attributes: [[fn('AVG', col('duration_seconds')), 'avg']],
      where: {
        duration_seconds: { [Op.ne]: null },
        ...(start ? { created_at: { [Op.gte]: start } } : {}),
      },
      raw: true,
    }),
    User.findAll({
      attributes: [[fn('DATE', col('created_at')), 'date'], [fn('COUNT', col('id')), 'count']],
      where: whereRange,
      group: [fn('DATE', col('created_at'))],
      order: [[fn('DATE', col('created_at')), 'ASC']],
      raw: true,
    }),
    ContentEngagement.findAll({
      attributes: [[fn('DATE', col('created_at')), 'date'], [fn('COUNT', col('id')), 'count']],
      where: whereRange,
      group: [fn('DATE', col('created_at'))],
      order: [[fn('DATE', col('created_at')), 'ASC']],
      raw: true,
    }),
    Event.findAll({
      attributes: ['id', 'user_id', 'session_id', 'event_type', 'event_data', 'page_url', 'user_agent', 'device_type', 'created_at'],
      where: whereRange,
      order: [['created_at', 'ASC']],
      raw: true,
    }),
    // Top content: join content_stats with all_content view
    dbSequelize.query(
      `SELECT cs.*, ac.title AS content_title
       FROM content_stats cs
       JOIN all_content ac ON ac.id = cs.content_id
       WHERE ac.status = 'published'
         AND (ac.subtype IS NULL OR ac.subtype NOT IN ('site_info','team_profile'))
       ORDER BY cs.total_views DESC NULLS LAST
       LIMIT 5`,
      { type: dbSequelize.QueryTypes.SELECT }
    ),
    // Underused content
    dbSequelize.query(
      `SELECT cs.*, ac.title AS content_title
       FROM content_stats cs
       JOIN all_content ac ON ac.id = cs.content_id
       WHERE ac.status = 'published'
         AND (ac.subtype IS NULL OR ac.subtype NOT IN ('site_info','team_profile'))
       ORDER BY cs.total_views ASC NULLS FIRST
       LIMIT 5`,
      { type: dbSequelize.QueryTypes.SELECT }
    ),
    User.count({ where: { last_active_at: { [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
    User.count({ where: { last_active_at: { [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
    User.count({ where: { last_active_at: { [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }),
  ]);

  const allEventsInRange = allRangeEvents || [];
  const eventsInSegment = filterEventsBySegment(allEventsInRange, segment);
  const totalEvents = eventsInSegment.length;

  const segmentUsers = new Set(eventsInSegment.map((event) => event.user_id).filter(Boolean));
  const segmentSessions = new Set(eventsInSegment.map((event) => event.session_id).filter(Boolean));
  const uniqueUsersInEvents = segmentUsers.size;
  const uniqueSessions = segmentSessions.size;

  const platformBuckets = { web: { users: new Set(), events: 0 }, mobile: { users: new Set(), events: 0 }, unknown: { users: new Set(), events: 0 } };
  allEventsInRange.forEach((event) => {
    const platform = resolvePlatformFromEvent(event);
    if (!platformBuckets[platform]) {
      platformBuckets[platform] = { users: new Set(), events: 0 };
    }
    platformBuckets[platform].events += 1;
    if (event.user_id) {
      platformBuckets[platform].users.add(event.user_id);
    }
  });

  const platformSplit = Object.entries(platformBuckets).map(([platform, bucket]) => ({
    platform,
    events: bucket.events,
    users: bucket.users.size,
    share: safePercent(bucket.events, Math.max(allEventsInRange.length, 1)),
  }));

  const featureBuckets = {};
  Object.keys(featureLabelById).forEach((featureId) => {
    featureBuckets[featureId] = { events: 0, users: new Set(), sessions: new Set() };
  });

  const endpointBuckets = {};
  const dailyBuckets = {};
  const platformByDayBuckets = {};

  eventsInSegment.forEach((event) => {
    const featureId = resolveFeatureId(event);
    const path = resolvePathFromEvent(event);
    const dayKey = toDateKey(event.created_at);
    const platform = resolvePlatformFromEvent(event);
    const durationMs = toNum(event?.event_data?.duration_ms);

    featureBuckets[featureId].events += 1;
    if (event.user_id) featureBuckets[featureId].users.add(event.user_id);
    if (event.session_id) featureBuckets[featureId].sessions.add(event.session_id);

    if (!endpointBuckets[path]) {
      endpointBuckets[path] = {
        path,
        hits: 0,
        users: new Set(),
        totalDurationMs: 0,
        timedHits: 0,
      };
    }
    endpointBuckets[path].hits += 1;
    if (event.user_id) endpointBuckets[path].users.add(event.user_id);
    if (durationMs > 0) {
      endpointBuckets[path].totalDurationMs += durationMs;
      endpointBuckets[path].timedHits += 1;
    }

    if (!dailyBuckets[dayKey]) {
      dailyBuckets[dayKey] = { date: dayKey, events: 0, users: new Set() };
    }
    dailyBuckets[dayKey].events += 1;
    if (event.user_id) dailyBuckets[dayKey].users.add(event.user_id);

    if (!platformByDayBuckets[dayKey]) {
      platformByDayBuckets[dayKey] = { date: dayKey, web: 0, mobile: 0, unknown: 0 };
    }
    if (!platformByDayBuckets[dayKey][platform]) {
      platformByDayBuckets[dayKey][platform] = 0;
    }
    platformByDayBuckets[dayKey][platform] += 1;
  });

  const featureUsage = Object.entries(featureBuckets)
    .map(([featureId, bucket]) => ({
      feature_id: featureId,
      feature: featureLabelById[featureId] || featureId,
      events: bucket.events,
      users: bucket.users.size,
      sessions: bucket.sessions.size,
      share: safePercent(bucket.events, Math.max(totalEvents, 1)),
      adoption_rate: safePercent(bucket.users.size, Math.max(activeUsers, 1)),
    }))
    .sort((a, b) => b.events - a.events);

  const mostUsedFeature = featureUsage.find((item) => item.events > 0) || null;
  const leastUsedFeature = [...featureUsage].reverse().find((item) => item.events > 0) || null;
  const usageOpportunities = [...featureUsage]
    .filter((item) => item.events > 0)
    .sort((a, b) => a.events - b.events)
    .slice(0, 4);

  const topEndpoints = Object.values(endpointBuckets)
    .map((item) => ({
      path: item.path,
      hits: item.hits,
      users: item.users.size,
      avg_duration_ms: item.timedHits ? Math.round(item.totalDurationMs / item.timedHits) : 0,
      share: safePercent(item.hits, Math.max(totalEvents, 1)),
    }))
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 12);

  // Build per-page engagement breakdown for the Pages section
  const PAGE_URL_MAP = {
    home:         (p) => p === '/' || p === '',
    courses:      (p) => p === '/learn' || (p.startsWith('/learn/') && !p.startsWith('/learn/lesson')),
    lessons:      (p) => p.startsWith('/learn/lesson') || p.startsWith('/pls/study'),
    tests:        (p) => p.startsWith('/practice') || p.startsWith('/pls/practice'),
    edutainment:  (p) => p.startsWith('/edutainment') || p.startsWith('/blog'),
    community:    (p) => p.startsWith('/community') || p.startsWith('/forum'),
    groups:       (p) => p.startsWith('/groups'),
    profile:      (p) => p === '/settings/profile',
    spotlight:    (p) => p === '/trending',
    updates:      (p) => p.startsWith('/release-updates') || p.startsWith('/updates'),
    library:      (p) => p.startsWith('/resources'),
    leaderboard:  (p) => p.startsWith('/progress'),
    subscription: (p) => p.startsWith('/upgrade') || p.startsWith('/features-and-plans'),
    settings:     (p) => p.startsWith('/settings') && p !== '/settings/profile',
  };
  const pageEngagement = {};
  for (const [pageKey, matches] of Object.entries(PAGE_URL_MAP)) {
    const userSet = new Set();
    let totalHits = 0;
    for (const [path, bucket] of Object.entries(endpointBuckets)) {
      if (matches(path)) {
        bucket.users.forEach((uid) => userSet.add(uid));
        totalHits += bucket.hits;
      }
    }
    pageEngagement[pageKey] = { users: userSet.size, guests: Math.max(0, totalHits - userSet.size) };
  }

  const activityTrend = Object.values(dailyBuckets)
    .map((item) => ({
      date: item.date,
      events: item.events,
      users: item.users.size,
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const platformTrend = Object.values(platformByDayBuckets).sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  const revenueSeries = buildRevenueSeries(currentSubscriptions);
  const revenueByPlanBuckets = currentSubscriptions.reduce((acc, sub) => {
    const name = sub.plan?.name || 'Unknown';
    if (!acc[name]) {
      acc[name] = { name, subscribers: 0, revenue: 0 };
    }
    acc[name].subscribers += 1;
    acc[name].revenue += Number(sub.plan?.price || 0);
    return acc;
  }, {});
  const revenueByPlan = Object.values(revenueByPlanBuckets).map((item) => ({
    ...item,
    revenue: Number(item.revenue.toFixed(2)),
  }));

  const totalCurrentRevenue = revenueByPlan.reduce((sum, item) => sum + item.revenue, 0);
  const previousRevenue = previousSubscriptions.reduce((sum, sub) => sum + Number(sub.plan?.price || 0), 0);
  const planDistribution = revenueByPlan.map((plan) => ({
    name: plan.name,
    percentage: safePercent(plan.subscribers, Math.max(activeSubscriptions, 1)),
  }));

  const topContent = topContentRows.map((row) => ({
    title: row.content_title || 'Untitled',
    views: row.total_views || 0,
    completion_rate: row.completion_rate || 0,
    avg_time: Math.round((row.avg_time_spent || 0) / 60),
  }));

  const underusedContent = underusedContentRows.map((row) => ({
    title: row.content_title || 'Untitled',
    views: row.total_views || 0,
    completion_rate: row.completion_rate || 0,
    avg_time: Math.round((row.avg_time_spent || 0) / 60),
  }));

  const engagementUsers = Number(activeEngagersRows?.[0]?.count || 0);
  const engagementRate = safePercent(engagementUsers, Math.max(totalUsers, 1));
  const conversionRate = safePercent(newSubscriptions, Math.max(newUsers, 1));
  const avgSessionMinutes = Math.round(Number(avgSessionRows?.[0]?.avg || 0) / 60);

  const mobileShare =
    platformSplit.find((item) => item.platform === 'mobile')?.share || 0;
  const stickiness = safePercent(dau, Math.max(mau, 1));
  const inactivityRate = safePercent(Math.max(totalUsers - activeUsers, 0), Math.max(totalUsers, 1));

  const insights = [];
  if (mostUsedFeature && leastUsedFeature && mostUsedFeature.events >= Math.max(leastUsedFeature.events * 4, 10)) {
    insights.push({
      type: 'warning',
      message: `${mostUsedFeature.feature} usage is far ahead of ${leastUsedFeature.feature}.`,
      action: `Promote ${leastUsedFeature.feature} through in-app prompts and onboarding.`,
      priority: 'high',
    });
  }
  if (mobileShare < 20) {
    insights.push({
      type: 'warning',
      message: 'Mobile activity share is low for a student-first product.',
      action: 'Audit mobile onboarding, push notifications, and app discovery funnels.',
      priority: 'high',
    });
  } else {
    insights.push({
      type: 'success',
      message: 'Mobile usage is contributing meaningfully to platform traffic.',
      action: 'Double down on high-retention mobile journeys.',
      priority: 'medium',
    });
  }
  if (conversionRate < 10) {
    insights.push({
      type: 'warning',
      message: 'Signup-to-subscription conversion is below target.',
      action: 'Test pricing page variants and improve paywall copy with outcomes data.',
      priority: 'high',
    });
  } else {
    insights.push({
      type: 'success',
      message: 'Conversion from signup to subscription is healthy.',
      action: 'Shift focus to retention and plan upgrades.',
      priority: 'medium',
    });
  }
  if (inactivityRate > 45) {
    insights.push({
      type: 'info',
      message: 'A large share of users are inactive in the selected window.',
      action: 'Launch win-back campaigns and schedule reminder notifications.',
      priority: 'medium',
    });
  }

  const funnel = {
    signups: newUsers,
    active_users: activeUsers,
    subscriptions: newSubscriptions,
    signup_to_active_rate: safePercent(activeUsers, Math.max(newUsers, 1)),
    active_to_subscription_rate: safePercent(newSubscriptions, Math.max(activeUsers, 1)),
    signup_to_subscription_rate: conversionRate,
  };

  return {
    active_users: activeUsers,
    new_users: newUsers,
    inactive_users: Math.max(totalUsers - activeUsers, 0),
    new_content: newContent,
    new_subscriptions: newSubscriptions,
    revenue: Number(totalCurrentRevenue.toFixed(2)),
    engagement_rate: engagementRate,
    conversion_rate: conversionRate,
    avg_session: avgSessionMinutes,
    total_events: totalEvents,
    unique_event_users: uniqueUsersInEvents,
    unique_sessions: uniqueSessions,
    daily_active_users: dau,
    weekly_active_users: wau,
    monthly_active_users: mau,
    stickiness,
    inactivity_rate: inactivityRate,
    mobile_share: mobileShare,
    user_growth: percentChange(newUsers, prevNewUsers),
    revenue_growth: percentChange(totalCurrentRevenue, previousRevenue),
    engagement_growth: percentChange(engagementCount, prevEngagementCount),
    conversion_growth: percentChange(newSubscriptions, prevWhereRange ? previousSubscriptions.length : 0),
    engagement_data: normalizeSeries(
      engagementSeriesRows.map((row) => ({ label: row.date, value: Number(row.count) }))
    ),
    revenue_data: normalizeSeries(
      revenueSeries.map((row) => ({ label: row.label, value: row.value }))
    ),
    user_growth_data: normalizeSeries(
      signupSeriesRows.map((row) => ({ label: row.date, value: Number(row.count) }))
    ),
    top_content: topContent,
    underused_content: underusedContent,
    revenue_by_plan: revenueByPlan,
    plan_distribution: planDistribution,
    feature_usage: featureUsage,
    most_used_feature: mostUsedFeature,
    least_used_feature: leastUsedFeature,
    usage_opportunities: usageOpportunities,
    top_endpoints: topEndpoints,
    page_engagement: pageEngagement,
    activity_trend: activityTrend,
    platform_trend: platformTrend,
    platform_split: platformSplit,
    funnel,
    insights,
    controls: {
      range,
      segment,
      available_ranges: ['7d', '30d', '90d', '1y', 'all'],
      available_segments: ['all', 'web', 'mobile'],
    },
  };
};

router.get('/stats', async (req, res) => {
  try {
    const range = req.query.range || '30d';
    const { start } = getRange(range);
    const prevRange = getPreviousRange(range);

    const [totalUsers, totalContent, pendingReviews, totalContributors, pendingPayouts, contentBreakdown, totalResourceFiles] = await Promise.all([
      User.count(),
      countLearningContentItems(),
      Contribution.count({ where: { status: 'pending' } }),
      User.count({ where: { [Op.or]: [{ is_contributor: true }, { role: 'contributor' }] } }),
      RewardPayout.count({ where: { status: 'pending' } }).catch(() => 0),
      dbSequelize.query(
        `SELECT
           COUNT(*) FILTER (WHERE content_type = 'lesson')::int AS text_lessons,
           COUNT(*) FILTER (WHERE content_type = 'video_lesson')::int AS video_lessons,
           COUNT(*) FILTER (WHERE content_type = 'text_item' AND subtype IN ('quiz','exam','past_question'))::int AS test_items,
           COUNT(*) FILTER (WHERE content_type = 'text_item' AND (subtype IS NULL OR subtype NOT IN ('quiz','exam','past_question','site_info','team_profile')))::int AS edutainment
         FROM all_content
         WHERE status = 'published'`,
        { type: dbSequelize.QueryTypes.SELECT }
      ).then((rows) => rows[0] || {}).catch(() => ({})),
      ResourceFile.count().catch(() => 0),
    ]);

    const activeSubscribers = await Subscription.count({
      where: { status: 'active' },
    });

    const userCountRange = start
      ? await User.count({ where: { created_at: { [Op.gte]: start } } })
      : totalUsers;
    const prevUserCount = prevRange
      ? await User.count({
          where: { created_at: { [Op.gte]: prevRange.start, [Op.lt]: prevRange.end } },
        })
      : 0;

    const contentCountRange = start
      ? await countLearningContentItems({ start })
      : totalContent;
    const prevContentCount = prevRange
      ? await countLearningContentItems({ start: prevRange.start, end: prevRange.end })
      : 0;

    const subscriberCountRange = start
      ? await Subscription.count({
          where: { status: 'active', started_at: { [Op.gte]: start } },
        })
      : activeSubscribers;
    const prevSubscriberCount = prevRange
      ? await Subscription.count({
          where: { status: 'active', started_at: { [Op.gte]: prevRange.start, [Op.lt]: prevRange.end } },
        })
      : 0;

    const today = new Date();
    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todaysSubs = await Subscription.findAll({
      where: { started_at: { [Op.gte]: dayStart } },
      include: [{ model: Plan, as: 'plan', attributes: ['price'] }],
    });
    const revenueToday = todaysSubs.reduce(
      (sum, sub) => sum + Number(sub.plan?.price || 0),
      0
    );

    const engagementUsers = start
      ? await ContentEngagement.findAll({
          attributes: [[fn('COUNT', fn('DISTINCT', col('user_id'))), 'count']],
          where: { created_at: { [Op.gte]: start } },
          raw: true,
        })
      : [];
    const activeEngagers = Number(engagementUsers?.[0]?.count || 0);
    const avgEngagement = totalUsers
      ? Math.round((activeEngagers / totalUsers) * 100)
      : 0;

    const { StudyGroup } = require('../models');
    const [studyGroupCount, communityCount] = await Promise.all([
      StudyGroup ? StudyGroup.count().catch(() => 0) : Promise.resolve(0),
      CommunityPost ? CommunityPost.count().catch(() => 0) : Promise.resolve(0),
    ]);

    res.json({
      success: true,
      stats: {
        total_users: totalUsers,
        active_subscribers: activeSubscribers,
        total_content: totalContent,
        pending_reviews: pendingReviews,
        total_contributors: totalContributors,
        pending_payouts: pendingPayouts,
        revenue_today: Number(revenueToday.toFixed(2)),
        avg_engagement: avgEngagement,
        user_growth: percentChange(userCountRange, prevUserCount),
        subscriber_growth: percentChange(subscriberCountRange, prevSubscriberCount),
        content_growth: percentChange(contentCountRange, prevContentCount),
        revenue_growth: 0,
        textLessons: Number(contentBreakdown.text_lessons || 0),
        videoLessons: Number(contentBreakdown.video_lessons || 0),
        testItems: Number(contentBreakdown.test_items || 0),
        edutainment: Number(contentBreakdown.edutainment || 0),
        resourceFiles: Number(totalResourceFiles || 0),
        studyGroups: studyGroupCount,
        communities: communityCount,
      },
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to load admin stats' });
  }
});

router.get('/activity', async (req, res) => {
  try {
    const limit = Number(req.query.limit || 8);
    const events = await Event.findAll({
      order: [['created_at', 'DESC']],
      limit,
    });

    // Event has no User association — resolve actor names in one batched query.
    const userIds = [...new Set(events.map((e) => e.user_id).filter(Boolean))];
    const users = userIds.length
      ? await User.findAll({
          where: { id: userIds },
          attributes: ['id', 'full_name', 'email', 'phone_number'],
        }).catch(() => [])
      : [];
    const userById = new Map(users.map((u) => [String(u.id), u]));

    const activity = events.map((event) => {
      const actor = event.user_id ? userById.get(String(event.user_id)) : null;
      return {
        id: event.id,
        type: event.event_type,
        action: event.event_type ? event.event_type.replace(/_/g, ' ') : 'activity',
        description: event.event_data?.description || (event.event_type || 'activity').replace(/_/g, ' '),
        createdAt: event.created_at,
        time: timeAgo(event.created_at),
        user: actor
          ? {
              id: actor.id,
              name: actor.full_name || '',
              email: actor.email || null,
              phone_number: actor.phone_number || null,
            }
          : null,
      };
    });

    res.json({ success: true, activity });
  } catch (error) {
    console.error('Admin activity error:', error);
    res.status(500).json({ success: false, error: 'Failed to load activity feed' });
  }
});

router.get('/content', async (req, res) => {
  try {
    const { status = 'published', limit = 20, page = 1, search, type } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const conditions = [];
    const replacements = { lim: Number(limit), off: offset };

    if (status !== 'all') { conditions.push(`ac.status = :status`); replacements.status = status; }
    if (search) { conditions.push(`(ac.title ILIKE :search OR ac.description ILIKE :search)`); replacements.search = `%${search}%`; }
    if (type && type !== 'all') {
      if (type === 'text') conditions.push(`ac.content_type = 'lesson'`);
      else if (type === 'video') conditions.push(`ac.content_type = 'video_lesson'`);
      else if (type === 'test') conditions.push(`ac.content_type = 'text_item' AND ac.subtype IN ('quiz','exam','past_question')`);
      else if (type === 'blog') conditions.push(`ac.content_type = 'text_item' AND ac.subtype = 'blog'`);
      else if (type === 'edutainment') conditions.push(`ac.content_type = 'text_item' AND (ac.subtype IS NULL OR ac.subtype NOT IN ('quiz','exam','past_question','site_info','team_profile'))`);
    }
    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRow] = await dbSequelize.query(
      `SELECT COUNT(*)::int AS total FROM all_content ac ${whereSql}`,
      { replacements, type: dbSequelize.QueryTypes.SELECT }
    );
    const count = countRow.total || 0;

    const rows = await dbSequelize.query(
      `SELECT ac.*, cs.total_views, cs.like_count, cs.save_count, cs.total_completions,
              u.full_name AS creator_name,
              c.title AS course_name
       FROM all_content ac
       LEFT JOIN content_stats cs ON cs.content_id = ac.id
       LEFT JOIN users u ON u.id = ac.creator_id
       LEFT JOIN courses c ON c.id = ac.course_id
       ${whereSql}
       ORDER BY ac.created_at DESC
       LIMIT :lim OFFSET :off`,
      { replacements, type: dbSequelize.QueryTypes.SELECT }
    );

    const typeLabel = (row) => {
      if (row.content_type === 'lesson') return 'text';
      if (row.content_type === 'video_lesson') return 'video';
      if (row.subtype === 'blog') return 'blog';
      if (['quiz','exam','past_question'].includes(row.subtype)) return 'test';
      return 'edutainment';
    };

    const normalized = rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      type: typeLabel(row),
      content_type: row.content_type,
      subtype: row.subtype,
      status: row.status,
      is_premium: row.is_premium,
      courseName: row.course_name || null,
      contributor: row.creator_name ? { name: row.creator_name } : null,
      views: row.total_views || 0,
      createdAt: row.created_at,
      publishedAt: row.published_at,
    }));

    res.json({ success: true, content: normalized, total: count });
  } catch (error) {
    console.error('Admin content error:', error);
    res.status(500).json({ success: false, error: 'Failed to load content' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const { q = '', limit = 20, page = 1, role } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const where = {};
    if (q) {
      where[Op.or] = [
        { full_name: { [Op.iLike]: `%${q}%` } },
        { email: { [Op.iLike]: `%${q}%` } },
        { phone_number: { [Op.iLike]: `%${q}%` } },
      ];
    }
    if (role) {
      where.role = role;
    }

    const { rows, count } = await User.findAndCountAll({
      where,
      distinct: true,
      include: [
        { model: Subscription, as: 'subscription', include: [{ model: Plan, as: 'plan' }] },
        { model: UserProgress, as: 'progress' },
      ],
      order: [['created_at', 'DESC']],
      limit: Number(limit),
      offset,
    });

    res.json({ success: true, users: rows, total: count });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ success: false, error: 'Failed to load users' });
  }
});

router.patch('/users/:id/moderation', async (req, res) => {
  try {
    const { action, reason = '', note = '', suspend_days } = req.body || {};
    const validActions = ['warn', 'suspend', 'block', 'reactivate'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ success: false, error: `Invalid moderation action. Must be one of: ${validActions.join(', ')}` });
    }

    const target = await User.findByPk(req.params.id);
    if (!target) return res.status(404).json({ success: false, error: 'User not found' });
    if (String(target.id) === String(req.user.id)) {
      return res.status(400).json({ success: false, error: 'You cannot moderate your own account.' });
    }
    if (target.role === 'admin' && !isSuperAdmin(req.user)) {
      return res.status(403).json({ success: false, error: 'Only a superadmin can moderate another admin.' });
    }

    const now = new Date();
    const patch = {
      moderation_reason: String(reason || '').trim() || null,
      moderation_note: String(note || '').trim() || null,
    };

    if (action === 'warn') {
      patch.account_status = 'warned';
      patch.warned_at = now;
      patch.suspended_until = null;
      patch.blocked_at = null;
    }

    if (action === 'suspend') {
      const days = Math.min(Math.max(Number(suspend_days || 7), 1), 365);
      patch.account_status = 'suspended';
      patch.suspended_until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      patch.session_token = null;
    }

    if (action === 'block') {
      patch.account_status = 'blocked';
      patch.blocked_at = now;
      patch.session_token = null;
    }

    if (action === 'reactivate') {
      patch.account_status = 'active';
      patch.suspended_until = null;
      patch.blocked_at = null;
    }

    await target.update(patch);
    const notificationCopy = {
      warn: {
        title: 'Account warning',
        body: patch.moderation_reason || 'An administrator has issued a warning on your account.',
      },
      suspend: {
        title: 'Account suspended',
        body: patch.suspended_until
          ? `Your account is suspended until ${patch.suspended_until.toLocaleString()}. ${patch.moderation_reason || ''}`.trim()
          : (patch.moderation_reason || 'Your account has been suspended.'),
      },
      block: {
        title: 'Account blocked',
        body: patch.moderation_reason || 'Your account has been blocked by an administrator.',
      },
      reactivate: {
        title: 'Account reactivated',
        body: 'Your account access has been restored.',
      },
    }[action];
    if (notificationCopy) {
      notificationService.createNotification({
        userId: target.id,
        type: 'account_moderation',
        title: notificationCopy.title,
        body: notificationCopy.body,
        data: { action, reason: patch.moderation_reason || null },
      }).catch((error) => console.error('Moderation notification error:', error));
      notifyUserModeration(target, {
        ...notificationCopy,
        action,
      }).catch((error) => console.error('Moderation direct message error:', error));
    }
    await createAuditLog(req, {
      action: `user_${action}`,
      section: 'users',
      status_code: 200,
      target_type: 'user',
      target_id: target.id,
      metadata: {
        target_email: target.email,
        reason: patch.moderation_reason,
        suspended_until: patch.suspended_until || null,
      },
    });

    res.json({ success: true, user: target });
  } catch (error) {
    console.error('Admin user moderation error:', error);
    res.status(500).json({ success: false, error: 'Failed to update user moderation status' });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const target = await User.findByPk(req.params.id);
    if (!target) return res.status(404).json({ success: false, error: 'User not found' });
    if (String(target.id) === String(req.user.id)) {
      return res.status(400).json({ success: false, error: 'You cannot delete your own account from the admin console.' });
    }
    if (target.role === 'admin' && !isSuperAdmin(req.user)) {
      return res.status(403).json({ success: false, error: 'Only a superadmin can delete another admin.' });
    }

    const now = new Date();
    const deleteReason = String(req.body?.reason || '').trim() || 'Removed by admin';
    await target.update({
      account_status: 'deleted',
      deleted_at: now,
      session_token: null,
      moderation_reason: deleteReason,
      moderation_note: String(req.body?.note || '').trim() || null,
      is_superadmin: false,
      admin_permissions: null,
      admin_title: null,
    });

    const deleteMessage = `Your Learnda account has been removed. Reason: ${deleteReason}`;
    notifyUserModeration(target, {
      action: 'delete',
      title: 'Account removed',
      body: deleteMessage,
    }).catch((error) => console.error('Moderation delete message error:', error));

    await createAuditLog(req, {
      action: 'user_delete',
      section: 'users',
      status_code: 200,
      target_type: 'user',
      target_id: target.id,
      metadata: {
        target_email: target.email,
        soft_deleted: true,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Admin user delete error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete user' });
  }
});

router.get('/contributor-applications', async (req, res) => {
  try {
    const { status = 'pending', limit = 20, page = 1 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const where = status === 'all'
      ? { contributor_application_status: { [Op.in]: ['pending', 'approved', 'rejected'] } }
      : { contributor_application_status: status };

    const { rows, count } = await User.findAndCountAll({
      where,
      attributes: [
        'id',
        'full_name',
        'email',
        'role',
        'is_contributor',
        'contributor_application_status',
        'contributor_application_note',
        'contributor_applied_at',
        'contributor_approved_at',
        'created_at'
      ],
      order: [['contributor_applied_at', 'DESC NULLS LAST'], ['created_at', 'DESC']],
      limit: Number(limit),
      offset
    });

    res.json({ success: true, applications: rows, total: count });
  } catch (error) {
    console.error('Admin contributor applications error:', error);
    res.status(500).json({ success: false, error: 'Failed to load contributor applications' });
  }
});

router.patch('/contributor-applications/:userId', async (req, res) => {
  try {
    const { decision } = req.body || {};
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ success: false, error: 'Decision must be approved or rejected' });
    }

    const user = await User.findByPk(req.params.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (decision === 'approved') {
      user.contributor_application_status = 'approved';
      user.contributor_approved_at = new Date();
      user.contributor_approved_by = req.user.id;
      user.is_contributor = true;
    } else {
      user.contributor_application_status = 'rejected';
      user.contributor_approved_at = null;
      user.contributor_approved_by = null;
      user.is_contributor = false;
    }
    await user.save();

    res.json({
      success: true,
      application: {
        id: user.id,
        status: user.contributor_application_status,
        is_contributor: user.is_contributor,
        approved_at: user.contributor_approved_at
      }
    });
  } catch (error) {
    console.error('Admin contributor application decision error:', error);
    res.status(500).json({ success: false, error: 'Failed to update contributor application' });
  }
});

router.get('/revenue', async (req, res) => {
  try {
    const subscriptions = await Subscription.findAll({
      where: { status: 'active' },
      include: [{ model: Plan, as: 'plan', attributes: ['name', 'price'] }],
    });

    const planBuckets = subscriptions.reduce((acc, sub) => {
      const name = sub.plan?.name || 'Unknown';
      if (!acc[name]) {
        acc[name] = { name, subscribers: 0, revenue: 0 };
      }
      acc[name].subscribers += 1;
      acc[name].revenue += Number(sub.plan?.price || 0);
      return acc;
    }, {});

    const plans = Object.values(planBuckets);
    const totalRevenue = plans.reduce((sum, plan) => sum + plan.revenue, 0);

    res.json({
      success: true,
      revenue: {
        total: Number(totalRevenue.toFixed(2)),
        plans,
      },
    });
  } catch (error) {
    console.error('Admin revenue error:', error);
    res.status(500).json({ success: false, error: 'Failed to load revenue data' });
  }
});

router.get('/analytics', async (req, res) => {
  try {
    const range = req.query.range || '30d';
    const segment = ['all', 'web', 'mobile'].includes(req.query.segment) ? req.query.segment : 'all';
    const analytics = await buildAnalyticsSnapshot({ range, segment });

    res.json({
      success: true,
      analytics,
      pageEngagement: analytics.page_engagement,
    });
  } catch (error) {
    console.error('Admin analytics error:', error);
    res.status(500).json({ success: false, error: 'Failed to load analytics' });
  }
});

router.get('/analytics/export', async (req, res) => {
  try {
    const range = req.query.range || '30d';
    const segment = ['all', 'web', 'mobile'].includes(req.query.segment) ? req.query.segment : 'all';
    const format = req.query.format || 'csv';
    const analytics = await buildAnalyticsSnapshot({ range, segment });

    const summaryRows = [
      ['metric', 'value'],
      ['range', range],
      ['segment', segment],
      ['active_users', analytics.active_users],
      ['new_users', analytics.new_users],
      ['new_subscriptions', analytics.new_subscriptions],
      ['revenue', analytics.revenue],
      ['engagement_rate', analytics.engagement_rate],
      ['conversion_rate', analytics.conversion_rate],
      ['mobile_share', analytics.mobile_share],
      ['daily_active_users', analytics.daily_active_users],
      ['weekly_active_users', analytics.weekly_active_users],
      ['monthly_active_users', analytics.monthly_active_users],
      ['stickiness', analytics.stickiness],
      ['total_events', analytics.total_events],
    ];

    const featureRows = analytics.feature_usage.map((item) => [
      `feature:${item.feature}`,
      `events=${item.events};users=${item.users};share=${item.share}%`,
    ]);

    const endpointRows = analytics.top_endpoints.slice(0, 10).map((item) => [
      `endpoint:${item.path}`,
      `hits=${item.hits};users=${item.users};avg_ms=${item.avg_duration_ms}`,
    ]);

    const csv = [...summaryRows, ...featureRows, ...endpointRows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    if (format === 'json') {
      return res.json({ success: true, analytics });
    }

    res.setHeader('Content-Disposition', `attachment; filename="analytics-${range}-${segment}.csv"`);
    res.setHeader('Content-Type', 'text/csv');
    return res.send(csv);
  } catch (error) {
    console.error('Admin analytics export error:', error);
    res.status(500).json({ success: false, error: 'Failed to export analytics' });
  }
});

router.get('/content/pending', async (req, res) => {
  try {
    const { type = 'all', status = 'pending', dateRange = 'all' } = req.query;
    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 100);
    const offset = Math.max(Number(req.query.offset || 0), 0);
    const where = { status };

    if (type !== 'all') {
      const kindMap = {
        text_lesson: 'lesson',
        lesson: 'lesson',
        video: 'lesson',
        quiz: 'quiz',
        file: 'file',
        past_question: 'file',
        blog: 'blog',
        edutainment: 'blog',
      };
      where.kind = kindMap[type] || type;
    }

    if (dateRange !== 'all') {
      const now = new Date();
      const start = new Date(now);
      if (dateRange === 'today') {
        start.setHours(0, 0, 0, 0);
      } else if (dateRange === 'week') {
        start.setDate(now.getDate() - 7);
      } else if (dateRange === 'month') {
        start.setDate(now.getDate() - 30);
      }
      where.created_at = { [Op.gte]: start };
    }

    const contributions = await Contribution.findAll({
      where,
      include: [{ model: User, as: 'uploader', attributes: ['full_name', 'email'] }],
      order: [['created_at', 'DESC']],
    });

    const contributionContent = contributions.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      type: item.kind,
      content_type: 'contribution',
      depth_level: item.level,
      visual_type: item.metadata?.visual_type || 'static',
      is_premium: false,
      creator_name: item.uploader?.full_name || item.uploader?.email || 'Contributor',
      contributor: {
        name: item.uploader?.full_name || item.uploader?.email || 'Contributor',
        email: item.uploader?.email || null,
      },
      created_at: item.created_at,
      createdAt: item.created_at,
      revenue_share: item.metadata?.revenue_share || 50,
      content: item.body,
      file_url: item.file_path ? `/uploads/${path.basename(item.file_path)}` : null,
      file_name: item.original_name,
      metadata: item.metadata || {},
    }));

    const acConditions = ['ac.status = :status'];
    const replacements = { status };

    if (type !== 'all') {
      if (['text_lesson', 'lesson'].includes(type)) {
        acConditions.push("ac.content_type = 'lesson'");
      } else if (type === 'video') {
        acConditions.push("ac.content_type = 'video_lesson'");
      } else if (type === 'quiz') {
        acConditions.push("ac.content_type = 'text_item' AND ac.subtype = 'quiz'");
      } else if (type === 'past_question') {
        acConditions.push("ac.content_type = 'text_item' AND ac.subtype = 'past_question'");
      } else if (type === 'blog') {
        acConditions.push("ac.content_type = 'text_item' AND ac.subtype IN ('blog','blog_post')");
      }
    }

    if (dateRange !== 'all' && where.created_at?.[Op.gte]) {
      acConditions.push('ac.created_at >= :startDate');
      replacements.startDate = where.created_at[Op.gte];
    }

    const generatedRows = await dbSequelize.query(
      `SELECT ac.*, cs.total_views,
              u.full_name AS creator_name,
              u.email AS creator_email,
              c.title AS course_name
       FROM all_content ac
       LEFT JOIN content_stats cs ON cs.content_id = ac.id
       LEFT JOIN users u ON u.id = ac.creator_id
       LEFT JOIN courses c ON c.id = ac.course_id
       WHERE ${acConditions.join(' AND ')}
       ORDER BY ac.created_at DESC`,
      { replacements, type: dbSequelize.QueryTypes.SELECT }
    );

    const generatedContent = generatedRows.map((row) => {
      const itemType = row.content_type === 'lesson'
        ? 'lesson'
        : row.subtype || row.content_type;
      const lessonHtml = Array.isArray(row.lesson_document?.chunks)
        ? row.lesson_document.chunks
          .map((chunk) => `<h4>${escapeHtml(chunk.title || '')}</h4>${chunk.html || chunk.content || chunk.body || ''}`)
          .join('\n')
        : null;
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        type: itemType,
        content_type: row.content_type,
        subtype: row.subtype,
        status: row.status,
        depth_level: row.depth_level,
        visual_type: row.metadata?.visual_type || 'static',
        is_premium: row.is_premium,
        creator_name: row.creator_name || row.creator_email || 'Learnda import',
        contributor: {
          name: row.creator_name || row.creator_email || 'Learnda import',
          email: row.creator_email || null,
        },
        course: row.course_name ? { title: row.course_name } : null,
        courseName: row.course_name || row.metadata?.course_title || row.metadata?.course || null,
        created_at: row.created_at,
        createdAt: row.created_at,
        revenue_share: row.metadata?.revenue_share || 0,
        content: row.body || lessonHtml,
        body: row.body,
        lesson_document: row.lesson_document,
        objectives: row.objectives,
        exercises: row.exercises,
        questions: row.questions || row.metadata?.questions,
        sections: row.sections || row.metadata?.sections,
        metadata: row.metadata || {},
        duration: row.duration_minutes || row.reading_time || null,
        views: row.total_views || 0,
        adminNote: row.metadata?.review_notes || row.metadata?.review_note || null,
      };
    });

    const allContent = [...contributionContent, ...generatedContent]
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    const content = allContent.slice(offset, offset + limit);

    res.json({ success: true, content, total: allContent.length });
  } catch (error) {
    console.error('Admin pending content error:', error);
    res.status(500).json({ success: false, error: 'Failed to load pending content' });
  }
});

router.post('/content/:id/review', async (req, res) => {
  try {
    const { action, notes, requires_changes, status: requestedStatus, adminNote } = req.body || {};
    const reviewAction = action || (requestedStatus === 'rejected' ? 'reject' : 'approve');
    const reviewNotes = notes || adminNote || null;
    const item = await Contribution.findByPk(req.params.id);
    if (item) {
      if (item.status !== 'pending') {
        return res.status(400).json({ success: false, error: 'Already reviewed' });
      }

      if (reviewAction === 'reject') {
        await item.update({
          status: 'rejected',
          review_notes: reviewNotes,
          reviewed_by: req.user.id,
          reviewed_at: new Date(),
        });
        return res.json({ success: true, contribution: item });
      }

      const fileUrl = item.file_path ? `/uploads/${path.basename(item.file_path)}` : null;
      const kindToModel = { blog: 'TextItem', quiz: 'TextItem', lesson: 'Lesson', file: 'Lesson' };
      const kindToSubtype = { blog: 'blog_post', quiz: 'quiz' };
      const ModelClass = kindToModel[item.kind] === 'TextItem' ? TextItem : Lesson;
      const contentFields = {
        title: item.title,
        description: item.description,
        depth_level: item.level,
        is_premium: false,
        creator_id: item.uploader_id,
        status: 'published',
        file_url: fileUrl,
        tags: item.tags || [],
        metadata: { ...(item.metadata || {}), course: item.course, body: item.body },
        published_at: new Date(),
      };
      if (ModelClass === TextItem) {
        contentFields.subtype = kindToSubtype[item.kind] || 'note';
        contentFields.body = item.body;
      }
      const content = await ModelClass.create(contentFields);

      await item.update({
        status: 'approved',
        review_notes: reviewNotes,
        reviewed_by: req.user.id,
        reviewed_at: new Date(),
        content_id: content.id,
      });

      return res.json({ success: true, contribution: item, content, requires_changes: !!requires_changes });
    }

    const [lesson, textItem] = await Promise.all([
      Lesson.findByPk(req.params.id),
      TextItem.findByPk(req.params.id),
    ]);
    const generatedItem = lesson || textItem;
    if (!generatedItem) {
      return res.status(404).json({ success: false, error: 'Content not found' });
    }
    if (!['pending', 'draft'].includes(generatedItem.status)) {
      return res.status(400).json({ success: false, error: 'Already reviewed' });
    }

    const nextStatus = reviewAction === 'reject' ? 'rejected' : 'published';
    const nextMetadata = {
      ...(generatedItem.metadata || {}),
      review_notes: reviewNotes,
      reviewed_by: req.user.id,
      reviewed_at: new Date().toISOString(),
      review_source: 'admin_console',
    };

    await generatedItem.update({
      status: nextStatus,
      metadata: nextMetadata,
      published_at: nextStatus === 'published' ? new Date() : generatedItem.published_at,
    });

    return res.json({
      success: true,
      content: generatedItem,
      requires_changes: !!requires_changes,
    });
  } catch (error) {
    console.error('Admin review content error:', error);
    res.status(500).json({ success: false, error: 'Failed to review content' });
  }
});

router.get('/reward-payouts', async (req, res) => {
  try {
    const { status = 'requested', limit = 20, page = 1 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const where = status === 'all' ? {} : { status };

    const { rows, count } = await RewardPayout.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'full_name', 'email', 'current_plan', 'rewards_lifetime']
        }
      ],
      order: [['requested_at', 'DESC']],
      limit: Number(limit),
      offset
    });

    const payouts = rows.map((item) => ({
      id: item.id,
      status: item.status,
      amount: Number(item.amount || 0),
      destination: item.destination,
      destination_telco: item.destination_telco,
      requested_at: item.requested_at,
      processed_at: item.processed_at,
      insights: item.insights || {},
      user: item.user
    }));

    res.json({ success: true, payouts, total: count });
  } catch (error) {
    console.error('Admin reward payouts error:', error);
    res.status(500).json({ success: false, error: 'Failed to load reward payouts' });
  }
});

router.patch('/reward-payouts/:id', async (req, res) => {
  try {
    const payout = await RewardPayout.findByPk(req.params.id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'rewards_balance', 'rewards_pending', 'email', 'full_name'] }
      ]
    });
    if (!payout) {
      return res.status(404).json({ success: false, error: 'Payout request not found' });
    }

    const nextStatus = req.body?.status;
    if (!['requested', 'approved', 'paid', 'rejected'].includes(nextStatus)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const previousStatus = payout.status;
    payout.status = nextStatus;
    payout.processed_at = nextStatus === 'requested' ? null : new Date();
    await payout.save();

    const amount = Number(payout.amount || 0);
    const user = payout.user;

    if (user && previousStatus !== nextStatus) {
      if (nextStatus === 'paid') {
        user.rewards_pending = Math.max(Number(user.rewards_pending || 0) - amount, 0);
        await user.save();
      }
      if (nextStatus === 'rejected') {
        user.rewards_pending = Math.max(Number(user.rewards_pending || 0) - amount, 0);
        user.rewards_balance = Number(user.rewards_balance || 0) + amount;
        await user.save();
      }

      try {
        const statusLabel = nextStatus.charAt(0).toUpperCase() + nextStatus.slice(1);
        await notificationService.createNotification({
          userId: user.id,
          title: 'Payout request update',
          body: `Your payout request is now ${statusLabel}.`,
          type: 'reward_payout',
          action_url: '/settings?tab=account',
          data: {
            payout_id: payout.id,
            status: nextStatus
          }
        });
      } catch (notifyError) {
        // Non-blocking
      }
    }

    res.json({ success: true, payout });
  } catch (error) {
    console.error('Admin update reward payout error:', error);
    res.status(500).json({ success: false, error: 'Failed to update payout request' });
  }
});

// ── Extended user analytics ────────────────────────────────────────────────────
router.get('/analytics/users', async (req, res) => {
  try {
    const range = req.query.range || '30d';
    const { start } = getRange(range);
    const now = new Date();

    const [dau, wau, mau, sau, aau, totalUsers, newUsers, subs, growthSeries, institutionRows, levelRows, recentUsersRows] = await Promise.all([
      User.count({ where: { last_active_at: { [Op.gte]: new Date(now - 86400000) } } }),
      User.count({ where: { last_active_at: { [Op.gte]: new Date(now - 7 * 86400000) } } }),
      User.count({ where: { last_active_at: { [Op.gte]: new Date(now - 30 * 86400000) } } }),
      User.count({ where: { last_active_at: { [Op.gte]: new Date(now - 180 * 86400000) } } }),
      User.count({ where: { last_active_at: { [Op.ne]: null } } }),
      User.count(),
      start ? User.count({ where: { created_at: { [Op.gte]: start } } }) : Promise.resolve(0),
      Subscription.findAll({ where: { status: 'active' }, include: [{ model: Plan, as: 'plan', attributes: ['name', 'price'] }] }),
      User.findAll({
        attributes: [[fn('DATE', col('created_at')), 'date'], [fn('COUNT', col('id')), 'count']],
        where: start ? { created_at: { [Op.gte]: start } } : {},
        group: [fn('DATE', col('created_at'))],
        order: [[fn('DATE', col('created_at')), 'ASC']],
        raw: true,
        limit: 90,
      }),
      AcademicProfile.findAll({
        attributes: ['level_group', [fn('COUNT', col('id')), 'count']],
        group: ['level_group'],
        order: [[fn('COUNT', col('id')), 'DESC']],
        raw: true,
      }).catch(() => []),
      // users.level was removed in the K-12 refactor; class levels live on AcademicProfile.
      AcademicProfile.findAll({
        attributes: ['class_level', [fn('COUNT', col('id')), 'count']],
        where: { class_level: { [Op.ne]: null } },
        group: ['class_level'],
        order: [[fn('COUNT', col('id')), 'DESC']],
        raw: true,
      }).then((rows) => rows.map((r) => ({ level: r.class_level, count: r.count }))).catch(() => []),
      User.findAll({
        include: [{ model: Subscription, as: 'subscription', include: [{ model: Plan, as: 'plan', attributes: ['name'] }], required: false }],
        order: [['created_at', 'DESC']],
        limit: 8,
        attributes: ['id', 'full_name', 'email', 'created_at'],
      }).catch(() => []),
    ]);

    const planCounts = subs.reduce((acc, sub) => {
      const name = (sub.plan?.name || 'Basic').toLowerCase();
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});

    const paying = subs.length;
    const basic = Math.max(0, totalUsers - paying);
    const serious = planCounts['serious student'] || planCounts.serious || 0;
    const master = planCounts['master student'] || planCounts.master || 0;

    const byPlan = [
      { label: 'Basic (Free)', count: basic },
      { label: 'Serious', count: serious },
      { label: 'Master', count: master },
    ];

    const recentUsers = recentUsersRows.map((u) => ({
      id: u.id,
      full_name: u.full_name || '',
      email: u.email,
      created_at: u.created_at,
      plan: (u.subscription?.plan?.name || 'basic').toLowerCase().includes('master') ? 'master'
          : (u.subscription?.plan?.name || 'basic').toLowerCase().includes('serious') ? 'serious'
          : 'basic',
    }));

    res.json({
      success: true,
      dau, wau, mau, sau, aau,
      total: totalUsers,
      new_users: newUsers,
      stickiness: mau > 0 ? Math.round((dau / mau) * 100) : 0,
      plan_breakdown: { basic, serious, master },
      by_plan: byPlan,
      by_level_group: institutionRows.map((r) => ({ label: r.level_group, count: Number(r.count) })),
      by_level: levelRows.map((r) => ({ label: r.level, count: Number(r.count) })),
      recent_users: recentUsers,
      growth_series: growthSeries.map((r) => ({ date: r.date, count: Number(r.count) })),
    });
  } catch (error) {
    console.error('Admin user analytics error:', error);
    res.status(500).json({ success: false, error: 'Failed to load user analytics' });
  }
});

// ── MRR / ARR / DRR ───────────────────────────────────────────────────────────
router.get('/analytics/mrr', async (req, res) => {
  try {
    const subs = await Subscription.findAll({
      where: { status: 'active' },
      include: [{ model: Plan, as: 'plan', attributes: ['name', 'price'] }],
    });

    const mrr = subs.reduce((sum, sub) => sum + Number(sub.plan?.price || 0), 0);
    const arr = mrr * 12;
    const drr = mrr / 30;
    const wrr = (mrr / 30) * 7;

    const planBreakdown = subs.reduce((acc, sub) => {
      const name = sub.plan?.name || 'Unknown';
      if (!acc[name]) acc[name] = { name, count: 0, mrr: 0 };
      acc[name].count++;
      acc[name].mrr += Number(sub.plan?.price || 0);
      return acc;
    }, {});

    // Monthly revenue series from recent subscriptions
    const revSeries = await Subscription.findAll({
      attributes: [
        [fn('DATE_TRUNC', 'month', col('started_at')), 'month'],
        [fn('COUNT', col('Subscription.id')), 'count'],
      ],
      where: { started_at: { [Op.gte]: new Date(Date.now() - 365 * 86400000) } },
      include: [{ model: Plan, as: 'plan', attributes: ['price'], required: true }],
      group: [fn('DATE_TRUNC', 'month', col('started_at'))],
      order: [[fn('DATE_TRUNC', 'month', col('started_at')), 'ASC']],
      raw: true,
    }).catch(() => []);

    const payingCount = new Set(subs.map((s) => s.user_id).filter(Boolean)).size;
    const arpu = payingCount > 0 ? Number((mrr / payingCount).toFixed(2)) : 0;
    const ltv = arpu > 0 ? Number((arpu * 12).toFixed(2)) : 0;

    res.json({
      success: true,
      drr: Number(drr.toFixed(2)),
      wrr: Number(wrr.toFixed(2)),
      mrr: Number(mrr.toFixed(2)),
      arr: Number(arr.toFixed(2)),
      paying_users: payingCount,
      active_subscriptions: payingCount,
      arpu,
      ltv,
      churned_count: 0,
      churn_rate: 0,
      plan_breakdown: Object.values(planBreakdown),
      rev_series: revSeries,
    });
  } catch (error) {
    console.error('Admin MRR error:', error);
    res.status(500).json({ success: false, error: 'Failed to load MRR data' });
  }
});

// ── Expenses ───────────────────────────────────────────────────────────────────
router.get('/expenses', async (req, res) => {
  res.json({ success: true, expenses: loadExpenses() });
});

router.put('/expenses', async (req, res) => {
  try {
    const expenses = Array.isArray(req.body?.expenses) ? req.body.expenses : [];
    saveExpenses(expenses);
    res.json({ success: true, expenses });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to save expenses' });
  }
});

// ── Usage statistics ───────────────────────────────────────────────────────────
router.get('/analytics/usage', async (req, res) => {
  try {
    const range = req.query.range || '30d';
    const { start } = getRange(range);
    const rangeWhere = start ? { created_at: { [Op.gte]: start } } : {};

    const distinctCount = (where) =>
      ContentEngagement.count({ attributes: [[fn('COUNT', fn('DISTINCT', col('user_id'))), 'c']], where, raw: true })
        .then((r) => Number(Array.isArray(r) ? r[0]?.c : r) || 0).catch(() => 0);

    const eventDistinctUsers = (where) =>
      Event.findOne({ attributes: [[fn('COUNT', fn('DISTINCT', col('user_id'))), 'c']], where, raw: true })
        .then((r) => Number(r?.c) || 0).catch(() => 0);

    const [
      lessonsStudied, uniqueLearners, testsCompleted, uniqueTesters,
      filesDownloaded, filesSaved, uniqueFileUsers,
      edutainmentViewed, uniqueViewers,
      communityPosts, groupMessages, contentEngagements,
      installRows,
    ] = await Promise.all([
      ContentEngagement.count({ where: { action: { [Op.in]: ['view', 'complete'] }, ...rangeWhere } }),
      distinctCount(rangeWhere),
      ContentEngagement.count({ where: { action: 'complete', ...rangeWhere } }),
      distinctCount({ action: 'complete', ...rangeWhere }),
      // 'download' is not in the ContentEngagement action ENUM — use Events table instead
      Event.count({ where: { event_type: { [Op.in]: ['file_download', 'resource_download'] }, ...rangeWhere } }).catch(() => 0),
      ContentEngagement.count({ where: { action: 'save', ...rangeWhere } }),
      distinctCount({ action: 'save', ...rangeWhere }),
      // content_engagements has no content_type column — count edutainment page views from Events
      Event.count({ where: { event_type: 'page_view', page_url: { [Op.like]: '%/edutainment%' }, ...rangeWhere } }).catch(() => 0),
      eventDistinctUsers({ event_type: 'page_view', page_url: { [Op.like]: '%/edutainment%' }, ...rangeWhere }),
      CommunityPost ? CommunityPost.count({ where: rangeWhere }) : Promise.resolve(0),
      StudyGroupMessage ? StudyGroupMessage.count({ where: rangeWhere }) : Promise.resolve(0),
      ContentEngagement.count({ where: rangeWhere }),
      // App installs by platform, proxied by registered push-notification devices (cumulative, not range-bound).
      PushToken
        ? PushToken.findAll({ attributes: ['platform', [fn('COUNT', col('id')), 'count']], group: ['platform'], raw: true }).catch(() => [])
        : Promise.resolve([]),
    ]);

    const installs = { android: 0, ios: 0, web: 0 };
    (installRows || []).forEach((row) => {
      const platform = String(row.platform || '').toLowerCase();
      const count = Number(row.count || 0);
      if (platform.includes('android')) installs.android += count;
      else if (platform.includes('ios') || platform.includes('iphone') || platform.includes('ipad')) installs.ios += count;
      else if (platform.includes('web') || platform.includes('pwa') || platform.includes('browser')) installs.web += count;
      else installs.web += count; // default unknown platforms to web/PWA
    });

    const completionRate = lessonsStudied > 0 ? Number(((testsCompleted / lessonsStudied) * 100).toFixed(1)) : 0;

    res.json({
      success: true,
      lessons_studied: lessonsStudied,
      unique_learners: uniqueLearners,
      tests_completed: testsCompleted,
      unique_testers: uniqueTesters,
      files_downloaded: filesDownloaded,
      files_saved: filesSaved,
      unique_file_users: uniqueFileUsers,
      edutainment_viewed: edutainmentViewed,
      unique_viewers: uniqueViewers,
      community_posts: communityPosts,
      group_messages: groupMessages,
      total_engagements: contentEngagements,
      completion_rate: completionRate,
      installs,
    });
  } catch (error) {
    console.error('Admin usage error:', error);
    res.status(500).json({ success: false, error: 'Failed to load usage stats' });
  }
});

// ── Visit / traffic analytics ─────────────────────────────────────────────────
router.get('/analytics/visits', async (req, res) => {
  try {
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const semStart = new Date(now);
    semStart.setMonth(now.getMonth() - 6);

    // Categorize a page URL/path into a guest-friendly bucket for the Guest Behavior visual.
    const categorizeGuestPath = (rawUrl) => {
      const p = String(rawUrl || '').toLowerCase();
      if (!p || p === '/' || p === '/home' || p.endsWith('/home')) return 'Home Page';
      if (p.includes('/blog') || p.includes('/updates') || p.includes('/release')) return 'Blog / Updates';
      if (p.includes('/learn') || p.includes('/courses') || p.includes('/lesson')) return 'Course Preview';
      if (p.includes('/community') || p.includes('/forum') || p.includes('/groups')) return 'Community';
      if (p.includes('/register') || p.includes('/signup') || p.includes('/login') || p.includes('/auth')) return 'Signup / Auth';
      if (p.includes('/edutainment') || p.includes('/trending')) return 'Edutainment';
      if (p.includes('/resources') || p.includes('/files')) return 'Resources';
      if (p.includes('/upgrade') || p.includes('/features-and-plans') || p.includes('/pricing')) return 'Plans & Pricing';
      return 'Other';
    };

    const pvFilter = { event_type: 'page_view' };
    // A "guest" event is a page view with no authenticated user attached.
    const guestOnly = { user_id: { [Op.is]: null } };
    const [total, today, thisMonth, thisYear, thisSemester, visitSeries, guestPageRows] = await Promise.all([
      Event.count({ where: pvFilter }),
      Event.count({ where: { ...pvFilter, created_at: { [Op.gte]: dayStart } } }),
      Event.count({ where: { ...pvFilter, created_at: { [Op.gte]: monthStart } } }),
      Event.count({ where: { ...pvFilter, created_at: { [Op.gte]: yearStart } } }),
      Event.count({ where: { ...pvFilter, created_at: { [Op.gte]: semStart } } }),
      Event.findAll({
        attributes: [
          [fn('DATE', col('created_at')), 'date'],
          [fn('COUNT', col('id')), 'total'],
          // Guest page views = views where user_id is NULL. Registered views are derived as total - guests
          // so both series share the same (page-view) scale and the split is apples-to-apples.
          [fn('COUNT', literal("CASE WHEN user_id IS NULL THEN 1 END")), 'guests'],
        ],
        where: { ...pvFilter, created_at: { [Op.gte]: new Date(now - 30 * 86400000) } },
        group: [fn('DATE', col('created_at'))],
        order: [[fn('DATE', col('created_at')), 'ASC']],
        raw: true,
      }).catch(() => []),
      Event.findAll({
        attributes: ['page_url', [fn('COUNT', col('id')), 'count']],
        where: { ...pvFilter, ...guestOnly, created_at: { [Op.gte]: semStart } },
        group: ['page_url'],
        raw: true,
      }).catch(() => []),
    ]);

    // Aggregate guest page views into friendly category buckets, sorted by volume.
    const guestBuckets = new Map();
    guestPageRows.forEach((row) => {
      const label = categorizeGuestPath(row.page_url);
      guestBuckets.set(label, (guestBuckets.get(label) || 0) + Number(row.count || 0));
    });
    const guestBehavior = [...guestBuckets.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    res.json({
      success: true,
      total_visits: total,
      today_visits: today,
      month_visits: thisMonth,
      semester_visits: thisSemester,
      year_visits: thisYear,
      guest_behavior: guestBehavior,
      visit_series: visitSeries.map((r) => {
        const totalViews = Number(r.total) || 0;
        const guestViews = Number(r.guests) || 0;
        return {
          date: r.date,
          total: totalViews,
          users: Math.max(0, totalViews - guestViews),
          guests: guestViews,
        };
      }),
    });
  } catch (error) {
    console.error('Admin visits error:', error);
    res.status(500).json({ success: false, error: 'Failed to load visit data' });
  }
});

// ── Trigger notification: send + history ──────────────────────────────────────
router.post('/notifications/trigger', authenticate, checkRole(['admin']), async (req, res) => {
  try {
    const { triggerId, label, message, cta } = req.body;
    if (!triggerId || !message) {
      return res.status(400).json({ success: false, error: 'triggerId and message are required.' });
    }

    const users = await User.findAll({
      attributes: ['id', 'full_name', 'email', 'phone_number'],
      limit: 5000,
    });

    const triggerTitle = label || 'Learnda Update';
    let sentCount = 0;
    for (const user of users) {
      try {
        const firstName = (user.full_name || '').split(' ')[0] || 'there';
        const personalizedBody = message.replace(/\{name\}/g, firstName);

        // Push — always
        await notificationService.createNotification({
          userId: user.id,
          type: 'system',
          title: triggerTitle,
          body: personalizedBody,
          data: { cta },
        });

        // Email — if user has an email address
        if (user.email) {
          try {
            await sendEmail({ to: user.email, subject: triggerTitle, text: personalizedBody });
          } catch { /* continue */ }
        }

        // SMS — if user has a phone number
        if (user.phone_number) {
          try {
            await sendOtpSms({ to: user.phone_number, message: personalizedBody });
          } catch { /* continue */ }
        }

        sentCount++;
      } catch { /* skip failed */ }
    }

    const log = loadJsonFile(TRIGGER_LOG_FILE, []);
    const entry = {
      id: `trig_${Date.now()}`,
      triggerId,
      label: label || triggerId,
      message,
      cta: cta || null,
      sentTo: sentCount,
      sentAt: new Date().toISOString(),
      sentBy: req.user?.id,
    };
    log.unshift(entry);
    saveJsonFile(TRIGGER_LOG_FILE, log.slice(0, 1000));

    res.json({ success: true, sent: sentCount, entry });
  } catch (error) {
    console.error('Trigger notification send error:', error);
    res.status(500).json({ success: false, error: 'Failed to send trigger notification.' });
  }
});

router.get('/notifications/trigger-history', authenticate, checkRole(['admin']), (req, res) => {
  try {
    const { triggerId, limit = 50, offset = 0 } = req.query;
    let log = loadJsonFile(TRIGGER_LOG_FILE, []);
    if (triggerId) log = log.filter((e) => e.triggerId === triggerId);
    const total = log.length;
    const page  = log.slice(Number(offset), Number(offset) + Number(limit));
    res.json({ success: true, log: page, total });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to load trigger history.' });
  }
});

router.get('/notifications/analytics', authenticate, checkRole(['admin']), async (req, res) => {
  try {
    const days = Math.min(365, Math.max(1, Number.parseInt(req.query.range_days, 10) || 30));
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
    const offset = Math.max(0, Number.parseInt(req.query.offset, 10) || 0);
    const typeFilter = String(req.query.type || '').trim();
    const since = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

    const where = {
      created_at: { [Op.gte]: since },
    };
    if (typeFilter) {
      where.type = typeFilter;
    }

    const [
      totalSent,
      totalRead,
      totalUnread,
      uniqueUsersResult,
      groupedTypes,
      seriesRows,
      recentRows,
      triggerLog,
      reengagementLog,
    ] = await Promise.all([
      Notification.count({ where }),
      Notification.count({ where: { ...where, is_read: true } }),
      Notification.count({ where: { ...where, is_read: false } }),
      Notification.count({
        where: { ...where, user_id: { [Op.ne]: null } },
        distinct: true,
        col: 'user_id',
      }),
      Notification.findAll({
        attributes: [
          [fn('COALESCE', col('type'), 'unknown'), 'type'],
          [fn('COUNT', col('id')), 'count'],
        ],
        where,
        group: [fn('COALESCE', col('type'), 'unknown')],
        order: [[fn('COUNT', col('id')), 'DESC']],
        raw: true,
      }),
      Notification.findAll({
        attributes: [
          [fn('DATE', col('created_at')), 'date'],
          [fn('COUNT', col('id')), 'count'],
        ],
        where,
        group: [fn('DATE', col('created_at'))],
        order: [[fn('DATE', col('created_at')), 'ASC']],
        raw: true,
      }),
      Notification.findAll({
        where,
        include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'email'], required: false }],
        order: [['created_at', 'DESC']],
        limit,
        offset,
      }),
      Promise.resolve(loadJsonFile(TRIGGER_LOG_FILE, [])),
      Promise.resolve(loadJsonFile(REENGAGEMENT_FILE, [])),
    ]);

    const campaignTriggerSends = triggerLog
      .filter((row) => row?.sentAt && new Date(row.sentAt) >= since)
      .reduce((sum, row) => sum + (Number(row.sentTo) || 0), 0);
    const campaignReengagementSends = reengagementLog
      .filter((row) => row?.sentAt && new Date(row.sentAt) >= since)
      .length;

    res.json({
      success: true,
      range_days: days,
      summary: {
        total_sent: totalSent,
        total_read: totalRead,
        total_unread: totalUnread,
        unique_users: Number(uniqueUsersResult) || 0,
        read_rate: totalSent > 0 ? Number(((totalRead / totalSent) * 100).toFixed(1)) : 0,
      },
      by_type: groupedTypes.map((row) => ({
        type: row.type || 'unknown',
        count: Number(row.count) || 0,
      })),
      daily_series: seriesRows.map((row) => ({
        date: row.date,
        count: Number(row.count) || 0,
      })),
      campaigns: {
        trigger_recipients: campaignTriggerSends,
        reengagement_recipients: campaignReengagementSends,
      },
      recent: {
        total: totalSent,
        limit,
        offset,
        rows: recentRows.map((row) => ({
          id: row.id,
          type: row.type || 'unknown',
          title: row.title,
          body: row.body,
          is_read: Boolean(row.is_read),
          read_at: row.read_at,
          sent_at: row.created_at,
          user: row.user ? {
            id: row.user.id,
            name: row.user.full_name,
            email: row.user.email,
          } : null,
        })),
      },
    });
  } catch (error) {
    console.error('Admin notification analytics error:', error);
    res.status(500).json({ success: false, error: 'Failed to load notification analytics.' });
  }
});

// College academic-state management removed: Learnda has no institutions.
// Class progression is per-learner and driven by the academic year (§6.4);
// corrections go through the audited override path in academicProgression.js (§6.5).

router.get('/reengagement/settings', (req, res) => {
  const defaults = {
    enabled: false,
    inactivityDays: 14,
    channels: { push: true, sms: false, email: true },
    messageTemplateId: 'gentle_comeback',
    messageTemplate: REENGAGEMENT_MESSAGE_TEMPLATES[0].message,
    ctaLabel: 'Open your personal learning space',
    ctaPath: '/pls',
  };
  const settings = loadJsonFile(REENGAGEMENT_SETTINGS_FILE, defaults);
  const resolved = resolveMessageTemplate(settings);
  res.json({
    success: true,
    settings: { ...settings, ...resolved },
    templates: REENGAGEMENT_MESSAGE_TEMPLATES,
  });
});

router.put('/reengagement/settings', (req, res) => {
  try {
    const {
      enabled,
      inactivityDays,
      channels,
      messageTemplate,
      messageTemplateId,
      ctaLabel,
      ctaPath,
    } = req.body;
    const settings = {
      enabled: !!enabled,
      inactivityDays: Number(inactivityDays) || 14,
      channels,
      messageTemplate,
      messageTemplateId: messageTemplateId || 'gentle_comeback',
      ctaLabel: ctaLabel || 'Open your personal learning space',
      ctaPath: ctaPath || '/pls',
    };
    saveJsonFile(REENGAGEMENT_SETTINGS_FILE, settings);
    const resolved = resolveMessageTemplate(settings);
    res.json({ success: true, settings: { ...settings, ...resolved }, templates: REENGAGEMENT_MESSAGE_TEMPLATES });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to save settings.' });
  }
});

// ── Re-engagement history ─────────────────────────────────────────────────────
router.get('/reengagement/history', (req, res) => {
  const log = loadJsonFile(REENGAGEMENT_FILE, []);
  const { limit = 50, offset = 0 } = req.query;
  const page = log.slice(Number(offset), Number(offset) + Number(limit));
  res.json({ success: true, log: page, total: log.length });
});

// ── Re-engagement: send now ───────────────────────────────────────────────────
router.post('/reengagement/send', authenticate, checkRole(['admin']), async (req, res) => {
  try {
    const settings = loadJsonFile(REENGAGEMENT_SETTINGS_FILE, {
      inactivityDays: 14,
      channels: { push: true, sms: false, email: true },
      messageTemplateId: 'gentle_comeback',
      messageTemplate: REENGAGEMENT_MESSAGE_TEMPLATES[0].message,
      ctaLabel: 'Open your personal learning space',
      ctaPath: '/pls',
    });

    const {
      targetMode = 'inactive',
      userIds = [],
      group = {},
      inactivityDays: bodyInactivityDays,
      channels: bodyChannels,
      messageTemplate: bodyMessageTemplate,
      messageTemplateId: bodyMessageTemplateId,
      ctaLabel: bodyCtaLabel,
      ctaPath: bodyCtaPath,
      skipCooldown = false,
    } = req.body || {};

    const inactivityDays = Number(bodyInactivityDays) || Number(settings.inactivityDays) || 14;
    const channels = { ...settings.channels, ...bodyChannels };
    const resolved = resolveMessageTemplate(settings, {
      messageTemplate: bodyMessageTemplate,
      messageTemplateId: bodyMessageTemplateId,
      ctaLabel: bodyCtaLabel,
      ctaPath: bodyCtaPath,
    });
    const { messageTemplate, ctaLabel, ctaPath } = resolved;
    const mode = String(targetMode || 'inactive').trim();

    if (!String(messageTemplate).trim()) {
      return res.status(400).json({ success: false, error: 'Message template is required.' });
    }

    const log = loadJsonFile(REENGAGEMENT_FILE, []);
    const applyCooldown = mode === 'inactive' && !skipCooldown;
    const sentIds = applyCooldown
      ? new Set(
        log
          .filter((entry) => new Date(entry.sentAt) > new Date(Date.now() - inactivityDays * 24 * 60 * 60 * 1000))
          .map((entry) => entry.userId)
      )
      : new Set();

    const { users, error, totalBeforeFilter } = await adminEngagementService.resolveEngagementRecipients({
      targetMode: mode,
      userIds,
      group,
      inactivityDays,
      sentIds,
    });

    if (error) {
      return res.status(400).json({ success: false, error });
    }

    const maxSend = mode === 'selected' ? 200 : 100;
    const toSend = users.slice(0, maxSend);
    const results = [];

    for (const user of toSend) {
      const { body, channelsUsed } = await adminEngagementService.deliverEngagementToUser(user, {
        notificationType: USER_NOTIFICATION_TYPE,
        notificationTitle: USER_NOTIFICATION_TITLE,
        messageTemplate,
        channels,
        ctaLabel,
        ctaPath,
        campaign: 'reengagement',
      });
      const entry = adminEngagementService.buildLogEntry(user, body, channelsUsed, 're', {});
      const reasonByMode = {
        selected: 'Manual: selected users',
        group: group?.type === 'role'
          ? `Group: ${group.role || 'users'}`
          : group?.type === 'class'
            ? `Group: ${group.classLevel || 'class'} learners`
            : group?.type === 'inactive'
              ? `Group: inactive ${inactivityDays}d`
              : 'Group send',
        inactive: `Inactive ${inactivityDays}d`,
      };
      entry.reason = reasonByMode[mode] || 'Re-engagement';
      entry.targetMode = mode;
      results.push(entry);
      log.unshift(entry);
    }

    saveJsonFile(REENGAGEMENT_FILE, log.slice(0, 2000));

    const skippedCooldown = applyCooldown && totalBeforeFilter != null
      ? Math.max(0, totalBeforeFilter - users.length)
      : 0;
    const skippedCap = Math.max(0, users.length - toSend.length);

    res.json({
      success: true,
      sent: results.length,
      skipped: skippedCooldown + skippedCap,
      skipped_cooldown: skippedCooldown,
      skipped_cap: skippedCap,
      target_mode: mode,
      matched: users.length,
      users: results,
    });
  } catch (error) {
    console.error('Re-engagement send error:', error);
    res.status(500).json({ success: false, error: 'Failed to send re-engagement messages.' });
  }
});

// ── Study & Learnda tips ────────────────────────────────────────────────────
router.get('/engagement-tips/catalog', authenticate, checkRole(['admin']), (req, res) => {
  res.json({
    success: true,
    studyTips: STUDY_TIPS,
    learndaTips: LEARNDA_TIPS,
  });
});

router.get('/engagement-tips/history', authenticate, checkRole(['admin']), (req, res) => {
  const log = loadJsonFile(TIPS_SEND_LOG_FILE, []);
  const { limit = 50, offset = 0, category } = req.query;
  let filtered = log;
  if (category) {
    filtered = filtered.filter((entry) => entry.tipCategory === category);
  }
  const page = filtered.slice(Number(offset), Number(offset) + Number(limit));
  res.json({ success: true, log: page, total: filtered.length });
});

router.post('/engagement-tips/send', authenticate, checkRole(['admin']), async (req, res) => {
  try {
    const {
      category = 'study',
      tipId,
      message: bodyMessage,
      ctaLabel: bodyCtaLabel,
      ctaPath: bodyCtaPath,
      targetMode = 'selected',
      userIds = [],
      group = {},
      inactivityDays: bodyInactivityDays = 14,
      channels = { push: true, email: true, sms: false },
    } = req.body || {};

    const resolved = resolveEngagementTip(category, tipId, {
      message: bodyMessage,
      ctaLabel: bodyCtaLabel,
      ctaPath: bodyCtaPath,
    });

    const mode = String(targetMode || 'selected').trim();
    const inactivityDays = Number(bodyInactivityDays) || 14;

    const { users, error } = await adminEngagementService.resolveEngagementRecipients({
      targetMode: mode,
      userIds,
      group,
      inactivityDays,
      sentIds: new Set(),
    });

    if (error) {
      return res.status(400).json({ success: false, error });
    }

    const maxSend = mode === 'selected' ? 200 : 100;
    const toSend = users.slice(0, maxSend);
    const log = loadJsonFile(TIPS_SEND_LOG_FILE, []);
    const results = [];

    for (const user of toSend) {
      const { body, channelsUsed } = await adminEngagementService.deliverEngagementToUser(user, {
        notificationType: resolved.notificationType,
        notificationTitle: resolved.notificationTitle,
        messageTemplate: resolved.message,
        channels,
        ctaLabel: resolved.ctaLabel,
        ctaPath: resolved.ctaPath,
        campaign: resolved.notificationType,
      });

      const entry = adminEngagementService.buildLogEntry(user, body, channelsUsed, 'tip', {
        tipCategory: resolved.category,
        tipId: resolved.tipId,
        tipLabel: resolved.tipMeta?.label,
        reason: `${resolved.category === 'learnda' ? 'Learnda tip' : 'Study tip'}: ${resolved.tipMeta?.label || resolved.tipId}`,
        targetMode: mode,
      });
      results.push(entry);
      log.unshift(entry);
    }

    saveJsonFile(TIPS_SEND_LOG_FILE, log.slice(0, 2000));

    res.json({
      success: true,
      sent: results.length,
      matched: users.length,
      skipped_cap: Math.max(0, users.length - toSend.length),
      category: resolved.category,
      tipId: resolved.tipId,
      users: results,
    });
  } catch (error) {
    console.error('Engagement tips send error:', error);
    res.status(500).json({ success: false, error: 'Failed to send tips.' });
  }
});

router.patch('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    const VALID_ROLES = ['student', 'lecturer', 'admin'];
    if (!role || !VALID_ROLES.includes(role)) {
      return res.status(400).json({ success: false, error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
    }

    const target = await User.findByPk(req.params.id, {
      attributes: ['id', 'role', 'email', 'is_superadmin']
    });
    if (!target) return res.status(404).json({ success: false, error: 'User not found' });

    const touchesAdminAccess = role === 'admin' || target.role === 'admin';
    if (touchesAdminAccess && !isSuperAdmin(req.user)) {
      return res.status(403).json({ success: false, error: 'Only a superadmin can grant or remove admin access.' });
    }

    // Prevent removing your own admin role
    if (String(req.params.id) === String(req.user.id) && role !== 'admin') {
      return res.status(400).json({ success: false, error: 'You cannot remove your own admin role.' });
    }

    const patch = { role };
    // Admins are always contributors
    if (role === 'admin') {
      patch.is_contributor = true;
      patch.is_superadmin = false;
      patch.admin_permissions = [];
      patch.admin_title = 'Administrator';
    } else {
      patch.is_superadmin = false;
      patch.admin_permissions = null;
      patch.admin_title = null;
    }

    await target.update(patch);

    res.json({ success: true });
  } catch (error) {
    console.error('Admin set-role error:', error);
    res.status(500).json({ success: false, error: 'Failed to update role' });
  }
});

// ── Lecturer invite management ────────────────────────────────────────────────

function loadInvites() {
  try {
    if (!fs.existsSync(LECTURER_INVITES_FILE)) return [];
    return JSON.parse(fs.readFileSync(LECTURER_INVITES_FILE, 'utf8'));
  } catch { return []; }
}
function saveInvites(invites) {
  const dir = path.dirname(LECTURER_INVITES_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(LECTURER_INVITES_FILE, JSON.stringify(invites, null, 2));
}

router.get('/lecturer-invites', (req, res) => {
  const siteUrl = process.env.APP_PUBLIC_URL || 'https://beta.learnda.app';
  const invites = loadInvites().map(({ token, ...rest }) => ({
    ...rest,
    link: rest.status === 'pending' ? `${siteUrl}/lecturer-invite/${token}` : null,
  }));
  res.json({ success: true, invites });
});

router.post('/lecturer-invites', async (req, res) => {
  try {
    const { contact } = req.body; // email or phone
    if (!contact || !contact.trim()) {
      return res.status(400).json({ success: false, error: 'Email or phone required' });
    }
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.trim());
    const token = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const invite = {
      id: crypto.randomUUID(),
      contact: contact.trim(),
      contact_type: isEmail ? 'email' : 'phone',
      token,
      status: 'pending',
      invited_by: req.user.id,
      invited_by_name: req.user.full_name || req.user.email,
      invited_at: now.toISOString(),
      expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      completed_at: null,
      completed_by_user_id: null,
    };

    const invites = loadInvites();
    // Revoke any prior pending invite for the same contact
    invites.forEach((inv) => {
      if (inv.contact === invite.contact && inv.status === 'pending') inv.status = 'revoked';
    });
    invites.push(invite);
    saveInvites(invites);

    const siteUrl = process.env.APP_PUBLIC_URL || 'https://beta.learnda.app';
    const link = `${siteUrl}/lecturer-invite/${token}`;

    if (isEmail) {
      await sendEmail({
        to: contact.trim(),
        subject: 'You\'ve been invited to join Learnda as a Lecturer',
        html: `
          <p>Hello,</p>
          <p>You've been invited by the Learnda admin team to register as a lecturer on our platform.</p>
          <p>Please click the link below to complete your registration. The link expires in <strong>7 days</strong>.</p>
          <p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#1f56db;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">Complete Lecturer Registration</a></p>
          <p>Or copy this link: <br/><a href="${link}">${link}</a></p>
          <p>If you weren't expecting this invitation, you can safely ignore this email.</p>
          <p>— The Learnda Team</p>
        `,
      }).catch((e) => console.error('Lecturer invite email error:', e));
    } else {
      await sendSms(contact.trim(),
        `You've been invited to join Learnda as a Lecturer. Complete your registration here: ${link} (expires in 7 days)`
      ).catch((e) => console.error('Lecturer invite SMS error:', e));
    }

    res.json({ success: true, invite: { ...invite, token: undefined } });
  } catch (error) {
    console.error('Create lecturer invite error:', error);
    res.status(500).json({ success: false, error: 'Failed to create invite' });
  }
});

router.delete('/lecturer-invites/:id', (req, res) => {
  const invites = loadInvites();
  const idx = invites.findIndex((i) => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Invite not found' });
  invites[idx].status = 'revoked';
  saveInvites(invites);
  res.json({ success: true });
});

router.get('/messages', async (req, res) => {
  try {
    const {
      limit = 50,
      offset = 0,
      category,
      type,
      status,
      search,
    } = req.query;
    const where = {};
    const requestedCategory = category || type;
    if (requestedCategory && requestedCategory !== 'all') {
      where.category = { [Op.iLike]: requestedCategory };
    }
    if (status && status !== 'all') {
      where.status = status;
    }
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { subject: { [Op.iLike]: `%${search}%` } },
        { message: { [Op.iLike]: `%${search}%` } },
      ];
    }
    const messages = SupportReport
      ? await SupportReport.findAndCountAll({
          where,
          include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'email'], required: false }],
          order: [['created_at', 'DESC']],
          limit: Number(limit),
          offset: Number(offset),
        }).catch(() => [])
      : { rows: [], count: 0 };

    res.json({ success: true, messages: messages.rows || [], total: messages.count || 0 });
  } catch (error) {
    console.error('Admin messages error:', error);
    res.status(500).json({ success: false, error: 'Failed to load messages' });
  }
});

router.patch('/messages/:id', async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!['new', 'in_progress', 'resolved'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid message status.' });
    }

    const message = await SupportReport.findByPk(req.params.id);
    if (!message) {
      return res.status(404).json({ success: false, error: 'Message not found.' });
    }

    await message.update({ status });
    res.json({ success: true, message });
  } catch (error) {
    console.error('Admin message status error:', error);
    res.status(500).json({ success: false, error: 'Failed to update message status.' });
  }
});

router.post('/messages/:id/reply', async (req, res) => {
  try {
    const { body, markResolved = true } = req.body || {};
    if (!body || !String(body).trim()) {
      return res.status(400).json({ success: false, error: 'Reply body is required.' });
    }

    const message = await SupportReport.findByPk(req.params.id);
    if (!message) {
      return res.status(404).json({ success: false, error: 'Message not found.' });
    }
    if (String(message.email || '').toLowerCase().endsWith('@guest.learnda.local')) {
      return res.status(400).json({ success: false, error: 'This message does not include a reply email.' });
    }

    await sendEmail({
      to: message.email,
      subject: `Re: ${message.subject}`,
      text: String(body).trim(),
    });

    await message.update({
      admin_reply: String(body).trim(),
      replied_at: new Date(),
      replied_by: req.user.id,
      status: markResolved ? 'resolved' : 'in_progress',
    });

    res.json({ success: true, message });
  } catch (error) {
    console.error('Admin message reply error:', error);
    res.status(500).json({ success: false, error: 'Failed to send reply.' });
  }
});

router.get('/plans', async (_req, res) => {
  try {
    const plans = await Plan.findAll({
      order: [['price', 'ASC'], ['name', 'ASC']],
      attributes: ['id', 'name', 'description', 'price', 'billing_cycle', 'is_active', 'version'],
    });
    res.json({ success: true, plans });
  } catch (error) {
    console.error('Admin plans error:', error);
    res.status(500).json({ success: false, error: 'Failed to load plans.' });
  }
});

router.patch('/plans/:id', async (req, res) => {
  try {
    const { price, description, is_active } = req.body || {};
    const plan = await Plan.findByPk(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found.' });
    }

    const patch = {};
    if (price !== undefined) {
      const parsedPrice = Number(price);
      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({ success: false, error: 'Plan price must be a non-negative number.' });
      }
      patch.price = parsedPrice;
    }
    if (description !== undefined) patch.description = description;
    if (is_active !== undefined) patch.is_active = Boolean(is_active);
    if (!Object.keys(patch).length) {
      return res.status(400).json({ success: false, error: 'No plan fields supplied.' });
    }
    patch.version = Number(plan.version || 1) + 1;

    await plan.update(patch);
    res.json({ success: true, plan });
  } catch (error) {
    console.error('Admin plan update error:', error);
    res.status(500).json({ success: false, error: 'Failed to update plan.' });
  }
});

// ── Team links (WhatsApp group links per application type) ────────────────────

router.get('/team-links', authenticate, checkRole(['admin']), (req, res) => {
  const links = loadJsonFile(TEAM_LINKS_FILE, DEFAULT_TEAM_LINKS);
  res.json({ success: true, links: { ...DEFAULT_TEAM_LINKS, ...links } });
});

router.put('/team-links', authenticate, checkRole(['admin']), (req, res) => {
  try {
    const { links } = req.body;
    if (!links || typeof links !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid links payload.' });
    }
    const current = loadJsonFile(TEAM_LINKS_FILE, DEFAULT_TEAM_LINKS);
    const merged  = { ...DEFAULT_TEAM_LINKS, ...current };
    for (const type of Object.keys(DEFAULT_TEAM_LINKS)) {
      if (links[type]?.whatsapp !== undefined) {
        merged[type] = { ...merged[type], whatsapp: links[type].whatsapp };
      }
    }
    saveJsonFile(TEAM_LINKS_FILE, merged);
    res.json({ success: true, links: merged });
  } catch (error) {
    console.error('Save team links error:', error);
    res.status(500).json({ success: false, error: 'Failed to save team links.' });
  }
});

// ── Team broadcast (email/push to all approved applicants of a given type) ───

router.post('/team-broadcast', authenticate, checkRole(['admin']), async (req, res) => {
  try {
    const { type, subject, message } = req.body;
    if (!type || !message?.trim()) {
      return res.status(400).json({ success: false, error: 'type and message are required.' });
    }

    const apps = loadJsonFile(APPLICATIONS_FILE, []);
    const targets = apps.filter((a) => a.status === 'approved' && a.email &&
      (type === 'all' || a.type === type));

    // De-duplicate by email
    const seen = new Set();
    const unique = targets.filter((a) => {
      if (seen.has(a.email)) return false;
      seen.add(a.email);
      return true;
    });

    const resolvedSubject = subject?.trim() || `Message from the Learnda team`;

    let sent = 0;
    for (const app of unique) {
      try {
        const firstName = (app.name || '').split(' ')[0] || 'there';
        const personalised = message.replace(/\{name\}/g, firstName);
        await require('../services/emailService').sendEmail({
          to: app.email,
          subject: resolvedSubject,
          text: personalised,
          html: `
<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 16px;">
  <p style="font-size:15px;line-height:1.7;color:#374151;white-space:pre-wrap;">${personalised}</p>
  <hr style="margin:24px 0;border:none;border-top:1px solid #f0f0f0;" />
  <p style="font-size:12px;color:#9ca3af;">— The Learnda Team &nbsp;·&nbsp;
    <a href="https://beta.learnda.app" style="color:#1f56db;text-decoration:none;">learnda.app</a>
  </p>
</div>`,
        });
        sent++;
      } catch { /* skip individual failures */ }
    }

    res.json({ success: true, sent, total: unique.length });
  } catch (error) {
    console.error('Team broadcast error:', error);
    res.status(500).json({ success: false, error: 'Failed to send broadcast.' });
  }
});

// ── Social links ──────────────────────────────────────────────────────────────

router.get('/social-links', (req, res) => {
  const links = loadJsonFile(SOCIAL_LINKS_FILE, DEFAULT_SOCIAL_LINKS);
  res.json({ success: true, links });
});

router.put('/social-links', (req, res) => {
  try {
    const { links } = req.body;
    if (!Array.isArray(links)) return res.status(400).json({ success: false, error: 'links must be an array' });
    saveJsonFile(SOCIAL_LINKS_FILE, links);
    res.json({ success: true, links });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to save social links.' });
  }
});

// ── Roadmap ────────────────────────────────────────────────────────────────────

router.get('/roadmap', (req, res) => {
  const phases = loadJsonFile(ROADMAP_FILE, DEFAULT_ROADMAP);
  res.json({ success: true, phases });
});

router.put('/roadmap', (req, res) => {
  try {
    const { phases } = req.body;
    if (!Array.isArray(phases)) return res.status(400).json({ success: false, error: 'phases must be an array' });
    saveJsonFile(ROADMAP_FILE, phases);
    res.json({ success: true, phases });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to save roadmap.' });
  }
});

// ── Services ───────────────────────────────────────────────────────────────────

router.get('/services', (req, res) => {
  const services = loadJsonFile(SERVICES_FILE, DEFAULT_SERVICES);
  res.json({ success: true, services });
});

router.put('/services', (req, res) => {
  try {
    const { services } = req.body;
    if (!Array.isArray(services)) return res.status(400).json({ success: false, error: 'services must be an array' });
    saveJsonFile(SERVICES_FILE, services);
    res.json({ success: true, services });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to save services.' });
  }
});

module.exports = router;

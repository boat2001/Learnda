const ADMIN_SECTIONS = Object.freeze([
  { id: 'overview', label: 'Overview', group: 'ANALYTICS' },
  { id: 'visits', label: 'Visits', group: 'ANALYTICS' },
  { id: 'users', label: 'Users', group: 'ANALYTICS' },
  { id: 'usage', label: 'Usage Statistics', group: 'ANALYTICS' },
  { id: 'contributions', label: 'Contributions', group: 'PLATFORM' },
  { id: 'contributor-ops', label: 'Contributor Ops', group: 'OPERATIONS' },
  { id: 'content', label: 'Content', group: 'PLATFORM' },
  { id: 'publishing', label: 'Team & Updates', group: 'PLATFORM' },
  { id: 'rankings', label: 'College Rankings', group: 'PLATFORM' },
  { id: 'pages', label: 'Pages & Features', group: 'PLATFORM' },
  { id: 'notifications', label: 'Notifications', group: 'OPERATIONS' },
  { id: 'messages', label: 'Messages', group: 'OPERATIONS' },
  { id: 'applications', label: 'Applications', group: 'OPERATIONS' },
  { id: 'ambassadors', label: 'Ambassadors', group: 'OPERATIONS' },
  { id: 'lecturers', label: 'Lecturers', group: 'OPERATIONS' },
  { id: 'revenue', label: 'Revenue', group: 'FINANCE' },
  { id: 'plans', label: 'Plan Pricing', group: 'FINANCE' },
  { id: 'roadmap', label: 'Roadmap', group: 'PLATFORM' },
  { id: 'services', label: 'Services', group: 'PLATFORM' },
  { id: 'social', label: 'Social Media', group: 'PLATFORM' },
]);

const ADMIN_SECTION_IDS = new Set(ADMIN_SECTIONS.map((section) => section.id));
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const normalizeAdminPermissions = (value) => {
  const raw = Array.isArray(value) ? value : [];
  return [...new Set(raw.map((item) => String(item || '').trim()).filter((item) => ADMIN_SECTION_IDS.has(item)))];
};

const isSuperAdmin = (user) => {
  if (!user || user.role !== 'admin') return false;
  if (user.is_superadmin) return true;
  return user.admin_permissions == null;
};

const getAdminPermissions = (user) => {
  if (!user || user.role !== 'admin') return [];
  if (isSuperAdmin(user)) return ADMIN_SECTIONS.map((section) => section.id);
  return normalizeAdminPermissions(user.admin_permissions);
};

const canAccessAdminSection = (user, section) => {
  if (!section) return true;
  if (isSuperAdmin(user)) return true;
  return getAdminPermissions(user).includes(section);
};

const normalizeAdminPath = (req) => {
  const original = req.originalUrl || req.url || '';
  const withoutQuery = original.split('?')[0];
  return withoutQuery
    .replace(/^\/api\/admin\b/, '')
    .replace(/^\/admin\b/, '')
    .replace(/^\/api\/site-content\/admin\b/, '/site-content/admin')
    .replace(/^\/site-content\/admin\b/, '/site-content/admin')
    .replace(/^\/api\/applications\/admin\b/, '/applications/admin')
    .replace(/^\/applications\/admin\b/, '/applications/admin')
    || '/';
};

const resolveAdminSectionFromPath = (req, forcedSection = null) => {
  if (forcedSection) return forcedSection;
  const path = normalizeAdminPath(req);
  if (path.startsWith('/site-content/admin')) return 'publishing';
  if (path.startsWith('/applications/admin')) return 'applications';
  if (path.startsWith('/stats') || path.startsWith('/activity')) return 'overview';
  if (path.startsWith('/analytics/visits')) return 'visits';
  if (path.startsWith('/analytics/usage')) return 'usage';
  if (path.startsWith('/analytics/users')) return 'users';
  if (path.startsWith('/analytics/mrr')) return 'revenue';
  if (path.startsWith('/analytics')) return 'overview';
  if (path.startsWith('/users')) return 'users';
  if (path.startsWith('/content')) return 'content';
  if (path.startsWith('/contributor-applications')) return 'contributions';
  if (path.startsWith('/reward-payouts')) return 'revenue';
  if (path.startsWith('/revenue') || path.startsWith('/expenses')) return 'revenue';
  if (path.startsWith('/plans')) return 'plans';
  if (path.startsWith('/notifications') || path.startsWith('/academic-state') || path.startsWith('/reengagement')) return 'notifications';
  if (path.startsWith('/messages')) return 'messages';
  if (path.startsWith('/lecturer-invites')) return 'lecturers';
  if (path.startsWith('/team-links') || path.startsWith('/team-broadcast')) return 'contributor-ops';
  if (path.startsWith('/social-links')) return 'social';
  if (path.startsWith('/roadmap')) return 'roadmap';
  if (path.startsWith('/services')) return 'services';
  return 'overview';
};

const createAuditLog = async (req, details = {}) => {
  try {
    const { AdminAuditLog } = require('../models');
    if (!AdminAuditLog) return null;
    const user = req.user;
    return await AdminAuditLog.create({
      admin_user_id: user?.id || null,
      admin_name: user?.full_name || user?.name || null,
      admin_email: user?.email || null,
      action: details.action || `${(req.method || 'GET').toLowerCase()}_admin_request`,
      section: details.section || resolveAdminSectionFromPath(req),
      method: details.method || req.method,
      path: details.path || normalizeAdminPath(req),
      status_code: details.status_code || null,
      target_type: details.target_type || null,
      target_id: details.target_id || null,
      ip_address: req.ip || req.headers?.['x-forwarded-for'] || null,
      user_agent: req.headers?.['user-agent'] || null,
      metadata: details.metadata || {}
    });
  } catch {
    return null;
  }
};

const requireSuperAdmin = (req, res, next) => {
  if (!isSuperAdmin(req.user)) {
    return res.status(403).json({ success: false, error: 'Superadmin access required' });
  }
  next();
};

const requireAdminPermission = (section = null) => (req, res, next) => {
  const resolvedSection = resolveAdminSectionFromPath(req, section);
  req.adminSection = resolvedSection;
  if (!canAccessAdminSection(req.user, resolvedSection)) {
    return res.status(403).json({
      success: false,
      error: 'You do not have access to this admin section',
      section: resolvedSection
    });
  }
  next();
};

const auditAdminAction = (action = null, section = null) => (req, res, next) => {
  if (!MUTATING_METHODS.has(req.method)) return next();
  const startedAt = Date.now();
  res.on('finish', () => {
    createAuditLog(req, {
      action: action || `${req.method.toLowerCase()}_${resolveAdminSectionFromPath(req, section)}`,
      section: resolveAdminSectionFromPath(req, section),
      status_code: res.statusCode,
      target_id: req.params?.id || req.params?.userId || null,
      metadata: {
        duration_ms: Date.now() - startedAt,
        query: req.query || {},
      }
    });
  });
  next();
};

module.exports = {
  ADMIN_SECTIONS,
  ADMIN_SECTION_IDS,
  normalizeAdminPermissions,
  isSuperAdmin,
  getAdminPermissions,
  canAccessAdminSection,
  resolveAdminSectionFromPath,
  requireSuperAdmin,
  requireAdminPermission,
  auditAdminAction,
  createAuditLog,
};

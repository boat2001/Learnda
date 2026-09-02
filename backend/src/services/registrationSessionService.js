const { RegistrationSession, RegistrationSecurityEvent } = require('../models');
const { normalizeEmailAddress, normalizePhoneNumber } = require('../utils/contact');

const PLACEHOLDER_PHONE_EMAIL_PATTERN = /^phone\.(\d+)@auth\.sharether\.(?:local|app)$/i;

const pickHeader = (headers, key) => {
  const raw = headers?.[key];
  return Array.isArray(raw) ? raw[0] : raw;
};

const parseUserAgent = (userAgent) => {
  const ua = String(userAgent || '');
  const browserChecks = [
    ['Edge', /Edg\/([\d.]+)/],
    ['Chrome', /Chrome\/([\d.]+)/],
    ['Firefox', /Firefox\/([\d.]+)/],
    ['Safari', /Version\/([\d.]+).*Safari/],
  ];
  const osChecks = [
    ['Windows', /Windows NT ([\d.]+)/],
    ['Android', /Android ([\d.]+)/],
    ['iOS', /OS ([\d_]+) like Mac OS X/],
    ['macOS', /Mac OS X ([\d_]+)/],
    ['Linux', /Linux/],
  ];

  let browserName = null;
  let browserVersion = null;
  for (const [name, pattern] of browserChecks) {
    const match = ua.match(pattern);
    if (match) {
      browserName = name;
      browserVersion = String(match[1] || '').replace(/_/g, '.');
      break;
    }
  }

  let osName = null;
  let osVersion = null;
  for (const [name, pattern] of osChecks) {
    const match = ua.match(pattern);
    if (match) {
      osName = name;
      osVersion = String(match[1] || '').replace(/_/g, '.');
      break;
    }
  }

  const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua);

  return {
    browser_name: browserName,
    browser_version: browserVersion,
    os_name: osName,
    os_version: osVersion,
    device_type: isMobile ? 'mobile' : 'desktop',
    is_mobile: isMobile
  };
};

const registrationStageFromOnboardingStep = (step) => {
  switch (String(step || '').toUpperCase()) {
    case 'PLAN':
      return 'PLAN';
    case 'PAYMENT':
      return 'PAYMENT';
    case 'DONE':
      return 'DONE';
    case 'PROFILE':
    case 'PASSWORD':
    default:
      return 'ACADEMIC';
  }
};

const getRequestSecurityContext = (req) => {
  const clientContext = req?.body?.client_context && typeof req.body.client_context === 'object'
    ? req.body.client_context
    : {};
  const forwardedFor = String(pickHeader(req?.headers, 'x-forwarded-for') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)[0];
  const ipAddress = forwardedFor || req?.ip || null;
  const userAgent = pickHeader(req?.headers, 'user-agent') || '';
  const acceptLanguage = pickHeader(req?.headers, 'accept-language') || '';
  const parsedUserAgent = parseUserAgent(userAgent);

  return {
    ip_address: ipAddress,
    user_agent: userAgent || null,
    browser_name: clientContext.browser_name || parsedUserAgent.browser_name,
    browser_version: clientContext.browser_version || parsedUserAgent.browser_version,
    os_name: clientContext.os_name || parsedUserAgent.os_name,
    os_version: clientContext.os_version || parsedUserAgent.os_version,
    device_type: clientContext.device_type || parsedUserAgent.device_type,
    country_code: clientContext.country_code || null,
    region: clientContext.region || null,
    city: clientContext.city || null,
    timezone: clientContext.timezone || null,
    language: clientContext.language || acceptLanguage || null,
    referrer: pickHeader(req?.headers, 'referer') || clientContext.referrer || null,
    metadata: {
      screen_width: clientContext.screen_width || null,
      screen_height: clientContext.screen_height || null,
      device_model: clientContext.device_model || null,
      device_vendor: clientContext.device_vendor || null,
      platform: clientContext.platform || null
    }
  };
};

const resolveRegistrationIdentityFromUser = (user) => {
  const phoneNumber = normalizePhoneNumber(user?.phone_number || '');
  if (phoneNumber) {
    return {
      channel: 'phone',
      contact: phoneNumber,
      normalized_contact: phoneNumber
    };
  }

  const email = normalizeEmailAddress(user?.email || '');
  if (!email) return null;

  const placeholderPhoneMatch = email.match(PLACEHOLDER_PHONE_EMAIL_PATTERN);
  if (placeholderPhoneMatch?.[1]) {
    return {
      channel: 'phone',
      contact: placeholderPhoneMatch[1],
      normalized_contact: placeholderPhoneMatch[1]
    };
  }

  return {
    channel: 'email',
    contact: email,
    normalized_contact: email
  };
};

const findRegistrationSessionForUser = async (user) => {
  const identity = resolveRegistrationIdentityFromUser(user);
  if (!identity?.channel || !identity?.normalized_contact) return null;

  return RegistrationSession.findOne({
    where: {
      contact_type: identity.channel,
      normalized_contact: identity.normalized_contact
    },
    order: [['created_at', 'DESC']]
  });
};

const mergeMetadata = (currentMetadata, nextMetadata) => ({
  ...(currentMetadata && typeof currentMetadata === 'object' ? currentMetadata : {}),
  ...(nextMetadata && typeof nextMetadata === 'object' ? nextMetadata : {})
});

const updateRegistrationSessionForUser = async (user, updates = {}) => {
  const session = await findRegistrationSessionForUser(user);
  if (!session) return null;

  const patch = {};
  const fields = [
    'contact_value',
    'otp_verified',
    'password_hash',
    'full_name',
    'institution_id',
    'affiliate_university',
    'programme_category',
    'program_id',
    'level',
    'semester',
    'index_number',
    'selected_plan_id',
    'duration_months',
    'stage',
    'expires_at'
  ];

  fields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(updates, field) && updates[field] !== undefined) {
      patch[field] = updates[field];
    }
  });

  if (updates.metadata && typeof updates.metadata === 'object') {
    patch.metadata = mergeMetadata(session.metadata, updates.metadata);
  }

  if (Object.keys(patch).length) {
    await session.update(patch);
  }

  return session;
};

const recordRegistrationSecurityEvent = async (sessionOrUser, eventType, req, metadata = {}) => {
  const session = sessionOrUser?.id && sessionOrUser?.contact_type
    ? sessionOrUser
    : await findRegistrationSessionForUser(sessionOrUser);

  if (!session?.id) return null;

  const requestContext = getRequestSecurityContext(req);
  return RegistrationSecurityEvent.create({
    registration_session_id: session.id,
    event_type: eventType,
    ...requestContext,
    metadata: {
      ...(requestContext.metadata || {}),
      ...metadata
    }
  });
};

module.exports = {
  getRequestSecurityContext,
  registrationStageFromOnboardingStep,
  resolveRegistrationIdentityFromUser,
  findRegistrationSessionForUser,
  updateRegistrationSessionForUser,
  recordRegistrationSecurityEvent
};

// controllers/authController.js
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const { Op } = require('sequelize');
const {
  User,
  Subscription,
  Plan,
  UserProgress,
  AcademicProfile,
  Program,
  RegistrationOtp,
  RegistrationSession,
  RegistrationSecurityEvent,
  AuthSession,
  UserContact,
  Institution
} = require('../models');
const rewardService = require('../services/rewardService');
const {
  normalizeLevel,
  normalizeSemester,
  maybeAdvanceAcademicProgress
} = require('../utils/academicProgression');
const {
  isEmailAddress,
  normalizeEmailAddress,
  normalizePhoneNumber,
} = require('../utils/contact');
const {
  buildOnboardingState,
  persistOnboardingState,
  serializeAuthUser,
  ONBOARDING_STEPS,
  PLAN_STATUSES
} = require('../utils/onboarding');
const {
  getBillingIntent,
  isBillingIntentExpired,
  setBillingIntentOnPreferences
} = require('../utils/billingIntent');
const { 
  validateLoginData,
  validateProfileUpdateData 
} = require('../middleware/validation');
const analyticsService = require('../services/analyticsService');
const emailService = require('../services/emailService');
const smsService = require('../services/smsService');
const paymentService = require('../services/paymentService');
const subscriptionService = require('../services/subscriptionService');
const notificationService = require('../services/notificationService');
const config = require('../config/env');
const { buildPaystackCallbackUrl } = require('../utils/callbackUrl');
const { getAcademicCatalog } = require('../services/academicCatalogService');
const { getFileUrl } = require('../config/upload');
const {
  normalizeProgramCategory,
  validateStudentIndexNumber,
  getProgramCategoryCode
} = require('../utils/studentIdentity');

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const googleClient = googleClientId ? new OAuth2Client(googleClientId) : null;
const googleOauthClient = (googleClientId && googleClientSecret)
  ? new OAuth2Client(googleClientId, googleClientSecret)
  : null;

const getCorsOriginAllowlist = () =>
  String(config.corsOrigin || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

const redirectUriOriginAllowed = (redirectUri, allowedOrigins) => {
  const trimmed = String(redirectUri || '').trim();
  if (!trimmed) return false;
  if (allowedOrigins.includes(trimmed)) return true;
  try {
    const origin = new URL(trimmed).origin;
    return allowedOrigins.includes(origin);
  } catch {
    return false;
  }
};

const createSignupWelcomeNotification = async (user) => {
  try {
    await notificationService.createWelcomeNotification(user);
  } catch (notificationError) {
    console.error('Welcome notification error:', notificationError);
  }
};

/**
 * GIS auth-code exchange: redirect_uri must match Google Cloud "Authorized redirect URIs"
 * (often `https://your-site/auth/google/callback`). We allow the exact string or any URL
 * whose origin appears in CORS_ORIGIN.
 */
const resolveGoogleAuthCodeRedirectUri = (req) => {
  const allowed = getCorsOriginAllowlist();
  const fromBody = String(req.body?.redirectUri || '').trim();
  if (fromBody && redirectUriOriginAllowed(fromBody, allowed)) {
    return fromBody;
  }
  const fromEnv = String(process.env.GOOGLE_REDIRECT_URI || '').trim();
  if (fromEnv && fromEnv !== 'postmessage' && redirectUriOriginAllowed(fromEnv, allowed)) {
    return fromEnv;
  }
  if (fromBody === 'postmessage' || process.env.GOOGLE_REDIRECT_URI === 'postmessage') {
    return 'postmessage';
  }
  return null;
};
const EMAIL_LOGIN_OTP_EXPIRY_MINUTES = 10;
const EMAIL_LOGIN_OTP_MAX_ATTEMPTS = 5;
const EMAIL_REGISTER_OTP_EXPIRY_MINUTES = 20;
const EMAIL_REGISTER_OTP_MAX_ATTEMPTS = 5;
const REGISTRATION_RESEND_COOLDOWN_SECONDS = 30;
const PASSWORD_RESET_OTP_EXPIRY_MINUTES = 10;
const PASSWORD_RESET_OTP_MAX_ATTEMPTS = 5;
const REGISTRATION_SESSION_RESUME_TTL_DAYS = 30;
const TRUSTED_DEVICE_TOKEN_TYPE = 'trusted_device';
const TRUSTED_DEVICE_TOKEN_VERSION = 1;
const PHONE_REGEX = /^(?:\+?[1-9]\d{7,14}|0\d{9})$/;
const isUuidLike = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
const buildProgramKey = (programName, programCategory) => (
  `${String(programCategory || '').trim()}-${String(programName || '').trim()}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
);

const syncUserAcademicColumnsFromProfile = async (user) => {
  if (!user?.id) return user;

  const academicProfileRecord = await AcademicProfile.findOne({
    where: { user_id: user.id },
    include: [
      {
        model: Program,
        as: 'program_record',
        required: false
      }
    ]
  });

  if (!academicProfileRecord) return user;

  const academicProfile = academicProfileRecord.get({ plain: true });
  const metadata = academicProfile?.metadata && typeof academicProfile.metadata === 'object'
    ? academicProfile.metadata
    : {};
  const desiredProgrammeCategory = academicProfile.programme_category || null;
  const desiredProgramId = academicProfile.program_id || null;
  const desiredProgramName =
    academicProfile.program_record?.name ||
    metadata.program_name ||
    null;

  const patch = {};
  if (desiredProgrammeCategory && String(user.programme_category || '') !== String(desiredProgrammeCategory)) {
    patch.programme_category = desiredProgrammeCategory;
  }
  if (desiredProgramId && String(user.program_id || '') !== String(desiredProgramId)) {
    patch.program_id = desiredProgramId;
  }
  if (desiredProgramName && String(user.program || '') !== String(desiredProgramName)) {
    patch.program = desiredProgramName;
  }

  if (!Object.keys(patch).length) return user;

  await user.update(patch);
  Object.assign(user, patch);
  return user;
};
const buildPhonePlaceholderEmail = (phoneNumber) => `phone.${String(phoneNumber || '').replace(/\D/g, '')}@auth.sharether.app`;
const getRegistrationChallengeKey = ({ channel, contact }) => (
  channel === 'phone'
    ? buildPhonePlaceholderEmail(contact)
    : normalizeEmailAddress(contact)
);
const normalizeRegistrationContact = ({ channel, contact }) => (
  channel === 'phone'
    ? normalizePhoneNumber(contact)
    : normalizeEmailAddress(contact)
);
const maskContact = ({ channel, contact }) => {
  const raw = String(contact || '').trim();
  if (!raw) return '';

  if (channel === 'email') {
    const [localPart, domain = ''] = raw.split('@');
    if (!localPart) return raw;
    const visibleLocal = localPart.length <= 2
      ? `${localPart[0] || ''}*`
      : `${localPart.slice(0, 2)}${'*'.repeat(Math.max(localPart.length - 2, 1))}`;
    return `${visibleLocal}@${domain}`;
  }

  const digits = raw.replace(/\D/g, '');
  if (digits.length <= 4) return raw;
  return `${digits.slice(0, 3)}${'*'.repeat(Math.max(digits.length - 5, 1))}${digits.slice(-2)}`;
};

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeTokenList = (value) => (
  Array.isArray(value) ? value.filter(Boolean) : []
);

const hashValue = (value) => crypto
  .createHash('sha256')
  .update(String(value || ''))
  .digest('hex');

const parseMajorVersion = (value) => {
  const match = String(value || '').match(/\d+/);
  return match ? match[0] : null;
};

const getPrivateIpPrefix = (ipAddress) => {
  const value = String(ipAddress || '').trim();
  if (!value) return null;
  if (value.includes(':')) {
    const normalized = value.toLowerCase();
    return normalized.startsWith('::1') ? 'loopback' : normalized.split(':').slice(0, 4).join(':');
  }
  return value.split('.').slice(0, 3).join('.');
};

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

class AuthController {
  constructor() {
    this.registerVisitor = this.registerVisitor.bind(this);
    this.register = this.register.bind(this);
    this.resendRegisterOtp = this.resendRegisterOtp.bind(this);
    this.verifyRegisterOtp = this.verifyRegisterOtp.bind(this);
    this.checkRegisterOtp = this.checkRegisterOtp.bind(this);
    this.getRegistrationAcademicCatalog = this.getRegistrationAcademicCatalog.bind(this);
    this.getRegistrationSession = this.getRegistrationSession.bind(this);
    this.uploadRegistrationAvatar = this.uploadRegistrationAvatar.bind(this);
    this.updateRegistrationProfile = this.updateRegistrationProfile.bind(this);
    this.selectRegistrationPlan = this.selectRegistrationPlan.bind(this);
    this.checkoutRegistrationPlan = this.checkoutRegistrationPlan.bind(this);
    this.verifyRegistrationPayment = this.verifyRegistrationPayment.bind(this);
    this.login = this.login.bind(this);
    this.googleLogin = this.googleLogin.bind(this);
    this.refreshToken = this.refreshToken.bind(this);
    this.forgotPassword = this.forgotPassword.bind(this);
    this.resetPassword = this.resetPassword.bind(this);
    this.forgotPasswordOtp = this.forgotPasswordOtp.bind(this);
    this.resetPasswordWithOtp = this.resetPasswordWithOtp.bind(this);
    this.getProfile = this.getProfile.bind(this);
    this.updateProfile = this.updateProfile.bind(this);
    this.logout = this.logout.bind(this);
  }

  async loadAuthContext(user) {
    await syncUserAcademicColumnsFromProfile(user);

    const nextAcademicState = maybeAdvanceAcademicProgress(user);
    if (nextAcademicState) {
      await user.update(nextAcademicState);
      Object.assign(user, nextAcademicState);
    }

    const [subscription, progress] = await Promise.all([
      Subscription.findOne({
        where: {
          user_id: user.id,
          status: 'active'
        },
        include: [{ model: Plan, as: 'plan' }],
        order: [['created_at', 'DESC']]
      }),
      UserProgress.findOne({ where: { user_id: user.id } })
    ]);

    let selectedPlan = null;
    if (user.selected_plan_id) {
      selectedPlan = await Plan.findByPk(user.selected_plan_id);
    } else if (subscription?.plan) {
      selectedPlan = subscription.plan;
    }

    const onboarding = buildOnboardingState(user, {
      selectedPlan,
      activeSubscription: subscription
    });

    await persistOnboardingState(user, onboarding);

    let billingIntent = getBillingIntent(user);
    if (billingIntent && isBillingIntentExpired(billingIntent)) {
      const nextPreferences = setBillingIntentOnPreferences(user.preferences, null);
      await user.update({ preferences: nextPreferences });
      user.preferences = nextPreferences;
      billingIntent = null;
    }

    return {
      subscription,
      progress,
      selectedPlan,
      onboarding,
      billingIntent
    };
  }

  buildAuthUser(user, context) {
    return {
      ...serializeAuthUser(user, context.onboarding),
      invite_code: user.invite_code,
      rewards_balance: user.rewards_balance,
      rewards_pending: user.rewards_pending,
      rewards_lifetime: user.rewards_lifetime,
      payout_contact: user.payout_contact,
      payout_telco: user.payout_telco,
      current_plan: user.current_plan,
      billing_intent: context.billingIntent || null,
      subscription: context.subscription,
      progress: context.progress
    };
  }

  async buildAuthResponse(user, req = null, metadata = {}) {
    const context = await this.loadAuthContext(user);
    const accessToken = this.generateToken(user);
    const refreshToken = this.generateRefreshToken(user);
    if (req) {
      await this.recordAuthSession(user, req, metadata);
    }

    return {
      success: true,
      accessToken,
      token: accessToken,
      refreshToken,
      user: this.buildAuthUser(user, context),
      next_step: context.onboarding.next_step
    };
  }

  async buildTrustedAuthResponse(user, req = null, metadata = {}, trustOptions = {}) {
    let trustedDeviceResult = null;
    if (req && trustOptions.enabled) {
      trustedDeviceResult = await this.trustCurrentDevice(user, req, {
        existingDeviceId: trustOptions.existingDeviceId || null,
        label: trustOptions.label || null,
        authMethod: trustOptions.authMethod || metadata.auth_method || 'password_otp'
      });
    }

    const payload = await this.buildAuthResponse(user, req, {
      ...metadata,
      trusted_device_id: trustedDeviceResult?.device?.id || metadata.trusted_device_id || null
    });

    if (!trustedDeviceResult) {
      return payload;
    }

    return {
      ...payload,
      trusted_device_token: trustedDeviceResult.token,
      trusted_device: {
        id: trustedDeviceResult.device.id,
        label: trustedDeviceResult.device.label,
        trusted_at: trustedDeviceResult.device.trusted_at,
        expires_at: trustedDeviceResult.device.expires_at
      }
    };
  }

  hashSessionToken(sessionToken) {
    return crypto
      .createHash('sha256')
      .update(`${sessionToken}.session.${config.jwt.secret}`)
      .digest('hex');
  }

  generateOtpCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  hashRegistrationOtp(otp, challengeToken) {
    return crypto
      .createHash('sha256')
      .update(`${otp}.${challengeToken}.register.${config.jwt.secret}`)
      .digest('hex');
  }

  hashPasswordResetOtp(otp, challengeToken) {
    return crypto
      .createHash('sha256')
      .update(`${otp}.${challengeToken}.password_reset.${config.jwt.secret}`)
      .digest('hex');
  }

  getTrustedDevices(user) {
    const authPreferences = user?.preferences?.auth;
    return normalizeTokenList(authPreferences?.trusted_devices).filter((item) => item?.id && item?.token_hash);
  }

  updateUserAuthPreferences(user, patch = {}) {
    const currentPreferences = user?.preferences && typeof user.preferences === 'object'
      ? user.preferences
      : {};
    const currentAuthPreferences = currentPreferences.auth && typeof currentPreferences.auth === 'object'
      ? currentPreferences.auth
      : {};

    user.preferences = {
      ...currentPreferences,
      auth: {
        ...currentAuthPreferences,
        ...patch
      }
    };
    return user.preferences.auth;
  }

  buildTrustedDeviceFingerprint(requestContext = {}) {
    const metadata = requestContext.metadata || {};
    return hashValue(JSON.stringify({
      browser_name: requestContext.browser_name || null,
      browser_major: parseMajorVersion(requestContext.browser_version),
      os_name: requestContext.os_name || null,
      os_major: parseMajorVersion(requestContext.os_version),
      device_type: requestContext.device_type || null,
      platform: metadata.platform || null,
      device_vendor: metadata.device_vendor || null,
      device_model: metadata.device_model || null,
      is_mobile: Boolean(requestContext.device_type === 'mobile')
    }));
  }

  buildTrustedDeviceSnapshot(requestContext = {}) {
    const metadata = requestContext.metadata || {};
    return {
      browser_name: requestContext.browser_name || null,
      browser_version: requestContext.browser_version || null,
      os_name: requestContext.os_name || null,
      os_version: requestContext.os_version || null,
      device_type: requestContext.device_type || null,
      platform: metadata.platform || null,
      device_vendor: metadata.device_vendor || null,
      device_model: metadata.device_model || null,
      ip_prefix: getPrivateIpPrefix(requestContext.ip_address),
      timezone: requestContext.timezone || null,
      language: requestContext.language || null
    };
  }

  hashTrustedDeviceToken(token) {
    return hashValue(`${token}.trusted_device.${config.jwt.secret}`);
  }

  createTrustedDeviceToken(user, deviceId, fingerprint) {
    const expiresAt = Math.floor(Date.now() / 1000) + (config.auth.trustedDeviceDays * 24 * 60 * 60);
    return jwt.sign({
      type: TRUSTED_DEVICE_TOKEN_TYPE,
      version: TRUSTED_DEVICE_TOKEN_VERSION,
      userId: user.id,
      deviceId,
      fingerprint,
      exp: expiresAt
    }, config.jwt.refreshSecret);
  }

  verifyTrustedDeviceToken(token) {
    try {
      const payload = jwt.verify(String(token || '').trim(), config.jwt.refreshSecret);
      if (payload?.type !== TRUSTED_DEVICE_TOKEN_TYPE || payload?.version !== TRUSTED_DEVICE_TOKEN_VERSION) {
        return null;
      }
      return payload;
    } catch (error) {
      return null;
    }
  }

  assessTrustedDeviceRisk(currentSnapshot, storedDevice) {
    if (!storedDevice) {
      return { score: 999, reasons: ['trusted_device_not_found'] };
    }

    const reasons = [];
    let score = 0;
    const storedSnapshot = storedDevice.snapshot || {};

    if ((storedSnapshot.device_type || null) !== (currentSnapshot.device_type || null)) {
      score += 4;
      reasons.push('device_type_changed');
    }
    if ((storedSnapshot.browser_name || null) !== (currentSnapshot.browser_name || null)) {
      score += 3;
      reasons.push('browser_changed');
    }
    if ((storedSnapshot.os_name || null) !== (currentSnapshot.os_name || null)) {
      score += 3;
      reasons.push('os_changed');
    }
    if (storedSnapshot.platform && currentSnapshot.platform && storedSnapshot.platform !== currentSnapshot.platform) {
      score += 2;
      reasons.push('platform_changed');
    }
    if (storedSnapshot.device_model && currentSnapshot.device_model && storedSnapshot.device_model !== currentSnapshot.device_model) {
      score += 2;
      reasons.push('device_model_changed');
    }
    if (storedSnapshot.device_vendor && currentSnapshot.device_vendor && storedSnapshot.device_vendor !== currentSnapshot.device_vendor) {
      score += 1;
      reasons.push('device_vendor_changed');
    }
    if (storedSnapshot.ip_prefix && currentSnapshot.ip_prefix && storedSnapshot.ip_prefix !== currentSnapshot.ip_prefix) {
      score += 1;
      reasons.push('ip_prefix_changed');
    }
    if (storedSnapshot.timezone && currentSnapshot.timezone && storedSnapshot.timezone !== currentSnapshot.timezone) {
      score += 1;
      reasons.push('timezone_changed');
    }

    return { score, reasons };
  }

  async trustCurrentDevice(user, req, {
    existingDeviceId = null,
    label = null,
    authMethod = 'password_otp'
  } = {}) {
    const requestContext = this.getRequestSecurityContext(req);
    const fingerprint = this.buildTrustedDeviceFingerprint(requestContext);
    const snapshot = this.buildTrustedDeviceSnapshot(requestContext);
    const currentDevices = this.getTrustedDevices(user);
    const now = new Date().toISOString();
    const deviceId = existingDeviceId || crypto.randomUUID();
    const token = this.createTrustedDeviceToken(user, deviceId, fingerprint);
    const tokenHash = this.hashTrustedDeviceToken(token);
    const expiresAt = new Date(Date.now() + (config.auth.trustedDeviceDays * 24 * 60 * 60 * 1000)).toISOString();
    const nextDevice = {
      id: deviceId,
      token_hash: tokenHash,
      fingerprint,
      snapshot,
      label: label || `${requestContext.browser_name || 'Browser'} on ${requestContext.os_name || requestContext.device_type || 'device'}`,
      auth_method: authMethod,
      trusted_at: now,
      last_used_at: now,
      expires_at: expiresAt
    };

    const mergedDevices = [
      nextDevice,
      ...currentDevices.filter((item) => item.id !== deviceId && item.token_hash !== tokenHash)
    ]
      .filter((item) => !item.expires_at || new Date(item.expires_at) > new Date())
      .slice(0, config.auth.trustedDeviceLimit);

    this.updateUserAuthPreferences(user, { trusted_devices: mergedDevices });
    await user.save();

    return { token, device: nextDevice };
  }

  resolveTrustedDeviceForLogin(user, req, rawTrustedDeviceToken) {
    if (!rawTrustedDeviceToken) {
      return { trusted: false, riskScore: 999, reasons: ['missing_trusted_device_token'], clearToken: false };
    }

    const tokenPayload = this.verifyTrustedDeviceToken(rawTrustedDeviceToken);
    if (!tokenPayload || tokenPayload.userId !== user.id) {
      return { trusted: false, riskScore: 999, reasons: ['invalid_trusted_device_token'], clearToken: true };
    }

    const devices = this.getTrustedDevices(user);
    const trustedDevice = devices.find((item) => item.id === tokenPayload.deviceId);
    if (!trustedDevice) {
      return { trusted: false, riskScore: 999, reasons: ['trusted_device_missing'], clearToken: true };
    }

    if (trustedDevice.expires_at && new Date(trustedDevice.expires_at) <= new Date()) {
      return { trusted: false, riskScore: 999, reasons: ['trusted_device_expired'], clearToken: true };
    }

    if (trustedDevice.token_hash !== this.hashTrustedDeviceToken(rawTrustedDeviceToken)) {
      return { trusted: false, riskScore: 999, reasons: ['trusted_device_hash_mismatch'], clearToken: true };
    }

    const requestContext = this.getRequestSecurityContext(req);
    const fingerprint = this.buildTrustedDeviceFingerprint(requestContext);
    if (tokenPayload.fingerprint !== fingerprint || trustedDevice.fingerprint !== fingerprint) {
      return { trusted: false, riskScore: 999, reasons: ['trusted_device_fingerprint_mismatch'], clearToken: true };
    }

    const risk = this.assessTrustedDeviceRisk(this.buildTrustedDeviceSnapshot(requestContext), trustedDevice);
    return {
      trusted: risk.score <= config.auth.trustedDeviceLowRiskScore,
      riskScore: risk.score,
      reasons: risk.reasons,
      trustedDevice,
      clearToken: false
    };
  }

  buildTrustedSnapshotFromAuthSession(session) {
    if (!session) return null;
    return {
      browser_name: session.browser_name || null,
      browser_version: session.browser_version || null,
      os_name: session.os_name || null,
      os_version: session.os_version || null,
      device_type: session.device_type || null,
      platform: session.metadata?.platform || null,
      device_vendor: session.device_vendor || null,
      device_model: session.device_model || null,
      ip_prefix: getPrivateIpPrefix(session.ip_address),
      timezone: session.timezone || null,
      language: session.language || null
    };
  }

  buildTrustedFingerprintFromAuthSession(session) {
    if (!session) return null;
    return hashValue(JSON.stringify({
      browser_name: session.browser_name || null,
      browser_major: parseMajorVersion(session.browser_version),
      os_name: session.os_name || null,
      os_major: parseMajorVersion(session.os_version),
      device_type: session.device_type || null,
      platform: session.metadata?.platform || null,
      device_vendor: session.device_vendor || null,
      device_model: session.device_model || null,
      is_mobile: Boolean(session.is_mobile)
    }));
  }

  async resolveRecentTrustedSessionForLogin(user, req) {
    if (!user?.id) {
      return { trusted: false, riskScore: 999, reasons: ['missing_user'] };
    }

    const requestContext = this.getRequestSecurityContext(req);
    const currentFingerprint = this.buildTrustedDeviceFingerprint(requestContext);
    const currentSnapshot = this.buildTrustedDeviceSnapshot(requestContext);
    const recentTrustedSessions = await AuthSession.findAll({
      where: {
        user_id: user.id,
        is_trusted: true
      },
      order: [['last_seen_at', 'DESC']],
      limit: 8
    });

    for (const session of recentTrustedSessions) {
      const storedFingerprint = this.buildTrustedFingerprintFromAuthSession(session);
      if (!storedFingerprint || storedFingerprint !== currentFingerprint) {
        continue;
      }

      const risk = this.assessTrustedDeviceRisk(currentSnapshot, {
        snapshot: this.buildTrustedSnapshotFromAuthSession(session)
      });
      if (risk.score <= config.auth.trustedDeviceLowRiskScore) {
        return {
          trusted: true,
          riskScore: risk.score,
          reasons: risk.reasons,
          authSession: session
        };
      }

      return {
        trusted: false,
        riskScore: risk.score,
        reasons: risk.reasons,
        authSession: session
      };
    }

    return { trusted: false, riskScore: 999, reasons: ['recent_trusted_session_not_found'] };
  }

  getPasswordResetOtpState(user) {
    const state = user?.preferences?.password_reset_otp;
    if (!state || typeof state !== 'object') {
      return null;
    }

    const attempts = Number(state.attempts ?? 0);
    return {
      hash: state.hash || null,
      challengeToken: state.challenge_token || null,
      expiresAt: state.expires_at ? new Date(state.expires_at) : null,
      attempts: Number.isFinite(attempts) ? attempts : 0
    };
  }

  setPasswordResetOtpState(user, { hash, challengeToken, expiresAt, attempts = 0 }) {
    const nextPreferences = {
      ...(user.preferences && typeof user.preferences === 'object' ? user.preferences : {})
    };

    nextPreferences.password_reset_otp = {
      hash,
      challenge_token: challengeToken,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      attempts
    };

    user.preferences = nextPreferences;
  }

  clearPasswordResetOtpState(user) {
    const nextPreferences = {
      ...(user.preferences && typeof user.preferences === 'object' ? user.preferences : {})
    };
    delete nextPreferences.password_reset_otp;
    user.preferences = nextPreferences;
  }

  resolveIdentityContact(rawValue) {
    const raw = String(rawValue || '').trim();
    if (!raw) {
      throw createHttpError(400, 'Email or phone number is required');
    }

    if (isEmailAddress(raw)) {
      const normalizedEmail = normalizeEmailAddress(raw);
      return {
        channel: 'email',
        contact: normalizedEmail,
        email: normalizedEmail,
        phone_number: null
      };
    }

    const normalizedPhone = normalizePhoneNumber(raw);
    if (!PHONE_REGEX.test(normalizedPhone)) {
      throw createHttpError(400, 'Provide a valid email address or phone number');
    }

    return {
      channel: 'phone',
      contact: normalizedPhone,
      email: buildPhonePlaceholderEmail(normalizedPhone),
      phone_number: normalizedPhone
    };
  }

  async sendRegistrationOtp({ channel, contact, otp }) {
    if (channel === 'phone') {
      return smsService.sendOtpSms(contact, otp, 'verification', EMAIL_REGISTER_OTP_EXPIRY_MINUTES);
    }
    return emailService.sendRegistrationOtpEmail(contact, otp, EMAIL_REGISTER_OTP_EXPIRY_MINUTES);
  }

  getRequestSecurityContext(req) {
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
  }

  async recordRegistrationSecurityEvent(session, eventType, req, metadata = {}) {
    if (!session?.id) return;

    const requestContext = this.getRequestSecurityContext(req);
    await RegistrationSecurityEvent.create({
      registration_session_id: session.id,
      event_type: eventType,
      ...requestContext,
      metadata: {
        ...(requestContext.metadata || {}),
        ...metadata
      }
    });
  }

  async findRegistrationSession(identity) {
    if (!identity?.channel || !identity?.contact) return null;
    return RegistrationSession.findOne({
      where: {
        contact_type: identity.channel,
        normalized_contact: normalizeRegistrationContact(identity)
      },
      order: [['created_at', 'DESC']]
    });
  }

  async findRegistrationChallengeForSession(session) {
    if (!session?.id) return null;
    return RegistrationOtp.findOne({
      where: { registration_session_id: session.id },
      order: [['created_at', 'DESC']]
    });
  }

  async getOrCreateRegistrationSession(identity, req) {
    const normalizedContact = normalizeRegistrationContact(identity);
    const existingSession = await this.findRegistrationSession(identity);
    if (existingSession) {
      await existingSession.update({
        contact_value: identity.contact,
        normalized_contact: normalizedContact
      });
      return existingSession;
    }

    const session = await RegistrationSession.create({
      contact_type: identity.channel,
      contact_value: identity.contact,
      normalized_contact: normalizedContact,
      stage: 'IDENTITY',
      expires_at: new Date(Date.now() + EMAIL_REGISTER_OTP_EXPIRY_MINUTES * 60 * 1000),
      metadata: {
        email: identity.email,
        phone_number: identity.phone_number
      }
    });

    await this.recordRegistrationSecurityEvent(session, 'session_started', req, {
      channel: identity.channel
    });
    return session;
  }

  async syncUserIdentityContacts(user) {
    if (!user?.id) return;

    const desiredContacts = [];
    if (user.email) {
      desiredContacts.push({
        type: 'email',
        value: String(user.email).trim().toLowerCase(),
        normalized: String(user.email).trim().toLowerCase(),
        is_verified: Boolean(user.email_verified)
      });
    }
    if (user.phone_number) {
      const normalizedPhone = normalizePhoneNumber(user.phone_number);
      desiredContacts.push({
        type: 'phone',
        value: normalizedPhone,
        normalized: normalizedPhone,
        is_verified: Boolean(user.phone_verified)
      });
    }
    if (!desiredContacts.length) return;

    const existingContacts = await UserContact.findAll({ where: { user_id: user.id } });
    const existingByType = new Map(existingContacts.map((contact) => [contact.contact_type, contact]));
    const primaryType = user.phone_number ? 'phone' : 'email';
    let primaryContactId = user.primary_contact_id || null;

    for (const desiredContact of desiredContacts) {
      const existing = existingByType.get(desiredContact.type);
      if (existing) {
        await existing.update({
          contact_value: desiredContact.value,
          normalized_value: desiredContact.normalized,
          is_primary: desiredContact.type === primaryType,
          is_verified: desiredContact.is_verified,
          verified_at: desiredContact.is_verified ? (existing.verified_at || new Date()) : null
        });
        if (desiredContact.type === primaryType) {
          primaryContactId = existing.id;
          user.primary_contact = existing;
        }
        continue;
      }

      const created = await UserContact.create({
        user_id: user.id,
        contact_type: desiredContact.type,
        contact_value: desiredContact.value,
        normalized_value: desiredContact.normalized,
        is_primary: desiredContact.type === primaryType,
        is_verified: desiredContact.is_verified,
        verified_at: desiredContact.is_verified ? new Date() : null
      });

      if (desiredContact.type === primaryType) {
        primaryContactId = created.id;
        user.primary_contact = created;
      }
    }

    if (primaryContactId && String(user.primary_contact_id || '') !== String(primaryContactId)) {
      await user.update({ primary_contact_id: primaryContactId });
      user.primary_contact_id = primaryContactId;
    }
  }

  async recordAuthSession(user, req, metadata = {}) {
    if (!user?.id || !user?.session_token) return null;

    const requestContext = this.getRequestSecurityContext(req);
    const sessionTokenHash = this.hashSessionToken(user.session_token);
    const payload = {
      user_id: user.id,
      session_token_hash: sessionTokenHash,
      ip_address: requestContext.ip_address,
      user_agent: requestContext.user_agent,
      browser_name: requestContext.browser_name,
      browser_version: requestContext.browser_version,
      os_name: requestContext.os_name,
      os_version: requestContext.os_version,
      device_type: requestContext.device_type,
      device_vendor: requestContext.metadata?.device_vendor || null,
      device_model: requestContext.metadata?.device_model || null,
      country_code: requestContext.country_code,
      region: requestContext.region,
      city: requestContext.city,
      timezone: requestContext.timezone,
      language: requestContext.language,
      screen_width: requestContext.metadata?.screen_width || null,
      screen_height: requestContext.metadata?.screen_height || null,
      is_mobile: requestContext.device_type === 'mobile',
      is_trusted: Boolean(metadata.is_trusted),
      last_seen_at: new Date(),
      metadata: {
        platform: requestContext.metadata?.platform || null,
        referrer: requestContext.referrer || null,
        ...metadata
      }
    };

    const existing = await AuthSession.findOne({
      where: {
        session_token_hash: sessionTokenHash
      }
    });

    if (existing) {
      await existing.update(payload);
      return existing;
    }

    return AuthSession.create(payload);
  }

  getRegistrationSessionExpiry(days = REGISTRATION_SESSION_RESUME_TTL_DAYS) {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  async issueRegistrationResumeToken(session) {
    if (!session?.id) return null;

    const metadata = session.metadata && typeof session.metadata === 'object'
      ? { ...session.metadata }
      : {};

    if (!metadata.resume_token) {
      metadata.resume_token = this.createSessionToken();
    }

    await session.update({
      metadata,
      expires_at: this.getRegistrationSessionExpiry()
    });

    return metadata.resume_token;
  }

  getRegistrationSessionNextStep(session) {
    switch (String(session?.stage || '').toUpperCase()) {
      case 'PLAN':
        return ONBOARDING_STEPS.PLAN;
      case 'PAYMENT':
        return ONBOARDING_STEPS.PAYMENT;
      case 'DONE':
        return ONBOARDING_STEPS.DONE;
      case 'ACADEMIC':
      case 'IDENTITY':
      case 'ABANDONED':
      default:
        return ONBOARDING_STEPS.PROFILE;
    }
  }

  serializeRegistrationSession(session, { resumeToken = null } = {}) {
    if (!session) return null;

    const metadata = session.metadata && typeof session.metadata === 'object'
      ? session.metadata
      : {};

    return {
      id: session.id,
      resume_token: resumeToken || metadata.resume_token || null,
      contact_type: session.contact_type,
      contact_value: session.contact_value,
      otp_verified: Boolean(session.otp_verified),
      full_name: session.full_name || '',
      institution_id: session.institution_id || '',
      affiliate_university: session.affiliate_university || '',
      programme_category: session.programme_category || '',
      program_id: session.program_id || '',
      program_name: metadata.program_name || '',
      level: session.level || '',
      semester: session.semester || '',
      index_number: session.index_number || '',
      selected_plan_id: session.selected_plan_id || null,
      duration_months: Number(session.duration_months || 1),
      stage: session.stage,
      next_step: this.getRegistrationSessionNextStep(session),
      expires_at: session.expires_at,
      email: metadata.email || null,
      phone_number: metadata.phone_number || null,
      student_identifier_type: metadata.student_identifier_type || null
    };
  }

  async resolveRegistrationSessionAccess(req) {
    const sessionId = String(
      req.body?.registration_session_id ||
      req.query?.registration_session_id ||
      req.headers['x-registration-session-id'] ||
      ''
    ).trim();
    const resumeToken = String(
      req.body?.resume_token ||
      req.query?.resume_token ||
      req.headers['x-registration-resume-token'] ||
      ''
    ).trim();

    if (!sessionId || !resumeToken) {
      throw createHttpError(401, 'Registration session has expired. Start again.');
    }

    const session = await RegistrationSession.findByPk(sessionId);
    if (!session) {
      throw createHttpError(404, 'Registration session not found. Start again.');
    }

    const metadata = session.metadata && typeof session.metadata === 'object'
      ? session.metadata
      : {};
    if (!metadata.resume_token || metadata.resume_token !== resumeToken) {
      throw createHttpError(401, 'Registration session has expired. Start again.');
    }

    if (session.expires_at && new Date(session.expires_at) < new Date()) {
      throw createHttpError(401, 'Registration session has expired. Start again.');
    }

    return session;
  }

  async createUserFromRegistrationPayload(payload, req) {
    const {
      email,
      password,
      full_name,
      role = 'student',
      institution_id,
      institution,
      affiliate_university,
      program,
      level,
      phone_number,
      index_number,
      referral_code
    } = payload || {};
    const normalizedLevel = normalizeLevel(level);
    const normalizedProgram = role === 'student'
      ? normalizeProgramCategory(program)
      : (typeof program === 'string' ? program.trim() : null);
    const normalizedAffiliateUniversity = role === 'student'
      ? String(affiliate_university || '').trim() || null
      : null;
    const normalizedPhone = normalizePhoneNumber(phone_number || '');
    const normalizedSemester = role === 'student'
      ? config.academic.defaultSemester
      : null;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      throw createHttpError(409, 'User already exists');
    }
    if (role === 'student' && program != null && !normalizedProgram) {
      throw createHttpError(
        400,
        'Program category must be one of: Early Childhood Education, Primary Education, JHS Education'
      );
    }
    if (role === 'student' && !normalizedPhone) {
      throw createHttpError(400, 'Phone number is required for student registration');
    }
    if (normalizedPhone && !PHONE_REGEX.test(normalizedPhone)) {
      throw createHttpError(400, 'Phone number format is invalid');
    }

    let referrer = null;
    if (referral_code) {
      referrer = await User.findOne({ where: { invite_code: referral_code } });
    }

    let resolvedInstitutionId = institution_id || null;
    let resolvedInstitutionName = institution || null;
    let institutionRecord = null;

    if (resolvedInstitutionId) {
      institutionRecord = await Institution.findByPk(resolvedInstitutionId);
      if (!institutionRecord) {
        throw createHttpError(400, 'Selected college is invalid');
      }
      resolvedInstitutionName = institutionRecord.name;
    }

    let normalizedIndexNumber = index_number ? String(index_number).trim().toUpperCase() : null;
    if (role === 'student' && !normalizedIndexNumber) {
      throw createHttpError(400, 'Index number is required for student registration');
    }
    if (role === 'student' && normalizedIndexNumber) {
      const canFullyValidateIndex = Boolean(
        normalizedProgram &&
        (institutionRecord || resolvedInstitutionName)
      );

      if (canFullyValidateIndex) {
        const indexValidation = validateStudentIndexNumber({
          indexNumber: normalizedIndexNumber,
          programCategory: normalizedProgram,
          institutionRecord,
          institutionName: resolvedInstitutionName
        });
        if (!indexValidation.valid) {
          throw createHttpError(400, indexValidation.error);
        }
        normalizedIndexNumber = indexValidation.normalizedIndexNumber;
      }

      const existingIndexOwner = await User.findOne({
        where: {
          index_number: normalizedIndexNumber
        }
      });
      if (existingIndexOwner) {
        throw createHttpError(409, 'Index number is already assigned to another account');
      }
    }

    const hasInstitution = Boolean(resolvedInstitutionId || resolvedInstitutionName);
    const hasAffiliateUniversity = Boolean(normalizedAffiliateUniversity);
    const hasProgram = Boolean(normalizedProgram);
    const hasPhoneNumber = Boolean(normalizedPhone);
    const hasIndexNumber = Boolean(normalizedIndexNumber);

    const user = await User.create({
      email,
      password_hash: password || crypto.randomBytes(24).toString('hex'),
      full_name,
      role,
      auth_provider: null,
      provider_user_id: null,
      email_verified: true,
      last_active_at: new Date(),
      session_token: this.createSessionToken(),
      institution_id: resolvedInstitutionId,
      institution: resolvedInstitutionName || null,
      affiliate_university: normalizedAffiliateUniversity,
      programme_category: normalizedProgram || null,
      program: null,
      program_id: null,
      level: normalizedLevel || null,
      semester: normalizedSemester || null,
      index_number: normalizedIndexNumber || null,
      phone_number: normalizedPhone || null,
      academic_last_progressed_at: role === 'student' ? new Date() : null,
      password_set: Boolean(password),
      profile_complete: role === 'student'
        ? Boolean(hasInstitution && hasAffiliateUniversity && hasProgram && normalizedLevel && hasPhoneNumber && hasIndexNumber)
        : true,
      onboarding_step: role === 'student' && !(hasInstitution && hasAffiliateUniversity && hasProgram && normalizedLevel && hasPhoneNumber && hasIndexNumber)
        ? ONBOARDING_STEPS.PROFILE
        : (password ? ONBOARDING_STEPS.PLAN : ONBOARDING_STEPS.PASSWORD),
      selected_plan_id: null,
      plan_status: PLAN_STATUSES.NONE,
      referral_code: referral_code || null,
      referred_by_user_id: referrer?.id || null
    });

    try {
      await UserProgress.create({
        user_id: user.id,
        xp: 0,
        level: 1,
        streak: 0,
        last_activity_date: new Date()
      });
    } catch (progressError) {
      console.error('User progress init error:', progressError);
    }

    await createSignupWelcomeNotification(user);

    if (referrer) {
      try {
        await rewardService.claimReward(referrer.id, 'invite_register');
      } catch (rewardError) {
        console.error('Invite register reward error:', rewardError);
      }
    }

    try {
      await emailService.sendWelcomeEmail(user.email, user.full_name);
    } catch (emailError) {
      console.error('Welcome email error:', emailError);
    }

    try {
      await analyticsService.trackEvent({
        event_type: 'user_registration',
        user_id: user.id,
        event_data: {
          role: user.role,
          method: 'email_otp',
          source: req?.headers?.referer || 'direct'
        }
      });
    } catch (analyticsError) {
      console.error('Registration analytics error:', analyticsError);
    }

    return user;
  }

  async createUserFromIdentityChallenge({ channel, contact, password, fullName = null }, req) {
    const email = channel === 'email'
      ? contact
      : buildPhonePlaceholderEmail(contact);
    const phoneNumber = channel === 'phone' ? contact : null;
    const normalizedFullName = String(fullName || '').trim() || null;

    const existingUser = await User.findOne({
      where: channel === 'phone'
        ? { phone_number: phoneNumber }
        : { email }
    });
    if (existingUser) {
      throw createHttpError(409, 'User already exists');
    }

    const user = await User.create({
      email,
      password_hash: password,
      full_name: normalizedFullName,
      role: 'student',
      auth_provider: null,
      provider_user_id: null,
      email_verified: channel === 'email',
      phone_verified: channel === 'phone',
      last_active_at: new Date(),
      session_token: this.createSessionToken(),
      institution_id: null,
      institution: null,
      affiliate_university: null,
      program: null,
      level: null,
      semester: null,
      index_number: null,
      phone_number: phoneNumber,
      academic_last_progressed_at: null,
      password_set: true,
      // Progressive onboarding: a verified contact + password + name is enough to
      // enter the app. Academic details are collected later, on first course access.
      profile_complete: Boolean(normalizedFullName),
      onboarding_step: ONBOARDING_STEPS.PROFILE,
      selected_plan_id: null,
      plan_status: PLAN_STATUSES.NONE,
      preferences: {
        registration_identity: {
          primary_channel: channel,
          primary_contact: contact
        }
      }
    });

    try {
      await UserProgress.create({
        user_id: user.id,
        xp: 0,
        level: 1,
        streak: 0,
        last_activity_date: new Date()
      });
    } catch (progressError) {
      console.error('User progress init error:', progressError);
    }

    if (channel === 'email') {
      try {
        await emailService.sendWelcomeEmail(user.email, user.full_name);
      } catch (emailError) {
        console.error('Welcome email error:', emailError);
      }
    }

    try {
      await analyticsService.trackEvent({
        event_type: 'user_registration',
        user_id: user.id,
        event_data: {
          role: user.role,
          method: config.features.disableRegistrationOtpVerification
            ? `${channel}_password_only`
            : `${channel}_otp`,
          source: req?.headers?.referer || 'direct'
        }
      });
    } catch (analyticsError) {
      console.error('Registration analytics error:', analyticsError);
    }

    await this.syncUserIdentityContacts(user);

    return user;
  }

  // Auto-enrol a new account on the free "Basic Student" plan so plan/payment
  // never block entry. handleFreePlan also sets the user's selected_plan_id,
  // plan_status = active and onboarding_step = DONE.
  async assignDefaultFreePlan(userId) {
    try {
      const freePlan =
        (await Plan.findOne({ where: { is_active: true, price: 0 }, order: [['price', 'ASC']] })) ||
        (await Plan.findOne({ where: { name: 'Basic Student' } }));
      if (!freePlan) return null;
      await subscriptionService.handleFreePlan(userId, freePlan.id, null);
      return freePlan;
    } catch (error) {
      console.error('Assign default free plan error:', error);
      return null;
    }
  }

  async createUserFromRegistrationSession(session, req, options = {}) {
    if (!session?.id) {
      throw createHttpError(400, 'Registration session is required');
    }

    const metadata = session.metadata && typeof session.metadata === 'object'
      ? session.metadata
      : {};
    const email = String(
      metadata.email ||
      (session.contact_type === 'email' ? session.contact_value : buildPhonePlaceholderEmail(session.contact_value))
    ).trim().toLowerCase();
    const phoneNumber = normalizePhoneNumber(
      metadata.phone_number ||
      (session.contact_type === 'phone' ? session.contact_value : '')
    );
    const fullName = String(session.full_name || '').trim();
    const affiliateUniversity = String(session.affiliate_university || '').trim();
    const programmeCategory = normalizeProgramCategory(session.programme_category);
    const normalizedLevel = normalizeLevel(session.level);
    const normalizedSemester = normalizeSemester(session.semester || config.academic.defaultSemester);
    const normalizedIndexNumber = String(session.index_number || '').trim().toUpperCase();
    const studentIdentifierType = metadata.student_identifier_type || 'index_number';
    const selectedPlanId = options.selectedPlanId || session.selected_plan_id || null;

    if (!session.password_hash) {
      throw createHttpError(400, 'Create a password before finishing registration');
    }
    if (!fullName || !session.institution_id || !affiliateUniversity || !programmeCategory || !session.program_id || !normalizedLevel || !normalizedSemester || !normalizedIndexNumber) {
      throw createHttpError(400, 'Registration session is incomplete');
    }
    if (phoneNumber && !PHONE_REGEX.test(phoneNumber)) {
      throw createHttpError(400, 'Phone number format is invalid');
    }

    const [existingUserByEmail, existingUserByPhone, institutionRecord, programRecord] = await Promise.all([
      User.findOne({ where: { email } }),
      phoneNumber ? User.findOne({ where: { phone_number: phoneNumber } }) : null,
      Institution.findByPk(session.institution_id),
      Program.findByPk(session.program_id)
    ]);

    if (existingUserByEmail || existingUserByPhone) {
      throw createHttpError(409, 'User already exists');
    }
    if (!institutionRecord) {
      throw createHttpError(400, 'Selected college is invalid');
    }
    if (!programRecord) {
      throw createHttpError(400, 'Selected program is invalid');
    }

    const user = await User.create({
      email,
      password_hash: session.password_hash,
      full_name: fullName,
      role: 'student',
      auth_provider: null,
      provider_user_id: null,
      email_verified: session.contact_type === 'email' ? Boolean(session.otp_verified) : false,
      phone_verified: session.contact_type === 'phone' ? Boolean(session.otp_verified) : false,
      last_active_at: new Date(),
      session_token: this.createSessionToken(),
      institution_id: institutionRecord.id,
      institution: institutionRecord.name,
      affiliate_university: affiliateUniversity,
      programme_category: programmeCategory,
      program: programRecord.name,
      program_id: programRecord.id,
      level: normalizedLevel,
      semester: normalizedSemester,
      index_number: normalizedIndexNumber,
      phone_number: phoneNumber || null,
      academic_last_progressed_at: new Date(),
      password_set: true,
      profile_complete: true,
      onboarding_step: selectedPlanId ? ONBOARDING_STEPS.PAYMENT : ONBOARDING_STEPS.PLAN,
      selected_plan_id: selectedPlanId,
      plan_status: selectedPlanId ? PLAN_STATUSES.PENDING_PAYMENT : PLAN_STATUSES.NONE,
      invite_code: crypto.randomBytes(4).toString('hex'),
      avatar_url: metadata.avatar_url || null,
      preferences: {
        academic_profile: {
          program_name: programRecord.name,
          program_category: programmeCategory,
          program_category_code: getProgramCategoryCode(programmeCategory),
          student_identifier_type: studentIdentifierType,
          college_id: institutionRecord.id,
          college_name: institutionRecord.name,
          affiliate_university: affiliateUniversity,
          program_id: programRecord.id
        }
      }
    }, { hooks: false });

    await UserProgress.create({
      user_id: user.id,
      xp: 0,
      level: 1,
      streak: 0,
      last_activity_date: new Date()
    });

    await AcademicProfile.create({
      user_id: user.id,
      institution_id: institutionRecord.id,
      affiliate_university: affiliateUniversity,
      programme_category: programmeCategory,
      program_id: programRecord.id,
      level: normalizedLevel,
      semester: normalizedSemester,
      index_number: normalizedIndexNumber,
      student_identifier_type: studentIdentifierType,
      metadata: {
        program_name: programRecord.name,
        program_category_code: getProgramCategoryCode(programmeCategory),
        college_id: institutionRecord.id,
        college_name: institutionRecord.name
      }
    });

    await createSignupWelcomeNotification(user);

    await this.syncUserIdentityContacts(user);

    if (session.contact_type === 'email') {
      try {
        await emailService.sendWelcomeEmail(user.email, user.full_name);
      } catch (emailError) {
        console.error('Welcome email error:', emailError);
      }
    }

    try {
      await analyticsService.trackEvent({
        event_type: 'user_registration',
        user_id: user.id,
        event_data: {
          role: user.role,
          method: `${session.contact_type}_session_finalized`,
          source: req?.headers?.referer || 'direct'
        }
      });
    } catch (analyticsError) {
      console.error('Registration analytics error:', analyticsError);
    }

    await session.update({
      stage: 'DONE',
      metadata: {
        ...metadata,
        user_id: user.id,
        onboarding_step: selectedPlanId ? ONBOARDING_STEPS.PAYMENT : ONBOARDING_STEPS.PLAN
      }
    });

    return user;
  }

  // Visitor registration (no auth required)
  async registerVisitor(req, res) {
    try {
      const { visitor_id, device_fingerprint } = req.body;
      
      // Create or get visitor session
      const visitorSession = await this.getOrCreateVisitorSession(visitor_id, device_fingerprint);
      
      // Track registration attempt
      await analyticsService.trackEvent({
        event_type: 'visitor_registration',
        visitor_id: visitorSession.visitor_id,
        user_id: null,
        event_data: {
          device_fingerprint,
          ip_address: req.ip
        }
      });
      
      res.json({
        success: true,
        visitor_id: visitorSession.visitor_id,
        message: 'Visitor session created'
      });
    } catch (error) {
      console.error('Visitor registration error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create visitor session'
      });
    }
  }

  // User registration
  async register(req, res) {
    try {
      const identity = this.resolveIdentityContact(
        req.body?.contact || req.body?.email || req.body?.phone_number
      );
      const otpVerificationRequired = !config.features.disableRegistrationOtpVerification;
      const challengeToken = this.createSessionToken();
      const otp = this.generateOtpCode();
      const otpExpiry = new Date(Date.now() + EMAIL_REGISTER_OTP_EXPIRY_MINUTES * 60 * 1000);

      const existingUser = await User.findOne({
        where: identity.channel === 'phone'
          ? { phone_number: identity.phone_number }
          : { email: identity.email }
      });
      if (existingUser && this.isReclaimableRegistrationUser(existingUser)) {
        await this.reclaimRegistrationUser(existingUser);
      }

      const blockingUser = await User.findOne({
        where: identity.channel === 'phone'
          ? { phone_number: identity.phone_number }
          : { email: identity.email }
      });
      if (blockingUser) {
        const existingContext = await this.loadAuthContext(blockingUser);
        const existingNextStep = existingContext?.onboarding?.next_step || ONBOARDING_STEPS.DONE;
        if (existingNextStep !== ONBOARDING_STEPS.DONE && blockingUser.password_set) {
          const existingSession = await this.findRegistrationSession(identity);
          if (existingSession) {
            await existingSession.update({
              stage: 'ACADEMIC',
              metadata: {
                ...(existingSession.metadata && typeof existingSession.metadata === 'object'
                  ? existingSession.metadata
                  : {}),
                user_id: blockingUser.id
              }
            });
          }
          return res.status(409).json({
            success: false,
            error: 'Account setup already started. Sign in to continue.',
            resume_available: true,
            next_step: existingNextStep,
            contact: identity.contact,
            channel: identity.channel,
            masked_contact: maskContact(identity)
          });
        }

        return res.status(409).json({
          success: false,
          error: 'User already exists'
        });
      }

      const registrationSession = await this.getOrCreateRegistrationSession(identity, req);
      const challengeKey = getRegistrationChallengeKey(identity);
      const payloadToStore = {
        channel: identity.channel,
        contact: identity.contact,
        email: identity.email,
        phone_number: identity.phone_number,
        role: 'student'
      };

      await registrationSession.update({
        contact_value: identity.contact,
        normalized_contact: normalizeRegistrationContact(identity),
        otp_verified: false,
        stage: otpVerificationRequired ? 'IDENTITY' : 'ACADEMIC',
        expires_at: otpExpiry,
        metadata: {
          ...(registrationSession.metadata && typeof registrationSession.metadata === 'object'
            ? registrationSession.metadata
            : {}),
          email: identity.email,
          phone_number: identity.phone_number,
          role: 'student'
        }
      });

      const existingChallenge = await this.findRegistrationChallengeForSession(registrationSession);
      if (existingChallenge) {
        await existingChallenge.update({
          registration_session_id: registrationSession.id,
          email: challengeKey,
          channel: identity.channel,
          contact_value: identity.contact,
          challenge_token: challengeToken,
          otp_hash: this.hashRegistrationOtp(otp, challengeToken),
          payload: payloadToStore,
          expires_at: otpExpiry,
          attempts: 0,
          verified_at: null
        });
      } else {
        await RegistrationOtp.create({
          registration_session_id: registrationSession.id,
          email: challengeKey,
          channel: identity.channel,
          contact_value: identity.contact,
          challenge_token: challengeToken,
          otp_hash: this.hashRegistrationOtp(otp, challengeToken),
          payload: payloadToStore,
          expires_at: otpExpiry,
          attempts: 0
        });
      }

      const canDeliverOtp = identity.channel === 'phone'
        ? smsService.isConfigured()
        : emailService.isConfigured();
      if (otpVerificationRequired) {
        if (config.isProduction && !canDeliverOtp) {
          return res.status(503).json({
            success: false,
            error: identity.channel === 'phone'
              ? 'SMS delivery is currently unavailable. Please try again later.'
              : 'Email delivery is currently unavailable. Please try again later.'
          });
        }
        await this.sendRegistrationOtp({
          channel: identity.channel,
          contact: identity.contact,
          otp
        });
        await this.recordRegistrationSecurityEvent(registrationSession, 'otp_sent', req, {
          channel: identity.channel
        });

        try {
          await analyticsService.trackEvent({
            event_type: 'registration_otp_sent',
            user_id: null,
            event_data: {
              contact: identity.contact,
              channel: identity.channel,
              expires_in_minutes: EMAIL_REGISTER_OTP_EXPIRY_MINUTES
            }
          });
        } catch (analyticsError) {
          console.error('Register OTP analytics error:', analyticsError);
        }
      }

      if (!otpVerificationRequired) {
        await this.recordRegistrationSecurityEvent(registrationSession, 'session_started', req, {
          channel: identity.channel,
          otp_bypassed: true
        });
      }

      const response = {
        success: true,
        requires_otp: true,
        otp_verification_required: otpVerificationRequired,
        challenge_token: challengeToken,
        registration_session: {
          id: registrationSession.id,
          next_step: this.getRegistrationSessionNextStep(registrationSession)
        },
        contact: identity.contact,
        email: identity.contact,
        channel: identity.channel,
        masked_contact: maskContact(identity),
        expires_in: EMAIL_REGISTER_OTP_EXPIRY_MINUTES * 60,
        can_resend_in: REGISTRATION_RESEND_COOLDOWN_SECONDS,
        message: otpVerificationRequired
          ? (
            identity.channel === 'phone'
              ? 'A verification code has been sent to your phone.'
              : 'A verification code has been sent to your email.'
          )
          : 'Verification is temporarily skipped. Create your password to continue.'
      };

      if (otpVerificationRequired && !config.isProduction && !canDeliverOtp) {
        response.dev_otp = otp;
        response.message = identity.channel === 'phone'
          ? 'SMS is not configured. Using development OTP response.'
          : 'Email is not configured. Using development OTP response.';
      }

      res.status(202).json(response);
    } catch (error) {
      console.error('Registration error:', error);
      res.status(error?.statusCode || 500).json({
        success: false,
        error: error?.message || 'Registration failed'
      });
    }
  }

  async resendRegisterOtp(req, res) {
    try {
      if (config.features.disableRegistrationOtpVerification) {
        return res.json({
          success: true,
          requires_otp: true,
          otp_verification_required: false,
          message: 'Verification is temporarily skipped. Continue with your password.'
        });
      }

      const identity = this.resolveIdentityContact(
        req.body?.contact || req.body?.email || req.body?.phone_number
      );
      if (!String(req.body?.challenge_token || '').trim()) {
        return res.status(400).json({
          success: false,
          error: 'challenge_token is required'
        });
      }

      const registrationSession = await this.findRegistrationSession(identity);
      if (!registrationSession) {
        return res.status(404).json({
          success: false,
          error: 'Registration challenge not found'
        });
      }

      const challenge = await this.findRegistrationChallengeForSession(registrationSession);
      if (!challenge) {
        return res.status(404).json({
          success: false,
          error: 'Registration challenge not found'
        });
      }

      const challengePayload = challenge.payload || {};
      if (
        !challengePayload.channel ||
        challengePayload.channel !== identity.channel ||
        challengePayload.contact !== identity.contact
      ) {
        await challenge.destroy();
        return res.status(400).json({
          success: false,
          error: 'Registration payload is invalid. Please start again.'
        });
      }

      const nextOtp = this.generateOtpCode();
      const nextChallengeToken = this.createSessionToken();
      const otpExpiry = new Date(Date.now() + EMAIL_REGISTER_OTP_EXPIRY_MINUTES * 60 * 1000);
      await RegistrationOtp.create({
        registration_session_id: registrationSession.id,
        email: getRegistrationChallengeKey(identity),
        channel: identity.channel,
        contact_value: identity.contact,
        challenge_token: nextChallengeToken,
        otp_hash: this.hashRegistrationOtp(nextOtp, nextChallengeToken),
        payload: challenge.payload,
        expires_at: otpExpiry,
        attempts: 0
      });

      await registrationSession.update({
        contact_value: identity.contact,
        normalized_contact: normalizeRegistrationContact(identity),
        otp_verified: false,
        stage: 'IDENTITY',
        expires_at: otpExpiry
      });

      const canDeliverOtp = identity.channel === 'phone'
        ? smsService.isConfigured()
        : emailService.isConfigured();
      if (config.isProduction && !canDeliverOtp) {
        return res.status(503).json({
          success: false,
          error: identity.channel === 'phone'
            ? 'SMS verification is not configured'
            : 'Email verification is not configured'
        });
      }
      await this.sendRegistrationOtp({
        channel: identity.channel,
        contact: identity.contact,
        otp: nextOtp
      });
      await this.recordRegistrationSecurityEvent(registrationSession, 'otp_sent', req, {
        channel: identity.channel,
        resend: true
      });

      const response = {
        success: true,
        requires_otp: true,
        challenge_token: nextChallengeToken,
        registration_session: {
          id: registrationSession.id,
          next_step: this.getRegistrationSessionNextStep(registrationSession)
        },
        contact: identity.contact,
        email: identity.contact,
        channel: identity.channel,
        masked_contact: maskContact(identity),
        expires_in: EMAIL_REGISTER_OTP_EXPIRY_MINUTES * 60,
        can_resend_in: REGISTRATION_RESEND_COOLDOWN_SECONDS,
        message: identity.channel === 'phone'
          ? 'A new verification code has been sent to your phone.'
          : 'A new verification code has been sent to your email.'
      };

      if (!config.isProduction && !canDeliverOtp) {
        response.dev_otp = nextOtp;
      }

      return res.json(response);
    } catch (error) {
      console.error('Resend register OTP error:', error);
      return res.status(error?.statusCode || 500).json({
        success: false,
        error: error?.message || 'Failed to resend verification code'
      });
    }
  }

  async verifyRegisterOtp(req, res) {
    try {
      const otpVerificationRequired = !config.features.disableRegistrationOtpVerification;
      const identity = this.resolveIdentityContact(
        req.body?.contact || req.body?.email || req.body?.phone_number
      );
      const otp = String(req.body?.otp || '').trim();
      const challengeToken = String(req.body?.challenge_token || '').trim();
      const password = String(req.body?.password || '');

      if (!password || (otpVerificationRequired && (!otp || !challengeToken))) {
        return res.status(400).json({
          success: false,
          error: otpVerificationRequired
            ? 'contact, otp, challenge_token and password are required'
            : 'contact and password are required'
        });
      }

      if (otpVerificationRequired && !/^\d{6}$/.test(otp)) {
        return res.status(400).json({
          success: false,
          error: 'OTP must be a 6-digit code'
        });
      }
      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          error: 'Password must be at least 8 characters'
        });
      }

      const registrationSession = await this.findRegistrationSession(identity);
      const activeChallenges = registrationSession
        ? await RegistrationOtp.findAll({
            where: {
              registration_session_id: registrationSession.id,
              expires_at: { [Op.gt]: new Date() },
              verified_at: null
            },
            order: [['created_at', 'DESC']]
          })
        : [];

      const currentChallenge = activeChallenges.find(c => c.challenge_token === challengeToken)
        || activeChallenges[0]
        || null;

      let challenge = currentChallenge;

      if (otpVerificationRequired) {
        if (!currentChallenge) {
          return res.status(401).json({
            success: false,
            error: 'Invalid or expired verification code'
          });
        }

        const attempts = Number(currentChallenge.attempts || 0);
        if (attempts >= EMAIL_REGISTER_OTP_MAX_ATTEMPTS) {
          await RegistrationOtp.destroy({ where: { registration_session_id: registrationSession.id } });
          return res.status(429).json({
            success: false,
            error: 'Too many invalid code attempts. Request a new code.'
          });
        }

        const matchingChallenge = activeChallenges.find(c =>
          this.hashRegistrationOtp(otp, c.challenge_token) === c.otp_hash
        );

        if (!matchingChallenge) {
          currentChallenge.attempts = attempts + 1;
          const maxedOut = currentChallenge.attempts >= EMAIL_REGISTER_OTP_MAX_ATTEMPTS;
          if (maxedOut) {
            await RegistrationOtp.destroy({ where: { registration_session_id: registrationSession.id } });
          } else {
            await currentChallenge.save();
          }
          return res.status(maxedOut ? 429 : 401).json({
            success: false,
            error: maxedOut
              ? 'Too many invalid code attempts. Request a new code.'
              : 'Invalid verification code'
          });
        }

        challenge = matchingChallenge;
      }

      if (!registrationSession) {
        return res.status(404).json({
          success: false,
          error: 'Registration session not found. Please start again.'
        });
      }

      const existingUser = await User.findOne({
        where: identity.channel === 'phone'
          ? { phone_number: identity.phone_number }
          : { email: identity.email }
      });
      if (existingUser) {
        if (registrationSession) {
          await RegistrationOtp.destroy({ where: { registration_session_id: registrationSession.id } });
        }
        return res.status(409).json({
          success: false,
          error: 'User already exists'
        });
      }

      if (challenge) {
        const registrationPayload = challenge.payload || {};
        if (
          !registrationPayload.channel ||
          registrationPayload.channel !== identity.channel ||
          registrationPayload.contact !== identity.contact
        ) {
          await challenge.destroy();
          return res.status(400).json({
            success: false,
            error: 'Registration payload is invalid. Please start again.'
          });
        }
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const fullName = String(req.body?.full_name || req.body?.fullName || '').trim();

      // Progressive onboarding: create the account immediately from the verified
      // contact + password (+ optional name) and drop the user straight into the
      // app on the free plan. Academic details are collected later, on first
      // course access — they are no longer required to finish signing up.
      await registrationSession.update({
        otp_verified: true,
        password_hash: passwordHash,
        full_name: fullName || registrationSession.full_name || null,
        metadata: {
          ...(registrationSession.metadata && typeof registrationSession.metadata === 'object'
            ? registrationSession.metadata
            : {}),
          email: identity.email,
          phone_number: identity.phone_number
        }
      });

      await this.recordRegistrationSecurityEvent(registrationSession, 'otp_verified', req, {
        channel: identity.channel
      });
      await this.recordRegistrationSecurityEvent(registrationSession, 'password_set', req, {
        channel: identity.channel
      });
      if (challenge) {
        challenge.verified_at = new Date();
        await challenge.save();
      }

      const user = await this.createUserFromIdentityChallenge({
        channel: identity.channel,
        contact: identity.contact,
        password: passwordHash,
        fullName: fullName || registrationSession.full_name || null
      }, req);

      await this.assignDefaultFreePlan(user.id);

      await registrationSession.update({
        stage: 'DONE',
        metadata: {
          ...(registrationSession.metadata && typeof registrationSession.metadata === 'object'
            ? registrationSession.metadata
            : {}),
          user_id: user.id,
          onboarding_step: ONBOARDING_STEPS.DONE
        }
      });
      await this.recordRegistrationSecurityEvent(registrationSession, 'registration_completed', req, {
        user_id: user.id,
        completion_source: 'progressive_identity'
      });

      const freshUser = await User.findByPk(user.id);
      const authPayload = await this.buildAuthResponse(freshUser || user, req, {
        auth_method: `${identity.channel}_registration_progressive`,
        source: 'verify_register_otp'
      });
      res.status(201).json(authPayload);
    } catch (error) {
      console.error('Verify register OTP error:', error);
      if (error?.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          error: error.message
        });
      }
      if (/already exists/i.test(String(error?.message || ''))) {
        return res.status(409).json({
          success: false,
          error: 'User already exists'
        });
      }
      res.status(500).json({
        success: false,
        error: 'Failed to verify registration code'
      });
    }
  }

  async checkRegisterOtp(req, res) {
    try {
      const otpVerificationRequired = !config.features.disableRegistrationOtpVerification;
      if (!otpVerificationRequired) {
        return res.json({ valid: true });
      }
      const identity = this.resolveIdentityContact(
        req.body?.contact || req.body?.email || req.body?.phone_number
      );
      const otp = String(req.body?.otp || '').trim();
      const challengeToken = String(req.body?.challenge_token || '').trim();
      if (!otp || !challengeToken) {
        return res.status(400).json({ valid: false, error: 'otp and challenge_token are required' });
      }
      if (!/^\d{6}$/.test(otp)) {
        return res.status(400).json({ valid: false, error: 'OTP must be a 6-digit code' });
      }
      const registrationSession = await this.findRegistrationSession(identity);
      const activeChallenges = registrationSession
        ? await RegistrationOtp.findAll({
            where: {
              registration_session_id: registrationSession.id,
              expires_at: { [Op.gt]: new Date() },
              verified_at: null
            },
            order: [['created_at', 'DESC']]
          })
        : [];
      const currentChallenge = activeChallenges.find(c => c.challenge_token === challengeToken)
        || activeChallenges[0]
        || null;
      if (!currentChallenge) {
        return res.status(401).json({ valid: false, error: 'Verification code has expired. Request a new one.' });
      }
      const attempts = Number(currentChallenge.attempts || 0);
      if (attempts >= EMAIL_REGISTER_OTP_MAX_ATTEMPTS) {
        await RegistrationOtp.destroy({ where: { registration_session_id: registrationSession.id } });
        return res.status(429).json({ valid: false, error: 'Too many invalid attempts. Request a new code.' });
      }
      const matchingChallenge = activeChallenges.find(c =>
        this.hashRegistrationOtp(otp, c.challenge_token) === c.otp_hash
      );
      if (!matchingChallenge) {
        currentChallenge.attempts = attempts + 1;
        const maxedOut = currentChallenge.attempts >= EMAIL_REGISTER_OTP_MAX_ATTEMPTS;
        if (maxedOut) {
          await RegistrationOtp.destroy({ where: { registration_session_id: registrationSession.id } });
        } else {
          await currentChallenge.save();
        }
        return res.status(401).json({
          valid: false,
          error: maxedOut ? 'Too many invalid attempts. Request a new code.' : 'That code is incorrect.'
        });
      }
      return res.json({ valid: true });
    } catch (err) {
      console.error('Check register OTP error:', err);
      return res.status(500).json({ valid: false, error: 'Could not check verification code' });
    }
  }

  async getRegistrationAcademicCatalog(req, res) {
    try {
      const catalog = await getAcademicCatalog();
      return res.json({ success: true, data: catalog });
    } catch (error) {
      console.error('Get registration academic catalog error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to load academic catalog'
      });
    }
  }

  async uploadRegistrationAvatar(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'Avatar file is required' });
      }
      const session = await this.resolveRegistrationSessionAccess(req);
      const avatarUrl = getFileUrl(req.file);
      const metadata = session.metadata && typeof session.metadata === 'object'
        ? { ...session.metadata }
        : {};
      metadata.avatar_url = avatarUrl;
      session.metadata = metadata;
      await session.save();
      return res.json({ success: true, avatar_url: avatarUrl });
    } catch (error) {
      return res.status(error?.statusCode || 500).json({
        success: false,
        error: error?.message || 'Failed to upload avatar'
      });
    }
  }

  async getRegistrationSession(req, res) {
    try {
      const session = await this.resolveRegistrationSessionAccess(req);
      return res.json({
        success: true,
        registration_session: this.serializeRegistrationSession(session)
      });
    } catch (error) {
      return res.status(error?.statusCode || 500).json({
        success: false,
        error: error?.message || 'Failed to load registration session'
      });
    }
  }

  async updateRegistrationProfile(req, res) {
    try {
      const session = await this.resolveRegistrationSessionAccess(req);
      const {
        full_name,
        institution_id,
        institution,
        affiliate_university,
        program,
        academic_program,
        level,
        semester,
        index_number
      } = req.body || {};

      const trimmedFullName = String(full_name || '').trim();
      const normalizedProgram = normalizeProgramCategory(program);
      const normalizedLevel = normalizeLevel(level);
      const normalizedSemester = normalizeSemester(semester || config.academic.defaultSemester);
      const normalizedAffiliateUniversity = String(affiliate_university || '').trim();
      const trimmedAcademicProgram = String(academic_program || '').trim();
      const trimmedIndexNumber = String(index_number || '').trim().toUpperCase();

      if (!trimmedFullName || !institution_id || !normalizedAffiliateUniversity || !normalizedProgram || !trimmedAcademicProgram || !normalizedLevel || !normalizedSemester || !trimmedIndexNumber) {
        return res.status(400).json({
          success: false,
          error: 'full_name, institution_id, affiliate_university, program, academic_program, level, semester and index_number are required'
        });
      }

      const academicCatalog = await getAcademicCatalog();
      const selectedCollege = academicCatalog?.colleges?.find((college) => String(college.id) === String(institution_id));
      if (!selectedCollege) {
        return res.status(400).json({
          success: false,
          error: 'Selected college is invalid'
        });
      }
      if (String(selectedCollege.affiliate_university || '') !== normalizedAffiliateUniversity) {
        return res.status(400).json({
          success: false,
          error: 'Affiliate university does not match the selected college'
        });
      }
      if (!(selectedCollege.programme_categories || []).some((category) => category.name === normalizedProgram)) {
        return res.status(400).json({
          success: false,
          error: 'Program category is not offered by the selected college'
        });
      }

      const availablePrograms = academicCatalog?.programs_by_category?.[normalizedProgram] || [];
      if (
        availablePrograms.length &&
        !availablePrograms.some((item) => String(item.name || '').trim().toLowerCase() === trimmedAcademicProgram.toLowerCase())
      ) {
        return res.status(400).json({
          success: false,
          error: 'Selected program is invalid for the chosen program category'
        });
      }

      const institutionRecord = await Institution.findByPk(institution_id);
      if (!institutionRecord) {
        return res.status(400).json({
          success: false,
          error: 'Selected college is invalid'
        });
      }

      const looksLikeStructuredIndex = /^[A-Z]{2}CE\/[A-Z]{3}\/\d{2}\/\d{4,6}$/.test(trimmedIndexNumber);
      let validatedStudentIdentifier = trimmedIndexNumber;
      let studentIdentifierType = 'application_number';
      if (looksLikeStructuredIndex) {
        const indexValidation = validateStudentIndexNumber({
          indexNumber: trimmedIndexNumber,
          programCategory: normalizedProgram,
          institutionRecord,
          institutionName: institutionRecord.name
        });
        if (!indexValidation.valid) {
          return res.status(400).json({
            success: false,
            error: indexValidation.error
          });
        }
        validatedStudentIdentifier = indexValidation.normalizedIndexNumber;
        studentIdentifierType = 'index_number';
      }

      const existingOwner = await User.findOne({
        where: {
          index_number: validatedStudentIdentifier
        }
      });
      if (existingOwner) {
        return res.status(409).json({
          success: false,
          error: 'Index number is already assigned to another account'
        });
      }

      const selectedProgramOption = availablePrograms.find(
        (item) => String(item.name || '').trim().toLowerCase() === trimmedAcademicProgram.toLowerCase()
      ) || null;

      let resolvedProgramRecord = null;
      if (selectedProgramOption?.id && isUuidLike(selectedProgramOption.id)) {
        resolvedProgramRecord = await Program.findByPk(selectedProgramOption.id);
      }
      if (!resolvedProgramRecord) {
        resolvedProgramRecord = await Program.findOne({
          where: {
            name: trimmedAcademicProgram,
            category: normalizedProgram
          }
        });
      }
      if (!resolvedProgramRecord) {
        const [createdProgram] = await Program.findOrCreate({
          where: {
            key: buildProgramKey(trimmedAcademicProgram, normalizedProgram)
          },
          defaults: {
            name: trimmedAcademicProgram,
            category: normalizedProgram,
            institution_id: institutionRecord.id,
            metadata: {
              category: normalizedProgram,
              source: 'auth.updateRegistrationProfile'
            }
          }
        });
        resolvedProgramRecord = createdProgram;
      }

      await session.update({
        full_name: trimmedFullName,
        institution_id: institutionRecord.id,
        affiliate_university: normalizedAffiliateUniversity,
        programme_category: normalizedProgram,
        program_id: resolvedProgramRecord.id,
        level: normalizedLevel,
        semester: normalizedSemester,
        index_number: validatedStudentIdentifier,
        stage: 'PLAN',
        expires_at: this.getRegistrationSessionExpiry(),
        metadata: {
          ...(session.metadata && typeof session.metadata === 'object' ? session.metadata : {}),
          institution: institution || institutionRecord.name,
          institution_name: institutionRecord.name,
          program_name: trimmedAcademicProgram,
          student_identifier_type: studentIdentifierType,
          onboarding_step: ONBOARDING_STEPS.PLAN
        }
      });

      await this.recordRegistrationSecurityEvent(session, 'academic_saved', req, {
        institution_id: institutionRecord.id,
        affiliate_university: normalizedAffiliateUniversity,
        programme_category: normalizedProgram,
        program_id: resolvedProgramRecord.id,
        level: normalizedLevel,
        semester: normalizedSemester
      });

      return res.json({
        success: true,
        next_step: ONBOARDING_STEPS.PLAN,
        registration_session: this.serializeRegistrationSession(session)
      });
    } catch (error) {
      console.error('Update registration profile error:', error);
      return res.status(error?.statusCode || 500).json({
        success: false,
        error: error?.message || 'Failed to save academic profile'
      });
    }
  }

  async selectRegistrationPlan(req, res) {
    try {
      const session = await this.resolveRegistrationSessionAccess(req);
      const planId = req.body?.plan_id;
      if (!planId) {
        return res.status(400).json({
          success: false,
          error: 'plan_id is required'
        });
      }

      const plan = await Plan.findByPk(planId);
      if (!plan || !plan.is_active) {
        return res.status(404).json({
          success: false,
          error: 'Plan not found'
        });
      }

      await session.update({
        selected_plan_id: plan.id,
        stage: Number(plan.price || 0) > 0 ? 'PAYMENT' : 'DONE',
        expires_at: this.getRegistrationSessionExpiry(),
        metadata: {
          ...(session.metadata && typeof session.metadata === 'object' ? session.metadata : {}),
          selected_plan_name: plan.name,
          selected_plan_price: Number(plan.price || 0),
          onboarding_step: Number(plan.price || 0) > 0 ? ONBOARDING_STEPS.PAYMENT : ONBOARDING_STEPS.DONE
        }
      });

      await this.recordRegistrationSecurityEvent(session, 'plan_selected', req, {
        plan_id: plan.id,
        plan_name: plan.name,
        price: Number(plan.price || 0)
      });

      if (Number(plan.price || 0) <= 0) {
        const user = await this.createUserFromRegistrationSession(session, req, {
          selectedPlanId: plan.id
        });
        await subscriptionService.handleFreePlan(user.id, plan.id, null);
        await this.recordRegistrationSecurityEvent(session, 'registration_completed', req, {
          user_id: user.id,
          completion_source: 'free_plan'
        });
        const authPayload = await this.buildAuthResponse(user, req, {
          auth_method: `${session.contact_type}_registration_free_plan`,
          source: 'select_registration_plan'
        });
        return res.json(authPayload);
      }

      return res.json({
        success: true,
        next_step: ONBOARDING_STEPS.PAYMENT,
        registration_session: this.serializeRegistrationSession(session)
      });
    } catch (error) {
      console.error('Select registration plan error:', error);
      return res.status(error?.statusCode || 500).json({
        success: false,
        error: error?.message || 'Failed to select registration plan'
      });
    }
  }

  async checkoutRegistrationPlan(req, res) {
    try {
      const session = await this.resolveRegistrationSessionAccess(req);
      const durationMonths = Number.parseInt(req.body?.duration_months ?? req.body?.durationMonths ?? 1, 10);
      const normalizedDurationMonths = Number.isFinite(durationMonths) && durationMonths >= 1 && durationMonths <= 12
        ? durationMonths
        : 1;
      const plan = session.selected_plan_id ? await Plan.findByPk(session.selected_plan_id) : null;
      if (!plan || !plan.is_active) {
        return res.status(404).json({
          success: false,
          error: 'Plan not found'
        });
      }
      if (Number(plan.price || 0) <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Selected plan does not require payment'
        });
      }

      const metadata = session.metadata && typeof session.metadata === 'object' ? session.metadata : {};
      const requestedReturnPath = String(req.body?.return_path || req.body?.returnPath || '').trim();
      const callbackUrl = buildPaystackCallbackUrl(requestedReturnPath, req)
        || `${String(config.app?.publicUrl || '').replace(/\/$/, '')}/`;
      const phoneDigits = String(metadata.phone_number || session.contact_value || '').replace(/\D/g, '');
      const checkoutEmail = session.contact_type === 'email'
        ? String(metadata.email || session.contact_value || '').trim().toLowerCase()
        : buildPhonePlaceholderEmail(phoneDigits).toLowerCase();
      const baseAmount = Number(plan.price || 0) * normalizedDurationMonths;
      const amountBreakdown = paymentService.calculateCustomerCharge(baseAmount, 'GHS');

      await session.update({
        duration_months: normalizedDurationMonths,
        stage: 'PAYMENT',
        expires_at: this.getRegistrationSessionExpiry(),
        metadata: {
          ...metadata,
          selected_plan_name: plan.name,
          selected_plan_price: Number(plan.price || 0),
          onboarding_step: ONBOARDING_STEPS.PAYMENT
        }
      });

      const checkout = await paymentService.initializePayment({
        userId: null,
        planId: plan.id,
        plan,
        amount: amountBreakdown.totalAmount,
        amountBreakdown,
        durationMonths: normalizedDurationMonths,
        metadata: {
          registration_session_id: session.id,
          planId: plan.id,
          durationMonths: normalizedDurationMonths,
          duration_months: normalizedDurationMonths,
          billing_kind: 'new_subscription',
          source: 'registration_checkout'
        },
        callbackUrl,
        currency: 'GHS',
        email: checkoutEmail,
        paymentMethod: 'paystack'
      });

      await this.recordRegistrationSecurityEvent(session, 'payment_started', req, {
        plan_id: plan.id,
        billing_kind: 'new_subscription',
        duration_months: normalizedDurationMonths,
        amount: amountBreakdown.totalAmount,
        source: 'registration_checkout'
      });

      return res.json({
        success: true,
        authorization_url: checkout.authorizationUrl,
        access_code: checkout.accessCode,
        reference: checkout.reference,
        provider: checkout.provider || 'paystack',
        duration_months: normalizedDurationMonths,
        amount: amountBreakdown.totalAmount,
        base_amount: amountBreakdown.baseAmount,
        fee_amount: amountBreakdown.feeAmount,
        next_step: ONBOARDING_STEPS.PAYMENT
      });
    } catch (error) {
      console.error('Registration checkout error:', error);
      return res.status(error?.statusCode || 500).json({
        success: false,
        error: error?.message || 'Failed to initialize checkout'
      });
    }
  }

  async verifyRegistrationPayment(req, res) {
    try {
      const session = await this.resolveRegistrationSessionAccess(req);
      const reference = String(req.body?.reference || '').trim();
      const provider = String(req.body?.provider || 'paystack').trim().toLowerCase();
      if (!reference) {
        return res.status(400).json({
          success: false,
          error: 'reference is required'
        });
      }

      const plan = session.selected_plan_id ? await Plan.findByPk(session.selected_plan_id) : null;
      if (!plan || !plan.is_active) {
        return res.status(404).json({
          success: false,
          error: 'Plan not found'
        });
      }

      const paymentResult = await paymentService.verifyPayment(reference, provider);
      if (!paymentResult.success || String(paymentResult.status || '').toLowerCase() !== 'success') {
        return res.status(400).json({
          success: false,
          error: 'Payment verification failed'
        });
      }

      const metadata = paymentResult.metadata || {};
      if (
        metadata.registration_session_id &&
        String(metadata.registration_session_id) !== String(session.id)
      ) {
        return res.status(403).json({
          success: false,
          error: 'Payment does not belong to this registration session'
        });
      }

      const sessionMetadata = session.metadata && typeof session.metadata === 'object'
        ? session.metadata
        : {};
      const sessionEmail = String(
        sessionMetadata.email ||
        (session.contact_type === 'email' ? session.contact_value : buildPhonePlaceholderEmail(session.contact_value))
      ).trim().toLowerCase();
      const sessionPhoneNumber = normalizePhoneNumber(
        sessionMetadata.phone_number ||
        (session.contact_type === 'phone' ? session.contact_value : '')
      );
      const existingUser = sessionMetadata.user_id
        ? await User.findByPk(sessionMetadata.user_id)
        : await User.findOne({
            where: {
              [Op.or]: [
                { email: sessionEmail },
                ...(sessionPhoneNumber ? [{ phone_number: sessionPhoneNumber }] : [])
              ]
            }
          });

      if (existingUser) {
        const activeSubscription = await Subscription.findOne({
          where: {
            user_id: existingUser.id,
            status: 'active'
          },
          include: [{ model: Plan, as: 'plan' }],
          order: [['created_at', 'DESC']]
        });

        if (activeSubscription && String(activeSubscription.plan_id) === String(plan.id)) {
          await session.update({
            stage: 'DONE',
            expires_at: this.getRegistrationSessionExpiry(),
            metadata: {
              ...sessionMetadata,
              user_id: existingUser.id,
              payment_reference: reference,
              payment_provider: provider,
              onboarding_step: ONBOARDING_STEPS.DONE
            }
          });

          const authPayload = await this.buildAuthResponse(existingUser, req, {
            auth_method: `${session.contact_type}_registration_paid_plan`,
            source: 'verify_registration_payment_resume'
          });
          return res.json(authPayload);
        }
      }

      const user = await this.createUserFromRegistrationSession(session, req, {
        selectedPlanId: plan.id
      });
      await subscriptionService.activatePaidPlanFromPayment(user.id, plan.id, {
        provider,
        reference,
        transaction_id: paymentResult.transactionId || reference,
        amount: paymentResult.amount,
        currency: paymentResult.currency,
        paid_at: paymentResult.paidAt || null,
        customer_email: paymentResult.customerEmail || null,
        customer_code: paymentResult.customerCode || null,
        authorization_code: paymentResult.authorizationCode || null,
        paystack_plan_code: paymentResult.planCode || null,
        channel: paymentResult.channel || null,
        duration_months: Number(session.duration_months || 1),
        billing_kind: metadata.billing_kind || metadata.billingKind || 'new_subscription',
        charged_duration_months: metadata.charged_duration_months || metadata.chargedDurationMonths || Number(session.duration_months || 1),
        registration_session_id: session.id,
        metadata: {
          ...metadata,
          source: 'registration_verify'
        }
      });

      await session.update({
        stage: 'DONE',
        expires_at: this.getRegistrationSessionExpiry(),
        metadata: {
          ...(session.metadata && typeof session.metadata === 'object' ? session.metadata : {}),
          payment_reference: reference,
          payment_provider: provider,
          onboarding_step: ONBOARDING_STEPS.DONE
        }
      });

      await this.recordRegistrationSecurityEvent(session, 'payment_verified', req, {
        plan_id: plan.id,
        reference,
        provider,
        source: 'registration_verify'
      });
      await this.recordRegistrationSecurityEvent(session, 'registration_completed', req, {
        user_id: user.id,
        completion_source: 'paid_plan'
      });

      const authPayload = await this.buildAuthResponse(user, req, {
        auth_method: `${session.contact_type}_registration_paid_plan`,
        source: 'verify_registration_payment'
      });
      return res.json(authPayload);
    } catch (error) {
      console.error('Verify registration payment error:', error);
      return res.status(error?.statusCode || 500).json({
        success: false,
        error: error?.message || 'Failed to verify registration payment'
      });
    }
  }

  // User login
  async login(req, res) {
    try {
      const { error } = validateLoginData(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message
        });
      }

      const { email, password, trusted_device_token: trustedDeviceToken } = req.body;
      const identity = this.resolveIdentityContact(email);
      const user = await User.findOne({
        where: identity.channel === 'phone'
          ? { phone_number: identity.phone_number }
          : { email: identity.email }
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      // Verify password
      const isValidPassword = await user.verifyPassword(password);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      if (['blocked', 'deleted'].includes(user.account_status)) {
        return res.status(403).json({
          success: false,
          error: user.account_status === 'deleted' ? 'This account has been removed.' : 'This account has been blocked.'
        });
      }
      if (user.account_status === 'suspended') {
        const suspendedUntil = user.suspended_until ? new Date(user.suspended_until) : null;
        if (!suspendedUntil || suspendedUntil > new Date()) {
          return res.status(403).json({
            success: false,
            error: suspendedUntil
              ? `This account is suspended until ${suspendedUntil.toLocaleString()}.`
              : 'This account is suspended.'
          });
        }
      }

      const trustedLogin = this.resolveTrustedDeviceForLogin(user, req, trustedDeviceToken);

      user.last_active_at = new Date();
      user.session_token = this.createSessionToken();
      if (!user.invite_code) {
        user.invite_code = crypto.randomBytes(4).toString('hex');
      }
      await user.save();

      const authMethod = trustedLogin.trusted && trustedLogin.trustedDevice
        ? `${identity.channel}_password_trusted_device`
        : `${identity.channel}_password`;

      const payload = await this.buildTrustedAuthResponse(user, req, {
        auth_method: authMethod,
        source: 'password_login',
        is_trusted: true,
        trusted_device_id: trustedLogin.trustedDevice?.id || null,
        trusted_device_risk_score: trustedLogin.trusted ? trustedLogin.riskScore : null
      }, {
        enabled: true,
        existingDeviceId: trustedLogin.trustedDevice?.id || null,
        authMethod: authMethod
      });

      try {
        await analyticsService.trackEvent({
          event_type: 'user_login',
          user_id: user.id,
          event_data: { method: authMethod }
        });
      } catch (analyticsError) {
        console.error('Login analytics error:', analyticsError);
      }

      return res.json({
        ...payload,
        trusted_device_verified: Boolean(trustedLogin.trusted && trustedLogin.trustedDevice),
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(error?.statusCode || 500).json({
        success: false,
        error: error?.message || 'Login failed'
      });
    }
  }

  // Google login
  async googleLogin(req, res) {
    try {
      if (!googleClient || !googleClientId) {
        return res.status(500).json({
          success: false,
          error: 'Google authentication not configured'
        });
      }

      const tokenFromBody = req.body?.idToken || req.body?.credential || req.body?.token;
      const authorizationCode = req.body?.authorizationCode || req.body?.code;
      let idToken = tokenFromBody;
      let googleAuthMethod = 'google_id_token';

      if (!idToken && authorizationCode) {
        if (!googleOauthClient) {
          return res.status(500).json({
            success: false,
            error: 'Google OAuth code exchange not configured'
          });
        }

        const exchangeRedirectUri = resolveGoogleAuthCodeRedirectUri(req);
        if (!exchangeRedirectUri) {
          const redirectUriFromBody = String(req.body?.redirectUri || '').trim();
          console.warn('Google OAuth redirect URI rejected', {
            redirectUriFromBody: redirectUriFromBody || null,
            corsOriginAllowlist: getCorsOriginAllowlist(),
            googleRedirectUriEnv: process.env.GOOGLE_REDIRECT_URI || null
          });
          return res.status(400).json({
            success: false,
            error:
              'Google sign-in requires redirectUri (e.g. https://your-site/auth/google/callback) that matches Google Cloud Console and whose origin is listed in CORS_ORIGIN.'
          });
        }

        try {
          const tokenResult = await googleOauthClient.getToken({
            code: authorizationCode,
            redirect_uri: exchangeRedirectUri
          });
          idToken = tokenResult?.tokens?.id_token;
          googleAuthMethod = 'google_oauth2_code';
        } catch (exchangeError) {
          console.error('Google OAuth code exchange error:', exchangeError?.message || exchangeError);
          return res.status(401).json({
            success: false,
            error: 'Google authorization code is invalid or expired'
          });
        }
      }

      if (!idToken) {
        return res.status(400).json({
          success: false,
          error: 'Google credential is required'
        });
      }

      let payload = null;
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken,
          audience: googleClientId
        });
        payload = ticket.getPayload();
      } catch (verificationError) {
        console.error('Google ID token verification error:', verificationError?.message || verificationError);
        return res.status(401).json({
          success: false,
          error: 'Google credential verification failed'
        });
      }

      const email = payload?.email;
      const providerUserId = payload?.sub;

      if (!email || !providerUserId) {
        return res.status(401).json({
          success: false,
          error: 'Google authentication failed'
        });
      }

      let user = await User.findOne({
        where: {
          [Op.or]: [
            {
              auth_provider: 'google',
              provider_user_id: providerUserId
            },
            { email }
          ]
        }
      });
      let isNewUser = false;

      if (!user) {
        isNewUser = true;
        const fallbackName = email.split('@')[0];
        const randomPassword = crypto.randomBytes(24).toString('hex');

        user = await User.create({
          email,
          password_hash: randomPassword,
          password_set: false,
          full_name: payload?.name || fallbackName,
          avatar_url: payload?.picture || null,
          email_verified: payload?.email_verified ?? true,
          role: 'student',
          auth_provider: 'google',
          provider_user_id: providerUserId,
          last_active_at: new Date(),
          session_token: this.createSessionToken(),
          profile_complete: false,
          onboarding_step: ONBOARDING_STEPS.PROFILE,
          selected_plan_id: null,
          plan_status: PLAN_STATUSES.NONE
        });

        await UserProgress.create({
          user_id: user.id,
          xp: 0,
          level: 1,
          streak: 0,
          last_activity_date: new Date()
        });

        await createSignupWelcomeNotification(user);

        // Progressive onboarding: Google accounts come with a verified email and
        // name, so enrol them on the free plan and let them straight into the app.
        await this.assignDefaultFreePlan(user.id);
        user = await User.findByPk(user.id);
      } else {
        if (['blocked', 'deleted'].includes(user.account_status)) {
          return res.status(403).json({
            success: false,
            error: user.account_status === 'deleted' ? 'This account has been removed.' : 'This account has been blocked.'
          });
        }
        if (user.account_status === 'suspended') {
          const suspendedUntil = user.suspended_until ? new Date(user.suspended_until) : null;
          if (!suspendedUntil || suspendedUntil > new Date()) {
            return res.status(403).json({
              success: false,
              error: suspendedUntil
                ? `This account is suspended until ${suspendedUntil.toLocaleString()}.`
                : 'This account is suspended.'
            });
          }
        }

        user.last_active_at = new Date();
        user.session_token = this.createSessionToken();
        user.auth_provider = 'google';
        user.provider_user_id = providerUserId;

        if (!user.full_name && payload?.name) {
          user.full_name = payload.name;
        }

        if (!user.avatar_url && payload?.picture) {
          user.avatar_url = payload.picture;
        }

        if (!user.email_verified && payload?.email_verified) {
          user.email_verified = true;
        }

        if (!user.invite_code) {
          user.invite_code = crypto.randomBytes(4).toString('hex');
        }

        await user.save();
        await this.updateUserStreak(user.id);
      }

      await analyticsService.trackEvent({
        event_type: isNewUser ? 'user_registration' : 'user_login',
        user_id: user.id,
        event_data: {
          method: googleAuthMethod,
          source: req.headers.referer || 'direct'
        }
      });

      const authPayload = await this.buildAuthResponse(user, req, {
        auth_method: googleAuthMethod,
        source: 'google_login'
      });
      res.json(authPayload);
    } catch (error) {
      console.error('Google login error:', error);
      res.status(500).json({
        success: false,
        error: 'Google login failed'
      });
    }
  }

  // Refresh token
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          error: 'Refresh token required'
        });
      }

      // Verify refresh token
      const decoded = jwt.verify(
        refreshToken,
        config.jwt.refreshSecret
      );

      // Find user
      const user = await User.findByPk(decoded.userId);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not found'
        });
      }

      if (!decoded.sessionToken || decoded.sessionToken !== user.session_token) {
        return res.status(401).json({
          success: false,
          error: 'Session expired'
        });
      }

      // Generate new tokens
      const newToken = this.generateToken(user);
      const newRefreshToken = this.generateRefreshToken(user);

      res.json({
        success: true,
        accessToken: newToken,
        token: newToken,
        refreshToken: newRefreshToken
      });
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(401).json({
        success: false,
        error: 'Invalid refresh token'
      });
    }
  }

  // Request password reset
  async forgotPassword(req, res) {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      if (!email) {
        return res.status(400).json({ success: false, error: 'Email is required' });
      }

      const user = await User.findOne({ where: { email } });
      if (!user) {
        return res.json({
          success: true,
          message: 'If an account exists, a reset email will be sent.'
        });
      }

      const resetToken = jwt.sign(
        { userId: user.id, type: 'password_reset' },
        config.jwt.resetSecret,
        { expiresIn: config.jwt.resetExpiresIn }
      );

      const resetUrl = `${config.app.publicUrl.replace(/\/$/, '')}/reset-password?token=${resetToken}`;
      await emailService.sendPasswordResetEmail(user.email, resetUrl);

      res.json({
        success: true,
        message: 'If an account exists, a reset email will be sent.'
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ success: false, error: 'Failed to request password reset' });
    }
  }

  // Request password reset OTP
  async forgotPasswordOtp(req, res) {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      if (!email) {
        return res.status(400).json({ success: false, error: 'Email is required' });
      }

      const user = await User.findOne({ where: { email } });
      if (!user) {
        return res.json({
          success: true,
          requires_otp: false,
          message: 'If an account exists, a password reset code will be sent.'
        });
      }

      const challengeToken = this.createSessionToken();
      const otp = this.generateOtpCode();
      const otpExpiry = new Date(Date.now() + PASSWORD_RESET_OTP_EXPIRY_MINUTES * 60 * 1000);

      this.setPasswordResetOtpState(user, {
        hash: this.hashPasswordResetOtp(otp, challengeToken),
        challengeToken,
        expiresAt: otpExpiry,
        attempts: 0
      });
      await user.save();

      const canSendEmailOtp = emailService.isConfigured();
      if (config.isProduction && !canSendEmailOtp) {
        return res.status(503).json({
          success: false,
          error: 'Email password reset verification is not configured'
        });
      }
      await emailService.sendPasswordResetOtpEmail(user.email, otp, PASSWORD_RESET_OTP_EXPIRY_MINUTES);

      try {
        await analyticsService.trackEvent({
          event_type: 'password_reset_otp_sent',
          user_id: user.id,
          event_data: {
            expires_in_minutes: PASSWORD_RESET_OTP_EXPIRY_MINUTES
          }
        });
      } catch (analyticsError) {
        console.error('Password reset OTP analytics error:', analyticsError);
      }

      const response = {
        success: true,
        requires_otp: true,
        challenge_token: challengeToken,
        email: user.email,
        expires_in: PASSWORD_RESET_OTP_EXPIRY_MINUTES * 60,
        message: 'A password reset code has been sent to your email.'
      };

      if (!config.isProduction && !canSendEmailOtp) {
        response.dev_otp = otp;
        response.message = 'Email is not configured. Using development OTP response.';
      }

      return res.status(202).json(response);
    } catch (error) {
      console.error('Forgot password OTP error:', error);
      return res.status(500).json({ success: false, error: 'Failed to request password reset code' });
    }
  }

  // Reset password
  async resetPassword(req, res) {
    try {
      const { token, newPassword } = req.body || {};
      if (!token || !newPassword) {
        return res.status(400).json({ success: false, error: 'Token and newPassword are required' });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
      }

      const decoded = jwt.verify(token, config.jwt.resetSecret);
      if (!decoded || decoded.type !== 'password_reset') {
        return res.status(400).json({ success: false, error: 'Invalid reset token' });
      }

      const user = await User.findByPk(decoded.userId);
      if (!user) {
        return res.status(400).json({ success: false, error: 'Invalid reset token' });
      }

      user.password_hash = newPassword;
      user.password_set = true;
      user.session_token = this.createSessionToken();
      await user.save();

      res.json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(400).json({ success: false, error: 'Reset token expired or invalid' });
    }
  }

  // Reset password with OTP challenge
  async resetPasswordWithOtp(req, res) {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const otp = String(req.body?.otp || '').trim();
      const challengeToken = String(req.body?.challenge_token || '').trim();
      const newPassword = String(req.body?.newPassword || '');

      if (!email || !otp || !challengeToken || !newPassword) {
        return res.status(400).json({
          success: false,
          error: 'email, otp, challenge_token and newPassword are required'
        });
      }

      if (!/^\d{6}$/.test(otp)) {
        return res.status(400).json({
          success: false,
          error: 'OTP must be a 6-digit code'
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          error: 'Password must be at least 8 characters'
        });
      }

      const user = await User.findOne({ where: { email } });
      const otpState = this.getPasswordResetOtpState(user);
      if (!user || !otpState?.hash || !otpState?.challengeToken) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired reset code'
        });
      }

      if (otpState.challengeToken !== challengeToken) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired reset code'
        });
      }

      if (!otpState.expiresAt || otpState.expiresAt < new Date()) {
        this.clearPasswordResetOtpState(user);
        await user.save();
        return res.status(401).json({
          success: false,
          error: 'Reset code has expired. Please request a new code.'
        });
      }

      if (otpState.attempts >= PASSWORD_RESET_OTP_MAX_ATTEMPTS) {
        this.clearPasswordResetOtpState(user);
        await user.save();
        return res.status(429).json({
          success: false,
          error: 'Too many invalid code attempts. Request a new code.'
        });
      }

      const expectedHash = this.hashPasswordResetOtp(otp, challengeToken);
      if (expectedHash !== otpState.hash) {
        const nextAttempts = otpState.attempts + 1;
        const maxedOut = nextAttempts >= PASSWORD_RESET_OTP_MAX_ATTEMPTS;

        if (maxedOut) {
          this.clearPasswordResetOtpState(user);
        } else {
          this.setPasswordResetOtpState(user, {
            hash: otpState.hash,
            challengeToken,
            expiresAt: otpState.expiresAt,
            attempts: nextAttempts
          });
        }
        await user.save();

        return res.status(maxedOut ? 429 : 401).json({
          success: false,
          error: maxedOut
            ? 'Too many invalid code attempts. Request a new code.'
            : 'Invalid reset code'
        });
      }

      this.clearPasswordResetOtpState(user);
      user.password_hash = newPassword;
      user.password_set = true;
      user.session_token = this.createSessionToken();
      await user.save();

      try {
        await analyticsService.trackEvent({
          event_type: 'password_reset_otp_completed',
          user_id: user.id
        });
      } catch (analyticsError) {
        console.error('Password reset OTP complete analytics error:', analyticsError);
      }

      return res.json({
        success: true,
        message: 'Password updated successfully. You can now sign in.'
      });
    } catch (error) {
      console.error('Reset password with OTP error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to reset password'
      });
    }
  }

  // Get current user profile
  async getProfile(req, res) {
    try {
      const user = await User.findByPk(req.user.id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      const context = await this.loadAuthContext(user);

      res.json({
        success: true,
        user: this.buildAuthUser(user, context),
        next_step: context.onboarding.next_step
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get profile'
      });
    }
  }

  // Update user profile
  async updateProfile(req, res) {
    try {
      const { error } = validateProfileUpdateData(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message
        });
      }

      const updates = { ...req.body };
      const userId = req.user.id;

      // Prevent role changes unless admin
      if (updates.role && req.user.role !== 'admin') {
        delete updates.role;
      }

      // Update user
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      if (Object.prototype.hasOwnProperty.call(updates, 'level')) {
        const normalizedLevel = updates.level ? normalizeLevel(updates.level) : null;
        if (updates.level && !normalizedLevel) {
          return res.status(400).json({
            success: false,
            error: 'level format is invalid'
          });
        }
        updates.level = normalizedLevel;
      }

      if (Object.prototype.hasOwnProperty.call(updates, 'program')) {
        updates.program = updates.program ? String(updates.program).trim() : null;
      }

      if (Object.prototype.hasOwnProperty.call(updates, 'programme_category')) {
        if (user.role === 'student') {
          const normalizedProgramCategory = updates.programme_category
            ? normalizeProgramCategory(updates.programme_category)
            : null;
          if (updates.programme_category && !normalizedProgramCategory) {
            return res.status(400).json({
              success: false,
              error: 'Program category must be one of: Early Childhood Education, Primary Education, JHS Education'
            });
          }
          updates.programme_category = normalizedProgramCategory;
        } else {
          updates.programme_category = updates.programme_category
            ? String(updates.programme_category).trim()
            : null;
        }
      } else if (user.role === 'student' && Object.prototype.hasOwnProperty.call(updates, 'program')) {
        const legacyProgramCategory = updates.program
          ? normalizeProgramCategory(updates.program)
          : null;
        if (legacyProgramCategory) {
          updates.programme_category = legacyProgramCategory;
        }
      }

      if (Object.prototype.hasOwnProperty.call(updates, 'semester')) {
        const normalizedSemester = updates.semester ? normalizeSemester(updates.semester) : null;
        if (updates.semester && !normalizedSemester) {
          return res.status(400).json({
            success: false,
            error: 'semester must be "1" or "2"'
          });
        }
        updates.semester = normalizedSemester;
      }

      if (Object.prototype.hasOwnProperty.call(updates, 'index_number')) {
        updates.index_number = updates.index_number
          ? String(updates.index_number).trim().toUpperCase()
          : null;
      }

      let selectedInstitutionRecord = null;
      if (Object.prototype.hasOwnProperty.call(updates, 'institution_id')) {
        if (!updates.institution_id) {
          updates.institution_id = null;
          updates.institution = null;
        } else {
          selectedInstitutionRecord = await Institution.findByPk(updates.institution_id);
          if (!selectedInstitutionRecord) {
            return res.status(400).json({
              success: false,
              error: 'Selected college is invalid'
            });
          }
          updates.institution = selectedInstitutionRecord.name;
        }
      }

      if (Object.prototype.hasOwnProperty.call(updates, 'program_id')) {
        if (!updates.program_id) {
          updates.program_id = null;
        } else {
          const selectedProgramRecord = await Program.findByPk(updates.program_id);
          if (!selectedProgramRecord) {
            return res.status(400).json({
              success: false,
              error: 'Selected program is invalid'
            });
          }
          updates.program = selectedProgramRecord.name;
          if (user.role === 'student' && !Object.prototype.hasOwnProperty.call(updates, 'programme_category')) {
            updates.programme_category = normalizeProgramCategory(selectedProgramRecord.category);
          }
        }
      }

      const identityFieldsChanged = (
        Object.prototype.hasOwnProperty.call(updates, 'index_number') ||
        Object.prototype.hasOwnProperty.call(updates, 'programme_category') ||
        Object.prototype.hasOwnProperty.call(updates, 'institution_id') ||
        Object.prototype.hasOwnProperty.call(updates, 'institution')
      );
      if (user.role === 'student' && identityFieldsChanged) {
        const effectiveProgram = Object.prototype.hasOwnProperty.call(updates, 'programme_category')
          ? updates.programme_category
          : (user.programme_category || normalizeProgramCategory(user.program));
        const effectiveIndexNumber = Object.prototype.hasOwnProperty.call(updates, 'index_number')
          ? updates.index_number
          : (user.index_number ? String(user.index_number).trim().toUpperCase() : null);
        const effectiveInstitutionId = Object.prototype.hasOwnProperty.call(updates, 'institution_id')
          ? updates.institution_id
          : user.institution_id;
        const effectiveInstitutionName = Object.prototype.hasOwnProperty.call(updates, 'institution')
          ? updates.institution
          : user.institution;

        if (!effectiveProgram) {
          return res.status(400).json({
            success: false,
            error: 'Program category is required for students'
          });
        }
        if (!effectiveIndexNumber) {
          return res.status(400).json({
            success: false,
            error: 'Index number is required for students'
          });
        }

        let effectiveInstitutionRecord = selectedInstitutionRecord;
        if (!effectiveInstitutionRecord && effectiveInstitutionId) {
          effectiveInstitutionRecord = await Institution.findByPk(effectiveInstitutionId);
          if (!effectiveInstitutionRecord) {
            return res.status(400).json({
              success: false,
              error: 'Selected college is invalid'
            });
          }
        }

        const indexValidation = validateStudentIndexNumber({
          indexNumber: effectiveIndexNumber,
          programCategory: effectiveProgram,
          institutionRecord: effectiveInstitutionRecord,
          institutionName: effectiveInstitutionName
        });
        if (!indexValidation.valid) {
          return res.status(400).json({
            success: false,
            error: indexValidation.error
          });
        }

        const existingIndexOwner = await User.findOne({
          where: {
            index_number: indexValidation.normalizedIndexNumber,
            id: { [Op.ne]: userId }
          }
        });
        if (existingIndexOwner) {
          return res.status(409).json({
            success: false,
            error: 'Index number is already assigned to another account'
          });
        }

        updates.programme_category = indexValidation.normalizedProgramCategory;
        updates.index_number = indexValidation.normalizedIndexNumber;
      }

      if (
        user.role === 'student' &&
        (
          Object.prototype.hasOwnProperty.call(updates, 'level') ||
          Object.prototype.hasOwnProperty.call(updates, 'semester')
        )
      ) {
        updates.academic_last_progressed_at = new Date();
      }

      await user.update(updates);
      const context = await this.loadAuthContext(user);

      // Track profile update
      await analyticsService.trackEvent({
        event_type: 'profile_update',
        user_id: userId,
        event_data: {
          updated_fields: Object.keys(updates)
        }
      });

      res.json({
        success: true,
        user: this.buildAuthUser(user, context),
        next_step: context.onboarding.next_step
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update profile'
      });
    }
  }

  // Logout
  async logout(req, res) {
    try {
      if (req.user) {
        req.user.session_token = null;
        await req.user.save();
      }

      // Track logout
      await analyticsService.trackEvent({
        event_type: 'user_logout',
        user_id: req.user.id,
        event_data: {
          session_duration: req.session?.duration || 0
        }
      });

      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        error: 'Logout failed'
      });
    }
  }

  // Generate JWT token
  generateToken(user) {
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        sessionToken: user.session_token
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
  }

  // Generate refresh token
  generateRefreshToken(user) {
    return jwt.sign(
      {
        userId: user.id,
        sessionToken: user.session_token
      },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn }
    );
  }

  createSessionToken() {
    return crypto.randomUUID();
  }

  isReclaimableRegistrationUser(user) {
    const registrationIdentity = user?.preferences?.registration_identity;

    return Boolean(
      user &&
      user.role === 'student' &&
      !user.profile_complete &&
      !user.selected_plan_id &&
      String(user.plan_status || PLAN_STATUSES.NONE) === PLAN_STATUSES.NONE &&
      registrationIdentity?.primary_contact
    );
  }

  async reclaimRegistrationUser(user) {
    if (!this.isReclaimableRegistrationUser(user)) {
      return false;
    }

    await UserProgress.destroy({ where: { user_id: user.id } });
    await user.destroy();
    return true;
  }

  // Update user streak
  async updateUserStreak(userId) {
    try {
      const progress = await UserProgress.findOne({ where: { user_id: userId } });
      if (!progress) return;

      const today = new Date().toISOString().split('T')[0];
      const lastActivity = progress.last_activity_date
        ? new Date(progress.last_activity_date).toISOString().split('T')[0]
        : null;

      if (lastActivity === today) {
        // Already active today
        return;
      }

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (lastActivity === yesterdayStr) {
        // Consecutive day
        progress.streak += 1;
      } else if (lastActivity && lastActivity < yesterdayStr) {
        // Broken streak
        progress.streak = 1;
      } else {
        // First activity or more than 1 day gap
        progress.streak = 1;
      }

      progress.last_activity_date = today;
      await progress.save();

      // Check for streak badges
      await this.checkStreakBadges(userId, progress.streak);

      if (progress.streak >= 7) {
        try {
          await rewardService.claimReward(userId, 'streak_7_day');
        } catch (rewardError) {
          // Ignore if already claimed or not eligible
        }
      }
    } catch (error) {
      console.error('Update streak error:', error);
    }
  }

  // Check and award streak badges
  async checkStreakBadges(userId, streak) {
    try {
      const badgeService = require('../services/gamificationService');
      
      if (streak >= 7) {
        await badgeService.awardBadge(userId, 'WEEK_STREAK');
      }
      
      if (streak >= 30) {
        await badgeService.awardBadge(userId, 'MONTH_STREAK');
      }
    } catch (error) {
      console.error('Check streak badges error:', error);
    }
  }

  // Get or create visitor session
  async getOrCreateVisitorSession(visitorId, deviceFingerprint) {
    // This would typically use Redis or another cache
    // For now, we'll generate a new ID
    if (!visitorId) {
      visitorId = crypto.randomUUID();
    }
    
    return {
      visitor_id: visitorId,
      device_fingerprint: deviceFingerprint,
      created_at: new Date(),
      last_seen_at: new Date()
    };
  }
}

module.exports = new AuthController();

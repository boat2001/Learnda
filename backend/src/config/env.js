const { loadEnv } = require('./loadEnv');

loadEnv();

const env = process.env.NODE_ENV || 'development';
const isProduction = env === 'production';

const requireInProduction = (value, name) => {
  if (isProduction && !value) {
    throw new Error(`${name} is required in production`);
  }
  return value;
};

const requireNonDefault = (value, fallback, name) => {
  if (isProduction && (!value || value === fallback)) {
    throw new Error(`${name} must be set to a non-default value in production`);
  }
  return value || fallback;
};

const corsOriginDefault = 'http://localhost:5173,http://10.242.53.186:5173,http://localhost:5175,http://10.242.53.186:5175,http://localhost:8081,http://10.242.53.186:8081';
const corsOrigin = process.env.CORS_ORIGIN || (isProduction ? '' : corsOriginDefault);
if (isProduction && !corsOrigin) {
  throw new Error('CORS_ORIGIN must be set in production');
}
if (isProduction) {
  const hasWildcardOrigin = String(corsOrigin)
    .split(',')
    .map((segment) => segment.trim())
    .some((segment) => segment === '*');
  if (hasWildcardOrigin) {
    throw new Error(
      'CORS_ORIGIN must not contain * in production — list explicit https:// origins (comma-separated).'
    );
  }
}

const normalizeSemester = (value) => {
  const normalized = String(value || '').trim();
  return normalized === '2' ? '2' : '1';
};

const defaultSemester = normalizeSemester(
  process.env.DEFAULT_SEMESTER || process.env.CURRENT_SEMESTER || process.env.SEMESTER || '1'
);

const parseBoolean = (value, fallback = false) => {
  if (value === undefined) return fallback;
  return String(value).toLowerCase() === 'true';
};

const parseNumber = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const appPublicUrl = requireInProduction(process.env.APP_PUBLIC_URL || '', 'APP_PUBLIC_URL') || 'http://localhost:5175';

module.exports = {
  env,
  isProduction,
  
  // Server
  port: process.env.PORT || 5000,
  host: process.env.HOST || '0.0.0.0',
  
  // Database
  database: {
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_DATABASE || 'learnda',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5433,
    dialect: 'postgres',
    logging: process.env.DB_LOGGING === 'true',
    pool: {
      max: parseInt(process.env.DB_POOL_MAX) || 10,
      min: parseInt(process.env.DB_POOL_MIN) || 0,
      acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 30000,
      idle: parseInt(process.env.DB_POOL_IDLE) || 10000
    }
  },
  
  // JWT
  jwt: {
    secret: requireNonDefault(process.env.JWT_SECRET, 'your_jwt_secret', 'JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshSecret: requireNonDefault(process.env.JWT_REFRESH_SECRET, 'refresh_secret', 'JWT_REFRESH_SECRET'),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    resetSecret: requireNonDefault(process.env.JWT_RESET_SECRET, 'reset_secret', 'JWT_RESET_SECRET'),
    resetExpiresIn: process.env.JWT_RESET_EXPIRES_IN || '1h'
  },
  
  // Cloudflare R2 (S3-compatible object storage)
  r2: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    accountId: process.env.R2_ACCOUNT_ID,
    bucket: process.env.R2_BUCKET || 'learnda-content',
    endpoint: process.env.R2_ENDPOINT,
    publicUrl: process.env.R2_PUBLIC_URL || '',
  },
  
  // Payment
  payment: {
    paystackSecretKey: process.env.PAYSTACK_SECRET_KEY,
    paystackChargePercent: parseFloat(process.env.PAYSTACK_CHARGE_PERCENT || '1.95'),
    paystackChargeFlat: parseFloat(process.env.PAYSTACK_CHARGE_FLAT || '0'),
    paystackChargeCap: parseFloat(process.env.PAYSTACK_CHARGE_CAP || '0'),
  },
  
  // Email (Resend)
  resend: {
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM || 'Learnda <noreply@learnda.app>',
    supportRecipients: (process.env.SUPPORT_EMAIL_RECIPIENTS || process.env.REPORT_RECIPIENTS || '')
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean),
  },

  // SMS
  sms: {
    provider: process.env.SMS_PROVIDER || 'arkesel',
    arkesel: {
      apiKey: process.env.ARKESEL_API_KEY,
      senderId: process.env.ARKESEL_SENDER_ID || 'Learnda',
      baseUrl: process.env.ARKESEL_BASE_URL || 'https://sms.arkesel.com/api/v2',
    },
  },
  
  // CORS
  corsOrigin,
  
  // App version
  version: process.env.APP_VERSION || '3.0.0',
  app: {
    publicUrl: appPublicUrl
  },

  auth: {
    trustedDeviceDays: parseNumber(process.env.AUTH_TRUSTED_DEVICE_DAYS, 90),
    trustedDeviceLimit: parseNumber(process.env.AUTH_TRUSTED_DEVICE_LIMIT, 8),
    trustedDeviceLowRiskScore: parseNumber(process.env.AUTH_TRUSTED_DEVICE_LOW_RISK_SCORE, 1)
  },

  academic: {
    defaultSemester
  },

  startup: {
    dbSyncMode: process.env.DB_SYNC || 'none',
    seedDefaultPlans: parseBoolean(process.env.SEED_DEFAULT_PLANS, false),
    runLegacyAcademicBackfill: parseBoolean(process.env.RUN_LEGACY_ACADEMIC_BACKFILL, false),
    logIncomingOrigin: parseBoolean(process.env.LOG_INCOMING_ORIGIN, false),
  },

  rewards: {
    payoutThreshold: parseFloat(process.env.REWARD_PAYOUT_THRESHOLD || '10'),
    inviteDownloadAmount: parseFloat(process.env.REWARD_INVITE_DOWNLOAD_AMOUNT || '0.5'),
    inviteRegisterAmount: parseFloat(process.env.REWARD_INVITE_REGISTER_AMOUNT || '0.5'),
    streakRewardAmount: parseFloat(process.env.REWARD_STREAK_AMOUNT || '1'),
    contributeRewardAmount: parseFloat(process.env.REWARD_CONTRIBUTE_AMOUNT || '1')
  },
  
  // Feature flags
  features: {
    enableContributions: process.env.ENABLE_CONTRIBUTIONS !== 'false',
    enableGamification: process.env.ENABLE_GAMIFICATION !== 'false',
    enableAnalytics: process.env.ENABLE_ANALYTICS !== 'false',
    enableSocialSubscriptionPopup: process.env.ENABLE_SOCIAL_SUBSCRIPTION_POPUP !== 'false',
    enableSpotlightPopup: process.env.ENABLE_SPOTLIGHT_POPUP !== 'false',
    disableRegistrationOtpVerification:
      process.env.DISABLE_REGISTRATION_OTP_VERIFICATION === 'true' ||
      (!isProduction && process.env.DISABLE_REGISTRATION_OTP_VERIFICATION !== 'false')
  }
};

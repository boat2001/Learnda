const config = require('../config/env');
const logger = require('../config/logger');

const isConfigured = () => Boolean(
  config.sms?.provider === 'arkesel' &&
  config.sms?.arkesel?.apiKey
);

const logSkipped = (type, details = {}) =>
  logger.info(`SMS service not configured. Skipping ${type} SMS.`, details);

/**
 * Normalise a phone number for Arkesel (E.164 without the leading +).
 * Ghana numbers (0XXXXXXXXX) are converted to 233XXXXXXXXX.
 */
const normalisePhone = (raw) => {
  const stripped = String(raw || '').replace(/[\s\-().+]/g, '');

  // Already has country code
  if (/^233\d{9}$/.test(stripped)) return stripped;

  // Ghana local format: 0XXXXXXXXX → 233XXXXXXXXX
  if (/^0\d{9}$/.test(stripped)) return `233${stripped.slice(1)}`;

  // Generic international (digits only, 10+)
  if (/^\d{10,}$/.test(stripped)) return stripped;

  return stripped;
};

const sendArkeselSms = async ({ to, message }) => {
  const arkesel = config.sms.arkesel;
  const baseUrl = String(arkesel.baseUrl || '').replace(/\/$/, '');
  const phone = normalisePhone(to);

  const response = await fetch(`${baseUrl}/sms/send`, {
    method: 'POST',
    headers: {
      'api-key': arkesel.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: arkesel.senderId,
      message,
      recipients: [phone],
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data?.status === 'failed') {
    throw new Error(data?.message || `SMS delivery failed (HTTP ${response.status})`);
  }

  return {
    success: true,
    provider: 'arkesel',
    messageId: data?.data?.[0]?.id || null,
    status: data?.status || null,
    response: data,
  };
};

const sendOtpSms = async (phoneNumber, otp, purpose = 'verification', expiresInMinutes = 10) => {
  if (!isConfigured()) {
    logSkipped('otp', { phoneNumber, purpose });
    return { success: true, skipped: true };
  }

  const message = purpose === 'signin'
    ? `Your Sharether sign-in code is ${otp}. It expires in ${expiresInMinutes} minutes.`
    : `Your Sharether verification code is ${otp}. Expires in ${expiresInMinutes} mins. Do not share it.`;

  return sendArkeselSms({ to: phoneNumber, message });
};

const sendSms = async (phoneNumber, message) => {
  if (!isConfigured()) {
    logSkipped('generic', { phoneNumber });
    return { success: true, skipped: true };
  }
  return sendArkeselSms({ to: phoneNumber, message });
};

module.exports = { isConfigured, sendOtpSms, sendSms };

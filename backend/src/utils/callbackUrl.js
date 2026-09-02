const config = require('../config/env');

const normalizeOrigin = (value) => {
  const raw = String(value || '').trim().replace(/\/$/, '');
  if (!raw) return '';
  try {
    const u = new URL(raw.includes('://') ? raw : `https://${raw}`);
    return `${u.protocol}//${u.host}`;
  } catch {
    return '';
  }
};

const corsOriginsList = () => {
  const raw = String(process.env.CORS_ORIGIN || config.corsOrigin || '');
  return raw
    .split(',')
    .map((s) => normalizeOrigin(s.trim()))
    .filter(Boolean);
};

const isCallbackBaseAllowed = (overrideBase) => {
  const candidate = normalizeOrigin(overrideBase);
  if (!candidate) return false;
  return corsOriginsList().includes(candidate);
};

/**
 * Base URL used for Paystack callback_url (post-payment redirect).
 * In non-production, req.body.callback_base wins when it matches CORS_ORIGIN
 * so users on localhost are not sent to a LAN IP from APP_PUBLIC_URL.
 */
const resolvePaystackCallbackBase = (req) => {
  const fromEnv = String(process.env.APP_PUBLIC_URL || '').trim()
    || String(config.app?.publicUrl || '').trim();
  let base = fromEnv.replace(/\/$/, '');

  if (config.isProduction) {
    return base;
  }

  const body = req?.body || {};
  const override = String(body.callback_base || body.callbackBase || '').trim().replace(/\/$/, '');
  if (override && isCallbackBaseAllowed(override)) {
    base = normalizeOrigin(override).replace(/\/$/, '');
  }

  return base;
};

const buildPaystackCallbackUrl = (returnPath, req) => {
  const normalizedBase = String(resolvePaystackCallbackBase(req) || '').replace(/\/$/, '');
  if (!normalizedBase) return null;
  const normalizedPath = String(returnPath || '').trim();
  if (!normalizedPath.startsWith('/') || normalizedPath.startsWith('//')) {
    return `${normalizedBase}/`;
  }
  return `${normalizedBase}${normalizedPath}`;
};

module.exports = {
  buildPaystackCallbackUrl,
  resolvePaystackCallbackBase,
  isCallbackBaseAllowed,
};

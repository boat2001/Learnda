const BILLING_INTENT_TYPES = Object.freeze({
  UPGRADE: 'upgrade',
  RENEWAL: 'renewal'
});

const BILLING_INTENT_KEY = 'billing_intent';

const normalizeObject = (value) => (
  value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {}
);

const normalizeBillingIntent = (value) => {
  if (!value || typeof value !== 'object') return null;
  const planId = String(value.plan_id || '').trim();
  const type = String(value.type || '').trim().toLowerCase();
  if (!planId) return null;
  if (!Object.values(BILLING_INTENT_TYPES).includes(type)) return null;

  return {
    plan_id: planId,
    type,
    from_plan_id: value.from_plan_id ? String(value.from_plan_id).trim() : null,
    created_at: value.created_at || new Date().toISOString(),
    expires_at: value.expires_at || null,
    status: String(value.status || 'pending').trim().toLowerCase()
  };
};

const getBillingIntent = (user) => {
  const preferences = normalizeObject(user?.preferences);
  return normalizeBillingIntent(preferences[BILLING_INTENT_KEY]);
};

const setBillingIntentOnPreferences = (preferences, intent) => {
  const nextPreferences = normalizeObject(preferences);
  const normalizedIntent = normalizeBillingIntent(intent);
  if (!normalizedIntent) {
    delete nextPreferences[BILLING_INTENT_KEY];
    return nextPreferences;
  }
  nextPreferences[BILLING_INTENT_KEY] = normalizedIntent;
  return nextPreferences;
};

const buildBillingIntent = ({ planId, type, fromPlanId = null, ttlMinutes = 30 }) => {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + Math.max(1, Number(ttlMinutes) || 30));
  return normalizeBillingIntent({
    plan_id: planId,
    type,
    from_plan_id: fromPlanId,
    created_at: new Date().toISOString(),
    expires_at: expiresAt.toISOString(),
    status: 'pending'
  });
};

const isBillingIntentExpired = (intent) => {
  if (!intent?.expires_at) return false;
  const expiresAt = new Date(intent.expires_at);
  if (Number.isNaN(expiresAt.getTime())) return false;
  return expiresAt <= new Date();
};

module.exports = {
  BILLING_INTENT_KEY,
  BILLING_INTENT_TYPES,
  buildBillingIntent,
  getBillingIntent,
  isBillingIntentExpired,
  normalizeBillingIntent,
  setBillingIntentOnPreferences
};

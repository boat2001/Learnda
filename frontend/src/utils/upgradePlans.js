const FALLBACK_PLANS = [
  { id: 'basic', name: 'Basic Student', price: 0 },
  { id: 'serious', name: 'Serious Student', price: 5 },
  { id: 'master', name: 'Master Student', price: 10 },
];

const PLAN_RANK = {
  'Basic Student': 1,
  'Serious Student': 2,
  'Master Student': 3,
};

// Map display names / URL keys back to backend names before normalization
// so PLAN_RANK lookups work for both "Credit" and "Serious Student" inputs.
const DISPLAY_KEY_TO_BACKEND_NORMALIZED = {
  friend:      'basic',
  helper:      'serious',
  hero:        'master',
  pass:        'basic',
  credit:      'serious',
  distinction: 'master',
};

const RANK_BY_NORMALIZED = {
  basic:   1,
  serious: 2,
  master:  3,
};

const normalizePlanValue = (value) => {
  const raw = String(value || '').trim().toLowerCase().replace(/[_-]/g, ' ').replace(/\s+/g, ' ');
  // Resolve display name / key aliases first
  if (DISPLAY_KEY_TO_BACKEND_NORMALIZED[raw]) return DISPLAY_KEY_TO_BACKEND_NORMALIZED[raw];
  // Standard normalization: strip "student" suffix
  return raw.replace(/\bstudent\b/g, '').replace(/\s+/g, ' ').trim();
};

/** Rank for any plan spelling — backend name, display name, or URL key. */
const getPlanRankOf = (planName) => RANK_BY_NORMALIZED[normalizePlanValue(planName)] || 0;

const parsePlanDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** End of the paid period the contributor is currently inside. */
const getPlanPeriodEnd = (subscriptionDetails) =>
  parsePlanDate(subscriptionDetails?.next_billing_date) ||
  parsePlanDate(subscriptionDetails?.expires_at);

const formatPlanDate = (date) =>
  date
    ? date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

/**
 * Mirrors the backend DOWNGRADE_NOT_ALLOWED rule: while a contributor is inside a
 * paid period, every plan below their current one is locked. Once the period ends
 * they're free to pick any plan again.
 *
 * If the current plan is paid but the period end is unknown (details still loading,
 * or missing from the API), we lock rather than unlock — the backend would reject
 * the checkout anyway, so an optimistic CTA would only mislead.
 */
const getPlanLockState = ({ currentPlanName, targetPlanName, subscriptionDetails } = {}) => {
  const unlocked = { locked: false, reason: '', unlocksAt: null, unlocksAtLabel: '' };

  const currentRank = getPlanRankOf(currentPlanName);
  const targetRank = getPlanRankOf(targetPlanName);

  // Unknown plans, or anything at/above the current one (i.e. an upgrade), stay open.
  if (!currentRank || !targetRank || targetRank >= currentRank) return unlocked;

  const periodEnd = getPlanPeriodEnd(subscriptionDetails);
  const periodActive = periodEnd ? periodEnd.getTime() > Date.now() : true;
  if (!periodActive) return unlocked;

  const unlocksAtLabel = formatPlanDate(periodEnd);
  return {
    locked: true,
    unlocksAt: periodEnd,
    unlocksAtLabel,
    reason: unlocksAtLabel
      ? `Your current contribution runs until ${unlocksAtLabel}. You can move to a lower plan after that.`
      : 'You can move to a lower plan once your current contribution period ends.',
  };
};

const getAvailableUpgradePlans = (plans) =>
  (Array.isArray(plans) && plans.length ? plans : FALLBACK_PLANS)
    .slice()
    .sort((a, b) => Number(a.price || 0) - Number(b.price || 0));

const resolveRequestedPlan = ({ detail, plans, currentPlanName }) => {
  const availablePlans = getAvailableUpgradePlans(plans);

  const detailValues = [];
  if (typeof detail === 'string') {
    detailValues.push(detail);
  } else if (detail && typeof detail === 'object') {
    detailValues.push(
      detail.planId,
      detail.id,
      detail.planName,
      detail.name,
      detail.requiredPlan,
      detail.planKey,
      detail.plan
    );
  }

  const normalizedCandidates = detailValues
    .filter(Boolean)
    .map((value) => normalizePlanValue(value));

  const explicitPlan = availablePlans.find((plan) => {
    const normalizedName = normalizePlanValue(plan.name || plan.plan_name);
    const normalizedId = normalizePlanValue(plan.id);
    return normalizedCandidates.includes(normalizedName) || normalizedCandidates.includes(normalizedId);
  });

  if (explicitPlan) return explicitPlan;

  const currentRank = PLAN_RANK[currentPlanName] || 1;
  return availablePlans.find((plan) => (PLAN_RANK[plan.name] || 0) > currentRank) || null;
};

export {
  FALLBACK_PLANS,
  PLAN_RANK,
  getAvailableUpgradePlans,
  getPlanLockState,
  getPlanPeriodEnd,
  getPlanRankOf,
  normalizePlanValue,
  resolveRequestedPlan,
};

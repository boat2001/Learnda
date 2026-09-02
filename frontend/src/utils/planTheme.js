export const getPlanTierClass = () => 'plan-tier-basic';

// Paid contribution tiers (backend names + display aliases). Anything else —
// including guests and the free Basic Student tier — counts as "free".
const PAID_PLAN_NAMES = new Set([
  'serious student',
  'master student',
  'helper',
  'hero',
]);

export const isPaidPlan = (planName) =>
  PAID_PLAN_NAMES.has(String(planName || '').trim().toLowerCase());

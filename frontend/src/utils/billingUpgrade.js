import { toDisplayName } from './contributionPlans';

const PLAN_PRICES = {
  'Basic Student':   0,
  'Serious Student': 5,
  'Master Student':  10,
};

// Duration options in months.
const BILLING_DURATION_OPTIONS = [1, 2, 3, 6, 9, 12];

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseDateSafe = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const shiftMonths = (value, months) => {
  const date = parseDateSafe(value);
  if (!date) return null;
  date.setMonth(date.getMonth() + months);
  return date;
};

const clampRatio = (value) => Math.min(Math.max(toNumber(value, 0), 0), 1);

const formatGhsAmount = (value) => {
  const amount = toNumber(value, 0);
  return Number.isInteger(amount) ? `GHS ${amount}` : `GHS ${amount.toFixed(2).replace(/\.?0+$/, '')}`;
};

const formatShortDate = (value) => {
  const date = parseDateSafe(value);
  if (!date) return '';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const getProrationPeriod = (subscriptionDetails) => {
  const periodEnd = parseDateSafe(
    subscriptionDetails?.next_billing_date ||
    subscriptionDetails?.expires_at
  );
  const durationMonths = Math.max(1, toNumber(subscriptionDetails?.duration_months, 1));
  const periodStart = periodEnd
    ? shiftMonths(periodEnd, -durationMonths)
    : parseDateSafe(subscriptionDetails?.started_at);
  const periodLengthMs = periodEnd && periodStart ? periodEnd.getTime() - periodStart.getTime() : 0;
  const remainingMs = periodEnd ? periodEnd.getTime() - Date.now() : 0;
  const remainingRatio = periodLengthMs > 0 && remainingMs > 0
    ? clampRatio(remainingMs / periodLengthMs)
    : 0;

  return { durationMonths, periodStart, periodEnd, remainingRatio };
};

const getUpgradeBillingPreview = ({
  currentPlanName,
  currentPlanPrice,
  targetPlanName,
  targetPlanPrice,
  durationMonths = 1,
  subscriptionDetails = null,
}) => {
  const months = Math.max(1, toNumber(durationMonths, 1));
  const days = months * 30;

  const currentPrice = toNumber(currentPlanPrice, PLAN_PRICES[currentPlanName] ?? 0);
  const nextPrice    = toNumber(targetPlanPrice,  PLAN_PRICES[targetPlanName]  ?? 0);
  const prorationPeriod = getProrationPeriod(subscriptionDetails);

  const isProratedUpgrade = Boolean(
    currentPrice > 0 &&
    nextPrice > currentPrice &&
    prorationPeriod.remainingRatio > 0
  );

  const fullAmount             = nextPrice * months;
  const monthlyDifferenceAmount = Math.max(nextPrice - currentPrice, 0);
  const termDifferenceAmount    = monthlyDifferenceAmount * prorationPeriod.durationMonths;
  const proratedDifferenceAmount = termDifferenceAmount * prorationPeriod.remainingRatio;
  const amountDue      = isProratedUpgrade ? proratedDifferenceAmount : fullAmount;
  const creditedAmount = isProratedUpgrade ? Math.max(termDifferenceAmount - proratedDifferenceAmount, 0) : 0;

  const displayTarget = toDisplayName(targetPlanName);
  const displayCurrent = toDisplayName(currentPlanName);
  const monthsLabel = `${months} ${months === 1 ? 'month' : 'months'}`;

  let primaryExplanation = `Contributing to ${displayTarget} (from ${displayCurrent}) requires ${formatGhsAmount(fullAmount)} for ${monthsLabel} of benefits.`;
  if (isProratedUpgrade) {
    primaryExplanation = `You pay only the prorated difference for the time remaining in your current active period. Your renewal date stays ${formatShortDate(prorationPeriod.periodEnd)}.`;
  }

  return {
    currentPlanName,
    targetPlanName,
    days,
    months,
    amountDue,
    fullAmount,
    differenceAmount: isProratedUpgrade ? proratedDifferenceAmount : monthlyDifferenceAmount,
    monthlyDifferenceAmount,
    termDifferenceAmount,
    creditedAmount,
    isProratedUpgrade,
    periodStart:      prorationPeriod.periodStart,
    periodStartLabel: formatShortDate(prorationPeriod.periodStart),
    periodEnd:        prorationPeriod.periodEnd,
    periodEndLabel:   formatShortDate(prorationPeriod.periodEnd),
    primaryExplanation,
    downgradeMessage: "You can't switch to a lower contribution plan during your current active period. Once it ends, you're free to choose any plan.",
    providerFeeMessage: 'Provider transaction charges are added at checkout.',
  };
};

export {
  BILLING_DURATION_OPTIONS,
  PLAN_PRICES,
  formatGhsAmount,
  getUpgradeBillingPreview,
};

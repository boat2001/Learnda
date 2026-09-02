const {
  LEVEL_GROUPS,
  getLevelGroup,
  isValidClassLevel,
  normalizeClassLevelCode,
} = require('../config/educationStructure');

const ONBOARDING_STEPS = Object.freeze({
  PROFILE: 'PROFILE',
  PASSWORD: 'PASSWORD',
  PLAN: 'PLAN',
  PAYMENT: 'PAYMENT',
  DONE: 'DONE'
});

const PLAN_STATUSES = Object.freeze({
  NONE: 'none',
  PENDING_PAYMENT: 'pending_payment',
  ACTIVE: 'active'
});

const validSteps = new Set(Object.values(ONBOARDING_STEPS));
const validStatuses = new Set(Object.values(PLAN_STATUSES));

const normalizeStep = (value) => (
  validSteps.has(value) ? value : ONBOARDING_STEPS.PROFILE
);

const normalizeStatus = (value) => (
  validStatuses.has(value) ? value : PLAN_STATUSES.NONE
);

const nonEmpty = (value) => typeof value === 'string' && value.trim().length > 0;

// Reads a learner's place in the school timeline (§6.2). Prefers the
// academic_profiles row; falls back to a draft held in user preferences while
// onboarding is still in progress.
const getStructuredAcademicProfile = (user) => {
  const rawProfile = user?.academic_profile || user?.academicProfile || null;
  if (!rawProfile || typeof rawProfile !== 'object') return null;

  const profile = typeof rawProfile.get === 'function' ? rawProfile.get({ plain: true }) : rawProfile;
  const metadata = profile?.metadata && typeof profile.metadata === 'object' ? profile.metadata : {};

  return {
    class_level: profile?.class_level || null,
    level_group: profile?.level_group || getLevelGroup(profile?.class_level) || null,
    academic_year: profile?.academic_year || '',
    term: profile?.term || '',
    status: profile?.status || '',
    auto_progression: profile?.auto_progression !== false,
    pathway_id: profile?.pathway_id || null,
    is_stem_school: Boolean(profile?.is_stem_school),
    guardian_user_id: profile?.guardian_user_id || null,
    metadata
  };
};

const getAcademicProfile = (user) => {
  const structured = getStructuredAcademicProfile(user);
  if (structured) return structured;

  const draft = user?.preferences?.academic_profile;
  if (!draft || typeof draft !== 'object') return {};

  const classLevel = normalizeClassLevelCode(draft.class_level);
  return {
    class_level: classLevel,
    level_group: getLevelGroup(classLevel),
    academic_year: draft.academic_year || '',
    term: draft.term || '',
    status: draft.status || '',
    auto_progression: draft.auto_progression !== false,
    pathway_id: draft.pathway_id || null,
    is_stem_school: Boolean(draft.is_stem_school),
    guardian_user_id: draft.guardian_user_id || null,
    metadata: draft.metadata && typeof draft.metadata === 'object' ? draft.metadata : {}
  };
};

// A learner can enter the app with a name, but cannot open class content until
// their class level is known -- that is what every §5 content query scopes on.
// SHS additionally needs a pathway before subjects can be resolved (§4.4).
const hasClassPlacement = (user) => {
  const profile = getAcademicProfile(user);
  if (!isValidClassLevel(profile?.class_level)) return false;
  if (getLevelGroup(profile.class_level) === LEVEL_GROUPS.SHS && !profile.pathway_id) return false;
  return true;
};

// Minimum profile required to ENTER the app (progressive onboarding).
// A student only needs a name; full academic details are collected later, the
// first time they open class content (Learn / Practice).
const hasMinimumProfile = (user) => nonEmpty(user?.full_name);


const getPlanPrice = (plan) => {
  const value = Number(plan?.price);
  return Number.isFinite(value) ? value : 0;
};


const buildOnboardingState = (user, context = {}) => {
  let selectedPlan = context.selectedPlan || context.activeSubscription?.plan || null;
  let selectedPlanId = user?.selected_plan_id || context.activeSubscription?.plan_id || null;
  const activeSubscription = context.activeSubscription || null;
  const activePlanId = activeSubscription?.plan_id || activeSubscription?.plan?.id || null;
  // Federated (e.g. Google) accounts authenticate through their provider, so a
  // local password is never required to enter the app.
  const isFederated = Boolean(user?.auth_provider);
  const passwordSet = Boolean(user?.password_set ?? true) || isFederated;
  const explicitStatus = normalizeStatus(user?.plan_status);

  const isStudent = String(user?.role || '').toLowerCase() === 'student';
  let profileComplete = isStudent
    ? hasMinimumProfile(user)
    : Boolean(user?.profile_complete);

  let planStatus = explicitStatus;
  const hasActivePlanSelectionMismatch = Boolean(
    activeSubscription?.status === 'active' &&
    activePlanId &&
    selectedPlanId &&
    String(activePlanId) !== String(selectedPlanId)
  );

  // Recover legacy upgrade attempts that incorrectly forced onboarding payment.
  if (hasActivePlanSelectionMismatch && explicitStatus === PLAN_STATUSES.PENDING_PAYMENT) {
    selectedPlanId = activePlanId;
    selectedPlan = activeSubscription?.plan || selectedPlan;
    planStatus = PLAN_STATUSES.ACTIVE;
  }

  if (!selectedPlanId) {
    planStatus = PLAN_STATUSES.NONE;
  } else if (
    activeSubscription?.status === 'active' &&
    activePlanId &&
    String(activePlanId) === String(selectedPlanId)
  ) {
    planStatus = PLAN_STATUSES.ACTIVE;
  } else if (explicitStatus === PLAN_STATUSES.PENDING_PAYMENT) {
    planStatus = PLAN_STATUSES.PENDING_PAYMENT;
  } else if (getPlanPrice(selectedPlan) > 0) {
    planStatus = PLAN_STATUSES.PENDING_PAYMENT;
  } else if (planStatus === PLAN_STATUSES.NONE) {
    planStatus = getPlanPrice(selectedPlan) > 0
      ? PLAN_STATUSES.PENDING_PAYMENT
      : PLAN_STATUSES.ACTIVE;
  }

  // Progressive onboarding: a free plan is auto-assigned at sign-up, so a
  // missing plan no longer blocks entry — only an explicit pending payment
  // (a paid plan awaiting checkout) does. Plan selection happens contextually
  // later, never as a gate to getting into the app.
  let nextStep = ONBOARDING_STEPS.DONE;
  if (!profileComplete) {
    nextStep = ONBOARDING_STEPS.PROFILE;
  } else if (!passwordSet) {
    nextStep = ONBOARDING_STEPS.PASSWORD;
  } else if (selectedPlanId && planStatus === PLAN_STATUSES.PENDING_PAYMENT) {
    nextStep = ONBOARDING_STEPS.PAYMENT;
  }

  const storedStep = normalizeStep(user?.onboarding_step);
  if (storedStep === ONBOARDING_STEPS.PROFILE && !profileComplete) {
    nextStep = ONBOARDING_STEPS.PROFILE;
  } else if (storedStep === ONBOARDING_STEPS.PASSWORD && profileComplete && !passwordSet) {
    nextStep = ONBOARDING_STEPS.PASSWORD;
  } else if (storedStep === ONBOARDING_STEPS.PAYMENT && selectedPlanId && planStatus === PLAN_STATUSES.PENDING_PAYMENT) {
    nextStep = ONBOARDING_STEPS.PAYMENT;
  }

  const patch = {};
  if (Boolean(user?.profile_complete) !== profileComplete) {
    patch.profile_complete = profileComplete;
  }
  if ((user?.selected_plan_id || null) !== (selectedPlanId || null)) {
    patch.selected_plan_id = selectedPlanId;
  }
  if (user?.plan_status !== planStatus) {
    patch.plan_status = planStatus;
  }
  if (user?.onboarding_step !== nextStep) {
    patch.onboarding_step = nextStep;
  }

  return {
    profile_complete: profileComplete,
    password_set: passwordSet,
    selected_plan_id: selectedPlanId,
    plan_status: planStatus,
    onboarding_step: nextStep,
    next_step: nextStep,
    patch
  };
};

const persistOnboardingState = async (user, state) => {
  if (!user || !state?.patch) return;
  const keys = Object.keys(state.patch);
  if (!keys.length) return;

  await user.update(state.patch);
};

const serializeAuthUser = (user, onboardingState) => ({
  id: user.id,
  email: user.email,
  name: user.full_name,
  full_name: user.full_name,
  role: user.role,
  is_contributor: Boolean(user.is_contributor),
  contributor_application_status: user.contributor_application_status || 'none',
  contributor_applied_at: user.contributor_applied_at || null,
  contributor_approved_at: user.contributor_approved_at || null,
  avatar_url: user.avatar_url,
  phone_number: user.phone_number,
  country_code: user.country_code,

  // Place in the school timeline (§6.2). class_level drives all content scoping.
  class_level: getAcademicProfile(user)?.class_level || null,
  level_group: getAcademicProfile(user)?.level_group || null,
  academic_year: getAcademicProfile(user)?.academic_year || null,
  term: getAcademicProfile(user)?.term || null,
  academic_status: getAcademicProfile(user)?.status || null,
  pathway_id: getAcademicProfile(user)?.pathway_id || null,
  is_stem_school: Boolean(getAcademicProfile(user)?.is_stem_school),
  has_class_placement: hasClassPlacement(user),
  profile_complete: onboardingState.profile_complete,
  password_set: onboardingState.password_set,
  onboarding_step: onboardingState.onboarding_step,
  selected_plan_id: onboardingState.selected_plan_id,
  plan_status: onboardingState.plan_status
});

module.exports = {
  ONBOARDING_STEPS,
  PLAN_STATUSES,
  getAcademicProfile,
  hasMinimumProfile,
  hasClassPlacement,
  buildOnboardingState,
  persistOnboardingState,
  serializeAuthUser
};

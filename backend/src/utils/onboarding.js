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
  ACTIVE: 'active',
  INSTITUTION_PENDING: 'institution_pending'
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

const normalizeProgramCategoryFromCatalog = (value) => {
  const text = String(value || '').trim();
  if (text === 'Primary') return 'Primary Education';
  if (text === 'JHS') return 'JHS Education';
  if (text === 'ECE') return 'Early Childhood Education';
  return '';
};

const getStructuredAcademicProfile = (user) => {
  const rawProfile = user?.academic_profile || user?.academicProfile || null;
  if (!rawProfile || typeof rawProfile !== 'object') return null;

  const profile = typeof rawProfile.get === 'function' ? rawProfile.get({ plain: true }) : rawProfile;
  const metadata = profile?.metadata && typeof profile.metadata === 'object' ? profile.metadata : {};
  const programRecord = profile?.program_record || profile?.programRecord || null;

  return {
    institution_id: profile?.institution_id || null,
    affiliate_university: profile?.affiliate_university || metadata.affiliate_university || '',
    programme_category:
      profile?.programme_category ||
      profile?.program_category ||
      metadata.programme_category ||
      metadata.program_category ||
      user?.programme_category ||
      normalizeProgramCategoryFromCatalog(programRecord?.category) ||
      '',
    program_id: profile?.program_id || user?.program_id || null,
    program_name: programRecord?.name || metadata.program_name || user?.program || '',
    level: profile?.level || user?.academic_level || user?.study_level || '',
    semester: profile?.semester || user?.current_semester || user?.semester || '',
    index_number: profile?.index_number || '',
    student_identifier_type: profile?.student_identifier_type || metadata.student_identifier_type || ''
  };
};

const getAcademicProfile = (user) => {
  const structuredProfile = getStructuredAcademicProfile(user);
  if (structuredProfile) return structuredProfile;
  const preferences = user?.preferences;
  if (!preferences || typeof preferences !== 'object') return {};
  const academicProfile = preferences.academic_profile;
  if (!academicProfile || typeof academicProfile !== 'object') {
    return {};
  }

  return {
    ...academicProfile,
    institution_id: academicProfile.institution_id || academicProfile.college_id || null,
    affiliate_university: academicProfile.affiliate_university || '',
    programme_category:
      academicProfile.programme_category ||
      academicProfile.program_category ||
      '',
    program_id: academicProfile.program_id || null,
    program_name: academicProfile.program_name || '',
    level: academicProfile.level || user?.level || user?.academic_level || user?.study_level || '',
    semester: academicProfile.semester || user?.current_semester || user?.semester || '',
    index_number: academicProfile.index_number || user?.index_number || '',
    student_identifier_type: academicProfile.student_identifier_type || ''
  };
};

// Minimum profile required to ENTER the app (progressive onboarding).
// A student only needs a name; full academic details are collected later, the
// first time they open programme-specific content (Learn/Courses/PLS).
const hasMinimumProfile = (user) => nonEmpty(user?.full_name);


const getPlanPrice = (plan) => {
  const value = Number(plan?.price);
  return Number.isFinite(value) ? value : 0;
};

const isInstitutionalPlan = (plan) => (
  /institution/i.test(String(plan?.name || ''))
);

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
  } else if (isInstitutionalPlan(selectedPlan)) {
    planStatus = PLAN_STATUSES.INSTITUTION_PENDING;
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
  ...(getAcademicProfile(user)?.program_name
    ? { academic_program: getAcademicProfile(user).program_name }
    : {}),
  ...(getAcademicProfile(user)?.student_identifier_type
    ? { academic_identifier_type: getAcademicProfile(user).student_identifier_type }
    : {}),
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
  institution_id: user.institution_id,
  institution: user.institution,
  affiliate_university: user.affiliate_university,
  programme_category: user.programme_category || getAcademicProfile(user)?.programme_category || null,
  program: getAcademicProfile(user)?.program_name || user.program,
  program_id: user.program_id || getAcademicProfile(user)?.program_id || null,
  level: user.level,
  semester: user.semester,
  phone_number: user.phone_number,
  country_code: user.country_code,
  index_number: user.index_number,
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
  isInstitutionalPlan,
  hasMinimumProfile,
  buildOnboardingState,
  persistOnboardingState,
  serializeAuthUser
};

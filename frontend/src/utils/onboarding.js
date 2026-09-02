export const ONBOARDING_STEPS = {
  PROFILE: 'PROFILE',
  PASSWORD: 'PASSWORD',
  PLAN: 'PLAN',
  PAYMENT: 'PAYMENT',
  DONE: 'DONE',
};

export const getOnboardingRoute = (step) => {
  switch (step) {
    case ONBOARDING_STEPS.PROFILE:
      return '/onboarding/profile';
    case ONBOARDING_STEPS.PASSWORD:
      return '/onboarding/password';
    case ONBOARDING_STEPS.PLAN:
      return '/onboarding/plan';
    case ONBOARDING_STEPS.PAYMENT:
      return '/onboarding/payment';
    default:
      return '/learn';
  }
};

const nonEmpty = (value) => typeof value === 'string' && value.trim().length > 0;

// Minimum to enter the app (progressive onboarding): a name. Academic details
// are collected later, the first time the user opens course content.
export const hasMinimumProfile = (user) =>
  nonEmpty(user?.full_name || user?.name);

// Full academic profile — used to gate programme-specific content/features
// (Learn/Courses/PLS), NOT to gate entry into the app. Mirrors the backend
// `hasFullAcademicProfile` in backend/src/utils/onboarding.js.
export const hasFullAcademicProfile = (user) => {
  if (!user) return false;
  return (
    nonEmpty(user.full_name || user.name) &&
    Boolean(user.institution_id || nonEmpty(user.institution)) &&
    nonEmpty(user.affiliate_university) &&
    nonEmpty(user.programme_category || user.program) &&
    nonEmpty(user.academic_program || user.program) &&
    nonEmpty(user.level) &&
    nonEmpty(user.semester) &&
    nonEmpty(user.index_number)
  );
};

export const getNextOnboardingStep = (user) => {
  if (!user) return ONBOARDING_STEPS.DONE;

  // Trust the backend's computed step when it says the user is done; the backend
  // owns the source of truth for onboarding completion.
  const onboardingStep = user.onboarding_step || user.onboardingStep;
  if (onboardingStep === ONBOARDING_STEPS.DONE) {
    return ONBOARDING_STEPS.DONE;
  }

  const isFederated = Boolean(user.auth_provider);
  const selectedPlanId =
    user.selected_plan_id ||
    user.selectedPlanId ||
    user.selected_plan?.id ||
    user.subscription?.plan_id ||
    user.subscription?.plan?.id ||
    null;
  const planStatus =
    user.plan_status ||
    user.planStatus ||
    (user.subscription?.status === 'active' ? 'active' : 'none');
  const passwordSet = Boolean(user.password_set ?? user.passwordSet ?? true) || isFederated;

  // Only a name is required for entry now.
  if (!hasMinimumProfile(user) && onboardingStep === ONBOARDING_STEPS.PROFILE) {
    return ONBOARDING_STEPS.PROFILE;
  }

  if (!passwordSet && onboardingStep === ONBOARDING_STEPS.PASSWORD) {
    return ONBOARDING_STEPS.PASSWORD;
  }

  // A plan is auto-assigned (free) at signup, so a missing plan no longer blocks
  // entry — only an explicit pending payment does.
  if (selectedPlanId && planStatus === 'pending_payment' && onboardingStep === ONBOARDING_STEPS.PAYMENT) {
    return ONBOARDING_STEPS.PAYMENT;
  }

  return ONBOARDING_STEPS.DONE;
};

export const isOnboardingComplete = (user) =>
  getNextOnboardingStep(user) === ONBOARDING_STEPS.DONE;

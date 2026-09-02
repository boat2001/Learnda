import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCheck } from 'react-icons/fi';
import { useAuth } from '../../hooks/useAuth';
import authService from '../../services/authService';
import api from '../../services/api';
import { ONBOARDING_STEPS } from '../../utils/onboarding';
import {
  clearRegistrationDraft,
  loadRegistrationDraft,
  saveRegistrationDraft,
} from '../../utils/registrationDraft';
import OnboardingContent from './AuthOnboardingFlow/OnboardingContent';
import ContributionAppeal from '../subscription/ContributionAppeal';
import {
  getProgramCategoryCode,
  buildIndexNumberExample,
  deriveCollegeCode,
  formatIndexNumberInput,
} from '../../utils/studentIdentity';
import './Auth.css';

const STEP_SEQUENCE = [
  ONBOARDING_STEPS.PROFILE,
  ONBOARDING_STEPS.PASSWORD,
  ONBOARDING_STEPS.PLAN,
];

const STEP_TITLES = {
  [ONBOARDING_STEPS.PROFILE]: 'Personal info',
  [ONBOARDING_STEPS.PASSWORD]: 'Secure your account',
  [ONBOARDING_STEPS.PLAN]: 'Choose your plan',
};

const STEP_DESCRIPTIONS = {
  [ONBOARDING_STEPS.PROFILE]: 'Enter your full name and student index number.',
  [ONBOARDING_STEPS.PASSWORD]: 'Create a strong password to secure your account.',
  [ONBOARDING_STEPS.PLAN]: 'Choose a plan that fits how seriously you want to study.',
};

const isDoneStep = (step) => !step || step === ONBOARDING_STEPS.DONE;
const normalizeUiStep = (step) => (
  step === ONBOARDING_STEPS.PAYMENT ? ONBOARDING_STEPS.PLAN : step
);
const DATE_FIELDS = [
  'next_billing_date',
  'next_billing_at',
  'renewal_date',
  'renews_at',
  'current_period_end',
  'expires_at',
  'end_date',
];
const AUTO_RENEW_FIELDS = [
  'auto_renew',
  'autoRenew',
  'renews_automatically',
  'is_auto_renew',
];
const DURATION_FIELDS = ['duration_months', 'durationMonths', 'billing_months', 'billingMonths'];
const PLAN_DESCRIPTION_OVERRIDES = {
  'Serious Student': 'Unlock all core course content, more downloads, and full access to study groups.',
  'Master Student': 'Everything Sharether offers — core and elective courses, unlimited downloads, all features.',
  'Basic Student': 'Access notes, past questions, and resources — free, always. Upgrade when you need more.',
};

const DEFAULT_PLAN_BENEFITS = {
  'Basic Student': [
    'Access to essential lessons and resources',
    'Core study tools to get started',
  ],
  'Serious Student': [
    'Premium lessons and interactive features',
    'More XP for content you create',
  ],
  'Master Student': [
    'Full access to advanced learning tools',
    'Top-tier contribution and engagement features',
  ],
};

const parseDateSafe = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const addMonths = (date, months) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + Number(months || 0));
  return next;
};

const readField = (sources, fieldNames) => {
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    for (const fieldName of fieldNames) {
      if (source[fieldName] !== undefined && source[fieldName] !== null && source[fieldName] !== '') {
        return source[fieldName];
      }
    }
  }
  return null;
};

const toFeatureLabel = (feature) => {
  if (typeof feature === 'string') return feature;
  if (!feature || typeof feature !== 'object') return '';
  if (feature.enabled === false) return '';
  return String(
    feature.name ||
    feature.title ||
    feature.label ||
    feature.feature_name ||
    feature.description ||
    feature.key ||
    feature.feature_key ||
    ''
  ).trim();
};

const normalizeFeatureList = (features) => {
  if (!Array.isArray(features)) return [];
  return Array.from(
    new Set(
      features
        .map(toFeatureLabel)
        .filter(Boolean)
    )
  ).slice(0, 6);
};

const readPaystackReferenceFromUrl = () => {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search || '');
  return params.get('reference') || params.get('trxref') || '';
};

const clearPaystackReferenceFromUrl = () => {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search || '');
  params.delete('reference');
  params.delete('trxref');
  params.delete('status');
  params.delete('resume_onboarding');
  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash || ''}`;
  window.history.replaceState({}, '', nextUrl);
};

const normalizeReturnPath = (value) => {
  const fallback = '/';
  if (typeof window === 'undefined') return fallback;

  try {
    const url = new URL(String(value || fallback), window.location.origin);
    if (url.origin !== window.location.origin) return fallback;
    if (url.pathname === '/auth/google/callback') return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
};

const buildOnboardingReturnPath = (value) => {
  if (typeof window === 'undefined') return '/?resume_onboarding=plan';
  const url = new URL(normalizeReturnPath(value), window.location.origin);
  url.searchParams.delete('reference');
  url.searchParams.delete('trxref');
  url.searchParams.delete('status');
  url.searchParams.set('resume_onboarding', 'plan');
  return `${url.pathname}${url.search}${url.hash}`;
};

const mergeRegistrationSessionDraft = (session, nextStep) => {
  const draft = loadRegistrationDraft();
  saveRegistrationDraft({
    ...draft,
    registrationSession: session || null,
    onboardingStep: nextStep || session?.next_step || draft?.onboardingStep || ONBOARDING_STEPS.PROFILE,
    updatedAt: Date.now(),
  });
};

function resolveOnboardingError(errorStr) {
  const e = (errorStr || '').toLowerCase();

  // ── Session ──
  if (e.includes('session') && (e.includes('expired') || e.includes('not found') || e.includes('invalid') || e.includes('start again'))) {
    return { message: 'Your session expired. Please start the sign-up again.' };
  }

  // ── Academic / profile stage ──
  if (e.includes('failed to complete profile') || e.includes('complete profile')) {
    return { message: "Couldn't save your profile. Check your details and try again." };
  }
  if ((e.includes('full_name') || e.includes('full name') || e.includes('name')) && e.includes('required')) {
    return { message: 'Please enter your full name to continue.' };
  }
  if ((e.includes('institution') || e.includes('college')) && e.includes('required')) {
    return { message: 'Please select your college or institution to continue.' };
  }
  if (e.includes('index') && (e.includes('invalid') || e.includes('format') || e.includes('wrong'))) {
    return { message: 'That index number format looks wrong. Check it and try again.' };
  }
  if (e.includes('program') && e.includes('required')) {
    return { message: 'Please select your programme to continue.' };
  }
  if (e.includes('level') && e.includes('required')) {
    return { message: 'Please select your level of study to continue.' };
  }

  // ── Password stage ──
  if (e.includes('password') && (e.includes('least 8') || e.includes('characters') || e.includes('short'))) {
    return { message: 'Your password needs to be at least 8 characters long.' };
  }
  if (e.includes('passwords') && (e.includes('match') || e.includes('same'))) {
    return { message: "The two passwords don't match. Re-enter them and try again." };
  }
  if (e.includes('failed to create password') || e.includes('create password')) {
    return { message: "Couldn't save your password. Please try again." };
  }

  // ── Plan selection stage ──
  if (e.includes('failed to select') || (e.includes('select') && e.includes('plan'))) {
    return { message: "Couldn't select that plan. Please try again." };
  }
  if (e.includes('plan') && e.includes('not found')) {
    return { message: "That plan isn't available right now. Choose another one." };
  }

  // ── Checkout / payment initiation stage ──
  if (e.includes('checkout url') || e.includes('authorization_url') || e.includes('not available') || e.includes('failed to start checkout')) {
    return { message: "Couldn't start the payment process. Try again or start with the free plan.", actionKey: 'freePlan', actionLabel: 'Use free plan' };
  }
  if (e.includes('checkout') || e.includes('payment') && e.includes('start')) {
    return { message: "Couldn't launch the payment page. Try again or choose the free plan.", actionKey: 'freePlan', actionLabel: 'Use free plan' };
  }

  // ── Payment return / verification stage ──
  if (e.includes('payment') && e.includes('verif')) {
    return { message: "We couldn't confirm your payment. Try again or contact support.", actionKey: 'freePlan', actionLabel: 'Use free plan' };
  }
  if (e.includes('payment') && e.includes('failed')) {
    return { message: "Your payment didn't go through. Try again or start with the free plan.", actionKey: 'freePlan', actionLabel: 'Use free plan' };
  }
  if (e.includes('payment') && (e.includes('cancel') || e.includes('declin'))) {
    return { message: "Payment was cancelled. You can choose the free plan or try again.", actionKey: 'freePlan', actionLabel: 'Use free plan' };
  }

  // ── Rate limiting / network / server ──
  if (e.includes('too many') || e.includes('rate limit') || e.includes('throttle')) {
    return { message: 'Too many attempts. Wait a moment before trying again.' };
  }
  if (e.includes('network') || e.includes('connection') || e.includes('offline') || e.includes('fetch')) {
    return { message: "Couldn't reach the server. Check your internet connection and try again." };
  }
  if (e.includes('server error') || e.includes('500')) {
    return { message: 'Something went wrong on our end. Please try again.' };
  }

  return { message: errorStr };
}

export default function AuthOnboardingFlow({
  initialStep = ONBOARDING_STEPS.PROFILE,
  returnPath = '/',
  onDone,
}) {
  const navigate = useNavigate();
  const { user, isAuthenticated, checkAuth } = useAuth();
  const initialDraft = loadRegistrationDraft();
  const initialRegistrationSession = initialDraft?.registrationSession && typeof initialDraft.registrationSession === 'object'
    ? initialDraft.registrationSession
    : null;
  const [currentStep, setCurrentStep] = useState(normalizeUiStep(initialStep));
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [profileSubStep, setProfileSubStep] = useState(initialDraft?.profileSubStep || 'personal');

  const [profileForm, setProfileForm] = useState({
    full_name: '',
    institution_id: '',
    institution: '',
    affiliate_university: '',
    program: '',
    academic_program: '',
    level: '',
    semester: '',
    index_number: '',
  });

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [processingPlanId, setProcessingPlanId] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar_url || null);
  const [avatarError, setAvatarError] = useState('');
  const [academicCatalog, setAcademicCatalog] = useState(null);
  const [academicCatalogLoading, setAcademicCatalogLoading] = useState(false);
  const [completionSummary, setCompletionSummary] = useState(null);
  const [durationMonths, setDurationMonths] = useState(Number(initialDraft?.durationMonths) || 1);
  const [registrationSession, setRegistrationSession] = useState(initialRegistrationSession);
  const [selectedPlanId, setSelectedPlanId] = useState(
    initialDraft?.selectedPlanId ||
    user?.selected_plan_id ||
    initialRegistrationSession?.selected_plan_id ||
    null
  );
  const verifyInProgressRef = useRef(false);
  const handledReturnRef = useRef(false);

  const isRegistrationSessionMode = !isAuthenticated && Boolean(registrationSession?.id && registrationSession?.resume_token);

  useEffect(() => {
    setCurrentStep(normalizeUiStep(initialStep));
    setProfileSubStep('personal');
    setCompletionSummary(null);
  }, [initialStep]);

  useEffect(() => {
    if (!isRegistrationSessionMode) return undefined;
    let active = true;

    const run = async () => {
      try {
        const response = await authService.getRegistrationSession({
          registration_session_id: registrationSession.id,
          resume_token: registrationSession.resume_token,
        });
        const nextSession = response?.registration_session || null;
        if (!active || !nextSession) return;
        setRegistrationSession(nextSession);
        mergeRegistrationSessionDraft(nextSession, nextSession.next_step);
        if (!isDoneStep(nextSession.next_step)) {
          setCurrentStep(normalizeUiStep(nextSession.next_step));
        }
      } catch (err) {
        if (!active) return;
        clearRegistrationDraft();
        setRegistrationSession(null);
        setError(err.message || 'Registration session expired. Start again.');
      }
    };

    run();
    return () => {
      active = false;
    };
  }, [isRegistrationSessionMode, registrationSession?.id, registrationSession?.resume_token]);

  useEffect(() => {
    const draft = loadRegistrationDraft();
    const draftProfile = draft?.profileForm && typeof draft.profileForm === 'object'
      ? draft.profileForm
      : {};
    const sessionProgramName = registrationSession?.program_name || '';
    const sessionProgrammeCategory = registrationSession?.programme_category || '';

    setProfileForm({
      full_name: user?.full_name || user?.name || registrationSession?.full_name || draftProfile.full_name || '',
      institution_id: user?.institution_id || registrationSession?.institution_id || draftProfile.institution_id || '',
      institution: user?.institution || draftProfile.institution || '',
      affiliate_university: user?.affiliate_university || registrationSession?.affiliate_university || draftProfile.affiliate_university || '',
      program: user?.programme_category || sessionProgrammeCategory || draftProfile.program || '',
      academic_program: user?.academic_program || sessionProgramName || draftProfile.academic_program || '',
      level: user?.level || registrationSession?.level || draftProfile.level || '',
      semester: user?.semester || user?.current_semester || registrationSession?.semester || draftProfile.semester || '',
      index_number: formatIndexNumberInput(user?.index_number || registrationSession?.index_number || draftProfile.index_number || ''),
    });
  }, [
    user?.full_name,
    user?.name,
    user?.institution_id,
    user?.institution,
    user?.affiliate_university,
    user?.programme_category,
    user?.program,
    user?.academic_program,
    user?.level,
    user?.semester,
    user?.current_semester,
    user?.index_number,
    registrationSession?.affiliate_university,
    registrationSession?.full_name,
    registrationSession?.index_number,
    registrationSession?.institution_id,
    registrationSession?.level,
    registrationSession?.semester,
    registrationSession?.program_name,
    registrationSession?.programme_category,
  ]);

  useEffect(() => {
    const nextSelectedPlanId =
      registrationSession?.selected_plan_id ||
      user?.selected_plan_id ||
      null;
    if (nextSelectedPlanId) {
      setSelectedPlanId(nextSelectedPlanId);
    }
  }, [registrationSession?.selected_plan_id, user?.selected_plan_id]);

  useEffect(() => {
    saveRegistrationDraft({
      ...loadRegistrationDraft(),
      onboardingStep: currentStep,
      profileSubStep,
      profileForm,
      durationMonths,
      registrationSession,
      selectedPlanId,
      updatedAt: Date.now(),
    });
  }, [currentStep, durationMonths, profileForm, profileSubStep, registrationSession, selectedPlanId]);

  useEffect(() => {
    if (currentStep !== ONBOARDING_STEPS.PROFILE) return;
    if (!isAuthenticated && !isRegistrationSessionMode) return;
    let active = true;

    const run = async () => {
      setAcademicCatalogLoading(true);
      try {
        const response = isRegistrationSessionMode
          ? await authService.getRegistrationAcademicCatalog()
          : await api.me.getAcademicCatalog();
        if (!active) return;
        setAcademicCatalog(response?.data || null);
      } catch (err) {
        if (active) {
          setAcademicCatalog(null);
        }
      } finally {
        if (active) setAcademicCatalogLoading(false);
      }
    };

    run();
    return () => {
      active = false;
    };
  }, [currentStep, isAuthenticated, isRegistrationSessionMode]);

  useEffect(() => {
    if (currentStep !== ONBOARDING_STEPS.PLAN) return;
    if (!isAuthenticated && !isRegistrationSessionMode) return;
    let active = true;

    const run = async () => {
      setPlansLoading(true);
      try {
        const response = await api.subscription.getPlans();
        if (!active) return;
        const list = Array.isArray(response?.plans) ? response.plans : [];
        setPlans(list.sort((a, b) => Number(a.price || 0) - Number(b.price || 0)));
      } catch (err) {
        if (active) setPlans([]);
      } finally {
        if (active) setPlansLoading(false);
      }
    };

    run();
    return () => {
      active = false;
    };
  }, [currentStep, isAuthenticated, isRegistrationSessionMode]);

  const selectedPlan = useMemo(
    () => plans.find((plan) => String(plan.id) === String(selectedPlanId || '')) || null,
    [plans, selectedPlanId]
  );

  const paymentTotal = useMemo(() => {
    const price = Number(selectedPlan?.price || 0);
    return Number((price * durationMonths).toFixed(2));
  }, [selectedPlan?.price, durationMonths]);

  const universities = useMemo(
    () => Array.isArray(academicCatalog?.universities) ? academicCatalog.universities : [],
    [academicCatalog]
  );

  const colleges = useMemo(
    () => Array.isArray(academicCatalog?.colleges) ? academicCatalog.colleges : [],
    [academicCatalog]
  );

  const selectedCollege = useMemo(
    () => colleges.find((college) => String(college.id) === String(profileForm.institution_id)) || null,
    [colleges, profileForm.institution_id]
  );

  const universityOptions = useMemo(() => {
    const currentValue = String(profileForm.affiliate_university || '').trim();
    const options = new Map();

    universities.forEach((item) => {
      const value = String(item?.name || '').trim();
      if (!value) return;
      options.set(value, {
        value,
        label: String(item?.code || item?.name || '').trim() || value,
      });
    });

    if (currentValue && !options.has(currentValue)) {
      options.set(currentValue, {
        value: currentValue,
        label: currentValue,
      });
    }

    return Array.from(options.values());
  }, [universities, profileForm.affiliate_university]);

  const collegeOptions = useMemo(() => (
    colleges.filter((college) => (
      !profileForm.affiliate_university ||
      college.affiliate_university === profileForm.affiliate_university
    )).slice().sort((a, b) => (
      String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { sensitivity: 'base' })
    ))
  ), [colleges, profileForm.affiliate_university]);

  const programCategoryOptions = useMemo(() => {
    if (!selectedCollege) return [];
    return Array.isArray(selectedCollege.programme_categories)
      ? selectedCollege.programme_categories
      : [];
  }, [selectedCollege]);

  const academicProgramOptions = useMemo(() => {
    if (!profileForm.program) return [];
    const programsByCategory = academicCatalog?.programs_by_category || {};
    return Array.isArray(programsByCategory[profileForm.program])
      ? programsByCategory[profileForm.program]
      : [];
  }, [academicCatalog, profileForm.program]);

  const expectedProgramCode = useMemo(
    () => getProgramCategoryCode(profileForm.program),
    [profileForm.program]
  );

  const indexExample = useMemo(
    () => buildIndexNumberExample({
      collegeCode: deriveCollegeCode(selectedCollege),
      programCode: expectedProgramCode
    }),
    [expectedProgramCode, selectedCollege]
  );

  const registrationSessionPayload = useMemo(() => (
    registrationSession?.id && registrationSession?.resume_token
      ? {
          registration_session_id: registrationSession.id,
          resume_token: registrationSession.resume_token,
        }
      : null
  ), [registrationSession?.id, registrationSession?.resume_token]);

  const needsPasswordInPersonal = Boolean(
    isAuthenticated &&
    !isRegistrationSessionMode &&
    (user?.password_set === false || user?.passwordSet === false)
  );

  const finishAndEnterApp = async (path = returnPath) => {
    clearRegistrationDraft();
    try {
      await checkAuth(true);
    } catch (err) {
      // Fall through and let the app boot from persisted session state.
    }
    navigate(normalizeReturnPath(path), { replace: true });
    if (onDone) {
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => {
          onDone();
        });
      } else {
        onDone();
      }
    }
  };

  const handleGoToHome = () => {
    void finishAndEnterApp('/');
  };

  const buildCompletionSummary = async (meResponse = null) => {
    const mePayload = meResponse?.user || meResponse?.data?.user || meResponse?.data || meResponse || {};
    const subscriptionFromMe = mePayload?.subscription || meResponse?.subscription || null;

    let currentPlanResponse = null;
    try {
      currentPlanResponse = await api.subscription.getCurrentPlan();
    } catch (err) {
      currentPlanResponse = null;
    }

    const planFromApi = currentPlanResponse?.plan || currentPlanResponse?.data || null;
    const subscriptionFromApi = currentPlanResponse?.subscription || null;
    const effectivePlan = planFromApi || subscriptionFromMe?.plan || selectedPlan || {};
    const planName = String(
      effectivePlan?.name ||
      mePayload?.current_plan ||
      subscriptionFromMe?.plan_name ||
      selectedPlan?.name ||
      'Selected plan'
    );

    const features = normalizeFeatureList(
      effectivePlan?.features || selectedPlan?.features || mePayload?.plan_features
    );
    const planDescription = String(
      effectivePlan?.description ||
      selectedPlan?.description ||
      PLAN_DESCRIPTION_OVERRIDES[planName] ||
      ''
    ).trim();
    const fallbackFeatures = DEFAULT_PLAN_BENEFITS[planName] || [
      'Your selected plan has been activated',
      'Plan benefits are now available on your account',
    ];

    const renewalRaw = readField(
      [subscriptionFromApi, subscriptionFromMe, planFromApi, mePayload],
      DATE_FIELDS
    );
    const parsedRenewal = parseDateSafe(renewalRaw);
    const cycleMonths = Number(
      readField(
        [subscriptionFromApi, subscriptionFromMe, planFromApi, mePayload],
        DURATION_FIELDS
      ) || durationMonths || 1
    );

    const renewalDate = parsedRenewal || addMonths(new Date(), cycleMonths);
    const renewalIsEstimated = !parsedRenewal;

    const autoRenewValue = readField(
      [subscriptionFromApi, subscriptionFromMe, planFromApi, mePayload],
      AUTO_RENEW_FIELDS
    );
    const autoRenew =
      typeof autoRenewValue === 'boolean'
        ? autoRenewValue
        : subscriptionFromApi?.cancel_at_period_end === true || subscriptionFromMe?.cancel_at_period_end === true
          ? false
          : null;

    return {
      planName,
      planDescription,
      features: features.length ? features : fallbackFeatures,
      renewalDate,
      renewalIsEstimated,
      autoRenew,
      cycleMonths: Number.isFinite(cycleMonths) && cycleMonths > 0 ? cycleMonths : 1,
      paymentStatusLabel: 'Paid',
      renewalMessage: Number.isFinite(cycleMonths) && cycleMonths > 1
        ? `This plan will be renewed every ${cycleMonths} months.`
        : 'This plan will be renewed every month.',
    };
  };

  const completeIfDone = (nextStep, { redirectToHome = false } = {}) => {
    if (isDoneStep(nextStep)) {
      if (onDone) onDone();
      if (redirectToHome) {
        navigate('/', { replace: true });
      }
      return true;
    }
    return false;
  };

  const startPlanCheckout = async (planId, months = durationMonths) => {
    const checkoutReturnPath = buildOnboardingReturnPath(returnPath);
    const response = isRegistrationSessionMode
      ? await authService.checkoutRegistration({
          ...registrationSessionPayload,
          duration_months: months,
          return_path: checkoutReturnPath,
        })
      : await api.billing.checkout(planId || user?.selected_plan_id || null, months, {
          return_path: checkoutReturnPath,
        });
    if (!response?.authorization_url) {
      throw new Error(response?.error || 'Checkout URL not available');
    }
    window.location.assign(response.authorization_url);
  };

  const verifyPaymentReference = async (reference) => {
    if (!reference || verifyInProgressRef.current) {
      return;
    }

    verifyInProgressRef.current = true;
    setProcessing(true);
    setError('');
    setStatus('');

    try {
      await (isRegistrationSessionMode
        ? await authService.verifyRegistrationPayment({
            ...registrationSessionPayload,
            reference,
            provider: 'paystack',
          })
        : await api.payment.verify(reference, 'paystack', user?.selected_plan_id || null));
      setStatus('Payment confirmed. Activating your plan...');
      if (isRegistrationSessionMode) {
        await checkAuth(true);
        const me = await api.me.get();
        const next = normalizeUiStep(me?.next_step || ONBOARDING_STEPS.PLAN);

        if (isDoneStep(next)) {
          clearRegistrationDraft();
          const summary = await buildCompletionSummary(me);
          setCompletionSummary(summary);
          setStatus('');
        } else {
          setCurrentStep(next);
        }
      } else {
        await checkAuth(true);
        const me = await api.me.get();
        const next = normalizeUiStep(me?.next_step || ONBOARDING_STEPS.PLAN);

        if (isDoneStep(next)) {
          clearRegistrationDraft();
          const summary = await buildCompletionSummary(me);
          setCompletionSummary(summary);
          setStatus('');
        } else {
          setCurrentStep(next);
        }
      }
    } catch (err) {
      setCurrentStep(ONBOARDING_STEPS.PLAN);
      setStatus("You can go with the free plan and upgrade later if you can't pay now.");
      setError(err.message || 'Payment verification failed');
    } finally {
      verifyInProgressRef.current = false;
      setProcessing(false);
    }
  };

  useEffect(() => {
    if (currentStep !== ONBOARDING_STEPS.PLAN) return;
    if (handledReturnRef.current) return;

    const params = new URLSearchParams(window.location.search || '');
    const paystackStatus = String(params.get('status') || '').toLowerCase();
    const reference = readPaystackReferenceFromUrl();
    if (!reference) {
      if (paystackStatus.includes('cancel') || paystackStatus.includes('fail')) {
        handledReturnRef.current = true;
        clearPaystackReferenceFromUrl();
        setCurrentStep(ONBOARDING_STEPS.PLAN);
        setStatus("You can go with the free plan and upgrade later if you can't pay now.");
      }
      return;
    }

    handledReturnRef.current = true;
    clearPaystackReferenceFromUrl();
    verifyPaymentReference(reference);
  }, [currentStep, user?.selected_plan_id]);

  const AVATAR_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!AVATAR_ALLOWED_TYPES.includes(file.type)) {
      setAvatarError('Please choose a JPG, PNG, GIF, or WebP image. iPhone HEIC photos need to be converted first.');
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setAvatarError('Photo must be under 5 MB.');
      return;
    }
    try {
      // Read into memory immediately — iOS Safari file references can become
      // invalid after the native photo picker dismisses or the tab is backgrounded.
      const buffer = await file.arrayBuffer();
      const stable = new File([buffer], file.name, { type: file.type, lastModified: file.lastModified });
      setAvatarError('');
      setAvatarFile(stable);
      setAvatarPreview(URL.createObjectURL(stable));
    } catch {
      setAvatarError('Could not read this photo. Please try selecting it again.');
    }
  };

  const submitPersonalInfo = (event) => {
    event.preventDefault();
    setCompletionSummary(null);
    setError('');
    setStatus('');

    if (!profileForm.full_name.trim()) {
      setError('Please enter your full name to continue.');
      return;
    }
    if (!profileForm.index_number.trim()) {
      setError('Please enter your index number or application number.');
      return;
    }
    if (needsPasswordInPersonal) {
      if (password.length < 8) {
        setError('Password must be at least 8 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setProfileSubStep('academic');
  };

  const submitProfile = async (event) => {
    event.preventDefault();
    setCompletionSummary(null);
    setProcessing(true);
    setError('');
    setStatus('');

    try {
      if (needsPasswordInPersonal) {
        if (password.length < 8) {
          setError('Password must be at least 8 characters.');
          setProcessing(false);
          return;
        }
        if (password !== confirmPassword) {
          setError('Passwords do not match.');
          setProcessing(false);
          return;
        }
        await authService.createPassword(password);
      }

      if (avatarFile) {
        try {
          if (isRegistrationSessionMode && registrationSessionPayload) {
            await authService.uploadRegistrationAvatar({
              registration_session_id: registrationSessionPayload.registration_session_id,
              resume_token: registrationSessionPayload.resume_token,
              file: avatarFile,
            });
          } else {
            const formData = new FormData();
            formData.append('avatar', avatarFile);
            await api.user.updateAvatar(formData);
          }
          setAvatarError('');
        } catch (avatarErr) {
          // Don't block registration — the user can set their photo from Settings later.
          console.error('Avatar upload failed:', avatarErr);
          setAvatarError("We couldn't upload your photo right now. You can add one from Settings after signing up.");
          setAvatarFile(null);
        }
      }

      const payload = {
        full_name: profileForm.full_name.trim(),
        role: user?.role || 'student',
        institution_id: profileForm.institution_id || null,
        institution: profileForm.institution.trim(),
        affiliate_university: profileForm.affiliate_university.trim(),
        program: profileForm.program.trim(),
        academic_program: profileForm.academic_program.trim(),
        level: profileForm.level.trim(),
        semester: profileForm.semester.trim(),
        index_number: formatIndexNumberInput(profileForm.index_number, { showTrailingSeparator: false }),
      };
      const response = isRegistrationSessionMode
        ? await authService.completeRegistrationProfile({
            ...registrationSessionPayload,
            ...payload,
          })
        : await authService.completeProfile(payload);

      const next = response?.next_step || ONBOARDING_STEPS.PASSWORD;
      if (response?.registration_session) {
        setRegistrationSession(response.registration_session);
        mergeRegistrationSessionDraft(response.registration_session, next);
      }
      const normalizedNext = needsPasswordInPersonal && normalizeUiStep(next) === ONBOARDING_STEPS.PASSWORD
        ? ONBOARDING_STEPS.PLAN
        : normalizeUiStep(next);
      if (!completeIfDone(normalizedNext)) {
        setCurrentStep(normalizedNext);
        if (normalizedNext === ONBOARDING_STEPS.PROFILE) {
          setProfileSubStep('academic');
        }
      }
      if (response?.user) {
        await checkAuth(true);
      }
      if (needsPasswordInPersonal) {
        setPassword('');
        setConfirmPassword('');
        setShowPassword(false);
        setShowConfirmPassword(false);
      }
    } catch (err) {
      setError(err.message || 'Failed to complete profile');
    } finally {
      setProcessing(false);
    }
  };

  const submitPassword = async (event) => {
    event.preventDefault();
    setCompletionSummary(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setProcessing(true);
    setError('');
    setStatus('');
    try {
      const response = await authService.createPassword(password);
      const next = response?.next_step || ONBOARDING_STEPS.PLAN;
      if (!completeIfDone(next)) {
        setCurrentStep(normalizeUiStep(next));
      }
      await checkAuth(true);
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setShowConfirmPassword(false);
    } catch (err) {
      setError(err.message || 'Failed to create password');
    } finally {
      setProcessing(false);
    }
  };

  const selectPlan = async (plan) => {
    if (!plan?.id) return;

    setCompletionSummary(null);
    setProcessingPlanId(plan.id);
    setProcessing(true);
    setError('');
    setStatus('');

    try {
      const response = isRegistrationSessionMode
        ? await authService.selectRegistrationPlan({
            ...registrationSessionPayload,
            plan_id: plan.id,
          })
        : await authService.selectPlan(plan.id);
      setSelectedPlanId(plan.id);
      if (response?.registration_session) {
        setRegistrationSession(response.registration_session);
        mergeRegistrationSessionDraft(response.registration_session, response?.next_step || ONBOARDING_STEPS.PLAN);
      }
      if (response?.user) {
        await checkAuth(true);
      }

      const next = response?.next_step || (Number(plan.price || 0) <= 0
        ? ONBOARDING_STEPS.DONE
        : ONBOARDING_STEPS.PLAN);

      if (Number(plan.price || 0) <= 0) {
        if (isDoneStep(next)) {
          await finishAndEnterApp();
        } else {
          setCurrentStep(normalizeUiStep(next));
        }
        return;
      }

      setCurrentStep(normalizeUiStep(next === ONBOARDING_STEPS.DONE ? ONBOARDING_STEPS.PLAN : next));
      setStatus('Continue to payment to complete this plan.');
    } catch (err) {
      setError(err.message || 'Failed to select plan');
    } finally {
      setProcessingPlanId(null);
      setProcessing(false);
    }
  };

  const startCheckout = async () => {
    setCompletionSummary(null);
    setProcessing(true);
    setError('');
    setStatus('');
    try {
      await startPlanCheckout(selectedPlanId || user?.selected_plan_id || null, durationMonths);
    } catch (err) {
      setError(err.message || 'Failed to start checkout');
    } finally {
      setProcessing(false);
    }
  };

  const goToPersonalInfo = () => {
    setCompletionSummary(null);
    setError('');
    setStatus('');
    setCurrentStep(ONBOARDING_STEPS.PROFILE);
    setProfileSubStep('personal');
  };

  const goToPreviousStep = () => {
    if (profileSubStep === 'academic') {
      goToPersonalInfo();
      return;
    }
    if (currentStep === ONBOARDING_STEPS.PLAN) {
      setCompletionSummary(null);
      setError('');
      setStatus('');
      setCurrentStep(ONBOARDING_STEPS.PROFILE);
      setProfileSubStep('academic');
      return;
    }
    const currentIndex = STEP_SEQUENCE.indexOf(currentStep);
    if (currentIndex <= 0) return;
    setCompletionSummary(null);
    setError('');
    setStatus('');
    setCurrentStep(STEP_SEQUENCE[currentIndex - 1]);
  };

  const renderContent = () => (
    <OnboardingContent
      completionSummary={completionSummary}
      currentStep={currentStep}
      profileSubStep={profileSubStep}
      processing={processing}
      profileForm={profileForm}
      needsPasswordInPersonal={needsPasswordInPersonal}
      universities={universityOptions}
      selectedCollege={selectedCollege}
      colleges={colleges}
      collegeOptions={collegeOptions}
      collegesLoading={academicCatalogLoading}
      programCategoryOptions={programCategoryOptions}
      academicProgramOptions={academicProgramOptions}
      indexExample={indexExample}
      submitPersonalInfo={submitPersonalInfo}
      submitProfile={submitProfile}
      setProfileForm={setProfileForm}
      submitPassword={submitPassword}
      goToPersonalInfo={goToPersonalInfo}
      password={password}
      setPassword={setPassword}
      confirmPassword={confirmPassword}
      setConfirmPassword={setConfirmPassword}
      showPassword={showPassword}
      setShowPassword={setShowPassword}
      showConfirmPassword={showConfirmPassword}
      setShowConfirmPassword={setShowConfirmPassword}
      setError={setError}
      goToPreviousStep={goToPreviousStep}
      plansLoading={plansLoading}
      plans={plans}
      planDescriptionOverrides={PLAN_DESCRIPTION_OVERRIDES}
      selectedPlan={selectedPlan}
      processingPlanId={processingPlanId}
      durationMonths={durationMonths}
      setDurationMonths={setDurationMonths}
      paymentTotal={paymentTotal}
      startCheckout={startCheckout}
      selectPlan={selectPlan}
      handleGoToHome={handleGoToHome}
      avatarPreview={avatarPreview}
      onAvatarChange={handleAvatarChange}
      avatarError={avatarError}
    />
  );

  const resolvedError = error ? resolveOnboardingError(error) : null;
  const resolvedErrorHandler = resolvedError?.actionKey === 'freePlan' ? handleGoToHome : null;
  const visualStepIndex = currentStep === ONBOARDING_STEPS.PLAN
    ? 2
    : currentStep === ONBOARDING_STEPS.PROFILE && profileSubStep === 'academic'
      ? 1
      : 0;
  const visualSteps = ['Personal', 'Academic', 'Plan'];

  return (
    <div className="auth-modal auth-onboarding-modal">
      {!completionSummary ? (
        <>
          <div className="auth-stepper" role="progressbar" aria-label="Setup progress">
            {visualSteps.map((label, i) => {
              const status = i < visualStepIndex ? 'done' : i === visualStepIndex ? 'active' : '';
              return (
                <div key={label} className={`auth-step ${status}`}>
                  <span className="step-dot">{status === 'done' ? <FiCheck strokeWidth={2.5} /> : i + 1}</span>
                  <span>{label}</span>
                </div>
              );
            })}
          </div>
          {currentStep === ONBOARDING_STEPS.PLAN && <ContributionAppeal />}
          <div className="auth-panel-header">
            <h3>
              {currentStep === ONBOARDING_STEPS.PROFILE && profileSubStep === 'academic'
                ? 'Academic info'
                : STEP_TITLES[currentStep] || 'Finish your setup'}
            </h3>
            <p>
              {currentStep === ONBOARDING_STEPS.PROFILE && profileSubStep === 'academic'
                ? 'Select your college, program, and year of study.'
                : STEP_DESCRIPTIONS[currentStep] || 'Complete your account details.'}
            </p>
          </div>
        </>
      ) : null}

      <div className="auth-step-content">
        {renderContent()}
      </div>

      {status ? (
        <p className="auth-onboarding-status">{status}</p>
      ) : null}

      {resolvedError ? (
        <div className="error-message">
          <span className="error-icon">!</span>
          <span className="error-message-body">{resolvedError.message}</span>
          {resolvedErrorHandler ? (
            <button type="button" className="error-action-btn" onClick={resolvedErrorHandler}>
              {resolvedError.actionLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

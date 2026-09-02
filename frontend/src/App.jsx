import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import ErrorBoundary from './components/common/ErrorBoundary';
import Layout from './components/layout/Layout';
import { ContentProvider } from './components/contexts/ContentContext';
import {SubscriptionProvider} from './components/contexts/SubscriptionContext';
import {GamificationProvider} from './components/contexts/GamificationContext';
import {AnalyticsProvider} from './components/contexts/AnalyticsContext';
import {PLSProvider} from './components/contexts/PLSContext';
import AdminGuard from './components/auth/AdminGuard';
import ProtectedRoute from './components/auth/ProtectedRoute';
import RequireAcademicProfile from './components/auth/RequireAcademicProfile';
import AuthRedirect from './components/auth/AuthRedirect';
import AuthModal from './components/auth/AuthModal';
import { ONBOARDING_STEPS } from './utils/onboarding';
import NotFound from './components/common/NotFound';
import RouteFallback from './components/common/RouteFallback';
import ScrollToTop from './components/common/ScrollToTop';
import UpgradeModalHost from './components/subscription/UpgradeModalHost';
import ContributionModalHost from './components/subscription/ContributionModalHost';
import NotificationAlert from './components/common/NotificationAlert';
import ConfirmModal from './components/common/ConfirmModal';
import { useAuth } from './hooks/useAuth';
import { useAuthStore } from './store/authStore';
import { loadRegistrationDraft } from './utils/registrationDraft';
import api from './services/api';
import { applyThemePreference, getStoredThemePreference } from './utils/theme';
import { resumeUiAudioContext, playUiSound } from './utils/uiSounds';
import analyticsService from './services/analyticsService';
import { FEATURE_FLAGS } from './config/featureFlags';
import './styles/global.css';

const Home = lazy(() => import('./pages/Home'));
const LearnIndex = lazy(() => import('./pages/learn'));
const PracticeIndex = lazy(() => import('./pages/practice'));
const PracticeDetail = lazy(() => import('./pages/practice/PracticeDetail'));
const PracticeSession = lazy(() => import('./pages/practice/PracticeSession'));
const CourseDetail = lazy(() => import('./pages/learn/CourseDetail'));
const LessonViewer = lazy(() => import('./pages/learn/LessonViewer'));
const ResourcesIndex = lazy(() => import('./pages/Resources'));
const ResourceCategory = lazy(() => import('./pages/Resources/Category'));
const BlogIndex = lazy(() => import('./pages/Blog'));
const PostDetail = lazy(() => import('./pages/Blog/PostDetail'));
const SettingsIndex = lazy(() => import('./pages/Settings'));
const Profile = lazy(() => import('./pages/Settings/Profile'));
const Preferences = lazy(() => import('./pages/Settings/Preferences'));
const Eduvhibe = lazy(() => import('./pages/Eduvhibe/index'));
const Create = lazy(() => import('./pages/Create'));
const Contribute = lazy(() => import('./pages/Contribute'));
const StudyGroups = lazy(() => import('./pages/PLS/StudyGroups'));
const StudyGroupRoom = lazy(() => import('./pages/PLS/StudyGroupRoom'));
const About = lazy(() => import('./pages/About'));
const Features = lazy(() => import('./pages/Features'));
const Roadmap = lazy(() => import('./pages/Roadmap'));
const Forum = lazy(() => import('./pages/Forum'));
const Events = lazy(() => import('./pages/Events'));
const SuccessStories = lazy(() => import('./pages/SuccessStories'));
const CollegeRankings = lazy(() => import('./pages/CollegeRankings'));
const Spotlights = lazy(() => import('./pages/Spotlights'));
const Contact = lazy(() => import('./pages/Contact'));
const Terms = lazy(() => import('./pages/Terms'));
const Policies = lazy(() => import('./pages/Policies'));
const OurSocials = lazy(() => import('./pages/OurSocials'));
const Download = lazy(() => import('./pages/Download'));
const InviteFriends = lazy(() => import('./pages/InviteFriends'));
const Team = lazy(() => import('./pages/Team'));
const Report = lazy(() => import('./pages/Report'));
const FeatureRequests = lazy(() => import('./pages/FeatureRequests'));
const Investments = lazy(() => import('./pages/Investments'));
const Partnerships = lazy(() => import('./pages/Partnerships'));
const Join = lazy(() => import('./pages/Join'));
const Upgrade = lazy(() => import('./pages/Upgrade'));
const UserManual = lazy(() => import('./pages/UserManual'));
const InviteLanding = lazy(() => import('./pages/InviteLanding'));
const SevenDayStreak = lazy(() => import('./pages/Rewards/StreakChallenge'));
const ContributeEarn = lazy(() => import('./pages/Rewards/ContributeEarn'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const AdminDashboard = lazy(() => import('./pages/Admin'));
const ContentReview = lazy(() => import('./pages/Admin/ContentReview'));
const AdminAnalytics = lazy(() => import('./pages/Admin/Analytics'));
const CollegeSignals = lazy(() => import('./pages/Admin/CollegeSignals'));
const Progress = lazy(() => import('./pages/Progress'));
const NotificationsPage = lazy(() => import('./pages/Notifications'));
const GoogleOAuthCallback = lazy(() => import('./pages/GoogleOAuthCallback'));
const LecturerInvite = lazy(() => import('./pages/LecturerInvite'));

function PageViewTracker() {
  const location = useLocation();
  useEffect(() => {
    analyticsService.trackPageView(location.pathname, { search: location.search });
  }, [location.pathname]);
  return null;
}

/**
 * Redirect a dormant PLS route to its Learn/Practice replacement, preserving
 * the course slug (if any) plus query string and hash. PLS has been retired;
 * its study/practice content now lives under /learn and /practice.
 */
function PlsRedirect({ base }) {
  const { courseSlug } = useParams();
  const { search, hash } = useLocation();
  const target = `${base}${courseSlug ? `/${courseSlug}` : ''}${search || ''}${hash || ''}`;
  return <Navigate to={target} replace />;
}

function OnboardingModalRedirect({ step }) {
  const location = useLocation();

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('openAuthModal', {
        detail: { mode: 'register', forceOnboardingStep: step },
      })
    );
  }, [step]);

  return <Navigate to={`/${location.search || ''}${location.hash || ''}`} replace />;
}

function FullscreenAuthModalHost() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, nextStep, checkAuth } = useAuth();
  const { pathname } = location;
  const handledPaymentCallbackRef = useRef(new Set());
  const [state, setState] = useState({
    open: false,
    mode: 'login',
    forceOnboardingStep: null,
    lockOnboarding: false,
  });
  const isFullscreenRoute =
    /^\/groups\/[^/]+\/?$/.test(pathname) ||
    /^\/upgrade\/?$/.test(pathname) ||
    /^\/learn\/lesson\/[^/]+\/?$/.test(pathname) ||
    /^\/practice\/session\/[^/]+\/?$/.test(pathname);

  // Open onboarding modal after Google OAuth completes (pending step stored in sessionStorage)
  useEffect(() => {
    if (pathname === '/auth/google/callback') return;
    const raw = sessionStorage.getItem('sharether_pending_onboarding');
    if (!raw) return;
    try {
      const { step } = JSON.parse(raw);
      sessionStorage.removeItem('sharether_pending_onboarding');
      if (step && step !== ONBOARDING_STEPS.DONE) {
        setState({ open: true, mode: 'login', forceOnboardingStep: step, lockOnboarding: false });
      }
    } catch {
      sessionStorage.removeItem('sharether_pending_onboarding');
    }
  }, [pathname]);

  // Open auth modal on fullscreen routes via custom event
  useEffect(() => {
    if (!isFullscreenRoute) return undefined;

    const handleOpenAuthModal = (event) => {
      const detail = event?.detail;
      const nextMode =
        typeof detail === 'string'
          ? detail
          : detail?.mode || 'login';
      const nextOnboardingStep =
        typeof detail === 'object' && detail
          ? detail.forceOnboardingStep || null
          : null;

      setState({
        open: true,
        mode: nextMode,
        forceOnboardingStep: nextOnboardingStep,
        lockOnboarding: false,
      });
    };

    window.addEventListener('openAuthModal', handleOpenAuthModal);
    return () => window.removeEventListener('openAuthModal', handleOpenAuthModal);
  }, [isFullscreenRoute, pathname]);

  useEffect(() => {
    if (!isFullscreenRoute) return;

    const params = new URLSearchParams(location.search || '');
    const reference = params.get('reference') || params.get('trxref') || '';
    const status = String(params.get('status') || '').toLowerCase();
    const resumeOnboarding = String(params.get('resume_onboarding') || '').toLowerCase();
    const hasPaymentStatus =
      status.includes('success') ||
      status.includes('cancel') ||
      status.includes('fail') ||
      status.includes('abandon');
    const hasPaymentCallbackParams = Boolean(reference || hasPaymentStatus);
    const registrationDraft = loadRegistrationDraft();
    const shouldResumeOnboarding =
      resumeOnboarding === 'plan' &&
      (
        Boolean(
          registrationDraft?.registrationSession?.id &&
          registrationDraft?.registrationSession?.resume_token
        ) ||
        Boolean(registrationDraft?.onboardingStep || registrationDraft?.selectedPlanId) ||
        Boolean(isAuthenticated && nextStep && nextStep !== ONBOARDING_STEPS.DONE)
      );

    if (shouldResumeOnboarding) {
      setState({
        open: true,
        mode: isAuthenticated ? 'login' : 'register',
        forceOnboardingStep: ONBOARDING_STEPS.PLAN,
        lockOnboarding: false,
      });
      return;
    }

    if (!isAuthenticated || !hasPaymentCallbackParams) return;

    const callbackKey = `${pathname}|${status}|${reference}`;
    if (handledPaymentCallbackRef.current.has(callbackKey)) return;
    handledPaymentCallbackRef.current.add(callbackKey);

    const clearPaymentParamsFromUrl = () => {
      const nextParams = new URLSearchParams(location.search || '');
      nextParams.delete('reference');
      nextParams.delete('trxref');
      nextParams.delete('status');
      const nextSearch = nextParams.toString();
      navigate(`${pathname}${nextSearch ? `?${nextSearch}` : ''}${location.hash || ''}`, { replace: true });
    };

    const verifyUpgradePayment = async () => {
      try {
        if (status.includes('cancel') || status.includes('fail')) {
          await api.billing.cancelPending();
          await checkAuth(true);
          return;
        }
        if (reference) {
          await api.payment.verify(reference, 'paystack');
          await checkAuth(true);
        }
      } finally {
        clearPaymentParamsFromUrl();
      }
    };

    verifyUpgradePayment();
  }, [
    checkAuth,
    isAuthenticated,
    isFullscreenRoute,
    location.hash,
    location.search,
    navigate,
    nextStep,
    pathname,
  ]);

  return (
    <AuthModal
      isOpen={state.open}
      initialMode={state.mode}
      forceOnboardingStep={state.forceOnboardingStep}
      lockOnboarding={state.lockOnboarding}
      returnPath={`${location.pathname}${location.search || ''}${location.hash || ''}`}
      onClose={() =>
        setState((previous) => ({
          ...previous,
          open: false,
          forceOnboardingStep: null,
          lockOnboarding: false,
        }))
      }
    />
  );
}

function AcademicStateNoticeHost() {
  const { user, checkAuth } = useAuth();
  const navigate = useNavigate();
  const [dismissedKey, setDismissedKey] = useState(null);
  const [processing, setProcessing] = useState(false);
  const notice = user?.academic_state_notice || null;
  const isOpen = Boolean(notice?.key && dismissedKey !== notice.key);

  const closeNotice = async ({ openSettings = false } = {}) => {
    if (!notice?.key || processing) return;
    setProcessing(true);
    try {
      await api.me.markAcademicStateNoticeSeen(notice.key);
      setDismissedKey(notice.key);
      await checkAuth(true);
      if (openSettings) {
        navigate('/settings');
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <ConfirmModal
      isOpen={isOpen}
      title={notice?.title || 'Semester Updated'}
      message={notice?.message || 'Your college is now in Semester 2, so we have moved your courses to Semester 2. You can switch back in Settings.'}
      confirmLabel="Open Settings"
      cancelLabel="Got It"
      isProcessing={processing}
      onConfirm={() => closeNotice({ openSettings: true })}
      onCancel={() => closeNotice({ openSettings: false })}
    />
  );
}

function App() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    applyThemePreference(getStoredThemePreference());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const unlock = () => resumeUiAudioContext();
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let lastAt = 0;
    const handle = (e) => {
      const now = Date.now();
      if (now - lastAt < 55) return;
      const { target } = e;
      if (!target) return;

      // Checkbox/radio → toggle sound (checked state already flipped by browser)
      const checkbox = target.closest('input[type="checkbox"], input[type="radio"]');
      if (checkbox && !checkbox.disabled) {
        lastAt = now;
        playUiSound(checkbox.checked ? 'toggleOn' : 'toggleOff');
        return;
      }
      // Tab / pill selection
      const tabEl = target.closest('[role="tab"], .course-prelims-tabs button, .filter-pill, .pls-selection-pill');
      if (tabEl) { lastAt = now; playUiSound('tab'); return; }
      // Nav links
      const link = target.closest('a[href]');
      if (link) { lastAt = now; playUiSound('nav'); return; }
      // All other buttons
      const btn = target.closest('button, [role="button"], .btn');
      if (btn && !btn.disabled && !btn.hasAttribute('disabled')) {
        lastAt = now;
        playUiSound('click');
      }
    };
    document.addEventListener('click', handle);
    return () => document.removeEventListener('click', handle);
  }, []);

  return (
    <AnalyticsProvider>
      <SubscriptionProvider>
        <ContentProvider>
          <GamificationProvider>
            <PLSProvider>
              <ScrollToTop />
              <PageViewTracker />
              <UpgradeModalHost />
              <ContributionModalHost />
              <NotificationAlert />
              <FullscreenAuthModalHost />
              <AcademicStateNoticeHost />
              <RouteTree />
            </PLSProvider>
          </GamificationProvider>
        </ContentProvider>
      </SubscriptionProvider>
    </AnalyticsProvider>
  );
}

export default App;

/* ─── extracted so ErrorBoundary key resets on every navigation ─── */
function DeviceConflictModal({ onClose, onSignIn }) {
  return (
    <div className="device-conflict-overlay" role="dialog" aria-modal="true" aria-labelledby="device-conflict-title">
      <div className="device-conflict-modal">
        <div className="device-conflict-icon" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
          </svg>
        </div>
        <h2 id="device-conflict-title">Signed out</h2>
        <p>Your account was signed in on another device, so you have been signed out here.</p>
        <div className="device-conflict-actions">
          <button className="device-conflict-btn device-conflict-btn--primary" onClick={onSignIn}>Sign in again</button>
          <button className="device-conflict-btn device-conflict-btn--ghost" onClick={onClose}>Continue as guest</button>
        </div>
      </div>
    </div>
  );
}

function RouteTree() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [showDeviceConflict, setShowDeviceConflict] = useState(false);

  useEffect(() => {
    const handleSessionExpired = (event) => {
      const reason = event.detail?.reason;
      if (reason === 'device_conflict') {
        useAuthStore.getState().clearSession();
        setShowDeviceConflict(true);
      } else if (window.location.pathname !== '/login') {
        navigate('/login', { replace: true });
      }
    };
    window.addEventListener('sessionExpired', handleSessionExpired);
    return () => window.removeEventListener('sessionExpired', handleSessionExpired);
  }, [navigate]);

  return (
    <>
      {showDeviceConflict && (
        <DeviceConflictModal
          onClose={() => { setShowDeviceConflict(false); navigate('/', { replace: true }); }}
          onSignIn={() => { setShowDeviceConflict(false); navigate('/login', { replace: true }); }}
        />
      )}
    <ErrorBoundary key={pathname}>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Admin Routes — outside Layout so they get their own shell */}
          <Route path="admin">
            <Route index element={<AdminGuard><AdminDashboard /></AdminGuard>} />
            <Route path="content-review" element={<AdminGuard><ContentReview /></AdminGuard>} />
            <Route path="analytics" element={<AdminGuard><AdminAnalytics /></AdminGuard>} />
            <Route path="college-signals" element={<AdminGuard><CollegeSignals /></AdminGuard>} />
          </Route>

          <Route path="learn/lesson/:lessonId" element={<LessonViewer />} />
          <Route path="practice/session/:practiceId" element={<PracticeSession />} />
          {FEATURE_FLAGS.studyGroups && (
            <Route path="groups/:groupId" element={
              <ProtectedRoute feature="Study Group Room" message="Sign in to open study groups."><StudyGroupRoom /></ProtectedRoute>
            } />
          )}
          <Route path="lecturer-invite/:token" element={<LecturerInvite />} />
          {FEATURE_FLAGS.community && <Route path="forum" element={<Forum />} />}
          <Route path="auth/google/callback" element={<GoogleOAuthCallback />} />
          <Route path="upgrade" element={
            <ProtectedRoute feature="Plan Upgrade" message="Sign in to upgrade your plan."><Upgrade /></ProtectedRoute>
          } />

          <Route path="/" element={<Layout />}>
                    <Route index element={<Home />} />
                    <Route path="login" element={<AuthRedirect mode="login" />} />
                    <Route path="register" element={<AuthRedirect mode="register" />} />

                    <Route
                      path="onboarding/profile"
                      element={
                        <ProtectedRoute
                          mode="register"
                          allowIncompleteOnboarding
                          message="Sign in to finish your profile setup."
                          ctaLabel="Sign in"
                        >
                          <OnboardingModalRedirect step={ONBOARDING_STEPS.PROFILE} />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="onboarding/password"
                      element={
                        <ProtectedRoute
                          mode="register"
                          allowIncompleteOnboarding
                          message="Sign in to set up your password."
                          ctaLabel="Sign in"
                        >
                          <OnboardingModalRedirect step={ONBOARDING_STEPS.PASSWORD} />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="onboarding/plan"
                      element={
                        <ProtectedRoute
                          mode="register"
                          allowIncompleteOnboarding
                          message="Sign in to choose a plan."
                          ctaLabel="Sign in"
                        >
                          <OnboardingModalRedirect step={ONBOARDING_STEPS.PLAN} />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="onboarding/payment"
                      element={
                        <ProtectedRoute
                          mode="register"
                          allowIncompleteOnboarding
                          message="Sign in to finish payment setup."
                          ctaLabel="Sign in"
                        >
                          <OnboardingModalRedirect step={ONBOARDING_STEPS.PAYMENT} />
                        </ProtectedRoute>
                      }
                    />

                    {/* Learn Routes */}
                    <Route path="learn">
                      <Route index element={<RequireAcademicProfile><LearnIndex /></RequireAcademicProfile>} />
                      <Route path=":courseSlug" element={<RequireAcademicProfile><CourseDetail /></RequireAcademicProfile>} />
                    </Route>

                    <Route path="practice">
                      <Route index element={<RequireAcademicProfile><PracticeIndex /></RequireAcademicProfile>} />
                      <Route path=":courseSlug" element={<RequireAcademicProfile><PracticeDetail /></RequireAcademicProfile>} />
                    </Route>
                    
                    {/* PLS retired — redirect old URLs to Learn / Practice */}
                    <Route path="pls" element={<PlsRedirect base="/learn" />} />
                    <Route path="pls/study/:courseSlug" element={<PlsRedirect base="/learn" />} />
                    <Route path="pls/practice/:courseSlug" element={<PlsRedirect base="/practice" />} />
                    {FEATURE_FLAGS.studyGroups && (
                      <Route
                        path="groups"
                        element={
                          <ProtectedRoute feature="Study Groups" message="Sign in to join study groups.">
                            <StudyGroups />
                          </ProtectedRoute>
                        }
                      />
                    )}

                    {/* Resources Routes */}
                    <Route path="resources">
                      <Route index element={<ResourcesIndex />} />
                      <Route path=":category" element={<ResourceCategory />} />
                    </Route>

                    {/* Edutainment retired — its content now lives on Home. */}
                    <Route path="edutainment/*" element={<Navigate to="/" replace />} />

                    {/* Eduvhibe */}
                    <Route path="eduvhibe" element={<Eduvhibe />} />
                    
                    {/* Blog Routes */}
                    <Route path="blog">
                      <Route index element={<BlogIndex />} />
                      <Route path="post/:postId" element={<PostDetail />} />
                    </Route>
                    
                    {/* Settings Routes */}
                    <Route path="settings">
                      <Route index element={
                        <ProtectedRoute feature="Settings" message="Sign in to manage your settings.">
                          <SettingsIndex />
                        </ProtectedRoute>
                      } />
                      <Route path="profile" element={
                        <ProtectedRoute feature="Profile Settings" message="Sign in to update your profile.">
                          <Profile />
                        </ProtectedRoute>
                      } />
                      <Route path="preferences" element={
                        <ProtectedRoute feature="Preferences" message="Sign in to update your preferences.">
                          <Preferences />
                        </ProtectedRoute>
                      } />
                    </Route>
                    
                    
                    {/* Content creation */}
                    <Route path="create" element={<Create />} />
                    <Route path="user-manual" element={<UserManual />} />

                    {/* Footer Routes */}
                    <Route path="about" element={<About />} />
                    <Route path="features" element={<Features />} />
                    <Route path="roadmap" element={<Roadmap />} />
                    <Route path="events" element={<Events />} />
                    <Route path="success-stories" element={<SuccessStories />} />
                    {FEATURE_FLAGS.collegeRankings && (
                      <Route path="college-rankings" element={<CollegeRankings />} />
                    )}
                    <Route path="spotlights" element={<Spotlights />} />
                    <Route path="contact" element={<Contact />} />
                    <Route path="contribute" element={<Contribute />} />
                    <Route path="policies" element={<Policies />} />
                    <Route path="our-socials" element={<OurSocials />} />
                    <Route path="terms" element={<Terms />} />
                    <Route path="download" element={<Download />} />
                    <Route path="team" element={<Team />} />
                    <Route path="report" element={<Report />} />
                    <Route path="feature-requests" element={<FeatureRequests />} />
                    <Route path="investments" element={<Investments />} />
                    <Route path="partnerships" element={<Partnerships />} />
                    <Route path="join" element={<Join />} />
                   <Route path="progress" element={
                     <ProtectedRoute feature="Progress" message="Sign in to view your progress.">
                       <Progress />
                     </ProtectedRoute>
                   } />
                   <Route
                     path="notifications"
                     element={
                       <ProtectedRoute feature="Notifications" message="Sign in to view notifications.">
                         <NotificationsPage />
                       </ProtectedRoute>
                     }
                   />
                    <Route path="invite-friends" element={<InviteFriends />} />
                    <Route path="invite" element={<InviteLanding />} />
                    <Route path="seven-day-streak" element={<SevenDayStreak />} />
                    <Route path="contribute-to-earn" element={<ContributeEarn />} />
                    <Route path="reset-password" element={<ResetPassword />} />
                    
                    {/* 404 Route */}
                    <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
    </>
  );
}

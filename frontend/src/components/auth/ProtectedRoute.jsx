import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  ONBOARDING_STEPS,
  getNextOnboardingStep,
  hasFullAcademicProfile,
} from '../../utils/onboarding';
import FormModal from '../common/FormModal';
import GuestGateModal from './GuestGateModal';
import AcademicProfileGate from './AcademicProfileGate';

export default function ProtectedRoute({
  children,
  feature,
  message,
  mode = 'login',
  allowIncompleteOnboarding = false,
  requiresAcademicProfile = false,
}) {
  const { user, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const nextStep = getNextOnboardingStep(user);

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Loading Learnda...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <GuestGateModal feature={feature} message={message} />;
  }

  if (allowIncompleteOnboarding && nextStep === ONBOARDING_STEPS.DONE) {
    return <Navigate to="/learn" replace />;
  }

  // Progressive onboarding: programme-specific routes need a full academic
  // profile. Instead of hard-blocking, collect the deferred details inline the
  // first time the user opens this kind of content.
  if (requiresAcademicProfile && !hasFullAcademicProfile(user)) {
    // On success the auth store updates `user`, which re-renders this route and
    // reveals the gated content — no explicit navigation needed.
    return <AcademicProfileGate />;
  }

  if (nextStep !== ONBOARDING_STEPS.DONE && !allowIncompleteOnboarding) {
    return (
      <FormModal
        isOpen
        onClose={() => navigate('/')}
        title="Complete your Learnda profile"
        subtitle="Your registration is not finished yet. Complete the remaining steps to access this section."
        modalClassName="setup-required-modal"
      >
        <div className="setup-required-modal__body">
          <p>
            Learnda keeps academic tools, groups, and plan access tied to a complete student profile.
          </p>
          <div className="setup-required-modal__actions">
            <button
              className="btn btn-primary"
              type="button"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent('openAuthModal', {
                    detail: { mode, forceOnboardingStep: nextStep },
                  })
                )
              }
            >
              Finish registration
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => navigate('/')}
            >
              Back to home
            </button>
          </div>
        </div>
      </FormModal>
    );
  }

  return children;
}

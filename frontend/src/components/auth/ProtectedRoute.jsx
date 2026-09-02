import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  ONBOARDING_STEPS,
  getNextOnboardingStep,
  hasClassPlacement,
} from '../../utils/onboarding';
import FormModal from '../common/FormModal';
import GuestGateModal from './GuestGateModal';
import ClassPlacementPrompt from '../../pages/learn/ClassPlacementPrompt';

export default function ProtectedRoute({
  children,
  feature,
  message,
  mode = 'login',
  allowIncompleteOnboarding = false,
  requiresAcademicProfile = false,
}) {
  const { user, isAuthenticated, loading, checkAuth } = useAuth();
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

  // Progressive onboarding: class content needs a class (§5). Rather than
  // hard-blocking, ask for it inline the first time such content is opened.
  if (requiresAcademicProfile && !hasClassPlacement(user)) {
    // On success the auth store updates `user`, which re-renders this route and
    // reveals the gated content — no explicit navigation needed.
    return (
      <ClassPlacementPrompt
        mode={user?.class_level ? 'pathway' : 'class'}
        classLevel={user?.class_level || null}
        onPlaced={() => checkAuth?.(true)}
      />
    );
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

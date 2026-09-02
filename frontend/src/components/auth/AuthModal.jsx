import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Login from './Login';
import Register from './Register';
import AuthOnboardingFlow from './AuthOnboardingFlow';
import { useAuth } from '../../hooks/useAuth';
import { ONBOARDING_STEPS } from '../../utils/onboarding';
import { lockBodyScroll } from '../../utils/bodyScrollLock';
import { loadRegistrationDraft } from '../../utils/registrationDraft';
import { playUiSound } from '../../utils/uiSounds';
import './Auth.css';

const LOGO_SRC = `${import.meta.env.BASE_URL}learnda-logo.webp`;
const AUTH_BROWSER_THEME_COLOR = '#f6b450';

export default function AuthModal({
  isOpen = false,
  mode = 'login',
  initialMode = null,
  onClose,
  onSwitchMode,
  forceOnboardingStep = null,
  lockOnboarding = false,
  allowLockedDismiss = false,
  returnPath = '/',
}) {
  const { isAuthenticated, nextStep } = useAuth();
  const resolvedMode = initialMode || mode || 'login';
  const registrationDraft = loadRegistrationDraft();
  const savedDraftStep = registrationDraft?.onboardingStep || null;
  const hasDraftRegistrationSession = Boolean(
    registrationDraft?.registrationSession?.id &&
    registrationDraft?.registrationSession?.resume_token
  );
  const draftOnboardingStep = savedDraftStep && savedDraftStep !== ONBOARDING_STEPS.DONE &&
    (hasDraftRegistrationSession || (isAuthenticated && nextStep !== ONBOARDING_STEPS.DONE))
    ? savedDraftStep
    : isAuthenticated && nextStep && nextStep !== ONBOARDING_STEPS.DONE
      ? nextStep
      : null;
  const initialOnboardingStep = forceOnboardingStep && forceOnboardingStep !== ONBOARDING_STEPS.DONE
    ? forceOnboardingStep
    : draftOnboardingStep && draftOnboardingStep !== ONBOARDING_STEPS.DONE
      ? draftOnboardingStep
    : ONBOARDING_STEPS.PROFILE;
  const [authMode, setAuthMode] = useState(resolvedMode);
  const wasOpenRef = useRef(false);
  const [authContext, setAuthContext] = useState(null);
  const [flowMode, setFlowMode] = useState(
    (forceOnboardingStep && forceOnboardingStep !== ONBOARDING_STEPS.DONE) || draftOnboardingStep
      ? 'onboarding'
      : 'auth'
  );
  const [onboardingStep, setOnboardingStep] = useState(initialOnboardingStep);
  const isLockEnforced = lockOnboarding && !allowLockedDismiss;
  const isOnboardingFlow = flowMode === 'onboarding';
  const isLogin = authMode === 'login';

  const handleSwitch = (nextMode, nextContext = null) => {
    setFlowMode('auth');
    setAuthMode(nextMode);
    setAuthContext(nextContext);
    if (onSwitchMode) {
      onSwitchMode(nextMode, nextContext);
    }
  };

  const closeModalUi = useCallback(() => {
    if (isLockEnforced) {
      return;
    }
    setFlowMode('auth');
    setAuthContext(null);
    if (onClose) {
      onClose();
    }
  }, [isLockEnforced, onClose]);

  const handleAbort = useCallback(async () => {
    if (isLockEnforced) {
      return;
    }
    closeModalUi();
  }, [closeModalUi, isLockEnforced]);

  const handleAuthSuccess = useCallback((nextStep) => {
    if (authMode === 'register') {
      try {
        localStorage.setItem('learnda_device_registered_v1', '1');
      } catch {
        // Local storage can be blocked without blocking auth completion.
      }
    }
    if (!nextStep || nextStep === ONBOARDING_STEPS.DONE) {
      closeModalUi();
      return;
    }
    setOnboardingStep(nextStep);
    setFlowMode('onboarding');
  }, [authMode, closeModalUi]);

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget) {
      void handleAbort();
    }
  };

  useEffect(() => {
    if (!forceOnboardingStep || forceOnboardingStep === ONBOARDING_STEPS.DONE) return;
    setOnboardingStep(forceOnboardingStep);
    setFlowMode('onboarding');
  }, [forceOnboardingStep]);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      playUiSound('modalOpen');
    } else if (!isOpen && wasOpenRef.current) {
      playUiSound('modalClose');
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    if (typeof document === 'undefined') return undefined;
    const releaseBodyScroll = lockBodyScroll();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        void handleAbort();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      releaseBodyScroll();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleAbort, isOpen]);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return undefined;

    const themeColorMeta =
      document.getElementById('theme-color-meta') ||
      document.querySelector('meta[name="theme-color"]');
    if (!themeColorMeta) return undefined;

    const previousThemeColor = themeColorMeta.getAttribute('content');
    themeColorMeta.setAttribute('content', AUTH_BROWSER_THEME_COLOR);

    return () => {
      if (previousThemeColor) {
        themeColorMeta.setAttribute('content', previousThemeColor);
      } else {
        themeColorMeta.removeAttribute('content');
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setAuthMode(resolvedMode);
    setAuthContext(null);
    if (!forceOnboardingStep || forceOnboardingStep === ONBOARDING_STEPS.DONE) {
      if (draftOnboardingStep && draftOnboardingStep !== ONBOARDING_STEPS.DONE) {
        setOnboardingStep(draftOnboardingStep);
        setFlowMode('onboarding');
        return;
      }
      setFlowMode('auth');
    }
  }, [draftOnboardingStep, forceOnboardingStep, isOpen, resolvedMode]);

  if (!isOpen) {
    return null;
  }

  const modalContent = (
    <div className="auth-modal-overlay" onClick={handleOverlayClick}>
      <div
        className={`auth-modal-container ${isOnboardingFlow ? 'auth-onboarding-container' : ''}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label="Authentication"
      >
        <header className="auth-shell-header">
          <span className="auth-brand">
            <img src={LOGO_SRC} alt="" className="auth-brand-mark" />
            <span className="auth-brand-text">Learnda</span>
          </span>
          {!isLockEnforced ? (
            <button
              className="close-btn"
              type="button"
              onClick={() => {
                void handleAbort();
              }}
              aria-label="Close authentication"
            >
              &times;
            </button>
          ) : null}
        </header>
        <div className={`auth-layout ${isOnboardingFlow ? 'onboarding-active' : ''}`.trim()}>
          <div className="auth-panel">
            {isOnboardingFlow ? (
              <AuthOnboardingFlow
                initialStep={onboardingStep}
                returnPath={returnPath}
                onDone={closeModalUi}
              />
            ) : (
              isLogin ? (
                <Login
                  onClose={closeModalUi}
                  onSwitchToRegister={() => handleSwitch('register')}
                  onAuthSuccess={handleAuthSuccess}
                  initialContact={authContext?.prefillContact || ''}
                  initialContactMode={authContext?.prefillContactMode || 'email'}
                  initialStatusMessage={authContext?.statusMessage || ''}
                />
              ) : (
                <Register
                  onClose={closeModalUi}
                  onSwitchToLogin={(nextContext = null) => handleSwitch('login', nextContext)}
                  onAuthSuccess={handleAuthSuccess}
                />
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') {
    return modalContent;
  }

  const modalRoot = document.getElementById('modal-root');
  return createPortal(modalContent, modalRoot || document.body);
}

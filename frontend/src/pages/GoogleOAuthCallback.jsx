import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAnalytics } from '../hooks/useAnalytics';
import {
  getGoogleOAuthRedirectUri,
  GOOGLE_OAUTH_SESSION_KEYS,
} from '../services/googleIdentityService';
import {
  clearRegistrationDraft,
  loadRegistrationDraft,
  saveRegistrationDraft,
} from '../utils/registrationDraft';
import { ONBOARDING_STEPS } from '../utils/onboarding';
import { setLastLoginMethod } from '../utils/loginMethodPreference';
import './GoogleOAuthCallback.css';

function readReturnPayload() {
  try {
    const raw = sessionStorage.getItem(GOOGLE_OAUTH_SESSION_KEYS.RETURN);
    if (!raw) return { returnPath: '/', intent: 'login' };
    const parsed = JSON.parse(raw);
    return {
      returnPath: typeof parsed.returnPath === 'string' ? parsed.returnPath : '/',
      intent: parsed.intent === 'register' ? 'register' : 'login',
    };
  } catch {
    return { returnPath: '/', intent: 'login' };
  }
}

function clearGoogleOauthSession() {
  sessionStorage.removeItem(GOOGLE_OAUTH_SESSION_KEYS.STATE);
  sessionStorage.removeItem(GOOGLE_OAUTH_SESSION_KEYS.RETURN);
}

function friendlyGoogleError(message) {
  const text = String(message || '').toLowerCase();
  if (text.includes('cancel') || text.includes('access_denied')) {
    return 'Google sign-in was cancelled. You can try again whenever you are ready.';
  }
  if (text.includes('expired') || text.includes('state') || text.includes('missing')) {
    return 'That Google sign-in session expired or was interrupted. Please start again.';
  }
  if (text.includes('account') || text.includes('email')) {
    return 'We could not match that Google account. Try again or use email or phone instead.';
  }
  return 'We could not verify your Google sign-in. Please try again or use another sign-in method.';
}

export default function GoogleOAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithGoogle } = useAuth();
  const { trackEvent } = useAnalytics();
  const ranRef = useRef(false);
  const [error, setError] = useState('');
  const [intent, setIntent] = useState(() => readReturnPayload().intent);

  const openAuthModal = (mode) => {
    navigate(mode === 'register' ? '/register' : '/login', { replace: true });
  };

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const oauthError = searchParams.get('error');
    const code = searchParams.get('code');
    const urlState = searchParams.get('state');

    const fail = (message, eventSuffix = 'error') => {
      setError(friendlyGoogleError(message));
      clearGoogleOauthSession();
      trackEvent(`google_oauth_callback_${eventSuffix}`, { message });
    };

    if (oauthError) {
      if (oauthError === 'access_denied') {
        fail('Google sign-in was cancelled.', 'cancelled');
      } else {
        fail('Google sign-in could not complete. Please try again.', 'error');
      }
      return;
    }

    if (!code) {
      fail('Missing Google authorization. Please try signing in again.', 'missing_code');
      return;
    }

    const expectedState = sessionStorage.getItem(GOOGLE_OAUTH_SESSION_KEYS.STATE);
    if (!expectedState || expectedState !== urlState) {
      fail('Sign-in session expired or was interrupted. Please try again.', 'state_mismatch');
      return;
    }

    const returnPayload = readReturnPayload();
    setIntent(returnPayload.intent);
    const redirectUri = getGoogleOAuthRedirectUri();
    if (!redirectUri) {
      fail('Unable to complete sign-in in this environment.', 'no_redirect_uri');
      return;
    }

    (async () => {
      trackEvent('google_oauth_callback_attempt', { intent: returnPayload.intent });

      try {
        const result = await loginWithGoogle({ authorizationCode: code, redirectUri });

        clearGoogleOauthSession();

        if (!result.success) {
          setError(friendlyGoogleError(result.error));
          trackEvent('google_oauth_callback_failed', { reason: result.error });
          return;
        }

        setLastLoginMethod('google');
        trackEvent(
          returnPayload.intent === 'register' ? 'google_register_success' : 'google_login_success',
          {}
        );

        const nextStep = result.next_step;

        if (nextStep && nextStep !== ONBOARDING_STEPS.DONE) {
          if (returnPayload.intent === 'register') {
            saveRegistrationDraft({
              ...loadRegistrationDraft(),
              onboardingStep: nextStep,
              updatedAt: Date.now(),
            });
          }
          sessionStorage.setItem('sharether_pending_onboarding', JSON.stringify({ step: nextStep }));
          const dest =
            returnPayload.returnPath &&
            returnPayload.returnPath !== '/auth/google/callback'
              ? returnPayload.returnPath
              : '/';
          navigate(dest, { replace: true });
          return;
        }

        if (returnPayload.intent === 'register') {
          clearRegistrationDraft();
        }

        const dest =
          returnPayload.returnPath &&
          returnPayload.returnPath !== '/auth/google/callback'
            ? returnPayload.returnPath
            : '/';
        navigate(dest, { replace: true });
      } catch (e) {
        clearGoogleOauthSession();
        setError(friendlyGoogleError(e?.message));
        trackEvent('google_oauth_callback_error', { reason: e?.message });
      }
    })();
  }, [loginWithGoogle, navigate, searchParams, trackEvent]);

  return (
    <main className="auth-google-callback" aria-busy={!error}>
      <div className="auth-google-callback__backdrop" aria-hidden="true">
        <section className="auth-google-callback__hero">
          <div>
            <span className="auth-google-callback__tag">Sharether</span>
            <h1>Learn together, wherever you are.</h1>
            <p>Your courses, resources, practice, and progress in one calm learning space.</p>
          </div>
        </section>
        <section className="auth-google-callback__preview-grid">
          <span />
          <span />
          <span />
        </section>
      </div>

      {error ? (
        <section
          className="auth-google-callback__modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="google-callback-error-title"
        >
          <button
            type="button"
            className="auth-google-callback__close"
            onClick={() => navigate('/', { replace: true })}
            aria-label="Close"
          >
            x
          </button>
          <span className="auth-google-callback__error-mark" aria-hidden="true">!</span>
          <h1 id="google-callback-error-title">Google sign-in needs another try</h1>
          <p>{error}</p>
          <div className="auth-google-callback__actions">
            <button
              type="button"
              className="auth-google-callback__primary"
              onClick={() => openAuthModal(intent)}
            >
              Try Google again
            </button>
            <button
              type="button"
              className="auth-google-callback__secondary"
              onClick={() => openAuthModal(intent)}
            >
              Use email or phone
            </button>
          </div>
          <button
            type="button"
            className="auth-google-callback__link"
            onClick={() => navigate('/', { replace: true })}
          >
            Back to home
          </button>
        </section>
      ) : (
        <section className="auth-google-callback__loading" aria-live="polite">
          <img src="/sharether-logo.webp" alt="Sharether" />
          <span className="auth-google-callback__spinner" aria-hidden="true" />
          <h1>Signing you in...</h1>
          <p>Connecting your Google account securely.</p>
        </section>
      )}
    </main>
  );
}

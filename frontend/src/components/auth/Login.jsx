import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FcGoogle } from 'react-icons/fc';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { useAuth } from '../../hooks/useAuth';
import { useAnalytics } from '../../hooks/useAnalytics';
import { ONBOARDING_STEPS, getOnboardingRoute } from '../../utils/onboarding';
import { inferContactModeFromValue, sanitizeAuthContact } from '../../utils/authContact';
import { getLastLoginMethod, setLastLoginMethod } from '../../utils/loginMethodPreference';
import { loadGoogleIdentityScript, getGoogleOAuthRedirectUri, GOOGLE_OAUTH_SESSION_KEYS } from '../../services/googleIdentityService';
import './Auth.css';

function resolveLoginError(errorStr) {
  const e = (errorStr || '').toLowerCase();

  // ── Google sign-in ──
  if (e.includes('google')) {
    if (e.includes('cancelled') || e.includes('canceled')) {
      return { message: 'Google sign-in was cancelled. Try again or use email instead.', actionKey: 'email', actionLabel: 'Use email' };
    }
    return { message: "Couldn't connect to Google. Try logging in with email instead.", actionKey: 'email', actionLabel: 'Use email' };
  }

  // ── Credentials / password stage ──
  if (e.includes('invalid credentials') || e.includes('login failed') || (e.includes('password') && (e.includes('incorrect') || e.includes('wrong') || e.includes('invalid')))) {
    return { message: "That password didn't match. Double-check it or reset it.", actionKey: 'reset', actionLabel: 'Reset password' };
  }
  if (e.includes('not found') || e.includes('no account') || e.includes('not registered') || e.includes('does not exist')) {
    return { message: 'No account found with that email. Want to create one?', actionKey: 'register', actionLabel: 'Create account' };
  }
  if (e.includes('disabled') || e.includes('suspended') || e.includes('banned') || e.includes('deactivated')) {
    return { message: 'This account has been suspended. Contact support for help.' };
  }

  // ── Password reset — request stage ──
  if (e.includes('send') && (e.includes('reset') || e.includes('password'))) {
    return { message: "Couldn't send a reset code. Double-check the email address and try again." };
  }

  // ── Password reset — confirm stage ──
  if (e.includes('reset password') || (e.includes('unable to reset') || e.includes('reset failed'))) {
    return { message: "Couldn't update your password. The code may have expired — request a new one.", actionKey: 'resetRequest', actionLabel: 'Resend reset code' };
  }
  if (e.includes('passwords do not match') || e.includes("passwords don't match")) {
    return { message: "The two passwords don't match. Re-enter them and try again." };
  }
  if (e.includes('password') && (e.includes('short') || e.includes('least 8') || e.includes('characters'))) {
    return { message: 'Your password needs to be at least 8 characters long.' };
  }

  // ── Rate limiting / server ──
  if (e.includes('too many') || e.includes('rate limit') || e.includes('throttle')) {
    return { message: 'Too many attempts. Wait a moment before trying again.' };
  }
  if (e.includes('unexpected') || e.includes('something went wrong') || e.includes('server error') || e.includes('500')) {
    return { message: 'Something went wrong on our end. Please try again.' };
  }
  if (e.includes('network') || e.includes('connection') || e.includes('offline') || e.includes('fetch')) {
    return { message: "Couldn't reach the server. Check your internet connection and try again." };
  }

  return { message: errorStr };
}

export default function Login({
  onClose,
  onSwitchToRegister,
  onAuthSuccess = null,
  initialContact = '',
  initialContactMode = 'email',
  initialStatusMessage = '',
}) {
  const { login, forgotPasswordOtp, resetPasswordWithOtp } = useAuth();
  const { trackEvent } = useAnalytics();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [contactMode, setContactMode] = useState('email');
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetChallengeToken, setResetChallengeToken] = useState('');
  const [resetOtpCode, setResetOtpCode] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [lastUsedMethod, setLastUsedMethod] = useState(() => getLastLoginMethod());
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const isGoogleEnabled = Boolean(googleClientId);

  useEffect(() => {
    const nextMode = String(initialContactMode || 'email') === 'phone' ? 'phone' : 'email';
    const nextContact = sanitizeAuthContact(initialContact || '', nextMode);
    const nextStatus = String(initialStatusMessage || '').trim();

    if (nextContact) {
      setFormData((prev) => ({ ...prev, email: nextContact }));
      setContactMode(nextMode === 'phone' ? 'phone' : 'email');
    }

    if (nextStatus) {
      setStatusMessage(nextStatus);
    }
  }, [initialContact, initialContactMode, initialStatusMessage]);

  useEffect(() => {
    let isMounted = true;

    if (!isGoogleEnabled) {
      return () => {
        isMounted = false;
      };
    }

    // Preload the Google script so the button opens quickly when tapped.
    loadGoogleIdentityScript()
      .catch(() => {
        if (isMounted) {
          setError('Google sign-in is unavailable right now.');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isGoogleEnabled]);

  // The OAuth redirect leaves this page in the back/forward cache. If the
  // learner comes back with the Back button, clear the "Opening Google…" state.
  useEffect(() => {
    const handlePageShow = (event) => {
      if (event.persisted) setGoogleLoading(false);
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  const persistBrowserCredential = async (contact, password) => {
    try {
      const normalizedContact = sanitizeAuthContact(contact, inferContactModeFromValue(contact));
      if (!normalizedContact || !password) return;
      if (typeof window === 'undefined') return;
      if (!window.PasswordCredential || !navigator.credentials?.store) return;

      const credential = new window.PasswordCredential({
        id: normalizedContact,
        password,
        name: normalizedContact,
      });
      await navigator.credentials.store(credential);
    } catch {
      // No-op: browser support varies and this should never block login.
    }
  };

  const handleSuccessfulAuth = (nextStep) => {
    if (nextStep && nextStep !== ONBOARDING_STEPS.DONE) {
      if (onAuthSuccess) {
        onAuthSuccess(nextStep);
        return;
      }
      if (onClose) onClose();
      navigate(getOnboardingRoute(nextStep));
      return;
    }
    if (onClose) onClose();
    navigate('/', { replace: true });
  };

  const clearResetState = () => {
    setResetEmail('');
    setResetChallengeToken('');
    setResetOtpCode('');
    setResetPassword('');
    setResetConfirmPassword('');
    setShowResetPassword(false);
    setShowResetConfirmPassword(false);
  };

  const startResetFlow = () => {
    setIsResetMode(true);
    setResetEmail(sanitizeAuthContact(formData.email || '', contactMode));
    setError('');
    setStatusMessage('');
  };

  const backToSignInCredentials = ({ keepStatus = false } = {}) => {
    clearResetState();
    setIsResetMode(false);
    setError('');
    if (!keepStatus) {
      setStatusMessage('');
    }
  };

  const submitCredentials = async (contact, password, mode = contactMode) => {
    const normalizedContact = sanitizeAuthContact(contact, mode);
    setFormData((prev) => ({ ...prev, email: normalizedContact }));
    setLoading(true);
    setError('');

    try {
      trackEvent('login_attempt', {
        contact: normalizedContact,
        channel: inferContactModeFromValue(normalizedContact),
      });
      const result = await login(normalizedContact, password);

      if (result.success) {
        trackEvent('login_success', { contact: normalizedContact });
        const method = mode === 'phone' ? 'phone' : 'email';
        setLastLoginMethod(method);
        setLastUsedMethod(method);
        await persistBrowserCredential(normalizedContact, password);
        handleSuccessfulAuth(result.next_step);
      } else {
        setError(result.error || 'Login failed');
        trackEvent('login_failed', { contact: normalizedContact, reason: result.error });
      }
    } catch (err) {
      setError('An unexpected error occurred');
      trackEvent('login_error', { error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitCredentials = async (e) => {
    e.preventDefault();
    await submitCredentials(formData.email, formData.password, contactMode);
  };

  const handleRequestResetOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setStatusMessage('');

    try {
      const normalizedContact = sanitizeAuthContact(resetEmail || '', contactMode);
      setResetEmail(normalizedContact);
      const result = await forgotPasswordOtp(normalizedContact);
      const contactLabel = contactMode === 'phone' ? 'phone' : 'email';

      if (result.success && result.requires_otp) {
        setResetEmail(result.contact || result.email || normalizedContact);
        setResetChallengeToken(result.challenge_token || '');
        setResetOtpCode(result.dev_otp ? String(result.dev_otp) : '');
        setStatusMessage(`Enter the code from your ${contactLabel} and set a new password.`);
        trackEvent('password_reset_otp_sent', { contact: normalizedContact });
        return;
      }

      if (result.success) {
        setStatusMessage(result.message || 'If an account exists, a password reset code will be sent.');
      } else {
        setError(result.error || 'Unable to send password reset code.');
      }
    } catch (err) {
      setError(err?.message || 'Unable to send password reset code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetWithOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setStatusMessage('');

    try {
      const normalizedContact = sanitizeAuthContact(resetEmail || '', contactMode);
      setResetEmail(normalizedContact);
      if (resetPassword.length < 8) {
        setError('Password must be at least 8 characters.');
        return;
      }

      if (resetPassword !== resetConfirmPassword) {
        setError('Passwords do not match.');
        return;
      }

      const result = await resetPasswordWithOtp({
        email: normalizedContact,
        otp: resetOtpCode,
        challenge_token: resetChallengeToken,
        newPassword: resetPassword,
      });

      if (result?.success) {
        trackEvent('password_reset_otp_verify_success', { contact: normalizedContact });
        setFormData((prev) => ({
          ...prev,
          email: normalizedContact,
          password: '',
        }));
        backToSignInCredentials({ keepStatus: true });
        setStatusMessage(result.message || 'Password updated. Log in with your new password.');
        return;
      }

      setError(result?.error || 'Unable to reset password.');
      trackEvent('password_reset_otp_verify_failed', { contact: normalizedContact, reason: result?.error });
    } catch (err) {
      setError(err?.message || 'Unable to reset password.');
      trackEvent('password_reset_otp_verify_error', { error: err?.message });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleUnavailable = () => {
    setError(
      'Google sign-in is temporarily unavailable. Please use email or phone.'
    );
    trackEvent('google_login_unavailable', { reason: 'missing_client_id' });
  };

  const handleGoogleClick = async () => {
    if (googleLoading) return;
    if (!isGoogleEnabled || !googleClientId) {
      handleGoogleUnavailable();
      return;
    }

    setError('');
    setGoogleLoading(true);

    try {
      await loadGoogleIdentityScript();
      if (!window.google?.accounts?.oauth2) {
        throw new Error('Google OAuth client unavailable');
      }

      const state =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

      sessionStorage.setItem(GOOGLE_OAUTH_SESSION_KEYS.STATE, state);
      sessionStorage.setItem(
        GOOGLE_OAUTH_SESSION_KEYS.RETURN,
        JSON.stringify({
          returnPath: `${window.location.pathname}${window.location.search}`,
          intent: 'login',
        })
      );

      trackEvent('google_login_attempt');

      const client = window.google.accounts.oauth2.initCodeClient({
        client_id: googleClientId,
        scope: 'openid email profile',
        ux_mode: 'redirect',
        redirect_uri: getGoogleOAuthRedirectUri(),
        state,
      });

      client.requestCode();
    } catch (err) {
      setGoogleLoading(false);
      setError('Google sign-in is unavailable right now.');
      trackEvent('google_login_error', { error: err.message });
    }
  };

  const contactLabel = contactMode === 'phone' ? 'phone number' : 'email';
  let headerTitle = 'Welcome back';
  let headerSubtitle = 'Log in to continue to Learnda.';
  if (isResetMode && resetChallengeToken) {
    headerTitle = 'Create a new password';
    headerSubtitle = 'Enter the reset code and set your new password.';
  } else if (isResetMode) {
    headerTitle = 'Reset your password';
    headerSubtitle = `Enter your ${contactLabel} and we'll send a reset code.`;
  }

  const resolvedError = error ? resolveLoginError(error) : null;
  const resolvedErrorHandler = resolvedError?.actionKey
    ? ({
        reset: startResetFlow,
        register: onSwitchToRegister,
        resetRequest: handleRequestResetOtp,
      }[resolvedError.actionKey] ?? null)
    : null;

  return (
    <div className="auth-modal">
      {headerTitle ? (
        <div className="auth-panel-header">
          <h3>{headerTitle}</h3>
          <p>{headerSubtitle}</p>
        </div>
      ) : null}

      <div className="auth-email-stage">
          {!isResetMode ? (
            <>
              <div className="social-auth social-auth-standalone">
                {isGoogleEnabled ? (
                  <div className="google-custom-wrapper">
                    <button
                      type="button"
                      className="social-btn google google-custom-button auth-login-choice"
                      onClick={handleGoogleClick}
                      disabled={loading || googleLoading}
                      aria-busy={googleLoading}
                    >
                      <span className="social-btn__leading">
                        <span className="social-icon">{googleLoading ? <span className="spinner" aria-hidden="true" /> : <FcGoogle />}</span>
                        {googleLoading ? 'Opening Google…' : 'Continue with Google'}
                      </span>
                      {lastUsedMethod === 'google' ? (
                        <span className="auth-last-used-badge">Last used</span>
                      ) : null}
                    </button>
                  </div>
                ) : (
                  <button type="button" className="social-btn google auth-login-choice" onClick={handleGoogleUnavailable}>
                    <span className="social-btn__leading">
                      <span className="social-icon"><FcGoogle /></span>
                      Continue with Google
                    </span>
                    {lastUsedMethod === 'google' ? (
                      <span className="auth-last-used-badge">Last used</span>
                    ) : null}
                  </button>
                )}
              </div>

              <div className="auth-divider auth-social-divider">
                <span>or</span>
              </div>

            <form onSubmit={handleSubmitCredentials} className="auth-email-fallback" autoComplete="on">
              <div className="form-group">
                <label htmlFor="email">Email or phone number</label>
                <input
                  type="text"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={(e) => {
                    handleChange(e);
                    setContactMode(inferContactModeFromValue(e.target.value));
                  }}
                  onBlur={() => {
                    setFormData((prev) => ({
                      ...prev,
                      email: sanitizeAuthContact(prev.email, inferContactModeFromValue(prev.email)),
                    }));
                  }}
                  placeholder="name@example.com or 0241234567"
                  required
                  autoComplete="username"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <div className="auth-field-row">
                  <label htmlFor="password">Password</label>
                  <button
                    type="button"
                    className="text-link auth-inline-link"
                    onClick={startResetFlow}
                    disabled={loading}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="password-field">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                    autoCapitalize="none"
                    spellCheck={false}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    disabled={loading}
                  >
                    {showPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
              </div>

              <div className="auth-actions">
                <button
                  type="submit"
                  className="auth-btn primary"
                  disabled={loading || !formData.email || !formData.password}
                >
                  {loading ? (
                    <>
                      <span className="spinner"></span>
                      Logging in...
                    </>
                  ) : (
                    'Log in'
                  )}
                </button>
              </div>
            </form>
            </>
          ) : null}

          {isResetMode && !resetChallengeToken ? (
            <form onSubmit={handleRequestResetOtp} className="auth-email-fallback">
              <div className="form-group">
                <label htmlFor="resetEmail">
                  {contactMode === 'phone' ? 'Account phone number' : 'Account email'}
                </label>
                <input
                  type={contactMode === 'phone' ? 'tel' : 'email'}
                  id="resetEmail"
                  value={resetEmail}
                  onChange={(event) => {
                    setResetEmail(event.target.value);
                    setError('');
                  }}
                  onBlur={() => {
                    setResetEmail((current) => sanitizeAuthContact(current, contactMode));
                  }}
                  placeholder={contactMode === 'phone' ? '0241234567' : 'name@example.com'}
                  required
                  autoComplete={contactMode === 'phone' ? 'tel' : 'email'}
                  inputMode={contactMode === 'phone' ? 'tel' : 'email'}
                  disabled={loading}
                />
              </div>

              <p className="auth-reset-note">
                {contactMode === 'phone'
                  ? 'We will send a 6-digit reset OTP to this phone number.'
                  : 'We will send a 6-digit reset OTP to this email.'}
              </p>

              <div className="auth-actions">
                <button
                  type="button"
                  className="auth-btn secondary"
                  onClick={backToSignInCredentials}
                  disabled={loading}
                >
                  Back to Login
                </button>
                <button
                  type="submit"
                  className="auth-btn primary"
                  disabled={loading || !resetEmail}
                >
                  {loading ? (
                    <>
                      <span className="spinner"></span>
                      Sending Code...
                    </>
                  ) : (
                    'Send Reset OTP'
                  )}
                </button>
              </div>
            </form>
          ) : null}

          {isResetMode && resetChallengeToken ? (
            <form onSubmit={handleResetWithOtp} className="auth-email-fallback">
              <div className="form-group">
                <label htmlFor="resetOtpCode">Reset code</label>
                <input
                  type="text"
                  id="resetOtpCode"
                  className="otp-input"
                  value={resetOtpCode}
                  onChange={(event) => {
                    const next = event.target.value.replace(/\D/g, '').slice(0, 6);
                    setResetOtpCode(next);
                    setError('');
                  }}
                  placeholder="123456"
                  required
                  autoComplete="one-time-code"
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="resetPassword">New password</label>
                <div className="password-field">
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    id="resetPassword"
                    value={resetPassword}
                    onChange={(event) => {
                      setResetPassword(event.target.value);
                      setError('');
                    }}
                    placeholder="At least 8 characters"
                    required
                    autoComplete="new-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowResetPassword((prev) => !prev)}
                    aria-label={showResetPassword ? 'Hide password' : 'Show password'}
                    disabled={loading}
                  >
                    {showResetPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="resetConfirmPassword">Confirm new password</label>
                <div className="password-field">
                  <input
                    type={showResetConfirmPassword ? 'text' : 'password'}
                    id="resetConfirmPassword"
                    value={resetConfirmPassword}
                    onChange={(event) => {
                      setResetConfirmPassword(event.target.value);
                      setError('');
                    }}
                    placeholder="Repeat your new password"
                    required
                    autoComplete="new-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowResetConfirmPassword((prev) => !prev)}
                    aria-label={showResetConfirmPassword ? 'Hide password' : 'Show password'}
                    disabled={loading}
                  >
                    {showResetConfirmPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
              </div>

              <div className="auth-actions">
                <button
                  type="button"
                  className="auth-btn secondary"
                  onClick={handleRequestResetOtp}
                  disabled={loading}
                >
                  Resend Code
                </button>
                <button
                  type="submit"
                  className="auth-btn primary"
                  disabled={loading || resetOtpCode.length !== 6 || !resetPassword || !resetConfirmPassword}
                >
                  {loading ? (
                    <>
                      <span className="spinner"></span>
                      Updating...
                    </>
                  ) : (
                    'Update Password'
                  )}
                </button>
              </div>
            </form>
          ) : null}
        </div>

      {statusMessage && (
        <div className="success-message">
          {statusMessage}
        </div>
      )}

      {resolvedError && (
        <div className="error-message">
          <span className="error-icon">!</span>
          <span className="error-message-body">{resolvedError.message}</span>
          {resolvedErrorHandler && (
            <button type="button" className="error-action-btn" onClick={resolvedErrorHandler}>
              {resolvedError.actionLabel}
            </button>
          )}
        </div>
      )}

      <div className="auth-footer">
        <p>
          Don't have an account?{' '}
          <button
            type="button"
            className="text-link"
            onClick={onSwitchToRegister}
            disabled={loading}
          >
            Register
          </button>
        </p>
      </div>
    </div>
  );
}

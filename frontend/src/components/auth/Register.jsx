import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { FcGoogle } from 'react-icons/fc';
import { FiArrowLeft, FiEye, FiEyeOff } from 'react-icons/fi';
import { useAuth } from '../../hooks/useAuth';
import { useAnalytics } from '../../hooks/useAnalytics';
import { ONBOARDING_STEPS, getOnboardingRoute } from '../../utils/onboarding';
import {
  clearRegistrationDraft,
  loadRegistrationDraft,
  saveRegistrationDraft,
} from '../../utils/registrationDraft';
import { inferContactModeFromValue, sanitizeAuthContact } from '../../utils/authContact';
import { loadGoogleIdentityScript, getGoogleOAuthRedirectUri, GOOGLE_OAUTH_SESSION_KEYS } from '../../services/googleIdentityService';
import './Auth.css';

const inferChannel = (contact = '') => (
  inferContactModeFromValue(contact)
);

const RESEND_OTP_DELAY_SECONDS = 40;

function resolveRegisterError(errorStr, resendCountdown) {
  const e = (errorStr || '').toLowerCase();

  // ── Google sign-up ──
  if (e.includes('google')) {
    if (e.includes('cancelled') || e.includes('canceled')) {
      return { message: 'Google sign-up was cancelled. Try again or use email instead.', actionKey: 'email', actionLabel: 'Use email' };
    }
    return { message: "Couldn't connect to Google. Try registering with email instead.", actionKey: 'email', actionLabel: 'Use email' };
  }

  // ── Contact entry stage ──
  if (e.includes('already registered') || e.includes('already exists') || e.includes('already in use') || e.includes('account exists') || e.includes('email already') || e.includes('phone already')) {
    return { message: 'Looks like you already have an account.', actionKey: 'login', actionLabel: 'Login instead' };
  }
  if (e.includes('invalid email') || e.includes('invalid phone') || e.includes('invalid contact') || (e.includes('invalid') && e.includes('format'))) {
    return { message: "That doesn't look like a valid email or phone number. Check it and try again." };
  }
  if (e.includes('contact') && e.includes('required')) {
    return { message: 'Please enter your email address or phone number to continue.' };
  }
  if (e.includes('failed to start') || e.includes('start registration')) {
    return { message: "Couldn't start your registration. Check your details and try again." };
  }

  // ── OTP / resend stage ──
  if (e.includes('resend') || (e.includes('send') && e.includes('code'))) {
    return { message: "Couldn't resend the code. Check your connection and try again." };
  }
  if (e.includes('registration challenge') && e.includes('not found')) {
    return {
      message: 'Your verification code has expired. Click on Resend OTP to get a new one.',
      actionKey: 'resend',
      actionLabel: 'Resend OTP',
    };
  }
  if (e.includes('invalid code') || e.includes('wrong code') || e.includes('incorrect code') || e.includes('code') && e.includes('match')) {
    const canResend = resendCountdown === 0;
    return {
      message: "That code didn't match. Double-check the digits or request a new one.",
      ...(canResend ? { actionKey: 'resend', actionLabel: 'Resend code' } : {}),
    };
  }
  if (e.includes('code') && e.includes('expired')) {
    return { message: 'That code has expired. Request a new one to continue.', actionKey: 'resend', actionLabel: 'Resend code' };
  }

  // ── Service unavailable (email/SMS not configured in production) ──
  if (e.includes('delivery is currently unavailable') || e.includes('unavailable. please try again')) {
    return { message: "We couldn't send a verification code right now. Please try again in a few minutes." };
  }

  // ── Identity completion stage (OTP + password) ──
  if (e.includes('otp') || e.includes('verification') || e.includes('complete identity') || e.includes('identity setup')) {
    const canResend = resendCountdown === 0;
    return {
      message: "That verification step didn't go through. Check your code or try resending.",
      ...(canResend ? { actionKey: 'resend', actionLabel: 'Resend code' } : {}),
    };
  }
  if (e.includes('session') && (e.includes('not found') || e.includes('expired') || e.includes('invalid'))) {
    return { message: 'Your session expired. Please start the registration again.', actionKey: 'restart', actionLabel: 'Start over' };
  }
  if (e.includes('password') && (e.includes('short') || e.includes('least 8') || e.includes('characters'))) {
    return { message: 'Your password needs to be at least 8 characters long.' };
  }
  if (e.includes('passwords') && (e.includes('match') || e.includes('same'))) {
    return { message: "The two passwords don't match. Re-enter them and try again." };
  }

  // ── Rate limiting / server ──
  if (e.includes('too many') || e.includes('rate limit') || e.includes('throttle')) {
    return { message: 'Too many attempts. Wait a moment before trying again.' };
  }
  if (e.includes('registration') && e.includes('failed')) {
    return { message: 'Registration hit a snag. Please try again.' };
  }
  if (e.includes('server error') || e.includes('500')) {
    return { message: 'Something went wrong on our end. Please try again.' };
  }
  if (e.includes('network') || e.includes('connection') || e.includes('offline') || e.includes('fetch')) {
    return { message: "Couldn't reach the server. Check your internet connection and try again." };
  }

  return { message: errorStr };
}

export default function Register({ onClose, onSwitchToLogin, onAuthSuccess = null }) {
  const { register, resendRegisterOtp, verifyRegisterOtp } = useAuth();
  const { trackEvent } = useAnalytics();
  const navigate = useNavigate();
  const [contact, setContact] = useState('');
  const [loading, setLoading] = useState(false);
  const [contactMode, setContactMode] = useState('email');
  const [challengeToken, setChallengeToken] = useState('');
  const [activeContact, setActiveContact] = useState('');
  const [maskedContact, setMaskedContact] = useState('');
  const [channel, setChannel] = useState('email');
  const [otpVerificationRequired, setOtpVerificationRequired] = useState(true);
  const [otpCode, setOtpCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [errors, setErrors] = useState({});
  const [statusMessage, setStatusMessage] = useState('');
  const [otpCheckStatus, setOtpCheckStatus] = useState('idle'); // idle | checking | valid | invalid
  const [otpCheckError, setOtpCheckError] = useState('');
  const otpCheckAbortRef = useRef(null);
  const [isGoogleReady, setIsGoogleReady] = useState(false);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const isGoogleEnabled = Boolean(googleClientId);

  useEffect(() => {
    const draft = loadRegistrationDraft();
    if (!draft || typeof draft !== 'object') return;
    const draftContactMode = String(draft.contactMode || 'email');

    setContact(sanitizeAuthContact(draft.contact || '', draftContactMode));
    setContactMode(draftContactMode);
    setChallengeToken(String(draft.challengeToken || ''));
    setActiveContact(sanitizeAuthContact(draft.activeContact || '', draft.channel || draftContactMode));
    setMaskedContact(String(draft.maskedContact || ''));
    setChannel(String(draft.channel || 'email'));
    setOtpVerificationRequired(draft.otpVerificationRequired !== false);
    setOtpCode(String(draft.otpCode || ''));
    setStatusMessage(String(draft.statusMessage || ''));
  }, []);

  useEffect(() => {
    saveRegistrationDraft({
      contact,
      showIdentityForm: Boolean(challengeToken || activeContact),
      contactMode,
      challengeToken,
      activeContact,
      maskedContact,
      channel,
      otpVerificationRequired,
      otpCode,
      statusMessage,
      updatedAt: Date.now(),
    });
  }, [
    contact,
    contactMode,
    challengeToken,
    activeContact,
    maskedContact,
    channel,
    otpVerificationRequired,
    otpCode,
    statusMessage,
  ]);

  useEffect(() => {
    if (!resendCountdown) return undefined;
    const timer = window.setTimeout(() => {
      setResendCountdown((current) => Math.max(current - 1, 0));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [resendCountdown]);

  const isOtpStepVisible = Boolean(challengeToken && otpVerificationRequired);

  useEffect(() => {
    if (otpCheckAbortRef.current) {
      otpCheckAbortRef.current = false;
    }
    if (!isOtpStepVisible || otpCode.length !== 6) {
      setOtpCheckStatus('idle');
      setOtpCheckError('');
      return undefined;
    }
    let cancelled = false;
    otpCheckAbortRef.current = () => { cancelled = true; };
    setOtpCheckStatus('checking');
    setOtpCheckError('');
    api.auth.checkRegisterOtp({ contact: activeContact, otp: otpCode, challenge_token: challengeToken })
      .then((result) => {
        if (cancelled) return;
        if (result.valid) {
          setOtpCheckStatus('valid');
        } else {
          setOtpCheckStatus('invalid');
          setOtpCheckError(result.error || 'That code is incorrect.');
        }
      })
      .catch(() => {
        if (cancelled) return;
        setOtpCheckStatus('idle');
      });
    return () => { cancelled = true; };
  }, [otpCode, isOtpStepVisible, activeContact, challengeToken]);

  useEffect(() => {
    let isMounted = true;

    if (!isGoogleEnabled) {
      return () => {
        isMounted = false;
      };
    }

    loadGoogleIdentityScript()
      .then(() => {
        if (isMounted) setIsGoogleReady(true);
      })
      .catch(() => {
        if (isMounted) {
          setIsGoogleReady(false);
          setErrors({ submit: 'Google sign-up is unavailable right now.' });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isGoogleEnabled]);

  const handleSuccessfulAuth = (nextStep, fallbackStep = null) => {
    const resolvedNextStep =
      nextStep && nextStep !== ONBOARDING_STEPS.DONE
        ? nextStep
        : fallbackStep;

    if (resolvedNextStep && resolvedNextStep !== ONBOARDING_STEPS.DONE) {
      saveRegistrationDraft({
        ...loadRegistrationDraft(),
        onboardingStep: resolvedNextStep,
        updatedAt: Date.now(),
      });
      if (onAuthSuccess) {
        onAuthSuccess(resolvedNextStep);
        return;
      }
      if (onClose) onClose();
      navigate(getOnboardingRoute(resolvedNextStep));
      return;
    }
    clearRegistrationDraft();
    if (onClose) onClose();
    navigate('/', { replace: true });
  };

  const clearIdentityState = () => {
    setChallengeToken('');
    setActiveContact('');
    setMaskedContact('');
    setChannel('email');
    setOtpVerificationRequired(true);
    setOtpCode('');
    setFullName('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setResendCountdown(0);
    setStatusMessage('');
    setErrors({});
  };

  const handleGoogleUnavailable = () => {
    setErrors({
      submit:
        'Google sign-up is not configured. Set VITE_GOOGLE_CLIENT_ID on the frontend and redeploy.',
    });
    trackEvent('google_register_unavailable', { reason: 'missing_client_id' });
  };

  const handleGoogleClick = async () => {
    if (!isGoogleEnabled || !googleClientId) {
      handleGoogleUnavailable();
      return;
    }
    if (!isGoogleReady) {
      setErrors({ submit: 'Google sign-up is still loading. Try again in a moment.' });
      trackEvent('google_register_unavailable', { reason: 'not_ready' });
      return;
    }

    setErrors({});

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
          intent: 'register',
        })
      );

      trackEvent('google_register_attempt');

      const client = window.google.accounts.oauth2.initCodeClient({
        client_id: googleClientId,
        scope: 'openid email profile',
        ux_mode: 'redirect',
        redirect_uri: getGoogleOAuthRedirectUri(),
        state,
      });

      client.requestCode();
    } catch (err) {
      setErrors({ submit: 'Google sign-up is unavailable right now.' });
      trackEvent('google_register_error', { error: err.message });
    }
  };

  const handleStartIdentity = async (event) => {
    event.preventDefault();
    const normalizedContact = sanitizeAuthContact(contact, contactMode);
    if (!normalizedContact) {
      setErrors({ contact: 'Email or phone number is required' });
      return;
    }

    setContact(normalizedContact);
    setLoading(true);
    setErrors({});
    setStatusMessage('');

    try {
      trackEvent('register_identity_started', { channel: inferChannel(normalizedContact) });
      const result = await register({ contact: normalizedContact });

      if (result.requires_otp) {
        const nextContact = sanitizeAuthContact(
          result.contact || normalizedContact,
          result.channel || inferChannel(result.contact || normalizedContact)
        );
        const nextSession = result.registration_session || {};
        setChallengeToken(result.challenge_token || '');
        setActiveContact(nextContact);
        setMaskedContact(result.masked_contact || nextContact);
        setChannel(result.channel || inferChannel(nextContact));
        setOtpVerificationRequired(result.otp_verification_required !== false);
        setOtpCode(result.dev_otp ? String(result.dev_otp) : '');
        setResendCountdown(Math.max(Number(result.can_resend_in || 0), RESEND_OTP_DELAY_SECONDS));
        setStatusMessage('');
        setPassword('');
        setConfirmPassword('');
        setShowPassword(false);
        setShowConfirmPassword(false);
        saveRegistrationDraft({
          ...loadRegistrationDraft(),
          registrationSession: {
            ...(loadRegistrationDraft()?.registrationSession || {}),
            id: nextSession.id || loadRegistrationDraft()?.registrationSession?.id || '',
            next_step: nextSession.next_step || '',
          },
        });
        trackEvent('register_otp_sent', {
          channel: result.channel || inferChannel(nextContact),
          verificationRequired: result.otp_verification_required !== false,
        });
        return;
      }

      if (result.resume_available) {
        clearRegistrationDraft();
        if (onSwitchToLogin) {
          onSwitchToLogin({
            prefillContact: sanitizeAuthContact(
              result.contact || normalizedContact,
              result.channel || inferChannel(result.contact || normalizedContact)
            ),
            prefillContactMode: result.channel || inferChannel(result.contact || normalizedContact),
            statusMessage: result.error || 'Enter your password to continue setup.',
          });
          return;
        }
      }

      setErrors({ submit: result.error || 'Failed to start registration' });
    } catch (error) {
      setErrors({ submit: error.message || 'Failed to start registration' });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!otpVerificationRequired || !activeContact || !challengeToken || resendCountdown > 0) return;

    setLoading(true);
    setErrors({});
    setStatusMessage('');

    try {
      const result = await resendRegisterOtp({
        contact: activeContact,
        challenge_token: challengeToken,
      });

      if (result.success) {
        setChallengeToken(result.challenge_token || challengeToken);
        setMaskedContact(result.masked_contact || maskedContact || activeContact);
        setOtpCode(result.dev_otp ? String(result.dev_otp) : '');
        setResendCountdown(Math.max(Number(result.can_resend_in || 0), RESEND_OTP_DELAY_SECONDS));
        setStatusMessage(result.message || 'A new verification code has been sent.');
        trackEvent('register_otp_resent', { channel });
        return;
      }

      setErrors({ submit: result.error || 'Unable to resend verification code' });
    } catch (error) {
      setErrors({ submit: error.message || 'Unable to resend verification code' });
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteIdentity = async (event) => {
    event.preventDefault();

    if (isOtpStepVisible && otpCode.length !== 6) {
      setErrors({ otp: 'Enter the 6-digit verification code' });
      return;
    }
    if (!fullName.trim()) {
      setErrors({ fullName: 'Enter your name' });
      return;
    }
    if (password.length < 8) {
      setErrors({ password: 'Password must be at least 8 characters' });
      return;
    }
    if (password !== confirmPassword) {
      setErrors({ confirmPassword: 'Passwords do not match' });
      return;
    }

    setLoading(true);
    setErrors({});
    setStatusMessage('');

    try {
      trackEvent('register_identity_complete_attempt', { channel });
      const result = await verifyRegisterOtp({
        contact: activeContact,
        otp: isOtpStepVisible ? otpCode : '000000',
        challenge_token: challengeToken,
        password,
        full_name: fullName.trim(),
      });

      if (result.success) {
        trackEvent('register_success', { channel });
        if (result.registration_session) {
          saveRegistrationDraft({
            ...loadRegistrationDraft(),
            registrationSession: result.registration_session,
            onboardingStep: result.next_step || ONBOARDING_STEPS.PROFILE,
            updatedAt: Date.now(),
          });
        }
        // Progressive onboarding: the account is created and signed in here, so
        // honour the backend's next step (normally DONE → straight into the app)
        // rather than forcing the old profile funnel.
        handleSuccessfulAuth(result.next_step);
        return;
      }

      setErrors({ submit: result.error || 'Unable to complete identity setup' });
    } catch (error) {
      setErrors({ submit: error.message || 'Unable to complete identity setup' });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    clearIdentityState();
    setContactMode('email');
    setContact('');
    clearRegistrationDraft();
  };

  const useEmailContact = () => {
    setContactMode('email');
    setErrors({});
    setStatusMessage('');
  };

  const switchToLoginWithContact = () => {
    const prefillContact = sanitizeAuthContact(activeContact || contact || '', channel || contactMode);
    const prefillContactMode = channel || contactMode;
    onSwitchToLogin({ prefillContact, prefillContactMode });
  };

  const resolvedError = errors.submit ? resolveRegisterError(errors.submit, resendCountdown) : null;
  const resolvedErrorHandler = resolvedError?.actionKey
    ? ({
        login: switchToLoginWithContact,
        email: useEmailContact,
        resend: handleResendOtp,
        restart: handleBack,
      }[resolvedError.actionKey] ?? null)
    : null;

  return (
    <div className="auth-modal">
      <div className="auth-panel-header">
        <h3>Create your account</h3>
        <p>
          {!challengeToken
            ? 'Use Google or enter your email or phone number.'
            : isOtpStepVisible
              ? 'Enter your code, your name, and a password — then you\'re in.'
              : 'Add your name and a password to finish.'}
        </p>
      </div>

      {!challengeToken ? (
        <>
          <div className="social-auth social-auth-standalone">
            {isGoogleEnabled ? (
              <div className="google-custom-wrapper">
                <button
                  type="button"
                  className="social-btn google google-custom-button"
                  onClick={handleGoogleClick}
                  disabled={loading}
                >
                  <span className="social-icon"><FcGoogle /></span>
                  Continue with Google
                </button>
              </div>
            ) : (
              <button type="button" className="social-btn google" onClick={handleGoogleUnavailable}>
                <span className="social-icon"><FcGoogle /></span>
                Continue with Google
              </button>
            )}
          </div>

          <div className="auth-divider auth-social-divider">
            <span>or</span>
          </div>

          <form onSubmit={handleStartIdentity} className="auth-email-fallback">
            <div className="form-group">
              <label htmlFor="contact">Email or phone number</label>
              <input
                id="contact"
                name="contact"
                type="text"
                value={contact}
                onChange={(event) => {
                  const nextContact = event.target.value;
                  setContact(nextContact);
                  setContactMode(inferChannel(nextContact));
                  setErrors((prev) => ({ ...prev, contact: null, submit: null }));
                }}
                onBlur={() => {
                  setContact((current) => sanitizeAuthContact(current, inferChannel(current)));
                }}
                placeholder="name@example.com or 0241234567"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                disabled={loading}
              />
              {errors.contact ? <span className="field-error">{errors.contact}</span> : null}
            </div>

            <div className="auth-actions">
              <button type="submit" className="auth-btn primary" disabled={loading || !contact.trim()}>
                {loading ? (
                  <>
                    <span className="spinner"></span>
                    Continuing...
                  </>
                ) : (
                  'Continue'
                )}
              </button>
            </div>
          </form>
        </>
      ) : (
        <div className="auth-email-stage">
          <div className="auth-email-stage-head">
            <button
              type="button"
              className="text-link auth-email-back"
              onClick={handleBack}
              disabled={loading}
            >
              <FiArrowLeft />
              Back
            </button>
          </div>

          <form onSubmit={handleCompleteIdentity} className="auth-email-fallback">
              {!isOtpStepVisible && (
                <div className="auth-field-row">
                  <p className="auth-reset-note">
                    Verification is temporarily skipped. Create your password to continue.
                  </p>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="register-full-name">Your name</label>
                <input
                  id="register-full-name"
                  name="full-name"
                  type="text"
                  value={fullName}
                  onChange={(event) => {
                    setFullName(event.target.value);
                    setErrors((prev) => ({ ...prev, fullName: null, submit: null }));
                  }}
                  placeholder="e.g. Ama Mensah"
                  autoComplete="name"
                  disabled={loading}
                />
                {errors.fullName ? <span className="field-error">{errors.fullName}</span> : null}
              </div>

              {isOtpStepVisible ? (
                <div className="form-group">
                  <label htmlFor="otpCode">Verification code</label>
                  <div className={`otp-smart-field${errors.otp ? ' has-error' : ''}${loading ? ' is-disabled' : ''}`}>
                    <input
                      type="text"
                      id="otpCode"
                      name="otpCode"
                      className="otp-input otp-input-native"
                      value={otpCode}
                      onChange={(event) => {
                        const next = event.target.value.replace(/\D/g, '').slice(0, 6);
                        setOtpCode(next);
                        setErrors((prev) => ({ ...prev, otp: null, submit: null }));
                      }}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      autoComplete="one-time-code"
                      aria-label="Six digit verification code"
                      disabled={loading}
                    />
                    <div className="otp-digit-grid" aria-hidden="true">
                      {Array.from({ length: 6 }).map((_, index) => (
                        <span
                          key={index}
                          className={`otp-digit-box${otpCode[index] ? ' is-filled' : ''}${index === otpCode.length ? ' is-active' : ''}`}
                        >
                          {otpCode[index] || ''}
                        </span>
                      ))}
                    </div>
                  </div>
                  {errors.otp ? <span className="field-error">{errors.otp}</span> : null}
                  {otpCheckStatus !== 'idle' && !errors.otp ? (
                    <span className={`otp-check-status otp-check-status--${otpCheckStatus}`}>
                      {otpCheckStatus === 'checking' && 'Checking code…'}
                      {otpCheckStatus === 'valid' && '✓ Code verified'}
                      {otpCheckStatus === 'invalid' && (otpCheckError || 'That code is incorrect.')}
                    </span>
                  ) : null}
                  <div className="auth-otp-resend-row">
                    <span className="auth-reset-note">
                      {resendCountdown > 0 ? 'Check your email for the code.' : "Haven't received a code yet?"}
                    </span>
                    {resendCountdown > 0 ? (
                      <span className="auth-resend-timer">Resend OTP in {resendCountdown}s</span>
                    ) : (
                      <button
                        type="button"
                        className="text-link auth-inline-link"
                        onClick={handleResendOtp}
                        disabled={loading}
                      >
                        Resend OTP
                      </button>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="form-group">
                <label htmlFor="register-password">Create password</label>
                <div className="password-field">
                  <input
                    id="register-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setErrors((prev) => ({ ...prev, password: null, submit: null }));
                    }}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
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
                {errors.password ? <span className="field-error">{errors.password}</span> : null}
              </div>

              <div className="form-group">
                <label htmlFor="register-confirm-password">Confirm password</label>
                <div className="password-field">
                  <input
                    id="register-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value);
                      setErrors((prev) => ({ ...prev, confirmPassword: null, submit: null }));
                    }}
                    placeholder="Repeat password"
                    autoComplete="new-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    disabled={loading}
                  >
                    {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
                {errors.confirmPassword ? <span className="field-error">{errors.confirmPassword}</span> : null}
              </div>

              <div className="auth-actions">
                  <button
                    type="submit"
                    className="auth-btn primary"
                    disabled={loading || (isOtpStepVisible && (otpCheckStatus === 'checking' || otpCheckStatus === 'invalid'))}
                  >
                  {loading ? (
                    <>
                      <span className="spinner"></span>
                      Creating account...
                    </>
                  ) : (
                    'Create account'
                  )}
                </button>
              </div>

              {isOtpStepVisible && channel === 'phone'
                ? <p className="auth-reset-note">If it delays, resend the code.</p>
                : null}
          </form>
        </div>
      )}

      {statusMessage ? (
        <div className="success-message">
          {statusMessage}
        </div>
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

      <div className="auth-footer">
        <p>
          Already have an account?{' '}
          <button
            type="button"
            className="text-link"
            onClick={onSwitchToLogin}
            disabled={loading}
          >
            Login
          </button>
        </p>
      </div>
    </div>
  );
}

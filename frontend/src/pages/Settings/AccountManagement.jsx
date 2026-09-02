import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FiCreditCard,
  FiCheckCircle,
  FiLock,
  FiEye,
  FiEyeOff,
  FiClock,
} from 'react-icons/fi';
import { useAuth } from '../../hooks/useAuth';
import { useSubscription } from '../../hooks/useSubscription';
import { toDisplayName } from '../../utils/contributionPlans';
import { getPlanLockState } from '../../utils/upgradePlans';
import api from '../../services/api';
import { APP_STATE_SCOPES, emitStateChanged } from '../../utils/appEvents';
import ConfirmModal from '../../components/common/ConfirmModal';
import ContributionAppeal from '../../components/subscription/ContributionAppeal';
import './Settings.css';

const TELCO_PATTERNS = [
  { name: 'MTN', prefixes: ['024', '025', '053', '054', '055', '059'] },
  { name: 'Telecel', prefixes: ['020', '050'] },
  { name: 'AT', prefixes: ['026', '027', '056', '057'] },
];
const detectTelco = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  const normalized = digits.length > 9 ? digits.slice(-9) : digits;
  if (normalized.length < 3) return '';
  const prefix = `0${normalized.slice(0, 2)}`;
  const matched = TELCO_PATTERNS.find((item) => item.prefixes.includes(prefix));
  return matched ? matched.name : '';
};

const EXTENSION_PRESETS = [30, 60, 90];

const formatExpiryDate = (dateVal) => {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const addDaysToDate = (dateVal, days) => {
  const d = new Date(dateVal);
  d.setDate(d.getDate() + days);
  return d;
};

export default function AccountManagement() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, logout } = useAuth();
  const { currentPlan, plans, cancelSubscription, subscriptionDetails } = useSubscription();
  const [status, setStatus] = useState('');
  const [rewardSummary, setRewardSummary] = useState(null);
  const [payoutContact, setPayoutContact] = useState('');
  const [payoutTelco, setPayoutTelco] = useState('');
  const [payoutContactStatus, setPayoutContactStatus] = useState('');
  const [payoutStatus, setPayoutStatus] = useState('');
  const [savingPayoutContact, setSavingPayoutContact] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [securityForm, setSecurityForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [securityStatus, setSecurityStatus] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState({ current: false, next: false, confirm: false });

  const [extensionDays, setExtensionDays] = useState(null);
  const [extending, setExtending] = useState(false);
  const [extensionStatus, setExtensionStatus] = useState('');
  const [extensionError, setExtensionError] = useState('');

  const orderedPlans = useMemo(() => {
    if (!plans?.length) {
      return [
        { name: 'Basic Student', price: 0 },
        { name: 'Serious Student', price: 5 },
        { name: 'Master Student', price: 10 },
      ];
    }
    return plans.slice().sort((a, b) => (a.price || 0) - (b.price || 0));
  }, [plans]);

  const currentPlanName = currentPlan?.name || user?.current_plan || 'Basic Student';
  const currentPlanPrice =
    currentPlan?.price ?? plans?.find((plan) => plan.name === currentPlanName)?.price ?? 0;

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const response = await api.rewards.getSummary();
        const summary = response?.summary || null;
        setRewardSummary(summary);
        setPayoutContact(summary?.payout_contact || '');
        setPayoutTelco(summary?.payout_telco || '');
      } catch (error) {
        setRewardSummary(null);
      }
    };
    loadSummary();
  }, []);

  // Handle Paystack callback for plan extension (/settings?action=extend&reference=xxx)
  useEffect(() => {
    if (searchParams.get('action') !== 'extend') return;
    const reference = searchParams.get('reference') || searchParams.get('trxref');
    if (!reference) return;
    setExtending(true);
    setExtensionError('');
    api.billing.verifyExtension(reference, 'paystack')
      .then((res) => {
        const d = res?.data || res;
        const newDate = formatExpiryDate(d?.new_expires_at);
        setExtensionStatus(`Plan extended by ${d?.days || extensionDays || ''} days${newDate ? `. New expiry: ${newDate}` : ''}.`);
      })
      .catch((err) => {
        setExtensionError(err?.message || 'Could not verify extension. Please contact support.');
      })
      .finally(() => {
        setExtending(false);
        const next = new URLSearchParams(searchParams);
        next.delete('action');
        next.delete('reference');
        next.delete('trxref');
        navigate(`/settings?${next.toString()}`, { replace: true });
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openUpgradeModal = (plan) => {
    setStatus('');
    window.dispatchEvent(new CustomEvent('openUpgradeModal', {
      detail: {
        ...plan,
        source: 'settings_account',
      }
    }));
  };

  const handleCancelSubscription = async () => {
    setStatus('');
    try {
      const response = await cancelSubscription();
      if (response?.success) {
        setStatus(response?.message || 'Contribution plan updated.');
        emitStateChanged([APP_STATE_SCOPES.SUBSCRIPTION, APP_STATE_SCOPES.SETTINGS], {
          source: 'settings.account.cancel',
        });
      } else {
        setStatus(response?.error || 'Unable to cancel contribution right now.');
      }
    } catch (error) {
      setStatus(error.message || 'Unable to cancel contribution right now.');
    }
  };

  const handleExtend = async () => {
    if (!extensionDays) return;
    setExtending(true);
    setExtensionError('');
    setExtensionStatus('');
    try {
      const res = await api.billing.extend(extensionDays);
      const data = res?.data || res;
      if (!data?.authorization_url) throw new Error('Unable to initialize extension payment.');
      window.location.href = data.authorization_url;
    } catch (err) {
      setExtensionError(err?.message || 'Unable to start extension payment.');
      setExtending(false);
    }
  };

  const handlePayoutContactChange = (value) => {
    setPayoutContact(value);
    const detected = detectTelco(value);
    setPayoutTelco(detected);
  };

  const handleSavePayoutContact = async () => {
    setPayoutContactStatus('');
    if (!payoutContact.trim()) {
      setPayoutContactStatus('Enter a valid payout contact number.');
      return;
    }
    setSavingPayoutContact(true);
    try {
      const response = await api.rewards.setPayoutContact({
        contact: payoutContact.trim(),
        telco: payoutTelco || detectTelco(payoutContact),
      });
      if (!response?.success) {
        throw new Error(response?.error || 'Unable to save payout contact');
      }
      setPayoutContactStatus('Payout contact saved.');
      emitStateChanged([APP_STATE_SCOPES.SETTINGS], {
        source: 'settings.account.payout_contact',
      });
      const refreshed = await api.rewards.getSummary();
      setRewardSummary(refreshed?.summary || null);
      setPayoutContact(refreshed?.summary?.payout_contact || payoutContact.trim());
      setPayoutTelco(refreshed?.summary?.payout_telco || payoutTelco);
    } catch (error) {
      setPayoutContactStatus(error.message || 'Unable to save payout contact.');
    } finally {
      setSavingPayoutContact(false);
    }
  };

  const handlePayoutRequest = async () => {
    setPayoutStatus('');
    try {
      const response = await api.rewards.requestPayout({
        destination: payoutContact?.trim() || null,
      });
      if (response?.success) {
        setPayoutStatus('Payout request submitted.');
        const refreshed = await api.rewards.getSummary();
        setRewardSummary(refreshed?.summary || null);
      } else {
        setPayoutStatus(response?.error || 'Unable to request payout.');
      }
    } catch (error) {
      setPayoutStatus(error.message || 'Unable to request payout.');
    }
  };

  const handleSecurityChange = (field, value) => {
    setSecurityForm((prev) => ({
      ...prev,
      [field]: value,
    }));
    setSecurityStatus('');
  };

  const handlePasswordChange = async () => {
    setSecurityStatus('');
    const currentPassword = securityForm.currentPassword.trim();
    const newPassword = securityForm.newPassword;

    if (!currentPassword || !newPassword) {
      setSecurityStatus('Enter your current password and a new password.');
      return;
    }

    if (newPassword.length < 8) {
      setSecurityStatus('New password must be at least 8 characters.');
      return;
    }

    if (newPassword !== securityForm.confirmPassword) {
      setSecurityStatus('New passwords do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      const response = await api.user.changePassword(currentPassword, newPassword);
      if (!response?.success) {
        throw new Error(response?.error || 'Unable to update password.');
      }
      setSecurityForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setSecurityStatus(response?.message || 'Password updated.');
      emitStateChanged([APP_STATE_SCOPES.SETTINGS], {
        source: 'settings.account.password',
      });
    } catch (error) {
      setSecurityStatus(error.message || 'Unable to update password.');
    } finally {
      setSavingPassword(false);
    }
  };

  const requestSignOut = () => {
    setShowSignOutConfirm(true);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await logout();
      navigate('/', { replace: true });
    } finally {
      setSigningOut(false);
      setShowSignOutConfirm(false);
    }
  };

  return (
    <div className="settings-section account-management">
      <div className="settings-title-row">
        <span className="settings-title-icon"><FiCreditCard /></span>
        <h2>Account</h2>
      </div>

      <div className="account-summary">
        <div className="account-summary-item">
          <div>
            <strong>Plan</strong>
            <p>{toDisplayName(currentPlanName)}</p>
          </div>
        </div>
        <div className="account-summary-item">
          <div>
            <strong>Rewards</strong>
            <p>
              {rewardSummary?.balance != null
                ? `GHS ${Number(rewardSummary.balance).toFixed(2)}`
                : 'GHS 0.00'}
            </p>
          </div>
        </div>
      </div>

      {currentPlanPrice > 0 && (
        <div className="account-block account-block--extend">
          <h3 className="settings-section-title">
            <FiClock />
            <span>Extend plan</span>
          </h3>

          {subscriptionDetails?.expires_at && (
            <p className="settings-note">
              Expires {formatExpiryDate(subscriptionDetails.expires_at)}
              {subscriptionDetails?.expires_at && (() => {
                const days = Math.ceil((new Date(subscriptionDetails.expires_at) - Date.now()) / 86400000);
                return days > 0 ? ` · ${days} day${days !== 1 ? 's' : ''} left` : ' · expired';
              })()}
            </p>
          )}

          <p className="extend-help-text">
            Add more days to your current plan. The extra time starts from the end of your existing plan, not today.
          </p>

          <div className="extend-day-pills">
            {EXTENSION_PRESETS.map((d) => (
              <button
                key={d}
                type="button"
                className={`extend-day-pill${extensionDays === d ? ' active' : ''}`}
                onClick={() => { setExtensionDays(d); setExtensionError(''); setExtensionStatus(''); }}
              >
                {d} days
              </button>
            ))}
          </div>

          {extensionDays && (
            <div className="extend-summary">
              <span className="extend-summary__cost">
                GH₵{(currentPlanPrice / 30 * extensionDays).toFixed(2)}
                <small>+ fee</small>
              </span>
              {subscriptionDetails?.expires_at && (
                <span className="extend-summary__expiry">
                  New expiry: {formatExpiryDate(addDaysToDate(subscriptionDetails.expires_at, extensionDays))}
                </span>
              )}
            </div>
          )}

          {extensionStatus && <p className="settings-note"><FiCheckCircle /> <span>{extensionStatus}</span></p>}
          {extensionError && <p className="settings-note extend-error"><span>{extensionError}</span></p>}

          <button
            className="settings-inline-btn primary"
            type="button"
            onClick={handleExtend}
            disabled={!extensionDays || extending}
          >
            <span>{extending ? 'Processing…' : extensionDays ? `Extend by ${extensionDays} days →` : 'Select a duration'}</span>
          </button>
        </div>
      )}

      <div className="account-block">
        <h3 className="settings-section-title">Contribution plan</h3>
        <ContributionAppeal />
        <button
          type="button"
          className="settings-inline-btn"
          onClick={() => navigate('/features#pricing-plans')}
        >
          See full plan details
        </button>
        <div className="account-plan-list">
          {orderedPlans.map((plan) => {
            const planName = plan.name || 'Plan';
            const isActive = planName === currentPlanName;
            // Same rule as every PlanCard: lower plans stay locked until the
            // current paid period ends.
            const lockState = getPlanLockState({
              currentPlanName,
              targetPlanName: planName,
              subscriptionDetails,
            });
            const canSelectPlan = !lockState.locked;
            const displayName = toDisplayName(planName);
            return (
              <div key={planName} className={`account-plan-item ${isActive ? 'active' : ''}`}>
                <strong>{displayName}</strong>
                <span>{Number(plan.price || 0) > 0 ? `GHS ${plan.price} / 30 days` : 'Free'}</span>
                {isActive ? (
                  <button type="button" className="settings-inline-btn" disabled>
                    Current plan
                  </button>
                ) : (
                  <button
                    type="button"
                    className="settings-inline-btn primary"
                    disabled={!canSelectPlan}
                    title={lockState.locked ? lockState.reason : undefined}
                    onClick={() => openUpgradeModal(plan)}
                  >
                    {lockState.locked
                      ? (lockState.unlocksAtLabel ? `Available ${lockState.unlocksAtLabel}` : 'Available when your plan ends')
                      : `Become a ${displayName}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {currentPlanPrice > 0 && (
          <button
            className="settings-inline-btn"
            type="button"
            onClick={handleCancelSubscription}
          >
            <span>Cancel</span>
          </button>
        )}
        {status && <p className="settings-note"><FiCheckCircle /> <span>{status}</span></p>}
      </div>

      <div className="account-block">
        <h3 className="settings-section-title">
          <FiLock />
          <span>Security</span>
        </h3>
        {user?.password_set === false ? (
          <p className="settings-note settings-note--info">
            You signed in with Google. Use "Forgot password" from the login screen to create a password for your account.
          </p>
        ) : (
          <>
            <div className="account-password-field">
              <input
                type={showPasswords.current ? 'text' : 'password'}
                value={securityForm.currentPassword}
                onChange={(event) => handleSecurityChange('currentPassword', event.target.value)}
                placeholder="Current password"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="account-password-toggle"
                onClick={() => setShowPasswords((prev) => ({ ...prev, current: !prev.current }))}
                aria-label={showPasswords.current ? 'Hide password' : 'Show password'}
                disabled={savingPassword}
              >
                {showPasswords.current ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
            <div className="account-password-field">
              <input
                type={showPasswords.next ? 'text' : 'password'}
                value={securityForm.newPassword}
                onChange={(event) => handleSecurityChange('newPassword', event.target.value)}
                placeholder="New password"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="account-password-toggle"
                onClick={() => setShowPasswords((prev) => ({ ...prev, next: !prev.next }))}
                aria-label={showPasswords.next ? 'Hide password' : 'Show password'}
                disabled={savingPassword}
              >
                {showPasswords.next ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
            <div className="account-password-field">
              <input
                type={showPasswords.confirm ? 'text' : 'password'}
                value={securityForm.confirmPassword}
                onChange={(event) => handleSecurityChange('confirmPassword', event.target.value)}
                placeholder="Confirm new password"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="account-password-toggle"
                onClick={() => setShowPasswords((prev) => ({ ...prev, confirm: !prev.confirm }))}
                aria-label={showPasswords.confirm ? 'Hide password' : 'Show password'}
                disabled={savingPassword}
              >
                {showPasswords.confirm ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
            <button
              className="settings-inline-btn primary"
              type="button"
              onClick={handlePasswordChange}
              disabled={savingPassword}
            >
              <span>{savingPassword ? 'Updating...' : 'Update password'}</span>
            </button>
            {securityStatus && <p className="settings-note"><FiCheckCircle /> <span>{securityStatus}</span></p>}
          </>
        )}
      </div>

      <div className="account-block account-block--session">
        <h3 className="settings-section-title">Session</h3>
        <button className="settings-inline-btn" type="button" onClick={requestSignOut}>
          <span>Sign out</span>
        </button>
      </div>

      <ConfirmModal
        isOpen={showSignOutConfirm}
        title="Confirm sign out"
        message="Are you sure you want to sign out of your account on this device?"
        confirmLabel={signingOut ? 'Signing out...' : 'Sign out'}
        cancelLabel="Cancel"
        onConfirm={handleSignOut}
        onCancel={() => setShowSignOutConfirm(false)}
        isProcessing={signingOut}
      />
    </div>
  );
}

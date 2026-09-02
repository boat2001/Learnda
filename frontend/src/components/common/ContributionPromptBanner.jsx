import { useEffect, useState } from 'react';
import { FiX } from 'react-icons/fi';
import { useAuth } from '../../hooks/useAuth';
import { hasFullAcademicProfile } from '../../utils/onboarding';
import './SupporterBanner.css';

// Only nudge users who have settled in and seen value — i.e. a few days after
// they finished setting up their academic profile.
const ELIGIBLE_SINCE_KEY = 'contribution_prompt_eligible_since';
const DISMISS_KEY = 'contribution_prompt_dismissed_at';
const SETTLE_IN_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // re-ask after a week

const PAID_PLAN_NAMES = new Set(['Serious Student', 'Master Student']);

const readTimestamp = (key) => {
  try {
    return Number(localStorage.getItem(key) || 0);
  } catch {
    return 0;
  }
};

const writeTimestamp = (key, value) => {
  try { localStorage.setItem(key, String(value)); } catch { /* noop */ }
};

/**
 * Dismissible nudge shown to settled-in free users to consider a contribution
 * plan. Tapping "Support Sharether" opens the contribution plans modal (styled
 * appeal + plans). Hidden for users already contributing.
 */
export default function ContributionPromptBanner() {
  const { user, isAuthenticated } = useAuth();
  const [visible, setVisible] = useState(false);

  const planName = user?.current_plan || user?.subscription?.plan?.name || 'Basic Student';
  const isContributing = PAID_PLAN_NAMES.has(planName);
  const profileReady = hasFullAcademicProfile(user);

  useEffect(() => {
    if (!isAuthenticated || !user || !profileReady || isContributing) {
      setVisible(false);
      return;
    }

    // Start the "settle in" clock the first time they're eligible.
    let eligibleSince = readTimestamp(ELIGIBLE_SINCE_KEY);
    if (!eligibleSince) {
      eligibleSince = Date.now();
      writeTimestamp(ELIGIBLE_SINCE_KEY, eligibleSince);
    }

    if (Date.now() - eligibleSince < SETTLE_IN_MS) {
      setVisible(false);
      return;
    }

    const dismissedAt = readTimestamp(DISMISS_KEY);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_TTL_MS) {
      setVisible(false);
      return;
    }

    setVisible(true);
  }, [isAuthenticated, user, profileReady, isContributing]);

  if (!visible) return null;

  const handleDismiss = () => {
    writeTimestamp(DISMISS_KEY, Date.now());
    setVisible(false);
  };

  const handleSupport = () => {
    window.dispatchEvent(
      new CustomEvent('openContributionModal', { detail: { source: 'contribution_banner' } })
    );
  };

  return (
    <div className="supporter-banner" role="complementary" aria-label="Support Sharether">
      <div className="supporter-banner__inner">
        <p className="supporter-banner__text">
          Sharether working for you? <strong>Chip in what fits</strong> and keep it free for your classmates too.
        </p>
        <button type="button" className="supporter-banner__cta" onClick={handleSupport}>
          See the plans
        </button>
      </div>
      <button
        type="button"
        className="supporter-banner__close"
        onClick={handleDismiss}
        aria-label="Dismiss contribution reminder"
      >
        <FiX size={14} />
      </button>
    </div>
  );
}

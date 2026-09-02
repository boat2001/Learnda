import { useEffect, useState } from 'react';
import { FiX } from 'react-icons/fi';
import { useSubscription } from '../../hooks/useSubscription';
import api from '../../services/api';
import './SupporterBanner.css';

const DISMISS_KEY = 'sb_dismissed_at';
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const isDismissed = () => {
  try {
    const ts = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return ts > 0 && Date.now() - ts < DISMISS_TTL_MS;
  } catch {
    return false;
  }
};

const dismiss = () => {
  try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* noop */ }
};

const FALLBACK_STATS = { count: 63, goal: 100 };

export default function SupporterBanner() {
  const { currentPlan } = useSubscription();
  const [stats, setStats] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isDismissed()) return;

    // Don't show to already-contributing Nationals
    const planName = currentPlan?.name || '';
    if (planName === 'Serious Student' || planName === 'Master Student') return;

    // Fetch live stats — fall back gracefully if endpoint not ready
    api.subscription?.getSupporterStats?.()
      .then((res) => {
        setStats(res?.data || res || FALLBACK_STATS);
      })
      .catch(() => setStats(FALLBACK_STATS));

    setVisible(true);
  }, [currentPlan]);

  if (!visible || !stats) return null;

  const gap = Math.max(0, (stats.goal || 100) - (stats.count || 0));

  const handleDismiss = () => {
    dismiss();
    setVisible(false);
  };

  const handleJoin = () => {
    window.dispatchEvent(
      new CustomEvent('openUpgradeModal', { detail: { source: 'supporter_banner' } })
    );
  };

  return (
    <div className="supporter-banner" role="complementary" aria-label="Sharether supporter progress">
      <div className="supporter-banner__inner">
        <p className="supporter-banner__text">
          <strong>{stats.count} students</strong> are chipping in this month — just{' '}
          <strong>{gap} more</strong> and Sharether is fully funded for the rest of it.
        </p>
        <button type="button" className="supporter-banner__cta" onClick={handleJoin}>
          Join them
        </button>
      </div>
      <button
        type="button"
        className="supporter-banner__close"
        onClick={handleDismiss}
        aria-label="Dismiss supporter banner"
      >
        <FiX size={14} />
      </button>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { FiX } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { hasFullAcademicProfile } from '../../utils/onboarding';
import './SupporterBanner.css';

const DISMISS_KEY = 'profile_completion_banner_dismissed_at';
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

/**
 * Gentle nudge for signed-in users who deferred their academic details at
 * sign-up. Dismissible (24h). Tapping "Add details" routes to /learn, where the
 * AcademicProfileGate collects the deferred information.
 */
export default function ProfileCompletionBanner() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setVisible(false);
      return;
    }
    if (hasFullAcademicProfile(user)) {
      setVisible(false);
      return;
    }
    setVisible(!isDismissed());
  }, [isAuthenticated, user]);

  if (!visible) return null;

  const handleDismiss = () => {
    dismiss();
    setVisible(false);
  };

  const handleAdd = () => {
    navigate('/learn');
  };

  return (
    <div className="supporter-banner" role="complementary" aria-label="Complete your profile">
      <div className="supporter-banner__inner">
        <p className="supporter-banner__text">
          Add your <strong>college and programme</strong> to unlock the courses made for your class.
        </p>
        <button type="button" className="supporter-banner__cta" onClick={handleAdd}>
          Add details
        </button>
      </div>
      <button
        type="button"
        className="supporter-banner__close"
        onClick={handleDismiss}
        aria-label="Dismiss profile reminder"
      >
        <FiX size={14} />
      </button>
    </div>
  );
}

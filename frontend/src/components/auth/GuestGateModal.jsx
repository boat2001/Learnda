import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { FiLock, FiArrowLeft } from 'react-icons/fi';
import './GuestGateModal.css';

export default function GuestGateModal({ feature, message }) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const handleSignIn = () =>
    window.dispatchEvent(new CustomEvent('openAuthModal', { detail: 'login' }));
  const handleRegister = () =>
    window.dispatchEvent(new CustomEvent('openAuthModal', { detail: 'register' }));

  const title = feature || 'This section is for registered members.';
  const body = message
    ? `${message} Register if you're new, or sign in if you already have an account.`
    : "Register if you're new, or sign in if you already have an account.";

  return createPortal(
    <div
      className="guest-gate-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Sign in required"
      onClick={handleBack}
    >
      <div className="guest-gate-modal" onClick={(e) => e.stopPropagation()}>
        <div className="guest-gate-icon">
          <FiLock />
        </div>
        <span className="guest-gate-tag">Members only</span>
        <h2 className="guest-gate-title">{title}</h2>
        <p className="guest-gate-message">{body}</p>
        <div className="guest-gate-actions">
          <button className="btn btn-primary" type="button" onClick={handleSignIn}>
            Sign in
          </button>
          <button className="btn btn-secondary" type="button" onClick={handleRegister}>
            Register
          </button>
        </div>
        <button className="guest-gate-back" type="button" onClick={handleBack}>
          <FiArrowLeft />
          Go back
        </button>
      </div>
    </div>,
    document.body
  );
}

import { useEffect } from "react";
import { MdLock } from "react-icons/md";
import { lockBodyScroll } from "../../utils/bodyScrollLock";
import { toDisplayName } from "../../utils/contributionPlans";
import "./FeatureLockModal.css";

export default function FeatureLockModal({
  isOpen,
  featureLabel = "This feature",
  requiredPlan = "Serious Student", // expects backend plan name
  message = "",
  onUpgrade,
  onClose,
}) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const releaseBodyScroll = lockBodyScroll();
    return releaseBodyScroll;
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget && onClose) onClose();
  };

  const description = message || `Chip in to open up ${featureLabel.toLowerCase()} — and help keep Learnda free for everyone else.`;

  return (
    <div className="feature-lock-overlay" onClick={handleOverlayClick}>
      <div className="feature-lock-modal" role="dialog" aria-modal="true" aria-label="Feature locked">
        <button className="feature-lock-close" type="button" onClick={onClose} aria-label="Close">
          &times;
        </button>

        <div className="feature-lock-icon" aria-hidden="true">
          <MdLock />
        </div>

        <h3>Unlock {featureLabel.toLowerCase()}</h3>
        <p>{description}</p>
        <p className="feature-lock-plan">
          Included from <strong>{toDisplayName(requiredPlan)}</strong> upwards
        </p>

        <div className="feature-lock-actions">
          <button className="feature-lock-btn primary" type="button" onClick={onUpgrade}>
            See the plans
          </button>
          <button className="feature-lock-btn secondary" type="button" onClick={onClose}>
            Not right now
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { FiAward } from 'react-icons/fi';
import ConfettiOverlay from './ConfettiOverlay';
import { lockBodyScroll } from '../../utils/bodyScrollLock';
import { resolveUploadUrl } from '../../services/api';
import { playUiSound } from '../../utils/uiSounds';
import './BadgeUnlockModal.css';

export default function BadgeUnlockModal({ badge, onClose }) {
  const [visible, setVisible] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);
  const [iconFailed, setIconFailed] = useState(false);

  useEffect(() => {
    if (!badge) return;
    const t = setTimeout(() => {
      setVisible(true);
      setConfettiActive(true);
      playUiSound('badgeUnlock');
    }, 50);
    return () => clearTimeout(t);
  }, [badge]);

  useEffect(() => {
    if (!badge) return undefined;
    const releaseBodyScroll = lockBodyScroll();
    return releaseBodyScroll;
  }, [badge]);

  useEffect(() => {
    setIconFailed(false);
  }, [badge?.id]);

  if (!badge) return null;

  const iconSrc = badge.icon_url ? resolveUploadUrl(badge.icon_url) : '';

  const handleClose = () => {
    setVisible(false);
    setConfettiActive(false);
    setTimeout(onClose, 300);
  };

  return (
    <>
      <ConfettiOverlay active={confettiActive} mode="burst" onDone={() => setConfettiActive(false)} />
      <div
        className={`badge-backdrop ${visible ? 'badge-backdrop--visible' : ''}`}
        onClick={handleClose}
        role="dialog"
        aria-modal="true"
        aria-label={`Badge unlocked: ${badge.name}`}
      >
        <div
          className={`badge-modal ${visible ? 'badge-modal--visible' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="badge-modal__shine" />

          <div className="badge-modal__icon-wrap" aria-hidden="true">
            <span className="badge-modal__icon-ring" />
            {iconSrc && !iconFailed ? (
              <img
                src={iconSrc}
                alt=""
                className="badge-modal__icon"
                onError={() => setIconFailed(true)}
              />
            ) : (
              <span className="badge-modal__icon-fallback">
                <FiAward className="badge-modal__fallback-award" />
              </span>
            )}
          </div>

          <p className="badge-modal__earned-label">Badge Unlocked!</p>
          <h2 className="badge-modal__name">{badge.name}</h2>
          <p className="badge-modal__description">{badge.description}</p>

          {badge.xp_reward > 0 && (
            <div className="badge-modal__xp-reward">
              +{badge.xp_reward} XP bonus
            </div>
          )}

          <button className="badge-modal__cta" onClick={handleClose}>
            Awesome!
          </button>
        </div>
      </div>
    </>
  );
}

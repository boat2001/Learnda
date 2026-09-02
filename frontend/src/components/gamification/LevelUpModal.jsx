import { useEffect, useState } from 'react';
import ConfettiOverlay from './ConfettiOverlay';
import { lockBodyScroll } from '../../utils/bodyScrollLock';
import { playUiSound } from '../../utils/uiSounds';
import { RANK_NAMES, RANK_COLORS } from '../../data/rankConfig';
import './LevelUpModal.css';

export default function LevelUpModal({ level, onClose }) {
  const [visible, setVisible] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);

  useEffect(() => {
    if (level == null) return;
    const t1 = setTimeout(() => {
      setVisible(true);
      setConfettiActive(true);
      playUiSound('levelUp');
    }, 50);
    return () => clearTimeout(t1);
  }, [level]);

  useEffect(() => {
    if (level == null) return undefined;
    const releaseBodyScroll = lockBodyScroll();
    return releaseBodyScroll;
  }, [level]);

  if (level == null) return null;

  const levelName = RANK_NAMES[level] || `Rank ${level}`;
  const levelColor = RANK_COLORS[level] || '#7c3aed';

  const handleClose = () => {
    setVisible(false);
    setConfettiActive(false);
    setTimeout(onClose, 300);
  };

  return (
    <>
      <ConfettiOverlay active={confettiActive} mode="fireworks" onDone={() => setConfettiActive(false)} />
      <div
        className={`levelup-backdrop ${visible ? 'levelup-backdrop--visible' : ''}`}
        onClick={handleClose}
        role="dialog"
        aria-modal="true"
        aria-label={`Rank up! You are now ${levelName}`}
      >
        <div
          className={`levelup-modal ${visible ? 'levelup-modal--visible' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="levelup-glow" style={{ '--level-color': levelColor }} />

          <div className="levelup-badge" style={{ '--level-color': levelColor }}>
            <span className="levelup-badge__initial">{levelName.charAt(0)}</span>
          </div>

          <div className="levelup-content">
            <p className="levelup-label">Rank Up!</p>
            <h2 className="levelup-title" style={{ color: levelColor }}>{levelName}</h2>
            <p className="levelup-subtitle">You're crushing it. Keep the momentum going!</p>
          </div>

          <button className="levelup-cta" onClick={handleClose}>
            Keep Learning →
          </button>
        </div>
      </div>
    </>
  );
}

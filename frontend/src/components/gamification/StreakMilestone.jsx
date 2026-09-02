import { useEffect, useState } from 'react';
import ConfettiOverlay from './ConfettiOverlay';
import { lockBodyScroll } from '../../utils/bodyScrollLock';
import './StreakMilestone.css';

const MILESTONE_MESSAGES = {
  3: { title: '3-Day Streak!', sub: "You're building a habit. Keep it up!" },
  7: { title: 'Week Warrior! 🔥', sub: 'A full week of learning. Incredible!' },
  14: { title: '2-Week Streak!', sub: "You're unstoppable. Learnda salutes you!" },
  21: { title: '3-Week Streak! 🏆', sub: "21 days of pure dedication. Legend!" },
  30: { title: '30-Day Master!', sub: 'A month of consistency. You did it!' },
};

const MILESTONE_DAYS = [3, 7, 14, 21, 30];

export function isStreakMilestone(streak) {
  return MILESTONE_DAYS.includes(streak);
}

export default function StreakMilestone({ streak, onClose }) {
  const [visible, setVisible] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);

  const info = MILESTONE_MESSAGES[streak];

  useEffect(() => {
    if (!info) return;
    const t = setTimeout(() => {
      setVisible(true);
      setConfettiActive(streak >= 7);
    }, 50);
    return () => clearTimeout(t);
  }, [info, streak]);

  useEffect(() => {
    if (!info) return undefined;
    const releaseBodyScroll = lockBodyScroll();
    return releaseBodyScroll;
  }, [info]);

  if (!info) return null;

  const handleClose = () => {
    setVisible(false);
    setConfettiActive(false);
    setTimeout(onClose, 300);
  };

  return (
    <>
      {confettiActive && (
        <ConfettiOverlay active={confettiActive} mode={streak >= 30 ? 'fireworks' : 'burst'} onDone={() => setConfettiActive(false)} />
      )}
      <div
        className={`streak-backdrop ${visible ? 'streak-backdrop--visible' : ''}`}
        onClick={handleClose}
        role="dialog"
        aria-modal="true"
      >
        <div
          className={`streak-modal ${visible ? 'streak-modal--visible' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="streak-flame">🔥</div>
          <div className="streak-days">{streak}</div>
          <p className="streak-days-label">Day Streak</p>
          <h2 className="streak-title">{info.title}</h2>
          <p className="streak-sub">{info.sub}</p>
          <button className="streak-cta" onClick={handleClose}>
            Keep Going →
          </button>
        </div>
      </div>
    </>
  );
}

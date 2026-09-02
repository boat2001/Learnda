import { useEffect, useRef, useState } from 'react';
import './XpToast.css';

// Each toast: { id, amount, source, levelUp, newLevel }
export default function XpToast({ toasts, onRemove }) {
  return (
    <div className="xp-toast-container" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <XpToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

function XpToastItem({ toast, onRemove }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    // Trigger enter animation
    const enterTimer = setTimeout(() => setVisible(true), 10);
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onRemove(toast.id), 350);
    }, 2800);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(timerRef.current);
    };
  }, [toast.id, onRemove]);

  const label = toast.levelUp
    ? `Level ${toast.newLevel}! +${toast.amount} XP`
    : `+${toast.amount} XP`;

  const icon = toast.levelUp ? '🏆' : '⚡';

  return (
    <div
      className={`xp-toast ${visible ? 'xp-toast--visible' : ''} ${toast.levelUp ? 'xp-toast--levelup' : ''}`}
      role="status"
    >
      <span className="xp-toast__icon">{icon}</span>
      <span className="xp-toast__label">{label}</span>
    </div>
  );
}

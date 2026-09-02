import { memo, useState, useEffect } from 'react';

const ScoreRing = memo(function ScoreRing({ percent, passed }) {
  const RADIUS = 44;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const [animPercent, setAnimPercent] = useState(0);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setTimeout(() => setAnimPercent(percent), 50);
    });
    return () => cancelAnimationFrame(raf);
  }, [percent]);

  const offset = CIRCUMFERENCE - (animPercent / 100) * CIRCUMFERENCE;
  const color = passed ? '#10b981' : percent >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div className="ps-score-ring" aria-label={`Score: ${percent}%`}>
      <svg width="100" height="100" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.3s ease' }}
        />
      </svg>
      <div className="ps-score-ring__value" style={{ color }}>
        <strong>{percent}</strong>
        <span>%</span>
      </div>
    </div>
  );
});

export default ScoreRing;

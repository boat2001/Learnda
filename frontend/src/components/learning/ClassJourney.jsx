// The school journey from KG 1 to SHS 3, drawn as a path.
//
// Display only: it shows where a learner is (§6.3) so the year-by-year model
// feels like progress rather than a restriction. It never grants access;
// the API decides what can be opened. With no `current`, it renders the
// whole journey neutrally (for the guest landing page).
import { useEffect, useRef, useState } from 'react';
import { MdCheck, MdLock } from 'react-icons/md';
import { CLASS_LEVELS, LEVEL_GROUP_LABELS, getClassLevel } from '../../constants/education';
import './ClassJourney.css';

const GROUP_COLORS = {
  KINDERGARTEN: 'orange',
  PRIMARY: 'amber',
  JHS: 'green',
  SHS: 'blue',
};

const GROUPS = ['KINDERGARTEN', 'PRIMARY', 'JHS', 'SHS'];

const GROUP_SHORT = { KINDERGARTEN: 'KG', PRIMARY: 'Primary', JHS: 'JHS', SHS: 'SHS' };

const shortLabel = (level) => level.label.replace('Basic ', 'B').replace('KG ', 'KG');

export default function ClassJourney({ current = null, compact = false, animate = false }) {
  const currentOrdinal = getClassLevel(current)?.ordinal ?? null;
  const journeyRef = useRef(null);
  const travelerRef = useRef(null);
  const [reached, setReached] = useState(-1);
  const animated = animate && currentOrdinal === null;

  useEffect(() => {
    if (!animated) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame;
    let points = [];
    let started;
    const measure = () => {
      const bounds = journeyRef.current.getBoundingClientRect();
      points = [...journeyRef.current.querySelectorAll('.journey__dot')].map((dot) => {
        const rect = dot.getBoundingClientRect();
        return { x: rect.left - bounds.left + rect.width / 2, y: rect.top - bounds.top + rect.height / 2,
          color: getComputedStyle(dot).getPropertyValue('--group') };
      });
    };
    const tick = (now) => {
      started ??= now;
      // Arrive at each class, pause briefly, then move to the next one.
      const elapsed = (now - started) % (points.length * 850 + 1800);
      const index = Math.min(Math.floor(elapsed / 850), points.length - 1);
      const next = Math.min(index + 1, points.length - 1);
      const progress = Math.min(Math.max((elapsed % 850 - 250) / 600, 0), 1);
      const eased = progress * progress * (3 - 2 * progress);
      const from = points[index];
      const to = points[next];
      if (from && to) {
        const traveler = travelerRef.current;
        traveler.style.transform = `translate(${from.x + (to.x - from.x) * eased}px, ${from.y + (to.y - from.y) * eased}px) translate(-50%, -50%)`;
        traveler.style.background = from.color;
        traveler.style.opacity = '1';
        setReached((previous) => previous === index ? previous : index);
      }
      frame = requestAnimationFrame(tick);
    };
    const start = () => {
      cancelAnimationFrame(frame);
      started = undefined;
      travelerRef.current.style.opacity = '0';
      setReached(-1);
      if (!motion.matches) {
        measure();
        frame = requestAnimationFrame(tick);
      }
    };
    const observer = new ResizeObserver(measure);
    observer.observe(journeyRef.current);
    motion.addEventListener('change', start);
    start();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      motion.removeEventListener('change', start);
    };
  }, [animated]);

  return (
    <ol ref={journeyRef} className={`journey${compact ? ' journey--compact' : ''}${animated ? ' journey--animated' : ''}`} aria-label="Classes from KG 1 to SHS 3">
      {GROUPS.map((group) => {
        const color = GROUP_COLORS[group];
        return (
          <li
            key={group}
            className="journey__group"
            style={{ '--group': `var(--brand-${color})`, '--group-tint': `var(--tint-${color})`, '--group-ink': `var(--ink-${color})` }}
          >
            <span className="journey__group-name">
              <span className="journey__group-full">{LEVEL_GROUP_LABELS[group]}</span>
              <span className="journey__group-short">{GROUP_SHORT[group]}</span>
            </span>
            <ol className="journey__stops">
              {CLASS_LEVELS.filter((l) => l.levelGroup === group).map((level) => {
                let state = 'open';
                if (currentOrdinal !== null) {
                  if (level.ordinal < currentOrdinal) state = 'done';
                  else if (level.ordinal === currentOrdinal) state = 'current';
                  else state = 'locked';
                }
                return (
                  <li
                    key={level.code}
                    className={`journey__stop is-${state}${animated && level.ordinal <= reached ? ' is-reached' : ''}`}
                    aria-current={state === 'current' ? 'step' : undefined}
                    title={state === 'locked' ? `${level.label} opens in a later school year` : level.label}
                  >
                    <span className="journey__dot" aria-hidden="true">
                      {state === 'done' && <MdCheck />}
                      {state === 'locked' && <MdLock />}
                    </span>
                    <span className="journey__label">
                      <span className="visually-hidden">{level.label}</span>
                      <span aria-hidden="true">{shortLabel(level)}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </li>
        );
      })}
      {animated && <li ref={travelerRef} className="journey__traveler" aria-hidden="true" />}
    </ol>
  );
}

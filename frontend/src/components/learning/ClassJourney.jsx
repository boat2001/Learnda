// The school journey from KG 1 to SHS 3, drawn as a path.
//
// Display only: it shows where a learner is (§6.3) so the year-by-year model
// feels like progress rather than a restriction. It never grants access;
// the API decides what can be opened. With no `current`, it renders the
// whole journey neutrally (for the guest landing page).
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

export default function ClassJourney({ current = null, compact = false }) {
  const currentOrdinal = getClassLevel(current)?.ordinal ?? null;

  return (
    <ol className={`journey${compact ? ' journey--compact' : ''}`} aria-label="Classes from KG 1 to SHS 3">
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
                    className={`journey__stop is-${state}`}
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
    </ol>
  );
}

// The Learn page: a learner's subjects for their own class.
//
// This is deliberately not a catalog. A Learnda learner sits in exactly one
// class and studies the subjects that class teaches (§0, §5) -- there is
// nothing to browse, filter by programme, or discover. What changes between
// learners is not WHICH subjects appear but HOW they are presented (§8):
// Kindergarten gets big tappable pictures, Primary gets visual cards, and
// JHS/SHS get a structured, practice-oriented list.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MdLock, MdVolumeUp, MdHistory, MdSchool, MdRefresh, MdChevronRight,
} from 'react-icons/md';
import { useAuth } from '../../hooks/useAuth';
import usePageTitle from '../../hooks/usePageTitle';
import api from '../../services/api';
import {
  ACCESS_MODES,
  getPresentation,
  getUnitNoun,
  LEVEL_GROUPS,
} from '../../constants/education';
import ClassPlacementPrompt from './ClassPlacementPrompt';
import './Learn.css';

// Subject tiles carry a colour so young learners can recognise them by sight
// before they can reliably read the label (§8, Kindergarten/Primary).
const SUBJECT_ACCENTS = [
  'var(--color-accent-blue)',
  'var(--color-accent-orange)',
  'var(--color-accent-green)',
  'var(--color-accent-amber)',
  'var(--color-primary-600)',
  'var(--color-accent-navy)',
];

const accentFor = (slug = '', index = 0) => {
  // Hash the slug so a subject keeps its colour across reloads and reorders.
  const hash = [...slug].reduce((acc, ch) => acc + ch.charCodeAt(0), index);
  return SUBJECT_ACCENTS[hash % SUBJECT_ACCENTS.length];
};

/** Speaks a subject name aloud. §8: Kindergarten is audio-first, tap-to-listen. */
const speak = (text) => {
  if (!window.speechSynthesis || !text) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 0.85; // slower, for early readers
  const voices = window.speechSynthesis.getVoices();
  const preferred = ['en-GH', 'en-NG', 'en-GB'];
  const chosen = preferred.reduce((found, lang) => found || voices.find((v) => v.lang === lang), null);
  if (chosen) utter.voice = chosen;
  else utter.lang = 'en-GB';
  window.speechSynthesis.speak(utter);
};

function SubjectCard({ subject, index, presentation, unitNoun, onListen }) {
  const accent = accentFor(subject.slug, index);
  const initials = subject.name.slice(0, 2).toUpperCase();

  return (
    <article className="subject-card" style={{ '--subject-accent': accent }}>
      <Link to={`/learn/${subject.slug}`} className="subject-card__link">
        <span className="subject-card__mark" aria-hidden="true">
          {subject.icon ? <span className="subject-card__emoji">{subject.icon}</span> : initials}
        </span>
        <span className="subject-card__body">
          <h3 className="subject-card__title">{subject.name}</h3>
          {presentation.textDensity !== 'minimal' && subject.description && (
            <p className="subject-card__desc">{subject.description}</p>
          )}
          {subject.required && (
            <span className="subject-card__tag">Core {unitNoun.singular.toLowerCase()}</span>
          )}
        </span>
        {!presentation.bigIcons && <MdChevronRight className="subject-card__chevron" aria-hidden="true" />}
      </Link>

      {/* §8: tap-to-listen, for learners who cannot yet read the label. */}
      {presentation.audioFirst && (
        <button
          type="button"
          className="subject-card__listen"
          onClick={() => onListen(subject.name)}
          aria-label={`Hear "${subject.name}" read aloud`}
        >
          <MdVolumeUp aria-hidden="true" />
        </button>
      )}
    </article>
  );
}

/**
 * The §6.3 class ladder. Past classes open in revision mode, the current class
 * is where new learning happens, and future classes stay visibly locked with
 * "available next academic year" -- so a learner understands the shape of the
 * journey without being able to jump ahead.
 */
function ClassLadder({ levels, activeCode, onSelect }) {
  if (!levels.length) return null;

  return (
    <nav className="class-ladder" aria-label="Your classes">
      <ul className="class-ladder__list">
        {levels.map((level) => {
          const isActive = level.code === activeCode;
          const isLocked = level.access === ACCESS_MODES.LOCKED;
          return (
            <li key={level.code}>
              <button
                type="button"
                className={[
                  'class-ladder__item',
                  isActive ? 'is-active' : '',
                  isLocked ? 'is-locked' : '',
                  level.access === ACCESS_MODES.REVISION ? 'is-revision' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => !isLocked && onSelect(level.code)}
                disabled={isLocked}
                aria-current={isActive ? 'true' : undefined}
                title={isLocked ? level.note : undefined}
              >
                <span className="class-ladder__label">{level.label}</span>
                {isLocked && <MdLock className="class-ladder__icon" aria-hidden="true" />}
                {level.access === ACCESS_MODES.REVISION && (
                  <MdHistory className="class-ladder__icon" aria-hidden="true" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="class-ladder__hint">
        <MdLock aria-hidden="true" /> Locked classes open next academic year.
      </p>
    </nav>
  );
}

export default function LearnIndex() {
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, error: '', data: null });
  const [classLevels, setClassLevels] = useState([]);
  const [viewingClass, setViewingClass] = useState(null);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const [subjectsRes, levelsRes] = await Promise.all([
        api.subjects.getAll(),
        api.subjects.getClassLevels().catch(() => null),
      ]);
      setState({ loading: false, error: '', data: subjectsRes?.data || null });
      setClassLevels(levelsRes?.data?.class_levels || []);
      setViewingClass(subjectsRes?.data?.class_level || null);
    } catch (err) {
      setState({
        loading: false,
        error: err?.message || 'We could not load your subjects. Please try again.',
        data: null,
      });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const data = state.data;
  const levelGroup = data?.level_group || null;
  const presentation = useMemo(() => getPresentation(levelGroup), [levelGroup]);
  const unitNoun = useMemo(
    () => data?.unit_noun || getUnitNoun(levelGroup),
    [data, levelGroup]
  );

  usePageTitle(data?.class_label ? `${unitNoun.plural} · ${data.class_label}` : unitNoun.plural);

  const handleListen = useCallback((name) => speak(name), []);

  const handleSelectClass = useCallback((code) => {
    setViewingClass(code);
    // Revision browsing is a per-subject view; the subject list itself is the
    // learner's own class list and does not change.
  }, []);

  if (state.loading) {
    return (
      <div className="learn-page" aria-busy="true">
        <div className="learn-page__skeleton">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="learn-page__skeleton-card" />
          ))}
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="learn-page">
        <div className="learn-empty">
          <h2>Something went wrong</h2>
          <p>{state.error}</p>
          <button type="button" className="btn btn-primary" onClick={load}>
            <MdRefresh aria-hidden="true" /> Try again
          </button>
        </div>
      </div>
    );
  }

  // A learner with no class cannot be shown any content at all (§5), so the
  // page becomes the placement prompt rather than an empty list.
  if (data?.needs_class_placement) {
    return <ClassPlacementPrompt onPlaced={load} />;
  }

  // SHS without a pathway: §4.4 forbids showing every SHS subject, so ask.
  if (data?.needs_pathway) {
    return (
      <ClassPlacementPrompt
        mode="pathway"
        classLevel={data.class_level}
        onPlaced={load}
      />
    );
  }

  const subjects = data?.subjects || [];
  const groups = data?.groups || null;

  return (
    <div
      className={`learn-page learn-page--${presentation.mode}`}
      data-level-group={levelGroup}
    >
      <header className="learn-header">
        <div className="learn-header__text">
          <p className="learn-header__eyebrow">
            <MdSchool aria-hidden="true" /> {data?.class_label}
          </p>
          <h1 className="learn-header__title">{presentation.tone}</h1>
          {presentation.textDensity === 'full' && (
            <p className="learn-header__sub">
              {subjects.length} {subjects.length === 1 ? unitNoun.singular.toLowerCase() : unitNoun.plural.toLowerCase()}
              {' '}for {data?.class_label}, {data?.academic_year || 'this year'}.
            </p>
          )}
        </div>
      </header>

      {/* KG has no class ladder: a 4-year-old does not navigate a revision
          timeline, and §8 asks for the simplest possible flow. */}
      {levelGroup !== LEVEL_GROUPS.KINDERGARTEN && (
        <ClassLadder levels={classLevels} activeCode={viewingClass} onSelect={handleSelectClass} />
      )}

      {subjects.length === 0 ? (
        <div className="learn-empty">
          <h2>No {unitNoun.plural.toLowerCase()} yet</h2>
          <p>Your {unitNoun.plural.toLowerCase()} for {data?.class_label} are being prepared.</p>
        </div>
      ) : groups ? (
        // SHS: grouped by pathway rule, so "choose 3 of these" is legible (§4.4).
        <div className="subject-groups">
          {Object.entries(groups)
            .filter(([, units]) => units.length > 0)
            .map(([groupKey, units]) => (
              <section key={groupKey} className="subject-group">
                <h2 className="subject-group__title">
                  {groupKey.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                </h2>
                <div className="subject-grid" style={{ '--cards-per-row': presentation.cardsPerRow }}>
                  {units.map((subject, i) => (
                    <SubjectCard
                      key={subject.id || subject.slug}
                      subject={subject}
                      index={i}
                      presentation={presentation}
                      unitNoun={unitNoun}
                      onListen={handleListen}
                    />
                  ))}
                </div>
              </section>
            ))}
        </div>
      ) : (
        <div className="subject-grid" style={{ '--cards-per-row': presentation.cardsPerRow }}>
          {subjects.map((subject, i) => (
            <SubjectCard
              key={subject.id || subject.slug}
              subject={subject}
              index={i}
              presentation={presentation}
              unitNoun={unitNoun}
              onListen={handleListen}
            />
          ))}
        </div>
      )}
    </div>
  );
}

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
import { MdLock, MdHistory, MdRefresh, MdCheck } from 'react-icons/md';
import usePageTitle from '../../hooks/usePageTitle';
import api from '../../services/api';
import {
  ACCESS_MODES,
  getPresentation,
  getUnitNoun,
  LEVEL_GROUPS,
} from '../../constants/education';
import ClassPlacementPrompt from './ClassPlacementPrompt';
import SubjectTile from '../../components/learning/SubjectTile';
import './Learn.css';

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
                {level.access === ACCESS_MODES.REVISION && !isActive && (
                  <MdCheck className="class-ladder__icon" aria-hidden="true" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="class-ladder__hint">
        <MdHistory aria-hidden="true" /> Tap an earlier class to revise it.
        <span><MdLock aria-hidden="true" /> Locked classes open next school year.</span>
      </p>
    </nav>
  );
}

const RULE_GROUP_LABELS = {
  CORE: 'Core subjects',
  PATHWAY_ELECTIVE: 'Learning area electives',
  ADDITIONAL_ELECTIVE: 'Additional electives',
  SCIENCE_ELECTIVE: 'Science electives',
  HUMANITIES_ELECTIVE: 'Humanities electives',
  INTERVENTION: 'Support subjects',
};

export default function LearnIndex() {
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

  // Choosing an earlier class on the ladder puts the page in revision mode:
  // the subject list stays the learner's own, and each subject opens on that
  // class's lessons. The API rejects anything above the current class (§5).
  const handleSelectClass = useCallback((code) => setViewingClass(code), []);

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
  const isRevising = Boolean(viewingClass && data?.class_level && viewingClass !== data.class_level);
  const revisingLabel = classLevels.find((l) => l.code === viewingClass)?.label || viewingClass;
  const linkFor = (subject) => (isRevising
    ? `/learn/${subject.slug}?class=${encodeURIComponent(viewingClass)}`
    : `/learn/${subject.slug}`);

  const renderGrid = (units) => (
    <div className={`subject-grid subject-grid--${presentation.mode}`}>
      {units.map((subject) => (
        <SubjectTile
          key={subject.id || subject.slug}
          subject={subject}
          mode={presentation.mode}
          showProgress={!isRevising && presentation.showProgressPercent}
          badge={subject.required && groups ? 'Core' : null}
          to={linkFor(subject)}
        />
      ))}
    </div>
  );

  return (
    <div
      className={`learn-page learn-page--${presentation.mode}`}
      data-level-group={levelGroup}
    >
      <header className="learn-header">
        <span className="learn-header__class">{data?.class_label}</span>
        <h1 className="learn-header__title">
          {levelGroup === LEVEL_GROUPS.KINDERGARTEN ? 'What shall we learn?' : `Your ${unitNoun.plural.toLowerCase()}`}
        </h1>
        {presentation.textDensity !== 'minimal' && (
          <p className="learn-header__sub">
            {subjects.length} {subjects.length === 1 ? unitNoun.singular.toLowerCase() : unitNoun.plural.toLowerCase()}
            {' '}for {data?.class_label}{data?.academic_year ? `, ${data.academic_year}` : ''}.
          </p>
        )}
      </header>

      {/* KG has no class ladder: a 4-year-old does not navigate a revision
          timeline, and §8 asks for the simplest possible flow. */}
      {levelGroup !== LEVEL_GROUPS.KINDERGARTEN && (
        <ClassLadder levels={classLevels} activeCode={viewingClass} onSelect={handleSelectClass} />
      )}

      {isRevising && (
        <div className="revision-banner" role="status">
          <MdHistory aria-hidden="true" />
          <span>Revising <strong>{revisingLabel}</strong>. Lessons open in revision mode.</span>
          <button type="button" onClick={() => setViewingClass(data.class_level)}>
            Back to {data.class_label}
          </button>
        </div>
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
                <h2 className="subject-group__title">{RULE_GROUP_LABELS[groupKey] || groupKey.replace(/_/g, ' ').toLowerCase()}</h2>
                {renderGrid(units)}
              </section>
            ))}
        </div>
      ) : (
        renderGrid(subjects)
      )}
    </div>
  );
}

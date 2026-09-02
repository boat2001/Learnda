// The Practice page: practice sets for the learner's own class.
//
// Mirrors Learn (§8 presentation modes, §6.3 class ladder) but adds a hard
// gate: §4.1 and §7 give Kindergarten no exams and no quizzes at all, so a KG
// learner does not see a reduced version of this page -- they see a friendly
// explanation that practice starts in Basic 1. Primary gets "gentle"
// assessments; JHS and SHS get the full practice-heavy surface.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MdQuiz, MdLock, MdHistory, MdRefresh, MdChevronRight, MdAutoAwesome,
} from 'react-icons/md';
import usePageTitle from '../../hooks/usePageTitle';
import api from '../../services/api';
import {
  ACCESS_MODES,
  LEVEL_GROUPS,
  getPresentation,
  getUnitNoun,
  getFeatureAccess,
} from '../../constants/education';
import ClassPlacementPrompt from '../learn/ClassPlacementPrompt';
import './Practice.css';

/** §7: what practice looks like at this level, in the learner's own words. */
const practiceCopyFor = (levelGroup) => {
  const quizzes = getFeatureAccess('quizzes', levelGroup);
  const exams = getFeatureAccess('exams', levelGroup);

  if (quizzes === 'off') return null; // Kindergarten -- no practice surface at all.

  if (exams === 'limited') {
    return {
      title: 'Practice what you have learnt',
      sub: 'Short, friendly question sets. There is no score to worry about — just try your best.',
      cta: 'Start practice',
    };
  }

  return {
    title: 'Practice and past questions',
    sub: 'Work through question sets for your class, then test yourself under exam conditions.',
    cta: 'Start practice',
  };
};

function PracticeCard({ subject, unitNoun, presentation }) {
  const initials = subject.name.slice(0, 2).toUpperCase();
  return (
    <Link to={`/practice/${subject.slug}`} className="practice-card">
      <span className="practice-card__mark" aria-hidden="true">
        {subject.icon || initials}
      </span>
      <span className="practice-card__body">
        <h3 className="practice-card__title">{subject.name}</h3>
        {presentation.textDensity === 'full' && (
          <p className="practice-card__meta">
            {subject.required ? `Core ${unitNoun.singular.toLowerCase()}` : unitNoun.singular}
          </p>
        )}
      </span>
      <MdChevronRight className="practice-card__chevron" aria-hidden="true" />
    </Link>
  );
}

export default function PracticeIndex() {
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
        error: err?.message || 'We could not load practice right now. Please try again.',
        data: null,
      });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const data = state.data;
  const levelGroup = data?.level_group || null;
  const presentation = useMemo(() => getPresentation(levelGroup), [levelGroup]);
  const unitNoun = useMemo(() => data?.unit_noun || getUnitNoun(levelGroup), [data, levelGroup]);
  const copy = useMemo(() => practiceCopyFor(levelGroup), [levelGroup]);

  usePageTitle('Practice');

  if (state.loading) {
    return (
      <div className="practice-page" aria-busy="true">
        <div className="practice-page__skeleton">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="practice-page__skeleton-row" />
          ))}
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="practice-page">
        <div className="practice-empty">
          <h2>Something went wrong</h2>
          <p>{state.error}</p>
          <button type="button" className="btn btn-primary" onClick={load}>
            <MdRefresh aria-hidden="true" /> Try again
          </button>
        </div>
      </div>
    );
  }

  if (data?.needs_class_placement) return <ClassPlacementPrompt onPlaced={load} />;
  if (data?.needs_pathway) {
    return <ClassPlacementPrompt mode="pathway" classLevel={data.class_level} onPlaced={load} />;
  }

  // §4.1 / §7: Kindergarten has no quizzes and no exams. Say so warmly rather
  // than showing an empty list a parent would read as a broken page.
  if (!copy) {
    return (
      <div className="practice-page" data-level-group={levelGroup}>
        <div className="practice-kg">
          <span className="practice-kg__icon" aria-hidden="true"><MdAutoAwesome /></span>
          <h1 className="practice-kg__title">No tests in Kindergarten</h1>
          <p className="practice-kg__body">
            Learning at this age is for playing, listening and exploring — not for scores.
            Practice sets begin in Basic 1.
          </p>
          <Link to="/learn" className="btn btn-primary">
            Back to learning
          </Link>
        </div>
      </div>
    );
  }

  const subjects = data?.subjects || [];

  return (
    <div
      className={`practice-page practice-page--${presentation.mode}`}
      data-level-group={levelGroup}
    >
      <header className="practice-header">
        <p className="practice-header__eyebrow">
          <MdQuiz aria-hidden="true" /> {data?.class_label}
        </p>
        <h1 className="practice-header__title">{copy.title}</h1>
        <p className="practice-header__sub">{copy.sub}</p>
      </header>

      {levelGroup !== LEVEL_GROUPS.KINDERGARTEN && classLevels.length > 0 && (
        <nav className="class-ladder" aria-label="Your classes">
          <ul className="class-ladder__list">
            {classLevels.map((level) => {
              const isLocked = level.access === ACCESS_MODES.LOCKED;
              return (
                <li key={level.code}>
                  <button
                    type="button"
                    className={[
                      'class-ladder__item',
                      level.code === viewingClass ? 'is-active' : '',
                      isLocked ? 'is-locked' : '',
                      level.access === ACCESS_MODES.REVISION ? 'is-revision' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => !isLocked && setViewingClass(level.code)}
                    disabled={isLocked}
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
        </nav>
      )}

      {subjects.length === 0 ? (
        <div className="practice-empty">
          <h2>Nothing to practise yet</h2>
          <p>Practice sets for {data?.class_label} are being prepared.</p>
        </div>
      ) : (
        <div className="practice-list">
          {subjects.map((subject) => (
            <PracticeCard
              key={subject.id || subject.slug}
              subject={subject}
              unitNoun={unitNoun}
              presentation={presentation}
            />
          ))}
        </div>
      )}
    </div>
  );
}

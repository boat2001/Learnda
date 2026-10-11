// The Practice page: practice sets for the learner's own class.
//
// Mirrors Learn (§8 presentation modes, §6.3 class ladder) but adds a hard
// gate: §4.1 and §7 give Kindergarten no exams and no quizzes at all, so a KG
// learner does not see a reduced version of this page -- they see a friendly
// explanation that practice starts in Basic 1. Primary gets "gentle"
// assessments; JHS and SHS get the full practice-heavy surface.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MdRefresh, MdAutoAwesome, MdTimer, MdEditNote } from 'react-icons/md';
import usePageTitle from '../../hooks/usePageTitle';
import api from '../../services/api';
import {
  getPresentation,
  getUnitNoun,
  getFeatureAccess,
} from '../../constants/education';
import ClassPlacementPrompt from '../learn/ClassPlacementPrompt';
import SubjectTile from '../../components/learning/SubjectTile';
import './Practice.css';

/** §7: what practice looks like at this level, in the learner's own words. */
const practiceCopyFor = (levelGroup) => {
  const quizzes = getFeatureAccess('quizzes', levelGroup);
  const exams = getFeatureAccess('exams', levelGroup);

  if (quizzes === 'off') return null; // Kindergarten -- no practice surface at all.

  if (exams === 'limited') {
    return {
      title: 'Practise what you learnt',
      sub: 'Short, friendly questions. No pressure, just try your best.',
      exam: null,
    };
  }

  const exam = levelGroup === 'SHS' ? 'WASSCE' : 'BECE';
  return {
    title: `Practice and ${exam} prep`,
    sub: `Question sets for your class, then timed papers in the style of the ${exam}.`,
    exam,
  };
};

export default function PracticeIndex() {
  const [state, setState] = useState({ loading: true, error: '', data: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const subjectsRes = await api.subjects.getAll();
      setState({ loading: false, error: '', data: subjectsRes?.data || null });
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
  const tileMode = presentation.mode === 'structured' ? 'structured' : 'visual';

  return (
    <div
      className={`practice-page practice-page--${presentation.mode}`}
      data-level-group={levelGroup}
    >
      <header className="practice-header">
        <span className="practice-header__icon" aria-hidden="true"><MdEditNote /></span>
        <div>
          <span className="practice-header__class">{data?.class_label}</span>
          <h1 className="practice-header__title">{copy.title}</h1>
          <p className="practice-header__sub">{copy.sub}</p>
        </div>
      </header>

      {copy.exam && (
        <p className="practice-tip">
          <MdTimer aria-hidden="true" />
          Open a subject to choose quick practice or a timed {copy.exam}-style paper.
        </p>
      )}

      {subjects.length === 0 ? (
        <div className="practice-empty">
          <h2>Nothing to practise yet</h2>
          <p>Practice sets for {data?.class_label} are being prepared.</p>
        </div>
      ) : (
        <section aria-label={`Practise by ${unitNoun.singular.toLowerCase()}`}>
          <h2 className="practice-list__title">Choose a {unitNoun.singular.toLowerCase()}</h2>
          <div className={`practice-list practice-list--${tileMode}`}>
            {subjects.map((subject) => (
              <SubjectTile
                key={subject.id || subject.slug}
                subject={subject}
                mode={tileMode}
                showProgress={false}
                to={`/practice/${subject.slug}`}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

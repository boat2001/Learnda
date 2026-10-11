// A learner's home: today, in their class.
//
// Order of the page follows what a learner opens the app to do:
//   1. pick up where they stopped
//   2. choose a subject
//   3. practise (not in KG: §4.1, §7)
//   4. see where they are in the school journey (not in KG: §8)
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MdArrowForward,
  MdLocalFireDepartment,
  MdPlayArrow,
  MdEditNote,
  MdSchool,
  MdRefresh,
} from 'react-icons/md';
import api from '../../services/api';
import usePageTitle from '../../hooks/usePageTitle';
import { useGamification } from '../../hooks/useGamification';
import SubjectTile from '../../components/learning/SubjectTile';
import ClassJourney from '../../components/learning/ClassJourney';
import {
  getClassLabel,
  getPresentation,
  getUnitNoun,
  isFeatureEnabled,
  LEVEL_GROUPS,
} from '../../constants/education';
import { getSubjectVisual, subjectColorVars } from '../../constants/subjectVisuals';
import { readLastActivity } from '../../utils/lastActivity';
import { speak } from '../../utils/speech';

const firstName = (user) => {
  const full = user?.full_name || user?.name || '';
  return full.trim().split(/\s+/)[0] || '';
};

const greetingFor = (date = new Date()) => {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const EXAM_FOR = { JHS: 'BECE', SHS: 'WASSCE' };

/** How many subjects to show on Home before "See all". */
const HOME_SUBJECT_LIMIT = { playful: 8, visual: 6, structured: 5 };

function ContinueCard({ activity, fallbackSubject }) {
  if (activity) {
    return (
      <Link to={activity.path} className="continue-card">
        <span className="continue-card__play" aria-hidden="true"><MdPlayArrow /></span>
        <span className="continue-card__body">
          <span className="continue-card__eyebrow">Continue where you stopped</span>
          <strong className="continue-card__title">{activity.title || 'Your last lesson'}</strong>
          {activity.subtitle && <span className="continue-card__meta">{activity.subtitle}</span>}
          {Number.isFinite(activity.progress) && (
            <span className="continue-card__bar"><i style={{ width: `${activity.progress}%` }} /></span>
          )}
        </span>
        <MdArrowForward className="continue-card__arrow" aria-hidden="true" />
      </Link>
    );
  }

  if (!fallbackSubject) return null;
  const { icon: Icon } = getSubjectVisual(fallbackSubject.slug);
  return (
    <Link to={`/learn/${fallbackSubject.slug}`} className="continue-card is-start" style={subjectColorVars(fallbackSubject.slug)}>
      <span className="continue-card__play is-subject" aria-hidden="true"><Icon /></span>
      <span className="continue-card__body">
        <span className="continue-card__eyebrow">Start here</span>
        <strong className="continue-card__title">Your first {fallbackSubject.name} lesson</strong>
        <span className="continue-card__meta">Takes about 10 minutes</span>
      </span>
      <MdArrowForward className="continue-card__arrow" aria-hidden="true" />
    </Link>
  );
}

function PlacementCard({ needsPathway }) {
  return (
    <section className="home-placement">
      <span className="home-placement__icon" aria-hidden="true"><MdSchool /></span>
      <div>
        <h2>{needsPathway ? 'Choose your learning area' : 'Which class are you in?'}</h2>
        <p>
          {needsPathway
            ? 'Tell us your SHS learning area so we can show your elective subjects.'
            : 'Tell us once, and we will show the lessons for your class.'}
        </p>
      </div>
      <Link to="/learn" className="btn btn-primary">
        {needsPathway ? 'Choose learning area' : 'Choose my class'}
      </Link>
    </section>
  );
}

export default function LearnerHome({ user }) {
  usePageTitle('Home');
  const { streak } = useGamification();
  const [state, setState] = useState({ loading: true, error: '', data: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const res = await api.subjects.getAll();
      setState({ loading: false, error: '', data: res?.data || null });
    } catch (err) {
      setState({ loading: false, error: err?.message || 'Could not load your subjects.', data: null });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const data = state.data;
  const classLevel = data?.class_level || user?.class_level || null;
  const levelGroup = data?.level_group || user?.level_group || null;
  const presentation = getPresentation(levelGroup);
  const mode = presentation.mode;
  const isKG = levelGroup === LEVEL_GROUPS.KINDERGARTEN;
  const unitNoun = data?.unit_noun || getUnitNoun(levelGroup);
  const subjects = data?.subjects || [];
  const shownSubjects = subjects.slice(0, HOME_SUBJECT_LIMIT[mode] || 6);
  const lastActivity = useMemo(() => readLastActivity(), []);
  const name = firstName(user);
  const exam = EXAM_FOR[levelGroup];
  const showPractice = levelGroup && isFeatureEnabled('quizzes', levelGroup);
  const needsPlacement = data?.needs_class_placement || (!state.loading && !classLevel);

  const greeting = isKG ? `Hello${name ? `, ${name}` : ''}!` : `${greetingFor()}${name ? `, ${name}` : ''}`;
  const schoolLine = [getClassLabel(classLevel), user?.term, user?.academic_year || data?.academic_year]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className={`learner-home learner-home--${mode}`} data-level-group={levelGroup || undefined}>
      <header className="learner-home__hello">
        <div>
          {schoolLine && <span className="learner-home__school">{schoolLine}</span>}
          <h1 className="learner-home__greeting">
            {greeting}
            {isKG && (
              <button
                type="button"
                className="learner-home__say"
                onClick={() => speak(`${greeting} What shall we learn today?`)}
                aria-label="Hear this"
              >
                <MdPlayArrow aria-hidden="true" />
              </button>
            )}
          </h1>
          <p className="learner-home__tone">
            {isKG ? 'What shall we learn today?' : 'Ready to learn something new today?'}
          </p>
        </div>
        {!isKG && streak > 0 && (
          <span className="streak-pill" title={`${streak}-day learning streak`}>
            <MdLocalFireDepartment aria-hidden="true" />
            <strong>{streak}</strong> day{streak === 1 ? '' : 's'}
          </span>
        )}
      </header>

      {needsPlacement || data?.needs_pathway ? (
        <PlacementCard needsPathway={Boolean(data?.needs_pathway)} />
      ) : (
        <>
          {!isKG && (
            <ContinueCard activity={lastActivity} fallbackSubject={subjects[0]} />
          )}

          <section className="home-block" aria-labelledby="home-subjects">
            <div className="home-block__head">
              <h2 id="home-subjects">{isKG ? 'Tap a picture' : `Your ${unitNoun.plural.toLowerCase()}`}</h2>
              {subjects.length > shownSubjects.length && (
                <Link to="/learn" className="home-block__more">
                  See all {subjects.length} <MdArrowForward aria-hidden="true" />
                </Link>
              )}
            </div>

            {state.loading ? (
              <div className={`home-subjects home-subjects--${mode}`} aria-busy="true">
                {Array.from({ length: 4 }).map((_, i) => <span key={i} className="home-skeleton-tile" />)}
              </div>
            ) : state.error ? (
              <div className="home-error">
                <p>{state.error}</p>
                <button type="button" className="btn btn-secondary" onClick={load}>
                  <MdRefresh aria-hidden="true" /> Try again
                </button>
              </div>
            ) : (
              <div className={`home-subjects home-subjects--${mode}`}>
                {(isKG ? subjects : shownSubjects).map((subject) => (
                  <SubjectTile key={subject.id || subject.slug} subject={subject} mode={mode} />
                ))}
              </div>
            )}
          </section>

          {showPractice && (
            <section className="practice-banner">
              <span className="practice-banner__icon" aria-hidden="true"><MdEditNote /></span>
              <div className="practice-banner__copy">
                <h2>{exam ? `Get ready for ${exam}` : 'Quick practice'}</h2>
                <p>
                  {exam
                    ? `Practise ${getClassLabel(classLevel)} questions in the style of the ${exam}.`
                    : 'A few questions on what you learnt this week. No pressure!'}
                </p>
              </div>
              <Link to="/practice" className="btn btn-accent">
                Practise now
              </Link>
            </section>
          )}

          {!isKG && classLevel && (
            <section className="home-block" aria-labelledby="home-journey">
              <div className="home-block__head">
                <h2 id="home-journey">Your school journey</h2>
              </div>
              <div className="home-journey-card">
                <ClassJourney current={classLevel} />
                <p className="home-journey-card__note">
                  You can revise any earlier class. The next class opens when the new school year starts.
                </p>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

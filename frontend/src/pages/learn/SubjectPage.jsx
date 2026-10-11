// One subject for one class: its lessons, in teaching order.
//
// Replaces the tertiary CourseDetail page. By default it shows the learner's
// current class only (§5). Earlier classes in the same stage can be opened
// for revision (§6.3), either from the chips here or from the ladder on the
// Learn page (?class=B2). The API refuses anything above the current class.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  MdArrowBack,
  MdCheck,
  MdHistory,
  MdPlayArrow,
  MdRefresh,
  MdSchedule,
  MdVolumeUp,
} from 'react-icons/md';
import api from '../../services/api';
import usePageTitle from '../../hooks/usePageTitle';
import { useAuth } from '../../hooks/useAuth';
import {
  getClassLabel,
  getLevelGroup,
  getPresentation,
  getUnitNoun,
  isFeatureEnabled,
} from '../../constants/education';
import { getSubjectVisual, subjectColorVars } from '../../constants/subjectVisuals';
import { recordLastActivity, ACTIVITY_TYPES } from '../../utils/lastActivity';
import { speak } from '../../utils/speech';
import './SubjectPage.css';

const minutesOf = (lesson) => {
  const n = Number(lesson.duration_minutes || lesson.reading_time || String(lesson.duration || '').match(/\d+/)?.[0]);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const isDone = (lesson) => Boolean(lesson.completed || lesson.is_completed || Number(lesson.progress) >= 100);

/** Groups lessons by strand when the content has strands, keeping lesson order. */
const groupByStrand = (lessons) => {
  const groups = [];
  const index = new Map();
  lessons.forEach((lesson) => {
    const strand = lesson.strand || lesson.metadata?.strand || '';
    if (!index.has(strand)) {
      index.set(strand, groups.length);
      groups.push({ strand, lessons: [] });
    }
    groups[index.get(strand)].lessons.push(lesson);
  });
  return groups;
};

export default function SubjectPage() {
  const { courseSlug: slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [subjectState, setSubjectState] = useState({ loading: true, error: '', subject: null, classLevels: [] });
  const [lessonState, setLessonState] = useState({ loading: true, error: '', lessons: [] });

  const currentClass = user?.class_level || subjectState.subject?.class_level || null;
  const viewingClass = searchParams.get('class') || currentClass;
  const isRevision = Boolean(viewingClass && currentClass && viewingClass !== currentClass);

  const loadSubject = useCallback(async () => {
    setSubjectState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const res = await api.subjects.getBySlug(slug);
      setSubjectState({
        loading: false,
        error: '',
        subject: res?.data?.subject || null,
        classLevels: res?.data?.class_levels || [],
      });
    } catch (err) {
      setSubjectState({
        loading: false,
        error: err?.status === 404 ? 'not_found' : (err?.message || 'Could not load this subject.'),
        subject: null,
        classLevels: [],
      });
    }
  }, [slug]);

  const loadLessons = useCallback(async () => {
    if (!viewingClass) return;
    setLessonState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const res = await api.subjects.getLessons(slug, { classLevel: viewingClass });
      setLessonState({ loading: false, error: '', lessons: res?.data?.lessons || [] });
    } catch (err) {
      setLessonState({ loading: false, error: err?.message || 'Could not load lessons.', lessons: [] });
    }
  }, [slug, viewingClass]);

  useEffect(() => { loadSubject(); }, [loadSubject]);
  useEffect(() => { loadLessons(); }, [loadLessons]);

  const subject = subjectState.subject;
  const levelGroup = subject?.level_group || getLevelGroup(currentClass);
  const presentation = getPresentation(levelGroup);
  const unitNoun = getUnitNoun(levelGroup);
  const { icon: Icon } = getSubjectVisual(slug);
  const lessons = lessonState.lessons;
  const doneCount = lessons.filter(isDone).length;
  const nextLesson = lessons.find((l) => !isDone(l)) || lessons[0] || null;
  const strandGroups = useMemo(() => groupByStrand(lessons), [lessons]);
  const showPractice = !isRevision && isFeatureEnabled('quizzes', levelGroup);

  // Revision chips: earlier classes of this subject in the same stage.
  const revisionClasses = subjectState.classLevels.filter((l) => l.code !== currentClass);

  usePageTitle(subject ? `${subject.name} · ${getClassLabel(viewingClass)}` : unitNoun.singular);

  const openLesson = (lesson) => {
    recordLastActivity({
      type: ACTIVITY_TYPES.LEARNING,
      title: lesson.title,
      subtitle: `${subject?.name || ''} · ${getClassLabel(lesson.class_level_code || viewingClass)}`,
      path: `/learn/lesson/${lesson.id}`,
    });
    navigate(`/learn/lesson/${lesson.id}`, {
      state: {
        coursePath: `/learn/${slug}${isRevision ? `?class=${viewingClass}` : ''}`,
        course: subject ? { id: subject.id, title: subject.name, name: subject.name, slug } : null,
        courseId: subject?.id,
        lessonSequence: lessons.map((l) => ({ id: l.id, title: l.title, lesson_number: l.lesson_number })),
        lessonEntryMode: isRevision ? 'revision' : 'learn',
      },
    });
  };

  const selectClass = (code) => {
    if (!code || code === currentClass) setSearchParams({}, { replace: true });
    else setSearchParams({ class: code }, { replace: true });
  };

  if (subjectState.error === 'not_found') {
    return (
      <div className="subject-page">
        <div className="subject-missing">
          <h1>We can’t find that {unitNoun.singular.toLowerCase()}</h1>
          <p>It may not be part of your class. Your {unitNoun.plural.toLowerCase()} are all on the Learn page.</p>
          <Link to="/learn" className="btn btn-primary">Go to Learn</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`subject-page subject-page--${presentation.mode}`} style={subjectColorVars(slug)}>
      <Link to="/learn" className="subject-back">
        <MdArrowBack aria-hidden="true" /> All {unitNoun.plural.toLowerCase()}
      </Link>

      <header className="subject-hero">
        <span className="subject-hero__art" aria-hidden="true"><Icon /></span>
        <div className="subject-hero__copy">
          <span className="subject-hero__class">
            {getClassLabel(viewingClass)}{isRevision ? ' · Revision' : ''}
          </span>
          <h1 className="subject-hero__title">
            {subject?.name || (subjectState.loading ? '…' : unitNoun.singular)}
            {presentation.audioFirst && subject && (
              <button type="button" className="subject-hero__listen" onClick={() => speak(subject.name)} aria-label={`Hear "${subject.name}"`}>
                <MdVolumeUp aria-hidden="true" />
              </button>
            )}
          </h1>
          {lessons.length > 0 && presentation.showProgressPercent && (
            <div className="subject-hero__progress">
              <span className="subject-hero__bar"><i style={{ width: `${Math.round((doneCount / lessons.length) * 100)}%` }} /></span>
              <span>{doneCount} of {lessons.length} lessons done</span>
            </div>
          )}
        </div>
        {nextLesson && !lessonState.loading && (
          <button type="button" className="btn btn-accent btn-lg subject-hero__cta" onClick={() => openLesson(nextLesson)}>
            <MdPlayArrow aria-hidden="true" /> {doneCount > 0 ? 'Continue' : 'Start'}
          </button>
        )}
      </header>

      {revisionClasses.length > 0 && (
        <nav className="subject-classes" aria-label="Choose a class">
          <button
            type="button"
            className={`subject-classes__chip${!isRevision ? ' is-active' : ''}`}
            onClick={() => selectClass(currentClass)}
            aria-pressed={!isRevision}
          >
            {getClassLabel(currentClass)} <small>this year</small>
          </button>
          {revisionClasses.map((level) => (
            <button
              key={level.code}
              type="button"
              className={`subject-classes__chip${viewingClass === level.code ? ' is-active' : ''}`}
              onClick={() => selectClass(level.code)}
              aria-pressed={viewingClass === level.code}
            >
              <MdHistory aria-hidden="true" /> {level.label}
            </button>
          ))}
        </nav>
      )}

      {lessonState.loading ? (
        <ol className="lesson-path" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => <li key={i} className="lesson-skeleton" />)}
        </ol>
      ) : lessonState.error ? (
        <div className="subject-note is-error">
          <p>{lessonState.error}</p>
          <button type="button" className="btn btn-secondary" onClick={loadLessons}>
            <MdRefresh aria-hidden="true" /> Try again
          </button>
        </div>
      ) : lessons.length === 0 ? (
        <div className="subject-note">
          <h2>Lessons are on the way</h2>
          <p>
            {subject?.name || 'This subject'} lessons for {getClassLabel(viewingClass)} are being prepared.
            Check back soon.
          </p>
        </div>
      ) : (
        strandGroups.map((group, gi) => (
          <section key={group.strand || gi} className="lesson-group">
            {group.strand && <h2 className="lesson-group__title">{group.strand}</h2>}
            <ol className="lesson-path">
              {group.lessons.map((lesson, i) => {
                const done = isDone(lesson);
                const isNext = lesson === nextLesson && !done;
                const minutes = minutesOf(lesson);
                return (
                  <li key={lesson.id} className={`lesson-step${done ? ' is-done' : ''}${isNext ? ' is-next' : ''}`}>
                    <button type="button" className="lesson-step__button" onClick={() => openLesson(lesson)}>
                      <span className="lesson-step__num" aria-hidden="true">
                        {done ? <MdCheck /> : (lesson.lesson_number || i + 1)}
                      </span>
                      <span className="lesson-step__body">
                        <span className="lesson-step__title">{lesson.title}</span>
                        <span className="lesson-step__meta">
                          {isNext && <span className="lesson-step__tag">Up next</span>}
                          {done && <span>Done</span>}
                          {presentation.showReadingTime && minutes && (
                            <span><MdSchedule aria-hidden="true" /> {minutes} min</span>
                          )}
                        </span>
                      </span>
                      <MdPlayArrow className="lesson-step__go" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        ))
      )}

      {showPractice && lessons.length > 0 && (
        <Link to={`/practice/${slug}`} className="subject-practice">
          <strong>Practise {subject?.name}</strong>
          <span>Questions on the {getClassLabel(currentClass)} topics you have covered.</span>
        </Link>
      )}
    </div>
  );
}

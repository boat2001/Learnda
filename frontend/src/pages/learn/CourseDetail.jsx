import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FiCheckCircle, FiChevronDown, FiCoffee, FiEye, FiFileText, FiLock, FiPlayCircle, FiX } from 'react-icons/fi';
import { useAuth } from '../../hooks/useAuth';
import { useSubscription } from '../../hooks/useSubscription';
import { useAnalytics } from '../../hooks/useAnalytics';
import usePageTitle from '../../hooks/usePageTitle';
import usePageLoadReady from '../../hooks/usePageLoadReady';
import UpgradePrompt from '../../components/subscription/UpgradePrompt';
import CoursePageSkeleton from '../../components/common/CoursePageSkeleton';
import HorizontalSlider from '../shared/listPage/HorizontalSlider';
import api from '../../services/api';
import { buildCourseRouteState, buildPracticePath } from '../../utils/courseRouting';
import { recordLastActivity, ACTIVITY_TYPES } from '../../utils/lastActivity';
import { getDisplayCourseCode } from '../../utils/courseCode';
import {
  buildPrelimProgressStorageKey,
  isCompletedPrelim,
  loadPrelimProgress,
} from '../../utils/prelimProgress';
import {
  FINAL_ASSESSMENT_PASS_PERCENT,
  buildFinalAssessmentQuestions,
  evaluateAssessmentSubmission,
  formatDurationLabel,
} from '../../utils/lessonAssessment';
import { lockBodyScroll } from '../../utils/bodyScrollLock';
import { formatCountCompact, resolveContentViewCount as resolveLessonViewCount, toFiniteNumber } from '../../utils/viewCounts';
import { playUiSound } from '../../utils/uiSounds';
import './CourseDetail.css';

import { FALLBACK_THUMBS, FALLBACK_COURSE_IMAGES } from '../../constants/courseAssets';

const LESSON_SKELETON_CARDS = Array.from({ length: 4 }, (_, index) => index);

// Shimmering placeholder row shown in a lesson section while its lessons are still loading.
// Reuses the shared course-page-skeleton-* shimmer classes (bundled via CoursePageSkeleton).
function LessonCardsSkeleton({ withHelperShort = false }) {
  return (
    <div className="course-slider" aria-hidden="true">
      <div className="course-page-skeleton-card-row course-lessons-skeleton-row">
        {LESSON_SKELETON_CARDS.map((card) => (
          <article key={card} className="course-page-skeleton-card course-lesson-card">
            <span className="course-page-skeleton-block course-page-skeleton-card-image" />
            <div className="course-page-skeleton-card-copy">
              <span className="course-page-skeleton-block course-page-skeleton-card-title" />
              <span className="course-page-skeleton-block course-page-skeleton-card-helper" />
              {withHelperShort ? (
                <span className="course-page-skeleton-block course-page-skeleton-card-helper short" />
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

const PRELIM_TABS = [
  { key: 'outline', label: 'Outline' },
  { key: 'description', label: 'Description' },
  { key: 'requirements', label: 'Requirements' },
  { key: 'big-picture', label: 'Big Picture' },
  { key: 'introduction', label: 'Introduction' },
];

const EMPTY_LESSON_PREP_STATE = {
  isOpen: false,
  lessonId: null,
  lessonTitle: '',
  lessonPreview: null,
  lessonSequence: [],
};
const EMPTY_JUMP_ASSESSMENT_STATE = {
  isOpen: false,
  isLoading: false,
  lessonId: null,
  sectionLabel: '',
  lessonTitle: '',
  lessonSequence: [],
  lessonPreview: null,
  questions: [],
  responses: {},
  error: '',
  unavailableMessage: '',
  result: null,
  elapsedSeconds: 0,
};
const EMPTY_COMPLETED_LESSON_STATE = {
  isOpen: false,
  lessonId: null,
  lessonTitle: '',
  lessonSequence: [],
  sectionLabel: '',
};

const getCourseCreditsText = (course) => {
  if (!course) return '3 Credits';
  if (course.creditsText) return course.creditsText;
  const raw = course.credits ?? course.credit ?? course.credit_hours;
  if (raw != null && String(raw).trim()) return `${String(raw).trim()} Credits`;
  return '3 Credits';
};

const resolveCourseStudiedCount = (course = {}) => {
  const source = course ?? {};
  return (
  Math.max(
    0,
    toFiniteNumber(
      source.total_studied ??
        source.total_studies ??
        source.total_study_count ??
        source.total_students_studied ??
        source.total_learners ??
        source.learners_count ??
        source.enrolled_count ??
        source.total_enrollments ??
        source.students_count ??
        0,
      0
    )
  ));
};

const resolveCourseActiveLearners = (course = {}) => {
  const source = course ?? {};
  return (
  Math.max(
    0,
    toFiniteNumber(
      source.currently_studying ??
        source.current_students ??
        source.active_students ??
        source.active_learners ??
        source.live_students ??
        source.online_students ??
        0,
      0
    )
  ));
};

const clampCount = (value, max) => Math.min(max, Math.max(0, Number(value) || 0));

const isCoveredItem = (item) =>
  Boolean(
    item?.completed ||
      item?.is_completed ||
      item?.status === 'completed' ||
      item?.progress === 100 ||
      item?.progress_percent === 100 ||
      item?.progress >= 1
  );

const getCoveredCount = (items) => (Array.isArray(items) ? items.filter(isCoveredItem).length : 0);

const isCompletedItem = (item) => {
  const progressValues = [
    item?.progress,
    item?.progress_percent,
    item?.progress_percentage,
    item?.user_interactions?.progress,
    item?.user_engagement?.progress_percentage,
  ]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  return Boolean(
    item?.completed ||
      item?.is_completed ||
      item?.status === 'completed' ||
      progressValues.some((value) => value >= 100 || value === 1)
  );
};

const getLessonThumbnail = (lesson, index) =>
  lesson?.thumbnail ||
  lesson?.image ||
  lesson?.cover_image ||
  lesson?.coverImage ||
  lesson?.image_url ||
  FALLBACK_THUMBS[index % FALLBACK_THUMBS.length];

const getLessonChunkCount = (lesson = {}) => {
  const directCount = [
    lesson?.chunk_count,
    lesson?.chunkCount,
    lesson?.total_chunks,
    lesson?.totalChunks,
    lesson?.metadata?.chunk_count,
    lesson?.metadata?.chunkCount,
    lesson?.metadata?.total_chunks,
    lesson?.metadata?.totalChunks,
  ]
    .map((value) => Number(value))
    .find((value) => Number.isFinite(value) && value > 0);

  if (directCount) return directCount;

  const lessonDocument = lesson?.lesson_document || lesson?.metadata?.lesson_document || lesson?.metadata?.lesson_payload;
  if (Array.isArray(lessonDocument?.chunks)) return lessonDocument.chunks.length;
  if (lessonDocument?.chunks && typeof lessonDocument.chunks === 'object') {
    return Object.keys(lessonDocument.chunks).length;
  }

  return 0;
};

const buildLessonSequence = (items = []) =>
  (Array.isArray(items) ? items : []).reduce((sequence, item, index) => {
    if (!item?.id) return sequence;

    sequence.push({
      id: item.id,
      title: item.title || `Lesson ${index + 1}`,
      lessonNumber:
        Number(
          item?.lessonNumber ||
            item?.lesson_number ||
            item?.sequence ||
            item?.metadata?.lesson_number ||
            item?.metadata?.sequence ||
            index + 1
        ) || index + 1,
    });

    return sequence;
  }, []);

const getNormalizedLessonType = (lesson = {}) => {
  const type = String(
    lesson?.type ||
      lesson?.content_type ||
      lesson?.lesson_type ||
      lesson?.format ||
      lesson?.contentType ||
      ''
  )
    .trim()
    .toLowerCase();

  if (
    type === 'video' ||
    type === 'video_lesson' ||
    type.includes('video') ||
    lesson?.video_url ||
    lesson?.videoUrl
  ) {
    return 'video';
  }

  if (type === 'text_lesson' || type === 'lesson' || type.includes('text')) {
    return 'text_lesson';
  }

  return 'text_lesson';
};

const getCourseLessonRows = (response) => {
  if (Array.isArray(response?.data?.lessons)) return response.data.lessons;
  if (Array.isArray(response?.lessons)) return response.lessons;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};

const getLessonRole = (lesson = {}) =>
  String(
    lesson?.lesson_role ||
      lesson?.content_role ||
      lesson?.section_role ||
      lesson?.metadata?.lesson_role ||
      lesson?.metadata?.content_role ||
      ''
  )
    .trim()
    .toLowerCase();

const splitLessonsByType = (items = []) =>
  items.reduce(
    (accumulator, lesson) => {
      if (!lesson?.id) return accumulator;
      if (getLessonRole(lesson) === 'prelim') {
        accumulator.prelims.push(lesson);
        return accumulator;
      }
      if (getNormalizedLessonType(lesson) === 'video') {
        accumulator.videos.push(lesson);
      } else {
        accumulator.lessons.push(lesson);
      }
      return accumulator;
    },
    { prelims: [], lessons: [], videos: [] }
  );

const splitIntoPrelimParagraphs = (value = '') => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return [];

  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((item) => item.trim()).filter(Boolean) || [text];
  const paragraphs = [];

  for (let index = 0; index < sentences.length; index += 2) {
    paragraphs.push(sentences.slice(index, index + 2).join(' '));
  }

  return paragraphs;
};

const buildPrelimPreviewLesson = ({ course, prelim, courseImage, courseSlug, courseId }) => {
  const syntheticId = `prelim-${courseId || courseSlug || 'course'}-${prelim.key}`;
  const paragraphs = splitIntoPrelimParagraphs(prelim.content);
  const lessonDocument = {
    schema_version: 'lesson_document.v2',
    lesson_number: prelim.order,
    main_topic: prelim.label,
    lesson_details: {
      main_topic: prelim.label,
    },
    chunks: [
      {
        id: `${prelim.key}-chunk-0`,
        heading: prelim.label,
        illustration: courseImage
          ? {
              src: courseImage,
              alt: `${prelim.label} illustration`,
              caption: `${prelim.label} for ${course?.title || 'this course'}.`,
              mobile_position: 'between_paragraph_0_1',
              desktop_align: 'right',
            }
          : null,
        paragraphs: paragraphs.map((paragraph, index) => ({
          id: `par_${index}`,
          body_html: `<p>${paragraph}</p>`,
        })),
      },
    ],
  };

  return {
    id: syntheticId,
    title: prelim.label,
    description: prelim.content,
    type: 'text_lesson',
    status: 'published',
    thumbnail_url: courseImage || '',
    featured_image: courseImage || '',
    metadata: {
      slug: syntheticId,
      course: course?.title || '',
      course_id: course?.id || courseId || null,
      lesson_role: 'prelim',
      virtual_lesson: true,
      lesson_number: prelim.order,
      sequence: prelim.order,
      featured_image: courseImage || '',
      summary: prelim.content,
      lesson_document: lessonDocument,
    },
  };
};

const getStoredLessonUnlocks = (storageKey) => {
  if (typeof window === 'undefined' || !storageKey) return {};

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    return {};
  }
};

const storeLessonUnlocks = (storageKey, unlocks) => {
  if (typeof window === 'undefined' || !storageKey) return;

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(unlocks));
  } catch (error) {
    // Ignore persistence failures and keep the session moving.
  }
};

const getLessonAccessStorageKey = ({ course, courseSlug, userId }) => {
  const courseKey = String(course?.id || course?.course_id || course?.content_id || courseSlug || 'course').trim();
  const learnerKey = String(userId || 'guest').trim();
  return `learnda:lesson-access:${learnerKey}:${courseKey}`;
};

const normalizeImageUrl = (value) => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (/^(https?:)?\/\//i.test(text) || text.startsWith('data:')) return text;
  if (text.startsWith('/')) return text;
  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}${text}`;
};

const getCourseImage = (course, index = 0) =>
  normalizeImageUrl(
    course?.thumbnail_url ||
      course?.image_url ||
      course?.cover_image ||
      course?.featured_image ||
      course?.thumbnail ||
      course?.image
  ) || FALLBACK_COURSE_IMAGES[index % FALLBACK_COURSE_IMAGES.length];

const getCourseImageIndex = (course) => {
  const seed = `${course?.title || ''}${course?.code || ''}`;
  if (!seed) return 0;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 2147483647;
  }
  return Math.abs(hash) % FALLBACK_COURSE_IMAGES.length;
};

const mergeCourseData = (base, next) => {
  if (!next) return base || null;
  const merged = { ...(base || {}) };
  Object.entries(next).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    merged[key] = value;
  });
  return merged;
};

const mergeLessonData = (base, next) => {
  if (!next) return base || null;

  return {
    ...(base || {}),
    ...next,
    metadata: {
      ...(base?.metadata || {}),
      ...(next?.metadata || {}),
    },
  };
};

// Learnda signature tone: triangle wave with sustain phase gives warm bell-like character.
const scheduleTone = (audioContext, destination, frequency, startAt, duration, volume, type = 'triangle') => {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gainNode.gain.setValueAtTime(0.0001, startAt);
  gainNode.gain.exponentialRampToValueAtTime(volume, startAt + 0.018);
  gainNode.gain.setValueAtTime(volume * 0.58, startAt + duration * 0.5);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gainNode);
  gainNode.connect(destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.05);
};

export default function CourseDetail() {
  const { courseSlug } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [prelimLessons, setPrelimLessons] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [videoLessons, setVideoLessons] = useState([]);
  const [prelimProgressMap, setPrelimProgressMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [lessonsLoading, setLessonsLoading] = useState(true);
  const [lessonJumpUnlocks, setLessonJumpUnlocks] = useState({});
  const [lessonPrepState, setLessonPrepState] = useState(EMPTY_LESSON_PREP_STATE);
  const [lessonPrepNotice, setLessonPrepNotice] = useState('');
  const [jumpAssessmentState, setJumpAssessmentState] = useState(EMPTY_JUMP_ASSESSMENT_STATE);
  const [completedLessonState, setCompletedLessonState] = useState(EMPTY_COMPLETED_LESSON_STATE);
  const [animatedProgressPercent, setAnimatedProgressPercent] = useState(0);
  const [animatedCoveredPercents, setAnimatedCoveredPercents] = useState({
    prelims: 0,
    lessons: 0,
    videos: 0,
  });
  const [coveredSectionsExpanded, setCoveredSectionsExpanded] = useState(false);

  const { user } = useAuth();
  const { hasFeature } = useSubscription();
  const { trackEvent } = useAnalytics();
  usePageTitle(course?.title || 'Course');
  const isProgressAnimationReady = usePageLoadReady(120);

  const courseIdParam = searchParams.get('id');
  const progressAudioRef = useRef(null);
  const progressAudioLockRef = useRef(0);
  const progressAnimationTimerRef = useRef(null);
  const progressAnimationFrameRef = useRef(null);
  const jumpAssessmentTimerRef = useRef(null);
  const jumpAssessmentStartedAtRef = useRef(null);
  const jumpAssessmentResultRef = useRef(null);
  const jumpAssessmentEnterButtonRef = useRef(null);
  const lessonAccessStorageKey = useMemo(
    () => getLessonAccessStorageKey({ course, courseSlug, userId: user?.id }),
    [course, courseSlug, user?.id]
  );
  const prelimProgressStorageKey = useMemo(
    () =>
      buildPrelimProgressStorageKey({
        courseId: course?.id || courseIdParam || null,
        courseSlug,
        userKey: user?.id || 'guest',
      }),
    [course?.id, courseIdParam, courseSlug, user?.id]
  );

  useEffect(() => {
    loadCourseData();
    trackEvent('course_view', { course_id: courseSlug, user_id: user?.id });
  }, [courseIdParam, courseSlug]);

  useEffect(() => {
    setLessonJumpUnlocks(getStoredLessonUnlocks(lessonAccessStorageKey));
  }, [lessonAccessStorageKey]);

  useEffect(() => {
    setPrelimProgressMap(loadPrelimProgress(prelimProgressStorageKey));
  }, [prelimProgressStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handlePrelimProgressUpdated = (event) => {
      const detail = event?.detail || {};
      const currentCourseId = String(course?.id || courseIdParam || '').trim();
      const detailCourseId = String(detail.courseId || '').trim();
      if (detailCourseId && currentCourseId && detailCourseId !== currentCourseId) return;
      setPrelimProgressMap(loadPrelimProgress(prelimProgressStorageKey));
    };

    window.addEventListener('learnda:prelim-progress-updated', handlePrelimProgressUpdated);
    return () => window.removeEventListener('learnda:prelim-progress-updated', handlePrelimProgressUpdated);
  }, [course?.id, courseIdParam, prelimProgressStorageKey]);

  useEffect(() => {
    if (!jumpAssessmentState.isOpen || typeof window === 'undefined') return undefined;

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        closeJumpAssessment();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [jumpAssessmentState.isOpen]);

  useEffect(() => {
    if (!lessonPrepState.isOpen && !completedLessonState.isOpen && !jumpAssessmentState.isOpen) {
      return undefined;
    }

    const releaseBodyScroll = lockBodyScroll();
    return releaseBodyScroll;
  }, [lessonPrepState.isOpen, completedLessonState.isOpen, jumpAssessmentState.isOpen]);

  useEffect(() => {
    if (!lessonPrepNotice || typeof window === 'undefined') return undefined;

    const timeoutId = window.setTimeout(() => {
      setLessonPrepNotice('');
    }, 4200);

    return () => window.clearTimeout(timeoutId);
  }, [lessonPrepNotice]);

  useEffect(() => {
    if (!completedLessonState.isOpen || typeof window === 'undefined') return undefined;

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setCompletedLessonState(EMPTY_COMPLETED_LESSON_STATE);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [completedLessonState.isOpen]);

  useEffect(() => {
    if (
      !jumpAssessmentState.isOpen ||
      jumpAssessmentState.isLoading ||
      jumpAssessmentState.result ||
      jumpAssessmentState.questions.length === 0
    ) {
      jumpAssessmentStartedAtRef.current = null;
      if (jumpAssessmentTimerRef.current) {
        window.clearInterval(jumpAssessmentTimerRef.current);
        jumpAssessmentTimerRef.current = null;
      }
      return undefined;
    }

    if (!jumpAssessmentStartedAtRef.current) {
      jumpAssessmentStartedAtRef.current = Date.now();
    }

    const tick = () => {
      if (!jumpAssessmentStartedAtRef.current) return;
      setJumpAssessmentState((previous) => ({
        ...previous,
        elapsedSeconds: Math.max(0, Math.round((Date.now() - jumpAssessmentStartedAtRef.current) / 1000)),
      }));
    };

    tick();
    jumpAssessmentTimerRef.current = window.setInterval(tick, 1000);

    return () => {
      if (jumpAssessmentTimerRef.current) {
        window.clearInterval(jumpAssessmentTimerRef.current);
        jumpAssessmentTimerRef.current = null;
      }
    };
  }, [
    jumpAssessmentState.isLoading,
    jumpAssessmentState.isOpen,
    jumpAssessmentState.questions.length,
    jumpAssessmentState.result,
  ]);

  useEffect(() => {
    if (!jumpAssessmentState.result?.key || typeof window === 'undefined') return undefined;

    const timeoutId = window.setTimeout(() => {
      const resultPanel = jumpAssessmentResultRef.current;
      if (!resultPanel) return;

      const top = resultPanel.getBoundingClientRect().top + window.scrollY - 96;
      window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
    }, 80);

    return () => window.clearTimeout(timeoutId);
  }, [jumpAssessmentState.result?.key]);

  useEffect(() => {
    if (!jumpAssessmentState.result?.passed) return undefined;

    const timeoutId = window.setTimeout(() => {
      jumpAssessmentEnterButtonRef.current?.focus();
    }, 60);

    return () => window.clearTimeout(timeoutId);
  }, [jumpAssessmentState.result?.passed]);

  const loadCourseData = async () => {
    const storedCourse = location.state?.course || null;
    const resolvedCourseId = courseIdParam || storedCourse?.id || null;

    setCourse(storedCourse || null);
    setPrelimLessons([]);
    setLessons([]);
    setVideoLessons([]);
    setLoading(!storedCourse);
    setLessonsLoading(true);

    if (!resolvedCourseId) {
      setLoading(false);
      setLessonsLoading(false);
      return;
    }

    try {
      let courseData = storedCourse;
      // `resolvedCourseId` is now a subject slug; class scope is applied server-side (§5).
      const lessonsPromise = api.subjects.getLessons(resolvedCourseId).catch(() => null);
      const courseResponse = await api.subjects.getBySlug(resolvedCourseId).catch(() => null);

      if (courseResponse?.data) {
        courseData = mergeCourseData(storedCourse || {}, courseResponse.data);
      }

      setCourse(courseData || null);
      setLoading(false);

      const courseLessonsResponse = await lessonsPromise;

      let nextLessons = [];
      let nextPrelims = [];
      let nextVideos = [];

      const courseLessonRows = getCourseLessonRows(courseLessonsResponse);
      if (courseLessonRows.length > 0) {
        const splitCourseLessons = splitLessonsByType(courseLessonRows);
        nextPrelims = splitCourseLessons.prelims;
        nextLessons = splitCourseLessons.lessons;
        nextVideos = splitCourseLessons.videos;
      }

      if (courseData?.title) {
        setPrelimLessons(nextPrelims);
        setLessons(nextLessons);
        setVideoLessons(nextVideos);
      } else {
        setPrelimLessons([]);
        setLessons([]);
        setVideoLessons([]);
      }
    } catch (error) {
      console.error('Error loading course:', error);
    } finally {
      setLoading(false);
      setLessonsLoading(false);
    }
  };

  const navigateToLesson = (lessonId, lessonPreview = null, lessonSequence = [], extraState = null) => {
    if (!lessonId) return;
    navigate(`/learn/lesson/${lessonId}`, {
      state: {
        coursePath: `${location.pathname}${location.search || ''}`,
        fromCoursePath: `${location.pathname}${location.search || ''}`,
        courseId: course?.id || course?.course_id || courseIdParam || null,
        course: course
          ? {
              id: course?.id || course?.course_id || courseIdParam || null,
              title: course?.title || '',
              code: course?.code || course?.course_code || '',
            credits: course?.credits ?? course?.credit ?? course?.credit_hours ?? null,
          }
          : null,
        lessonPreview,
        lessonSequence,
        ...(extraState && typeof extraState === 'object' ? extraState : {}),
      },
    });
  };

  const closeLessonPrep = () => {
    setLessonPrepState(EMPTY_LESSON_PREP_STATE);
  };

  const closeCompletedLessonModal = () => {
    setCompletedLessonState(EMPTY_COMPLETED_LESSON_STATE);
  };

  const handleConfirmLessonPrep = () => {
    const { lessonId, lessonPreview, lessonSequence } = lessonPrepState;
    if (!lessonId) return;

    closeLessonPrep();
    navigateToLesson(lessonId, lessonPreview, lessonSequence);
    trackEvent('lesson_start', { course_id: courseSlug, lesson_id: lessonId });
  };

  const handleDelayLessonPrep = () => {
    closeLessonPrep();
    setLessonPrepNotice('Get yourself ready, then come back when you can focus fully on the lesson.');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleStartLesson = (lessonId, options = {}) => {
    if (!lessonId) return;
    setLessonPrepNotice('');
    setLessonPrepState({
      isOpen: true,
      lessonId,
      lessonTitle: options.lessonTitle || 'this lesson',
      lessonPreview: options.lessonPreview || null,
      lessonSequence: options.lessonSequence || [],
    });
  };

  const handleOpenCompletedLessonModal = (lessonId, options = {}) => {
    if (!lessonId) return;
    setCompletedLessonState({
      isOpen: true,
      lessonId,
      lessonTitle: options.lessonTitle || 'this lesson',
      lessonSequence: options.lessonSequence || [],
      sectionLabel: options.sectionLabel || 'lesson',
    });
    trackEvent('completed_lesson_prompt_opened', {
      course_id: course?.id || courseSlug,
      lesson_id: lessonId,
      section: options.sectionLabel || 'lesson',
    });
  };

  const handleReviseCompletedLesson = () => {
    const { lessonId, lessonSequence, sectionLabel } = completedLessonState;
    if (!lessonId) return;

    closeCompletedLessonModal();
    navigateToLesson(lessonId, null, lessonSequence, { lessonEntryMode: 'revise' });
    trackEvent('completed_lesson_reopened', {
      course_id: course?.id || courseSlug,
      lesson_id: lessonId,
      section: sectionLabel,
      action: 'revise',
    });
  };

  const handleTakeCompletedLessonTest = () => {
    const { lessonId, lessonSequence, sectionLabel } = completedLessonState;
    if (!lessonId) return;

    closeCompletedLessonModal();
    navigateToLesson(lessonId, null, lessonSequence, { lessonEntryMode: 'assessment' });
    trackEvent('completed_lesson_reopened', {
      course_id: course?.id || courseSlug,
      lesson_id: lessonId,
      section: sectionLabel,
      action: 'assessment',
    });
  };

  const handleOpenPrelim = (item) => {
    if (!item?.id || !canAccess) return;
    const prelimSequence = prelimItems.map((prelim) => ({
      id: prelim.id,
      title: prelim.label,
      lessonNumber: prelim.order,
    }));
    handleStartLesson(item.id, {
      lessonTitle: item.label,
      lessonPreview: item.previewLesson || null,
      lessonSequence: prelimSequence,
    });
    trackEvent('course_prelim_open', {
      course_id: course?.id || courseSlug,
      prelim_id: item.id,
      prelim_label: item.label,
      preview: Boolean(item.previewLesson),
    });
  };

  const updateLessonJumpUnlocks = (updater) => {
    setLessonJumpUnlocks((previous) => {
      const next = typeof updater === 'function' ? updater(previous) : updater;
      storeLessonUnlocks(lessonAccessStorageKey, next);
      return next;
    });
  };

  const getCurrentLessonIndex = (items = []) => {
    const realItems = items.filter((item) => item?.id);
    for (const item of realItems) {
      if (!isCompletedItem(item)) {
        return items.findIndex((candidate) => candidate?.id === item.id);
      }
    }
    return -1;
  };

  const getLessonAccessState = (items, lesson, index, currentLessonIndex = -1) => {
    const hasLessonId = Boolean(lesson?.id);
    const isCompleted = isCompletedItem(lesson);
    const isAssessmentUnlocked = Boolean(lesson?.id && lessonJumpUnlocks[lesson.id]);
    const previousRealItems = items.slice(0, index).filter((item) => item?.id);
    const hasCompletedPreviousItems = previousRealItems.every((item) => isCompletedItem(item));
    const isUnlocked = hasLessonId && (index === 0 || isCompleted || isAssessmentUnlocked || hasCompletedPreviousItems);
    const isLocked = hasLessonId && !isUnlocked;
    const isCurrent = hasLessonId && currentLessonIndex === index && !isCompleted;
    const isFreshStart = isCurrent && previousRealItems.length === 0;

    let helperText = 'Unavailable until the lesson is published.';
    const lessonLabel = `Lesson ${index + 1}`;

    if (hasLessonId) {
      if (isLocked) {
        helperText = 'Jump with test';
      } else {
        helperText = lessonLabel;
      }
    }

    return {
      hasLessonId,
      isCompleted,
      isAssessmentUnlocked,
      isUnlocked,
      isLocked,
      isCurrent,
      isFreshStart,
      helperText,
    };
  };

  const handleLessonAccess = async (items, lesson, index, sectionLabel) => {
    if (!lesson?.id || !canAccess) return;

    const lessonSequence = buildLessonSequence(items);
    const accessState = getLessonAccessState(items, lesson, index);
    if (accessState.isCompleted) {
      handleOpenCompletedLessonModal(lesson.id, {
        lessonTitle: lesson.title,
        lessonSequence,
        sectionLabel,
      });
      return;
    }

    if (accessState.isUnlocked) {
      handleStartLesson(lesson.id, {
        lessonTitle: lesson.title,
        lessonSequence,
      });
      return;
    }

    jumpAssessmentStartedAtRef.current = null;
    if (jumpAssessmentTimerRef.current) {
      window.clearInterval(jumpAssessmentTimerRef.current);
      jumpAssessmentTimerRef.current = null;
    }

    setJumpAssessmentState({
      ...EMPTY_JUMP_ASSESSMENT_STATE,
      isOpen: true,
      isLoading: true,
      lessonId: lesson.id,
      sectionLabel,
      lessonTitle: lesson.title || 'Untitled lesson',
      lessonSequence,
    });

    trackEvent('lesson_jump_attempted', {
      course_id: course?.id || courseSlug,
      lesson_id: lesson.id,
      section: sectionLabel,
    });

    const fetchedLesson = await api.content
      .getById(lesson.id)
      .then((response) => response?.content || response?.data || response || null)
      .catch(() => null);
    const lessonPreview = mergeLessonData(lesson, fetchedLesson);
    const questions = buildFinalAssessmentQuestions(lessonPreview);

    if (questions.length === 0) {
      setJumpAssessmentState((prev) => ({
        ...prev,
        isLoading: false,
        unavailableMessage: 'This lesson test is not ready yet. Try the earlier lessons first and come back soon.',
      }));
      return;
    }

    setJumpAssessmentState((prev) => ({
      ...prev,
      isLoading: false,
      lessonPreview,
      questions,
    }));
  };

  const closeJumpAssessment = () => {
    jumpAssessmentStartedAtRef.current = null;
    if (jumpAssessmentTimerRef.current) {
      window.clearInterval(jumpAssessmentTimerRef.current);
      jumpAssessmentTimerRef.current = null;
    }
    setJumpAssessmentState(EMPTY_JUMP_ASSESSMENT_STATE);
  };

  const handleJumpAssessmentResponseChange = (questionId, value, opts = {}) => {
    if (opts.fromOptionSelect) {
      playUiSound('quizOptionSelect');
    }
    setJumpAssessmentState((prev) => ({
      ...prev,
      responses: {
        ...prev.responses,
        [questionId]: value,
      },
      error: '',
    }));
  };

  const handleRetakeJumpAssessment = () => {
    jumpAssessmentStartedAtRef.current = null;
    if (jumpAssessmentTimerRef.current) {
      window.clearInterval(jumpAssessmentTimerRef.current);
      jumpAssessmentTimerRef.current = null;
    }

    setJumpAssessmentState((prev) => ({
      ...prev,
      responses: {},
      error: '',
      result: null,
      elapsedSeconds: 0,
    }));
  };

  const handleEnterUnlockedLesson = () => {
    const { lessonId, lessonTitle, lessonPreview, lessonSequence, result } = jumpAssessmentState;
    if (!lessonId || !result?.passed) return;

    closeJumpAssessment();
    handleStartLesson(lessonId, {
      lessonTitle,
      lessonPreview,
      lessonSequence,
    });
  };

  const handleJumpAssessmentSubmit = (event) => {
    event.preventDefault();

    const { lessonId, questions, responses } = jumpAssessmentState;
    if (!lessonId || questions.length === 0) return;

    const summary = evaluateAssessmentSubmission({
      questions,
      responses,
      elapsedSeconds: jumpAssessmentState.elapsedSeconds,
      startedAt: jumpAssessmentStartedAtRef.current,
    });

    if (!summary.isReady) {
      setJumpAssessmentState((prev) => ({
        ...prev,
        error: 'Answer every test item before you submit the jump test.',
      }));
      return;
    }

    if (jumpAssessmentTimerRef.current) {
      window.clearInterval(jumpAssessmentTimerRef.current);
      jumpAssessmentTimerRef.current = null;
    }

    const { correctCount, totalQuestions, percentScore, passed, durationSeconds, evaluations } = summary;

    setJumpAssessmentState((prev) => ({
      ...prev,
      error: '',
      elapsedSeconds: durationSeconds,
      result: {
        key: Date.now(),
        percentScore,
        passed,
        correctCount,
        totalQuestions,
        durationSeconds,
        evaluations,
      },
    }));

    if (!passed) {
      trackEvent('lesson_jump_assessment_failed', {
        course_id: course?.id || courseSlug,
        lesson_id: lessonId,
        score: percentScore,
      });
      return;
    }

    updateLessonJumpUnlocks((previous) => ({
      ...previous,
      [lessonId]: {
        passedAt: new Date().toISOString(),
      },
    }));

    trackEvent('lesson_jump_assessment_passed', {
      course_id: course?.id || courseSlug,
      lesson_id: lessonId,
      score: percentScore,
    });
  };

  const prelimContent = useMemo(() => {
    if (!course) {
      return {
        outline: 'Course outline will appear once this course is fully loaded.',
        description: 'Course description will appear here.',
        requirements: 'Course requirements will appear here.',
        'big-picture': 'Course big picture content will appear here.',
        introduction: 'Course introduction will appear here.',
      };
    }

    return {
      outline: course.outline || course.syllabus || 'This course moves from fundamentals into advanced applications.',
      description: course.description || 'Explore the key themes, definitions, and practice routines for this course.',
      requirements: course.requirements || course.prerequisites || 'A curious mind and dedication to consistent practice.',
      'big-picture':
        course.big_picture ||
        course.bigPicture ||
        'Understand how this course connects to your program, career goals, and real-world impact.',
      introduction:
        course.introduction ||
        course.intro ||
        'Welcome! Get ready to build confidence through structured lessons and engaging activities.',
    };
  }, [course]);

  const courseImageIndex = useMemo(() => getCourseImageIndex(course), [course?.title, course?.code]);
  const courseImage = getCourseImage(course, courseImageIndex);
  const prelimItems = useMemo(() => {
    if (prelimLessons.length > 0) {
      return prelimLessons.map((lesson, index) => {
        const isCompleted = Boolean(isCompletedItem(lesson) || isCompletedPrelim(prelimProgressMap, lesson.id));
        return {
          key: lesson.id || `prelim-${index + 1}`,
          id: lesson.id,
          label: lesson.title || `Prelim ${index + 1}`,
          content: lesson.description || '',
          order: Number(lesson.sequence || lesson.lesson_number || index + 1) || index + 1,
          thumbnail: getLessonThumbnail(lesson, index),
          helperText: isCompleted
            ? 'Completed'
            : index === 0
              ? 'Start here'
              : 'Open prelim',
          previewLesson: null,
          completed: isCompleted,
        };
      });
    }

    return PRELIM_TABS.map((tab, index) => {
      const previewLesson = buildPrelimPreviewLesson({
        course,
        prelim: {
          key: tab.key,
          label: tab.label,
          content: prelimContent[tab.key],
          order: index + 1,
        },
        courseImage,
        courseSlug,
        courseId: course?.id || courseIdParam || null,
      });

      return {
        key: tab.key,
        id: previewLesson.id,
        label: tab.label,
        content: prelimContent[tab.key],
        order: index + 1,
        thumbnail: courseImage,
        helperText: isCompletedPrelim(prelimProgressMap, previewLesson.id)
          ? 'Completed'
          : index === 0
            ? 'Start here'
            : 'Open prelim',
        previewLesson,
        completed: isCompletedPrelim(prelimProgressMap, previewLesson.id),
      };
    });
  }, [course, courseIdParam, courseImage, courseSlug, prelimContent, prelimLessons, prelimProgressMap]);

  const totalPrelims = prelimItems.length;
  const coveredPrelims = prelimItems.filter((item) => item.completed).length ||
    (prelimLessons.length > 0
      ? getCoveredCount(prelimLessons)
      : clampCount(course?.prelims_completed || course?.covered_prelims || 0, totalPrelims));
  const coveredLessons = getCoveredCount(lessons);
  const coveredVideos = getCoveredCount(videoLessons);

  const displayedLessons = lessons;
  const displayedVideos = videoLessons;
  const currentLessonIndex = useMemo(() => getCurrentLessonIndex(displayedLessons), [displayedLessons]);
  const jumpAssessmentSummaryLabel = jumpAssessmentState.result
    ? `${jumpAssessmentState.result.correctCount}/${jumpAssessmentState.result.totalQuestions} correct`
    : '';
  const jumpAssessmentDurationLabel = jumpAssessmentState.result
    ? formatDurationLabel(jumpAssessmentState.result.durationSeconds)
    : formatDurationLabel(jumpAssessmentState.elapsedSeconds);

  const previewCoveredPrelims = coveredPrelims;
  const previewCoveredLessons = coveredLessons;
  const previewCoveredVideos = coveredVideos;

  const totalContent = totalPrelims + displayedLessons.length + displayedVideos.length;
  const coveredContent = previewCoveredPrelims + previewCoveredLessons + previewCoveredVideos;
  const progressPercent = totalContent
    ? Math.min(100, Math.round((coveredContent / totalContent) * 100))
    : 0;

  // Remember the course and its latest completion percentage so Home can
  // render an accurate resume bar on the next visit.
  useEffect(() => {
    if (!course?.title) return;
    recordLastActivity({
      type: ACTIVITY_TYPES.LEARNING,
      title: course.title,
      subtitle: getDisplayCourseCode(course) || course.code || 'Course',
      credits: getCourseCreditsText(course),
      path: `${location.pathname}${location.search || ''}`,
      progress: progressPercent,
    });
  }, [course, location.pathname, location.search, progressPercent]);
  const coveredSectionItems = [
    {
      key: 'prelims',
      label: 'Prelims',
      covered: previewCoveredPrelims,
      total: totalPrelims,
      percent: totalPrelims ? Math.round((previewCoveredPrelims / totalPrelims) * 100) : 0,
    },
    {
      key: 'lessons',
      label: 'Lessons',
      covered: previewCoveredLessons,
      total: displayedLessons.length,
      percent: displayedLessons.length ? Math.round((previewCoveredLessons / displayedLessons.length) * 100) : 0,
    },
    {
      key: 'videos',
      label: 'Videos',
      covered: previewCoveredVideos,
      total: displayedVideos.length,
      percent: displayedVideos.length ? Math.round((previewCoveredVideos / displayedVideos.length) * 100) : 0,
    },
  ];
  const courseStudiedCount = resolveCourseStudiedCount(course);
  const courseActiveLearners = resolveCourseActiveLearners(course);

  const canAccess = !course?.is_premium || hasFeature('premium_content');
  const collectionBackLink = { to: '/learn', label: 'Back to Learn' };
  const practicePath = buildPracticePath(course || {});
  const practiceLinkState = buildCourseRouteState(course || {}, {
    scope: '',
    activeTab: '',
    sourcePath: practicePath,
  });

  const playProgressTone = (variant = 'tap') => {
    if (typeof window === 'undefined') return;
    const now = Date.now();
    if (progressAudioLockRef.current && now - progressAudioLockRef.current < 1200) return;
    progressAudioLockRef.current = now;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!progressAudioRef.current) progressAudioRef.current = new AudioCtx();
      const ctx = progressAudioRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const master = ctx.createGain();
      master.gain.setValueAtTime(0.38, ctx.currentTime);
      master.connect(ctx.destination);
      const t0 = ctx.currentTime + 0.01;

      // Soft chime: sine body (warmer, gentler than triangle) + quiet overtones.
      // Gentle attack (12 ms) so the onset doesn't startle; long ring-out for calm feel.
      const bell = (freq, at, ringDur, vol) => {
        [[freq, 'sine', vol, ringDur],
         [freq * 2, 'sine', vol * 0.16, ringDur * 0.5],
         [freq * 3, 'sine', vol * 0.06, 0.055]].forEach(([f, type, v, dur]) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = type;
          osc.frequency.setValueAtTime(f, at);
          gain.gain.setValueAtTime(0.0001, at);
          gain.gain.exponentialRampToValueAtTime(v, at + 0.012);
          gain.gain.setValueAtTime(v * 0.48, at + 0.055);
          gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
          osc.connect(gain); gain.connect(master);
          osc.start(at); osc.stop(at + dur + 0.06);
        });
        // Barely-there detuned companion for organic warmth
        const osc2 = ctx.createOscillator(); const g2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq * 1.005, at);
        g2.gain.setValueAtTime(0.0001, at);
        g2.gain.exponentialRampToValueAtTime(vol * 0.1, at + 0.014);
        g2.gain.exponentialRampToValueAtTime(0.0001, at + ringDur * 0.65);
        osc2.connect(g2); g2.connect(master);
        osc2.start(at); osc2.stop(at + ringDur + 0.06);
      };

      if (variant === 'reveal' || variant === 'complete') {
        const isComplete = variant === 'complete' || progressPercent >= 100;

        // Very soft sub warmth at C3 — barely felt, just adds body
        const sub = ctx.createOscillator(); const subG = ctx.createGain();
        sub.type = 'sine'; sub.frequency.setValueAtTime(130.81, t0);
        subG.gain.setValueAtTime(0.0001, t0);
        subG.gain.exponentialRampToValueAtTime(0.038, t0 + 0.015);
        subG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
        sub.connect(subG); subG.connect(master); sub.start(t0); sub.stop(t0 + 0.26);

        // Gentle C-major chime cascade: C5 → E5 → G5 → C6
        const cascade = isComplete
          ? [[523.25, t0 + 0.06,  0.62, 0.072], [659.25, t0 + 0.20, 0.62, 0.080],
             [783.99, t0 + 0.33,  0.68, 0.088], [1046.5, t0 + 0.48, 0.90, 0.062]]
          : progressPercent >= 50
          ? [[523.25, t0 + 0.06,  0.58, 0.068], [659.25, t0 + 0.20, 0.60, 0.078],
             [783.99, t0 + 0.33,  0.68, 0.086]]
          : [[523.25, t0 + 0.06,  0.54, 0.066], [659.25, t0 + 0.22, 0.62, 0.076]];

        cascade.forEach(([freq, at, dur, vol]) => bell(freq, at, dur, vol));

        // 100% chord bloom — soft, slow, inspiring; fades over 1.6 s
        if (isComplete) {
          const bloomAt = t0 + 0.78;
          [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
            const osc = ctx.createOscillator(); const g = ctx.createGain();
            osc.type = 'sine'; osc.frequency.setValueAtTime(freq, bloomAt + i * 0.022);
            g.gain.setValueAtTime(0.0001, bloomAt + i * 0.022);
            g.gain.exponentialRampToValueAtTime(0.034, bloomAt + i * 0.022 + 0.09);
            g.gain.exponentialRampToValueAtTime(0.0001, bloomAt + 1.6);
            osc.connect(g); g.connect(master);
            osc.start(bloomAt + i * 0.022); osc.stop(bloomAt + 1.7);
          });
        }
        return;
      }
      bell(523.25, t0, 0.26, 0.08);
    } catch (_) {
      // Ignore audio errors silently.
    }
  };

  useEffect(() => {
    if (loading || !isProgressAnimationReady) return undefined;

    setAnimatedProgressPercent(0);
    setAnimatedCoveredPercents({
      prelims: 0,
      lessons: 0,
      videos: 0,
    });

    if (progressAnimationTimerRef.current) {
      window.clearTimeout(progressAnimationTimerRef.current);
    }

    if (progressAnimationFrameRef.current) {
      window.cancelAnimationFrame(progressAnimationFrameRef.current);
    }

    progressAnimationTimerRef.current = window.setTimeout(() => {
      const targetPercents = {
        prelims: coveredSectionItems[0]?.percent || 0,
        lessons: coveredSectionItems[1]?.percent || 0,
        videos: coveredSectionItems[2]?.percent || 0,
      };
      const duration = 950;
      let startedAt = null;

      if (progressPercent >= 100) {
        playProgressTone('complete');
      } else if (progressPercent > 0) {
        playProgressTone('reveal');
      }

      const animateProgress = (timestamp) => {
        if (!startedAt) startedAt = timestamp;

        const elapsed = timestamp - startedAt;
        const completion = Math.min(1, elapsed / duration);
        const eased = 1 - ((1 - completion) ** 3);

        setAnimatedProgressPercent(Math.round(progressPercent * eased));
        setAnimatedCoveredPercents({
          prelims: Math.round(targetPercents.prelims * eased),
          lessons: Math.round(targetPercents.lessons * eased),
          videos: Math.round(targetPercents.videos * eased),
        });

        if (completion < 1) {
          progressAnimationFrameRef.current = window.requestAnimationFrame(animateProgress);
          return;
        }

        setAnimatedProgressPercent(progressPercent);
        setAnimatedCoveredPercents(targetPercents);
        progressAnimationFrameRef.current = null;

        // Ring settle pulse
        const ring = document.querySelector('.course-progress-desktop-ring');
        if (ring && progressPercent > 0) {
          ring.classList.remove('ring-settled');
          void ring.offsetWidth;
          ring.classList.add('ring-settled');
        }
      };

      progressAnimationFrameRef.current = window.requestAnimationFrame(animateProgress);
    }, 160);

    return () => {
      if (progressAnimationTimerRef.current) {
        window.clearTimeout(progressAnimationTimerRef.current);
        progressAnimationTimerRef.current = null;
      }
      if (progressAnimationFrameRef.current) {
        window.cancelAnimationFrame(progressAnimationFrameRef.current);
        progressAnimationFrameRef.current = null;
      }
    };
  }, [
    isProgressAnimationReady,
    loading,
    progressPercent,
    previewCoveredPrelims,
    previewCoveredLessons,
    previewCoveredVideos,
    totalPrelims,
    displayedLessons.length,
    displayedVideos.length,
  ]);

  if (loading) {
    return <CoursePageSkeleton />;
  }

  if (!course) {
    return (
        <div className="course-not-found">
          <h2>Course Not Found</h2>
          <p>The course you're looking for doesn't exist or has been removed.</p>
          <Link to={collectionBackLink.to} state={collectionBackLink.state} className="back-button">
            {collectionBackLink.label}
          </Link>
        </div>
      );
  }

  return (
    <div className="course-detail-page">
      {!canAccess && (
        <UpgradePrompt
          requiredPlan="Serious Student"
          feature="premium courses"
          onUpgrade={() => window.dispatchEvent(new CustomEvent('openUpgradeModal'))}
        />
      )}

      {lessonPrepNotice ? (
        <div className="course-lesson-prep-notice" role="status" aria-live="polite">
          {lessonPrepNotice}
        </div>
      ) : null}

      <section className="course-hero">
        <div className="course-hero-left">
          <div className="course-hero-title-row">
            <div className="course-hero-image">
              <img
                src={courseImage}
                alt={`${course.title} cover`}
                loading="lazy"
                decoding="async"
                onError={(event) => {
                  event.currentTarget.src = FALLBACK_COURSE_IMAGES[courseImageIndex];
                }}
              />
            </div>
            <div className="course-hero-text">
              <h1 className="course-title">{course.title}</h1>
              <div className="course-submeta">
                <span>{getDisplayCourseCode(course, 'Course Code')}</span>
                <span>•</span>
                <span>{getCourseCreditsText(course)}</span>
                <span>•</span>
                <span className="course-usage-chip">{formatCountCompact(courseStudiedCount)} studied</span>
                <span>•</span>
                <span className="course-usage-chip">{formatCountCompact(courseActiveLearners)} studying</span>
              </div>
            </div>
          </div>
        </div>

        <span className="course-hero-divider" aria-hidden="true" />

        <div className="course-hero-right">
          <div className="course-progress">
            <div className="course-progress-desktop-ring" style={{ '--progress': animatedProgressPercent }}>
              <div className="course-progress-desktop-ring-core">
                <span className="course-progress-percent">{animatedProgressPercent}%</span>
                <span className="course-progress-label">Complete</span>
              </div>
            </div>
            <div className="course-progress-mobile-bar">
              <div className="course-progress-top">
                <span className="course-progress-label">Course Progress</span>
                <span className="course-progress-percent">{animatedProgressPercent}%</span>
              </div>
              <div className="course-progress-track" aria-hidden="true" style={{ '--progress': `${animatedProgressPercent}%` }}>
                <span />
              </div>
            </div>
            <button
              type="button"
              className="course-progress-meta course-progress-meta-toggle"
              onClick={() => setCoveredSectionsExpanded((previous) => !previous)}
              aria-expanded={coveredSectionsExpanded}
              aria-controls="course-covered-sections"
            >
              <span>
                {totalContent ? `${coveredContent}/${totalContent} items completed` : 'Progress will appear as content is added.'}
              </span>
              <span className={`course-progress-meta-chevron ${coveredSectionsExpanded ? 'expanded' : ''}`} aria-hidden="true">
                <FiChevronDown />
              </span>
            </button>
          </div>

          {coveredSectionsExpanded ? (
            <div className="course-covered" id="course-covered-sections">
              <h3>Covered Sections</h3>
              <div className="course-covered-row">
                {coveredSectionItems.map((item) => (
                  <div key={item.key} className="course-covered-item">
                    <div className="course-covered-top">
                      <span className="course-covered-label">{item.label}</span>
                      <span className="course-covered-count">
                        {item.covered}/{item.total}
                      </span>
                    </div>
                    <div className="course-covered-bar" style={{ '--fill': `${animatedCoveredPercents[item.key] || 0}%` }}>
                      <span />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="course-section course-prelims">
        <div className="course-section-header with-divider">
          <div className="course-section-head">
            <h2 className="course-section-title">
              <FiFileText aria-hidden="true" />
              <span>Prelims</span>
            </h2>
            <span className="course-section-count">{prelimItems.length}</span>
          </div>
          <hr className="course-section-divider" aria-hidden="true" />
        </div>
        <div className="course-slider">
          <HorizontalSlider ariaLabel="Prelims slider">
            {prelimItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className="course-lesson-card course-prelim-card"
                onClick={() => handleOpenPrelim(item)}
                disabled={!item.id || !canAccess}
              >
                <div className="course-lesson-thumb">
                  <img src={item.thumbnail || courseImage} alt={item.label} loading="lazy" decoding="async" />
                  <span className={`course-lesson-status-badge ${item.completed ? 'complete' : 'open'}`}>
                    {item.completed ? <FiCheckCircle aria-hidden="true" /> : null}
                    <span>{item.completed ? 'Completed' : item.order === 1 ? 'Start Here' : `Prelim ${item.order}`}</span>
                  </span>
                  <span className="course-lesson-icon course-text-icon">
                    <FiFileText />
                  </span>
                </div>
                <div className="course-lesson-title" title={item.label}>
                  <span className="course-lesson-title-text">{item.label}</span>
                  <div className="course-lesson-meta-row">
                    <span className="course-lesson-helper">{item.helperText}</span>
                    <span className="course-lesson-views">
                      <FiEye aria-hidden="true" /> {formatCountCompact(resolveLessonViewCount(item.previewLesson || item))}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </HorizontalSlider>
        </div>
      </section>

      <section className="course-section course-lessons-section">
        <div className="course-section-header with-divider">
          <div className="course-section-head">
            <h2 className="course-section-title">
              <FiFileText aria-hidden="true" />
              <span>Text Lessons</span>
            </h2>
            <span className="course-section-count">{displayedLessons.length}</span>
          </div>
          <hr className="course-section-divider" aria-hidden="true" />
        </div>
        {lessonsLoading && displayedLessons.length === 0 ? (
          <LessonCardsSkeleton withHelperShort />
        ) : displayedLessons.length === 0 ? (
          <p className="course-empty-state">No text lessons have been added to this course yet.</p>
        ) : (
          <div className="course-slider">
            <HorizontalSlider ariaLabel="Text lessons slider">
              {displayedLessons.map((lesson, index) => {
                const thumbnail = lesson.thumbnail || getLessonThumbnail(lesson, index);
                const lessonAccess = getLessonAccessState(displayedLessons, lesson, index, currentLessonIndex);
                const lessonChunkCount = getLessonChunkCount(lesson);
                const lessonViews = resolveLessonViewCount(lesson);
                const helperTextWithChunks =
                  lessonAccess.helperText.startsWith('Lesson ') && lessonChunkCount > 0
                    ? `${lessonAccess.helperText} • ${lessonChunkCount} ${lessonChunkCount === 1 ? 'chunk' : 'chunks'}`
                    : lessonAccess.helperText;
                return (
                  <button
                    key={lesson.id || `lesson-${index}`}
                    type="button"
                    className={`course-lesson-card ${lessonAccess.isLocked ? 'is-locked' : 'is-unlocked'} ${lessonAccess.isAssessmentUnlocked ? 'is-assessment-unlocked' : ''}`}
                    onClick={() => handleLessonAccess(displayedLessons, lesson, index, 'text')}
                    disabled={!lesson.id || !canAccess}
                  >
                    <div className="course-lesson-thumb">
                      <img src={thumbnail} alt={lesson.title} loading="lazy" decoding="async" />
                      {lessonAccess.hasLessonId && (
                        <span className={`course-lesson-status-badge ${lessonAccess.isLocked ? 'locked' : lessonAccess.isCompleted ? 'complete' : lessonAccess.isAssessmentUnlocked ? 'assessment' : 'open'}`}>
                          {lessonAccess.isLocked ? <FiLock aria-hidden="true" /> : <FiCheckCircle aria-hidden="true" />}
                          <span>
                            {lessonAccess.isLocked
                              ? 'Locked'
                              : lessonAccess.isCompleted
                                ? 'Completed'
                                : lessonAccess.isAssessmentUnlocked
                                  ? 'Assessment Pass'
                                  : index === 0
                                    ? 'Start Here'
                                    : 'Unlocked'}
                          </span>
                        </span>
                      )}
                      <span className="course-lesson-icon course-text-icon">
                        <FiFileText />
                      </span>
                    </div>
                    <div className="course-lesson-title" title={lesson.title}>
                      <span className="course-lesson-title-text">{lesson.title}</span>
                      <div className="course-lesson-meta-row">
                        <span className="course-lesson-helper">{helperTextWithChunks}</span>
                        <span className="course-lesson-meta-right">
                          <span className="course-lesson-views">
                            <FiEye aria-hidden="true" /> {formatCountCompact(lessonViews)}
                          </span>
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </HorizontalSlider>
          </div>
        )}
      </section>

      <section className="course-section course-videos-section">
        <div className="course-section-header with-divider">
          <div className="course-section-head">
            <h2 className="course-section-title">
              <FiPlayCircle aria-hidden="true" />
              <span>Video Lessons</span>
            </h2>
            <span className="course-section-count">{displayedVideos.length}</span>
          </div>
          <hr className="course-section-divider" aria-hidden="true" />
        </div>
        {lessonsLoading && displayedVideos.length === 0 ? (
          <LessonCardsSkeleton />
        ) : displayedVideos.length === 0 ? (
          <p className="course-empty-state">No video lessons have been added to this course yet.</p>
        ) : (
          <div className="course-slider">
            <HorizontalSlider ariaLabel="Video lessons slider">
              {displayedVideos.map((lesson, index) => {
                const thumbnail = lesson.thumbnail || getLessonThumbnail(lesson, index);
                const lessonAccess = getLessonAccessState(displayedVideos, lesson, index);
                const lessonViews = resolveLessonViewCount(lesson);
                return (
                  <button
                    key={lesson.id || `video-${index}`}
                    type="button"
                    className={`course-lesson-card course-video-card ${lessonAccess.isLocked ? 'is-locked' : 'is-unlocked'} ${lessonAccess.isAssessmentUnlocked ? 'is-assessment-unlocked' : ''}`}
                    onClick={() => handleLessonAccess(displayedVideos, lesson, index, 'video')}
                    disabled={!lesson.id || !canAccess}
                  >
                    <div className="course-lesson-thumb">
                      <img src={thumbnail} alt={lesson.title} loading="lazy" decoding="async" />
                      {lessonAccess.hasLessonId && (
                        <span className={`course-lesson-status-badge ${lessonAccess.isLocked ? 'locked' : lessonAccess.isCompleted ? 'complete' : lessonAccess.isAssessmentUnlocked ? 'assessment' : 'open'}`}>
                          {lessonAccess.isLocked ? <FiLock aria-hidden="true" /> : <FiCheckCircle aria-hidden="true" />}
                          <span>
                            {lessonAccess.isLocked
                              ? 'Locked'
                              : lessonAccess.isCompleted
                                ? 'Completed'
                                : lessonAccess.isAssessmentUnlocked
                                  ? 'Assessment Pass'
                                  : index === 0
                                    ? 'Start Here'
                                    : 'Unlocked'}
                          </span>
                        </span>
                      )}
                      <span className="course-lesson-icon course-video-icon">
                        <FiPlayCircle />
                      </span>
                    </div>
                    <div className="course-lesson-title" title={lesson.title}>
                      <span className="course-lesson-title-text">{lesson.title}</span>
                      <div className="course-lesson-meta-row">
                        <span className="course-lesson-helper">{lessonAccess.helperText}</span>
                        <span className="course-lesson-views">
                          <FiEye aria-hidden="true" /> {formatCountCompact(lessonViews)}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </HorizontalSlider>
          </div>
        )}
      </section>

      <section className="course-section course-links-section">
        <div className="course-section-header with-divider">
          <div className="course-section-head">
            <h2 className="course-section-title">
              <FiCoffee aria-hidden="true" />
              <span>Refreshment</span>
            </h2>
          </div>
          <hr className="course-section-divider" aria-hidden="true" />
        </div>
        <div className="course-links-card practice">
          <span className="course-links-tag">Practice</span>
          <span className="course-links-image" aria-hidden="true" />
          <div>
            <h3>Practice this course</h3>
            <p>Sharpen your skills with targeted practice sets and past questions.</p>
          </div>
          <Link to={practicePath} state={practiceLinkState} className="course-links-button">
            Go to Practice
          </Link>
        </div>
        <div className="course-links-card relax">
          <span className="course-links-tag">Edutainment</span>
          <span className="course-links-image" aria-hidden="true" />
          <div>
            <h3>Feeling stressed?</h3>
            <p>Take a short break with edutainment to reset your focus.</p>
          </div>
          <Link to="/" className="course-links-button">
            Edutain Yourself
          </Link>
        </div>
      </section>

      {lessonPrepState.isOpen && (
        <div className="course-lesson-prep-overlay" onClick={handleDelayLessonPrep}>
          <div
            className="course-lesson-prep-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="course-lesson-prep-title"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="course-lesson-prep-eyebrow">Lesson Check-In</span>
            <h3 id="course-lesson-prep-title">Get your brain ready to learn.</h3>
            <p className="course-lesson-prep-copy">
              Take a quick breath, settle in, and start <strong>{lessonPrepState.lessonTitle}</strong> when you are fully ready.
            </p>
            <div className="course-lesson-prep-actions">
              <button type="button" className="course-lesson-prep-primary" onClick={handleConfirmLessonPrep} autoFocus>
                I&apos;m ready
              </button>
              <button type="button" className="course-lesson-prep-secondary" onClick={handleDelayLessonPrep}>
                Not yet
              </button>
            </div>
          </div>
        </div>
      )}

      {completedLessonState.isOpen && (
        <div className="course-completed-lesson-overlay" onClick={closeCompletedLessonModal}>
          <div
            className="course-completed-lesson-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="course-completed-lesson-title"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="course-completed-lesson-eyebrow">Lesson completed</span>
            <h3 id="course-completed-lesson-title">
              {completedLessonState.lessonTitle || 'This lesson'} is already completed.
            </h3>
            <p className="course-completed-lesson-copy">
              Choose what you want to do next. You can revise the lesson content again or jump straight to the final lesson test.
            </p>
            <div className="course-completed-lesson-actions">
              <button
                type="button"
                className="course-completed-lesson-primary"
                onClick={handleReviseCompletedLesson}
                autoFocus
              >
                Revise lesson
              </button>
              <button
                type="button"
                className="course-completed-lesson-secondary"
                onClick={handleTakeCompletedLessonTest}
              >
                Take lesson test
              </button>
            </div>
          </div>
        </div>
      )}

      {jumpAssessmentState.isOpen && (
        <div className="course-assessment-overlay" onClick={closeJumpAssessment}>
          <div
            className="course-assessment-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="course-assessment-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="course-assessment-close"
              onClick={closeJumpAssessment}
              aria-label="Close competency assessment"
            >
              <FiX />
            </button>

            <div className="course-assessment-head">
              <div className="course-assessment-copy-group">
                <span className="course-assessment-eyebrow">Final lesson test</span>
                <h3 id="course-assessment-title">Jump to {jumpAssessmentState.lessonTitle}</h3>
                <p className="course-assessment-copy">
                  This uses the same combined lesson test learners take inside the lesson. Pass {FINAL_ASSESSMENT_PASS_PERCENT}% to unlock this {jumpAssessmentState.sectionLabel} lesson and move straight into it.
                </p>
              </div>
              {!jumpAssessmentState.isLoading && !jumpAssessmentState.unavailableMessage && (
                <div className="course-assessment-meta">
                  <strong>{jumpAssessmentState.questions.length} questions</strong>
                  <small>{jumpAssessmentDurationLabel}</small>
                </div>
              )}
            </div>

            {jumpAssessmentState.isLoading ? (
              <div className="course-assessment-state">
                <p>Building the lesson jump test...</p>
              </div>
            ) : jumpAssessmentState.unavailableMessage ? (
              <div className="course-assessment-state">
                <p>{jumpAssessmentState.unavailableMessage}</p>
              </div>
            ) : (
              <form className="course-assessment-form" onSubmit={handleJumpAssessmentSubmit}>
                <div className="course-assessment-list">
                  {jumpAssessmentState.questions.map((question, questionIndex) => (
                    <section key={question.id} className="course-assessment-question">
                      <div className="course-assessment-question-head">
                        <span>{`Question ${questionIndex + 1}`}</span>
                        <small>
                          {question.chunkId ? `Chunk ${question.chunkOrder}: ${question.chunkTitle}` : 'Lesson Review'}
                        </small>
                      </div>
                      <h4>{question.exercise?.prompt}</h4>

                      {(question.exercise?.type === 'multiple_choice' || question.exercise?.type === 'true_false') && (
                        <div className="course-assessment-choice-list">
                          {question.exercise?.options?.map((option, optionIndex) => {
                            const optionLabel = String.fromCharCode(65 + optionIndex);
                            const isSelected = jumpAssessmentState.responses[question.id] === option;

                            return (
                              <label
                                key={`${question.id}-${option}`}
                                className={`course-assessment-choice-card ${isSelected ? 'is-selected' : ''}`}
                              >
                                <input
                                  type="radio"
                                  name={`jump-question-${question.id}`}
                                  value={option}
                                  checked={isSelected}
                                  onChange={() =>
                                    handleJumpAssessmentResponseChange(question.id, option, { fromOptionSelect: true })
                                  }
                                />
                                <span className="course-assessment-choice-marker">{optionLabel}</span>
                                <span className="course-assessment-choice-copy">{option}</span>
                                <span className="course-assessment-choice-state" aria-hidden="true" />
                              </label>
                            );
                          })}
                        </div>
                      )}

                      {(question.exercise?.type === 'fill_in' || question.exercise?.type === 'theory') && (
                        <div className="course-assessment-response">
                          <textarea
                            value={jumpAssessmentState.responses[question.id] || ''}
                            onChange={(event) => handleJumpAssessmentResponseChange(question.id, event.target.value)}
                            rows={question.exercise?.type === 'theory' ? 5 : 3}
                            placeholder={question.exercise?.placeholder || 'Type your answer'}
                          />
                        </div>
                      )}
                    </section>
                  ))}
                </div>

                {jumpAssessmentState.error && (
                  <p className="course-assessment-feedback error">{jumpAssessmentState.error}</p>
                )}

                {jumpAssessmentState.result && (
                  <div
                    ref={jumpAssessmentResultRef}
                    className={`course-assessment-result ${jumpAssessmentState.result.passed ? 'is-pass' : 'is-fail'}`}
                  >
                    <div className="course-assessment-result-head">
                      <div className="course-assessment-result-copy">
                        <strong>{jumpAssessmentState.result.passed ? 'Jump test passed' : 'Jump test not passed yet'}</strong>
                        <p>
                          {jumpAssessmentState.result.passed
                            ? 'You proved readiness for this lesson. It is now unlocked for you.'
                            : `You need ${FINAL_ASSESSMENT_PASS_PERCENT}% to jump ahead. Review earlier lessons, then try again.`}
                        </p>
                      </div>
                      <div className="course-assessment-result-stats">
                        <strong>{jumpAssessmentState.result.percentScore}%</strong>
                        <small>{`${jumpAssessmentSummaryLabel} • ${formatDurationLabel(jumpAssessmentState.result.durationSeconds)}`}</small>
                      </div>
                    </div>

                    <div className="course-assessment-actions">
                      <button type="button" className="course-assessment-secondary" onClick={closeJumpAssessment}>
                        Back to course
                      </button>
                      {jumpAssessmentState.result.passed ? (
                        <button
                          ref={jumpAssessmentEnterButtonRef}
                          type="button"
                          className="course-assessment-primary"
                          onClick={handleEnterUnlockedLesson}
                        >
                          Enter lesson
                        </button>
                      ) : (
                        <button type="button" className="course-assessment-primary" onClick={handleRetakeJumpAssessment}>
                          Take test again
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {!jumpAssessmentState.result && (
                  <div className="course-assessment-actions">
                    <button type="button" className="course-assessment-secondary" onClick={closeJumpAssessment}>
                      Back to course
                    </button>
                    <button type="submit" className="course-assessment-primary">
                      Submit Jump Test
                    </button>
                  </div>
                )}
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FiCheckCircle, FiCheckSquare, FiChevronDown, FiClipboard, FiCoffee, FiEye, FiFileText } from 'react-icons/fi';
import { useAuth } from '../../hooks/useAuth';
import { useSubscription } from '../../hooks/useSubscription';
import { useAnalytics } from '../../hooks/useAnalytics';
import usePageTitle from '../../hooks/usePageTitle';
import usePageLoadReady from '../../hooks/usePageLoadReady';
import UpgradePrompt from '../../components/subscription/UpgradePrompt';
import CoursePageSkeleton from '../../components/common/CoursePageSkeleton';
import HorizontalSlider from '../shared/listPage/HorizontalSlider';
import api from '../../services/api';
import contentService from '../../services/contentService';
import { formatCountCompact, resolveContentViewCount } from '../../utils/viewCounts';
import { buildCoursePath, buildCourseRouteState } from '../../utils/courseRouting';
import { recordLastActivity, ACTIVITY_TYPES } from '../../utils/lastActivity';
import { getDisplayCourseCode } from '../../utils/courseCode';
import { buildPracticeSessionPath } from '../../utils/practiceSession';
import { getSamplePracticeItemsForCourse } from '../../utils/samplePracticePapers';
import {
  buildPrelimProgressStorageKey,
  isCompletedPrelim,
  loadPrelimProgress,
} from '../../utils/prelimProgress';
import { savePracticePrelimPreviewLesson } from '../../utils/practicePrelimPreview';
import { stripPracticeCourseTitleSuffix } from '../../utils/practiceCourseTitle';
import '../learn/CourseDetail.css';

import { FALLBACK_THUMBS, FALLBACK_COURSE_IMAGES } from '../../constants/courseAssets';

const PRELIM_TABS = [
  { key: 'outline', label: 'Outline' },
  { key: 'description', label: 'Description' },
  { key: 'requirements', label: 'Requirements' },
  { key: 'big-picture', label: 'Big Picture' },
  { key: 'introduction', label: 'Introduction' },
];

const splitIntoPrelimParagraphs = (value) => {
  const text = String(value || '').trim();
  if (!text) return ['This prelim guide will be available here soon.'];

  const paragraphs = text
    .split(/\n{2,}|(?<=[.?!])\s+(?=[A-Z])/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return paragraphs.length ? paragraphs : [text];
};

const buildPrelimPreviewLesson = ({ course, prelim, courseImage, courseSlug, courseId }) => {
  const syntheticId = `practice-prelim-${courseId || courseSlug || 'course'}-${prelim.key}`;
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
              caption: `${prelim.label} for ${course?.title || 'this practice course'}.`,
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

const getCardThumbnail = (item, index) =>
  item?.thumbnail ||
  item?.image ||
  item?.cover_image ||
  item?.coverImage ||
  item?.image_url ||
  FALLBACK_THUMBS[index % FALLBACK_THUMBS.length];

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

const getCourseCreditsText = (course) => {
  if (!course) return 'Credits N/A';
  if (course.creditsText) return course.creditsText;
  if (course.credits) return `${course.credits} Credits`;
  return 'Credits N/A';
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

const mergeUniqueItems = (...groups) => {
  const seen = new Set();
  return groups
    .flat()
    .filter((item) => {
      if (!item) return false;
      const key = String(item.id || item.title || '');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const getQuizCount = (course = {}) =>
  Math.max(
    0,
    Math.round(
      Number(
        course?.quizzes_count ??
          course?.quiz_count ??
          course?.total_quizzes ??
          course?.exercises_count ??
          course?.exercise_count ??
          course?.metadata?.quizzes_count ??
          0
      ) || 0
    )
  );

const getExamCount = (course = {}) =>
  Math.max(
    0,
    Math.round(
      Number(
        course?.exams_count ??
          course?.exam_count ??
          course?.total_exams ??
          course?.tests_count ??
          course?.metadata?.exams_count ??
          0
      ) || 0
    )
  );

const resolveCoursePracticedCount = (course = {}) =>
  Math.max(
    0,
    Math.round(
      Number(
        course?.total_practiced ??
          course?.total_practice_count ??
          course?.total_students_practiced ??
          course?.total_attempted ??
          course?.total_attempt_count ??
          course?.practice_count ??
          0
      ) || 0
    )
  );

const resolveCourseActivePracticingCount = (course = {}) =>
  Math.max(
    0,
    Math.round(
      Number(
        course?.currently_practicing ??
          course?.current_practicing ??
          course?.active_practicing ??
          course?.active_practice_learners ??
          course?.active_practice_students ??
          course?.active_attempts ??
          0
      ) || 0
    )
  );

const mapQuizContent = (item = {}) => ({
  ...item,
  id: item.id,
  title: item.title || 'Untitled quiz',
  thumbnail: item.thumbnail || item.image || item.image_url || null,
  stats: item.stats || null,
  destination: item.id ? buildPracticeSessionPath(item.id) : '/resources/past-quizzes',
  completed: Boolean(
    item?.user_engagement?.completed ||
      item?.user_interactions?.completed ||
      Number(item?.user_interactions?.progress || item?.progress || 0) >= 100
  ),
});

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

export default function PracticeDetail() {
  const { courseSlug } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [quizItems, setQuizItems] = useState([]);
  const [examItems, setExamItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [animatedProgressPercent, setAnimatedProgressPercent] = useState(0);
  const [animatedCoveredPercents, setAnimatedCoveredPercents] = useState({
    prelims: 0,
    quizzes: 0,
    exams: 0,
  });

  const { user } = useAuth();
  const { hasFeature } = useSubscription();
  const { trackEvent } = useAnalytics();
  const courseDisplayTitle = useMemo(
    () => stripPracticeCourseTitleSuffix(course?.title || ''),
    [course?.title],
  );
  usePageTitle(courseDisplayTitle || 'Practice');
  const isProgressAnimationReady = usePageLoadReady(120);

  const courseIdParam = searchParams.get('id');
  const prelimProgressStorageKey = useMemo(
    () =>
      buildPrelimProgressStorageKey({
        courseId: course?.id || courseIdParam || null,
        courseSlug,
        userKey: user?.id || 'guest',
      }),
    [course?.id, courseIdParam, courseSlug, user?.id]
  );
  const progressAudioRef = useRef(null);
  const progressAudioLockRef = useRef(0);
  const progressAnimationTimerRef = useRef(null);
  const progressAnimationFrameRef = useRef(null);
  const [prelimProgressMap, setPrelimProgressMap] = useState({});
  const [coveredSectionsExpanded, setCoveredSectionsExpanded] = useState(false);
  useEffect(() => {
    loadPracticeCourseData();
    trackEvent('practice_course_view', { course_id: courseIdParam || courseSlug, user_id: user?.id });
  }, [courseIdParam, courseSlug, trackEvent, user?.id]);

  useEffect(() => {
    setPrelimProgressMap(loadPrelimProgress(prelimProgressStorageKey));
  }, [prelimProgressStorageKey]);

  useEffect(() => {
    const handlePrelimProgressUpdated = (event) => {
      const detail = event?.detail || {};
      if (String(detail.courseId || '') !== String(course?.id || courseIdParam || '')) return;
      setPrelimProgressMap(loadPrelimProgress(prelimProgressStorageKey));
    };

    window.addEventListener('sharether:prelim-progress-updated', handlePrelimProgressUpdated);
    return () => window.removeEventListener('sharether:prelim-progress-updated', handlePrelimProgressUpdated);
  }, [course?.id, courseIdParam, prelimProgressStorageKey]);

  const loadPracticeCourseData = async () => {
    const storedCourse = location.state?.course || null;
    const resolvedCourseId = courseIdParam || storedCourse?.id || null;

    try {
      setLoading(true);
      let courseData = storedCourse;

      if (resolvedCourseId) {
        const courseResponse = await api.courses.getById(resolvedCourseId).catch(() => null);
        if (courseResponse?.data) {
          courseData = mergeCourseData(storedCourse || {}, courseResponse.data);
        }
      }

      if (!courseData && courseSlug) {
        courseData = {
          title: courseSlug
            .split('-')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' '),
          code: courseSlug.toUpperCase().slice(0, 6),
          credits: 3,
          description: 'Practice details will be available once this course is fully loaded.',
          isPreview: true,
        };
      }

      setCourse(courseData || null);

      if (!courseData?.title) {
        setQuizItems([]);
        setExamItems([]);
        return;
      }

      const courseFilterTitle = stripPracticeCourseTitleSuffix(courseData.title);

      const [quizContentResponse, examContentResponse] = await Promise.all([
        api.content.getAll({ type: 'quiz', course: courseFilterTitle }).catch(() => null),
        api.content.getAll({ type: 'past_question', course: courseFilterTitle }).catch(() => null),
      ]);

      const extractContent = (response) =>
        Array.isArray(response?.content) ? response.content :
        Array.isArray(response?.data?.content) ? response.data.content : [];

      const quizContent = extractContent(quizContentResponse).map(mapQuizContent);
      const examContent = extractContent(examContentResponse).map((item) => ({
        ...mapQuizContent(item),
        destination: item.id ? buildPracticeSessionPath(item.id) : '/resources/past-exams',
      }));
      const sampleQuizContent = getSamplePracticeItemsForCourse(courseFilterTitle, 'quiz').map(mapQuizContent);
      const sampleExamContent = getSamplePracticeItemsForCourse(courseFilterTitle, 'past_question').map((item) => ({
        ...mapQuizContent(item),
        destination: item.id ? buildPracticeSessionPath(item.id) : '/resources/past-exams',
      }));

      setQuizItems(mergeUniqueItems(quizContent, sampleQuizContent));
      setExamItems(mergeUniqueItems(examContent, sampleExamContent));
    } catch (error) {
      console.error('Error loading practice course:', error);
    } finally {
      setLoading(false);
    }
  };

  const prelimContent = useMemo(() => {
    if (!course) {
      return {
        outline: 'Practice outline will appear once this course is fully loaded.',
        description: 'Practice description will appear here.',
        requirements: 'Practice requirements will appear here.',
        'big-picture': 'Practice overview will appear here.',
        introduction: 'Practice introduction will appear here.',
      };
    }

    const quizCount = getQuizCount(course);
    const examCount = getExamCount(course);

    return {
      outline:
        course.outline ||
        course.practice_outline ||
        `This practice track combines ${quizCount || 'several'} quizzes and ${examCount || 'multiple'} exam-style drills.`,
      description:
        course.description ||
        'Use this practice track to reinforce concepts, test your speed, and identify weak spots before exams.',
      requirements:
        course.requirements ||
        course.prerequisites ||
        'Review your lessons first, then use these quizzes and exams to measure readiness.',
      'big-picture':
        course.big_picture ||
        course.bigPicture ||
        'Move from guided recall into timed application so your revision becomes more exam-focused.',
      introduction:
        course.introduction ||
        course.intro ||
        'Start with short quizzes, then step into longer exam-style practice as your confidence grows.',
    };
  }, [course]);

  const courseImageIndex = useMemo(() => getCourseImageIndex(course), [course?.title, course?.code]);
  const courseImage = getCourseImage(course, courseImageIndex);

  const prelimItems = useMemo(
    () =>
      PRELIM_TABS.map((tab, index) => {
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

        const completed = isCompletedPrelim(prelimProgressMap, previewLesson.id);

        return {
          key: tab.key,
          id: previewLesson.id,
          label: tab.label,
          content: prelimContent[tab.key],
          order: index + 1,
          thumbnail: courseImage,
          previewLesson,
          completed,
          helperText: completed ? 'Completed' : index === 0 ? 'Start here' : 'Open prelim',
        };
      }),
    [course, courseIdParam, courseImage, courseSlug, prelimContent, prelimProgressMap]
  );

  const totalPrelims = PRELIM_TABS.length;
  const coveredPrelims = prelimItems.filter((item) => item.completed).length ||
    clampCount(course?.prelims_completed || course?.covered_prelims || 0, totalPrelims);
  const coveredQuizzes = getCoveredCount(quizItems);
  const coveredExams = getCoveredCount(examItems);

  const displayedQuizzes = quizItems;
  const displayedExams = examItems;

  const previewCoveredPrelims = coveredPrelims;
  const previewCoveredQuizzes = coveredQuizzes;
  const previewCoveredExams = coveredExams;

  const totalContent = totalPrelims + displayedQuizzes.length + displayedExams.length;
  const coveredContent = previewCoveredPrelims + previewCoveredQuizzes + previewCoveredExams;
  const progressPercent = totalContent ? Math.min(100, Math.round((coveredContent / totalContent) * 100)) : 0;

  // Remember the practice course and its latest completion percentage so Home
  // can render an accurate resume bar on the next visit.
  useEffect(() => {
    if (!courseDisplayTitle) return;
    recordLastActivity({
      type: ACTIVITY_TYPES.PRACTICE,
      title: courseDisplayTitle,
      subtitle: getDisplayCourseCode(course, '') || 'Practice',
      credits: getCourseCreditsText(course),
      path: `${location.pathname}${location.search || ''}`,
      progress: progressPercent,
    });
  }, [course, courseDisplayTitle, location.pathname, location.search, progressPercent]);
  const coveredSectionItems = [
    {
      key: 'prelims',
      label: 'Prelims',
      covered: previewCoveredPrelims,
      total: totalPrelims,
      percent: totalPrelims ? Math.round((previewCoveredPrelims / totalPrelims) * 100) : 0,
    },
    {
      key: 'quizzes',
      label: 'Quizzes',
      covered: previewCoveredQuizzes,
      total: displayedQuizzes.length,
      percent: displayedQuizzes.length ? Math.round((previewCoveredQuizzes / displayedQuizzes.length) * 100) : 0,
    },
    {
      key: 'exams',
      label: 'Exams',
      covered: previewCoveredExams,
      total: displayedExams.length,
      percent: displayedExams.length ? Math.round((previewCoveredExams / displayedExams.length) * 100) : 0,
    },
  ];
  const courseActivePracticingCount = resolveCourseActivePracticingCount(course);
  const coursePracticedCount = resolveCoursePracticedCount(course);
  const canAccess = !course?.is_premium || hasFeature('premium_content');
  const collectionBackLink = { to: '/practice', label: 'Back to Practice' };
  const learnPath = buildCoursePath(course || {});
  const learnLinkState = buildCourseRouteState(course || {}, {
    scope: '',
    activeTab: '',
    sourcePath: learnPath,
  });

  const playProgressTone = (variant = 'tap') => {
    if (typeof window === 'undefined') return;
    const now = Date.now();
    if (progressAudioLockRef.current && now - progressAudioLockRef.current < 1200) return;
    progressAudioLockRef.current = now;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!progressAudioRef.current) {
        progressAudioRef.current = new AudioCtx();
      }
      const audioContext = progressAudioRef.current;
      if (audioContext.state === 'suspended') audioContext.resume();

      const masterGain = audioContext.createGain();
      masterGain.gain.setValueAtTime(0.82, audioContext.currentTime);
      masterGain.connect(audioContext.destination);
      const startAt = audioContext.currentTime + 0.01;

      if (variant === 'reveal' || variant === 'complete') {
        const isComplete = variant === 'complete' || progressPercent >= 100;
        const notes = isComplete
          ? [329.63, 415.30, 493.88, 659.25]
          : progressPercent >= 50
          ? [329.63, 415.30, 493.88]
          : [329.63, 415.30];

        notes.forEach((freq, i) => {
          const t = startAt + i * 0.105;
          const isLast = i === notes.length - 1;
          const vol = isLast ? 0.13 : 0.082;
          const dur = isLast ? 0.52 : 0.28;
          scheduleTone(audioContext, masterGain, freq, t, dur, vol, 'triangle');
          scheduleTone(audioContext, masterGain, freq * 2, t + 0.012, dur * 0.55, vol * 0.2, 'sine');
        });

        if (isComplete) {
          const sparkAt = startAt + notes.length * 0.105 + 0.06;
          [659.25, 830.61, 987.77].forEach((freq, i) => {
            scheduleTone(audioContext, masterGain, freq, sparkAt + i * 0.048, 0.6, 0.052, 'sine');
          });
        }
        return;
      }
      scheduleTone(audioContext, masterGain, 329.63, startAt, 0.14, 0.09, 'triangle');
    } catch (_) {
      // Ignore audio errors silently.
    }
  };

  useEffect(() => {
    if (loading || !isProgressAnimationReady) return undefined;

    setAnimatedProgressPercent(0);
    setAnimatedCoveredPercents({
      prelims: 0,
      quizzes: 0,
      exams: 0,
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
        quizzes: coveredSectionItems[1]?.percent || 0,
        exams: coveredSectionItems[2]?.percent || 0,
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
          quizzes: Math.round(targetPercents.quizzes * eased),
          exams: Math.round(targetPercents.exams * eased),
        });

        if (completion < 1) {
          progressAnimationFrameRef.current = window.requestAnimationFrame(animateProgress);
          return;
        }

        setAnimatedProgressPercent(progressPercent);
        setAnimatedCoveredPercents(targetPercents);
        progressAnimationFrameRef.current = null;

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
    displayedQuizzes.length,
    displayedExams.length,
    totalPrelims,
  ]);

  const handleOpenPracticeItem = (item, section) => {
    if (!item || !canAccess) return;
    const fallbackPath = section === 'quiz' ? '/resources/past-quizzes' : '/resources/past-exams';
    const destination = item.destination || fallbackPath;
    const courseState = {
      id: course?.id || null,
      title: course?.title || '',
      code: getDisplayCourseCode(course, ''),
      credits: course?.credits || null,
      creditsText: getCourseCreditsText(course),
    };

    navigate(destination, {
      state: {
        course: courseState,
        practiceItem: item,
        coursePath: location.pathname,
        fromCoursePath: location.pathname,
        activeTab: undefined,
      },
    });
    if (item?.id) {
      contentService.trackContentView(item.id, { duration: 0, progress: 0 }).catch(() => null);
    }
    trackEvent('practice_item_open', {
      course_id: course?.id || courseSlug,
      item_id: item.id || null,
      section,
      destination,
    });
  };

  const handleOpenPrelim = (item) => {
    if (!item?.id || !canAccess) return;

    savePracticePrelimPreviewLesson(item.previewLesson);

    const prelimSequence = prelimItems.map((prelim) => ({
      id: prelim.id,
      title: prelim.label,
      lessonNumber: prelim.order,
      lessonPreview: prelim.previewLesson || null,
    }));

    navigate(`/learn/lesson/${item.id}`, {
      state: {
        coursePath: `${location.pathname}${location.search || ''}`,
        fromCoursePath: `${location.pathname}${location.search || ''}`,
        courseId: course?.id || courseIdParam || null,
        course: course
          ? {
              id: course?.id || courseIdParam || null,
              title: course?.title || '',
              code: getDisplayCourseCode(course, ''),
              credits: course?.credits ?? null,
            }
          : null,
        lessonPreview: item.previewLesson || null,
        lessonSequence: prelimSequence,
      },
    });

    trackEvent('practice_prelim_open', {
      course_id: course?.id || courseSlug,
      prelim_id: item.id,
      prelim_label: item.label,
    });
  };

  if (loading) {
    return <CoursePageSkeleton />;
  }

  if (!course) {
    return (
        <div className="course-not-found">
          <h2>Practice Course Not Found</h2>
          <p>The practice course you're looking for doesn't exist or has been removed.</p>
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
          feature="premium practice packs"
          onUpgrade={() => window.dispatchEvent(new CustomEvent('openUpgradeModal'))}
        />
      )}

      <section className="course-hero">
        <div className="course-hero-left">
          <div className="course-hero-title-row">
            <div className="course-hero-image">
              <img
                src={courseImage}
                alt={`${courseDisplayTitle} cover`}
                loading="lazy"
                decoding="async"
                onError={(event) => {
                  event.currentTarget.src = FALLBACK_COURSE_IMAGES[courseImageIndex];
                }}
              />
            </div>
            <div className="course-hero-text">
              <h1 className="course-title">{courseDisplayTitle}</h1>
              <div className="course-submeta">
                <span>{getDisplayCourseCode(course, 'Course Code')}</span>
                <span>•</span>
                <span>{getCourseCreditsText(course)}</span>
                <span>•</span>
                <span className="course-usage-chip">{formatCountCompact(coursePracticedCount)} practiced</span>
                <span>•</span>
                <span className="course-usage-chip">{formatCountCompact(courseActivePracticingCount)} practicing</span>
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
              aria-controls="practice-covered-sections"
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
            <div className="course-covered" id="practice-covered-sections">
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

      <section id="practice-prelims" className="course-section course-prelims">
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
          <HorizontalSlider ariaLabel="Practice prelims slider">
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
                    <span className="course-lesson-helper">Prelim guide</span>
                    <span className="course-lesson-views">
                      <FiEye aria-hidden="true" />{' '}
                      {formatCountCompact(resolveContentViewCount(item.previewLesson || item))}
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
              <FiCheckSquare aria-hidden="true" />
              <span>Quizzes</span>
            </h2>
            <span className="course-section-count">{displayedQuizzes.length}</span>
          </div>
          <hr className="course-section-divider" aria-hidden="true" />
        </div>
        {displayedQuizzes.length === 0 ? (
          <p className="course-empty-state">No quizzes have been added to this course yet.</p>
        ) : (
          <div className="course-slider">
            <HorizontalSlider ariaLabel="Quizzes slider">
              {displayedQuizzes.map((item, index) => {
                const thumbnail = getCardThumbnail(item, index);
                const itemViews = resolveContentViewCount(item);
                return (
                  <button
                    key={item.id || `quiz-${index}`}
                    type="button"
                    className="course-lesson-card"
                    onClick={() => handleOpenPracticeItem(item, 'quiz')}
                    disabled={!item.id || !canAccess}
                  >
                    <div className="course-lesson-thumb">
                      <img src={thumbnail} alt={item.title} loading="lazy" decoding="async" />
                      <span className="course-lesson-icon course-text-icon">
                        <FiCheckSquare />
                      </span>
                    </div>
                    <div className="course-lesson-title" title={item.title}>
                      <span className="course-lesson-title-text">{item.title}</span>
                      <div className="course-lesson-meta-row">
                        <span className="course-lesson-helper">Quiz</span>
                        <span className="course-lesson-views">
                          <FiEye aria-hidden="true" /> {formatCountCompact(itemViews)}
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
              <FiClipboard aria-hidden="true" />
              <span>Exams</span>
            </h2>
            <span className="course-section-count">{displayedExams.length}</span>
          </div>
          <hr className="course-section-divider" aria-hidden="true" />
        </div>
        {displayedExams.length === 0 ? (
          <p className="course-empty-state">No exam packs have been added to this course yet.</p>
        ) : (
          <div className="course-slider">
            <HorizontalSlider ariaLabel="Exams slider">
              {displayedExams.map((item, index) => {
                const thumbnail = getCardThumbnail(item, index);
                const itemViews = resolveContentViewCount(item);
                return (
                  <button
                    key={item.id || `exam-${index}`}
                    type="button"
                    className="course-lesson-card course-video-card"
                    onClick={() => handleOpenPracticeItem(item, 'exam')}
                    disabled={!item.id || !canAccess}
                  >
                    <div className="course-lesson-thumb">
                      <img src={thumbnail} alt={item.title} loading="lazy" decoding="async" />
                      <span className="course-lesson-icon course-video-icon">
                        <FiClipboard />
                      </span>
                    </div>
                    <div className="course-lesson-title" title={item.title}>
                      <span className="course-lesson-title-text">{item.title}</span>
                      <div className="course-lesson-meta-row">
                        <span className="course-lesson-helper">Exam pack</span>
                        <span className="course-lesson-views">
                          <FiEye aria-hidden="true" /> {formatCountCompact(itemViews)}
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
          <span className="course-links-tag">Learn</span>
          <span className="course-links-image" aria-hidden="true" />
          <div>
            <h3>Back to guided learning</h3>
            <p>Return to lessons when you want explanations, walkthroughs, and concept refreshers.</p>
          </div>
          <Link to={learnPath} state={learnLinkState} className="course-links-button">
            Go to Learn
          </Link>
        </div>
        <div className="course-links-card relax">
          <span className="course-links-tag">Edutainment</span>
          <span className="course-links-image" aria-hidden="true" />
          <div>
            <h3>Take a short break</h3>
            <p>Step into edutainment when you want a lighter break before the next practice round.</p>
          </div>
          <Link to="/" className="course-links-button">
            Edutain Yourself
          </Link>
        </div>
      </section>
    </div>
  );
}

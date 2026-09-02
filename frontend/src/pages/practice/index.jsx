import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiChevronRight, FiSearch, FiTarget } from 'react-icons/fi';
import { useAuth } from '../../hooks/useAuth';
import { useSubscription } from '../../hooks/useSubscription';
import { useAnalytics } from '../../hooks/useAnalytics';
import useHeaderSheen from '../../hooks/useHeaderSheen';
import api from '../../services/api';
import { getPlanTierClass, isPaidPlan } from '../../utils/planTheme';
import ContributionAppeal from '../../components/subscription/ContributionAppeal';
import { getDisplayCourseCode } from '../../utils/courseCode';
import { buildCourseRouteState, buildPracticePath } from '../../utils/courseRouting';
import { stripPracticeCourseTitleSuffix } from '../../utils/practiceCourseTitle';
import LearnFilterDropdown from '../shared/listPage/FilterDropdown';
import LearnHorizontalSlider from '../shared/listPage/HorizontalSlider';
import useIncrementalResults, { scheduleCatalogWarmup } from '../shared/listPage/useIncrementalResults';
import {
  catalogOfferingMatchesFilters,
  CORE_LEVEL_OPTIONS,
  getCatalogOfferingFilters,
  PROGRAMME_CATEGORY_OPTIONS,
  normalizeProgrammeCategory,
} from '../shared/listPage/catalogFilters';
import { playListPageToggleSound } from '../shared/listPage/toggleSound';
import { playUiSound } from '../../utils/uiSounds';
import '../learn/Learn.css';
import './Practice.css';

const BASE_ASSET = import.meta.env.BASE_URL;
const FALLBACK_IMAGES = [
  `${BASE_ASSET}learn.jpg`,
  `${BASE_ASSET}learning-1.jpg`,
  `${BASE_ASSET}learning-2.jpg`,
  `${BASE_ASSET}learning-3.jpg`,
  `${BASE_ASSET}test-2.jpg`,
  `${BASE_ASSET}group-1.jpg`,
];
const SECTION_LIMIT = 10;
const PRACTICE_PAGE_QUOTE = 'Repetition is the mother of skill.';
const PRACTICE_PAGE_QUOTE_AUTHOR = 'Tony Robbins';

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
};

const toText = (value) => String(value ?? '').trim();
const normalizeText = (value) => toText(value).toLowerCase();
const TITLE_SMALL = new Set(['a','an','the','and','but','or','nor','for','so','yet','at','by','in','of','on','to','up','as','into','onto','with','from','over','via']);
const toTitleCase = (value = '') => {
  const words = toText(value).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  return words.map((w, i) => {
    const l = w.toLowerCase();
    return i > 0 && i < words.length - 1 && TITLE_SMALL.has(l) ? l : w[0].toUpperCase() + w.slice(1);
  }).join(' ');
};

const toSafeNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const normalizeCourseKey = (value = '') => normalizeText(String(value || '').replace(/\s+test items\s*$/i, '').trim());

const getCourseId = (course = {}) =>
  String(course.id || course.course_id || course.content_id || course.uuid || course.slug || '').trim();

const getCourseTitle = (course = {}) =>
  stripPracticeCourseTitleSuffix(
    toTitleCase(course.title || course.name || course.course_title || course.course_name || 'Untitled Course'),
  );

const getCourseCode = (course = {}) => getDisplayCourseCode(course, 'N/A');

const getCourseCreditsText = (course = {}) => {
  const raw = course.credits ?? course.credit ?? course.credit_hours;
  const text = toText(raw);
  if (!text) return '0 Credits';
  return /credit/i.test(text) ? text : `${text} Credits`;
};

const getCoursePrograms = (course = {}) => {
  const fromPrograms = toArray(course.programs).map((item) =>
    typeof item === 'string' ? item : item?.name || item?.title || item?.program_name || ''
  );
  const fromProgramField = [course.program, course.program_name, course.department].filter(Boolean);
  return [...fromPrograms, ...fromProgramField].map(toTitleCase).filter(Boolean);
};

const getCourseLevels = (course = {}) => {
  const fromArray = toArray(course.levels).map((level) => String(level));
  const fromSingle = [course.level, course.study_level].filter(Boolean).map(String);
  const unique = [...new Set([...fromArray, ...fromSingle].map((value) => value.trim()).filter(Boolean))];
  return unique.length ? unique : ['General'];
};

const getCourseSemesters = (course = {}) => {
  const fromArray = toArray(course.semesters).map((semester) => String(semester));
  const fromSingle = [course.semester, course.current_semester].filter(Boolean).map(String);
  const unique = [...new Set([...fromArray, ...fromSingle].map((value) => value.trim()).filter(Boolean))];
  return unique.length ? unique : ['1'];
};

const getCourseImage = (course = {}, index = 0) =>
  course.thumbnail_url ||
  course.image_url ||
  course.cover_image ||
  course.image ||
  FALLBACK_IMAGES[index % FALLBACK_IMAGES.length];

const resolvePracticeCounts = (course = {}) => {
  const quizzes = Math.max(
    0,
    Math.round(
      toSafeNumber(
        course.lesson_exercises_count ??
          course.quizzes_count ??
          course.quiz_count ??
          course.total_quizzes ??
          course.exercises_count ??
          course.exercise_count ??
          course.practice_quizzes_count ??
          course.metadata?.quizzes_count ??
          (Array.isArray(course.quizzes) ? course.quizzes.length : NaN),
        0,
      ),
    ),
  );

  const exams = Math.max(
    0,
    Math.round(
      toSafeNumber(
        course.exams_count ??
          course.exam_count ??
          course.total_exams ??
          course.tests_count ??
          course.test_count ??
          course.practice_exams_count ??
          course.metadata?.exams_count ??
          (Array.isArray(course.exams) ? course.exams.length : NaN),
        0,
      ),
    ),
  );

  const attempts = Math.max(
    0,
    Math.round(
      toSafeNumber(
        course.attempts_count ??
          course.total_attempts ??
          course.total_attempt_count ??
          course.practice_attempts ??
          course.completed_attempts ??
          course.submissions_count ??
          course.metadata?.attempts_count,
        0,
      ),
    ),
  );

  return { quizzes, exams, attempts };
};

const getCourseCardModel = (course = {}, index = 0) => {
  const textLessonsFallback =
    typeof course?.text_lessons_count === 'number'
      ? null
      : toSafeNumber(course.totalLessons ?? course.lessons_count ?? course.lesson_count, NaN);

  const lessons = Math.max(
    0,
    Math.round(
      toSafeNumber(
        course.text_lessons_count,
        Number.isFinite(textLessonsFallback) ? Math.max(textLessonsFallback, 0) : 0,
      ),
    ),
  );
  const exercises = Math.max(
    0,
    Math.round(
      toSafeNumber(
        course.lesson_exercises_count,
        course.totalExercises ??
          course.exercises_count ??
          course.exercise_count ??
          course.quiz_count ??
          course.quizzes_count ??
          0,
      ),
    ),
  );
  const videos = Math.max(
    0,
    Math.round(
      toSafeNumber(course.video_lessons_count, course.video_count ?? course.videos_count ?? course.totalVideos ?? 0),
    ),
  );
  const { quizzes, exams, attempts } = resolvePracticeCounts(course);
  const trendingScore =
    toSafeNumber(course.rating, 0) * 22 +
    toSafeNumber(course.enrolled_count ?? course.enrollment_count ?? course.popularity, 0) * 0.05 +
    toSafeNumber(course.offerings_count, 0) * 8 +
    toSafeNumber(course.completedLessons ?? course.completed_lessons, 0);

  const practiceTotal = Math.max(0, Math.round(toSafeNumber(course.practice_total, quizzes + exams)));
  const practiceAttempted = Math.max(0, Math.round(toSafeNumber(course.practice_attempted, 0)));
  const practiceProgress =
    practiceTotal > 0 ? Math.max(0, Math.min(100, Math.round(toSafeNumber(course.practice_progress, 0)))) : 0;
  const practiceBestScore = Math.max(0, Math.round(toSafeNumber(course.practice_best_score, 0)));

  return {
    id: getCourseId(course),
    title: getCourseTitle(course),
    code: getCourseCode(course),
    creditsText: getCourseCreditsText(course),
    image: getCourseImage(course, index),
    imageFallback: FALLBACK_IMAGES[index % FALLBACK_IMAGES.length],
    programs: getCoursePrograms(course),
    levels: getCourseLevels(course),
    semesters: getCourseSemesters(course),
    offerings: getCatalogOfferingFilters(course),
    lessons,
    exercises,
    videos,
    quizzes,
    exams,
    attempts,
    trendingScore,
    practiceTotal,
    practiceAttempted,
    practiceProgress,
    practiceBestScore,
  };
};

const normalizeLevelKey = (value = '') => {
  const normalized = toText(value);
  const digits = normalized.match(/\d+/)?.[0];
  return digits ? digits : normalized || 'General';
};

const getLevelSortValue = (value = '') => {
  const normalized = normalizeLevelKey(value);
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 9999;
};

const getCoursesFromResponse = (response) => response?.data?.courses || [];

export default function PracticeIndex() {
  const { user, isAuthenticated } = useAuth();
  const { currentPlan } = useSubscription();
  const { trackEvent } = useAnalytics();
  const { headerSheenReady, headerSheenCycle } = useHeaderSheen();
  useEffect(() => {
    const id = setTimeout(() => playUiSound('pageArrivePractice'), 500);
    return () => clearTimeout(id);
  }, []);

  const [programs, setPrograms] = useState([]);
  const [allCourses, setAllCourses] = useState([]);
  const [sectionCourses, setSectionCourses] = useState({
    trending: [],
    mostPracticed: [],
    top: [],
    recent: [],
  });
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [courseContentCounts, setCourseContentCounts] = useState({});
  const [error, setError] = useState('');

  const [myPractice, setMyPractice] = useState({
    loaded: false,
    missingProfile: true,
    courses: [],
    lastActivity: null,
    academicProfile: null,
  });

  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [discoveryMode, setDiscoveryMode] = useState('search');
  const [filters, setFilters] = useState({
    programCategory: 'all',
    program: 'all',
    level: 'all',
    semester: 'all',
  });
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const deferredFilters = useDeferredValue(filters);

  const planTierClass = getPlanTierClass(currentPlan?.name || user?.current_plan || 'Basic Student');
  const showContributionAppeal = !isPaidPlan(currentPlan?.name || user?.current_plan);

  const mapCourseList = useCallback(
    (courses = []) => courses.map((course, index) => getCourseCardModel(course, index)),
    []
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setMyPractice({ loaded: true, missingProfile: true, courses: [], lastActivity: null, academicProfile: null });
      return undefined;
    }

    let active = true;
    (async () => {
      try {
        const response = await api.courses.getCurrent();
        if (!active) return;
        setMyPractice({
          loaded: true,
          missingProfile: Boolean(response?.data?.missing_profile),
          courses: mapCourseList(response?.data?.courses || []),
          lastActivity: response?.data?.last_practice_activity || null,
          academicProfile: response?.data?.academic_profile || null,
        });
      } catch {
        if (!active) return;
        setMyPractice({ loaded: true, missingProfile: true, courses: [], lastActivity: null, academicProfile: null });
      }
    })();

    return () => {
      active = false;
    };
  }, [isAuthenticated, mapCourseList]);

  useEffect(() => {
    let active = true;
    const loadAccurateCounts = async () => {
      try {
        const [quizResponse, examResponse] = await Promise.all([
          api.content.getAll({ type: 'quiz', limit: 2000 }).catch(() => null),
          api.content.getAll({ type: 'past_question', limit: 2000 }).catch(() => null),
        ]);
        if (!active) return;

        const next = {};
        const consume = (items = [], field) => {
          (Array.isArray(items) ? items : []).forEach((item) => {
            const key = normalizeCourseKey(
              item?.course || item?.course_name || item?.metadata?.course || item?.metadata?.course_name || ''
            );
            if (!key) return;
            if (!next[key]) next[key] = { quizzes: 0, exams: 0 };
            next[key][field] += 1;
          });
        };

        consume(quizResponse?.content || quizResponse?.data?.content || [], 'quizzes');
        consume(examResponse?.content || examResponse?.data?.content || [], 'exams');
        setCourseContentCounts(next);
      } catch {
        if (active) setCourseContentCounts({});
      }
    };

    loadAccurateCounts();
    return () => {
      active = false;
    };
  }, []);

  const loadCatalogCourses = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const response = await api.courses.getAll({ limit: 1000 });

      setAllCourses(getCoursesFromResponse(response));
      setCatalogLoaded(true);
    } catch (err) {
      setAllCourses([]);
      setError((previous) => previous || err?.message || 'Could not load courses right now.');
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError('');
      setAllCourses([]);
      setCatalogLoaded(false);
      try {
        const [programsResponse, trendingResponse, mostPracticedResponse, topResponse, recentResponse] = await Promise.all([
          api.courses.getPrograms({ includeCounts: false }),
          api.courses.getAll({ limit: SECTION_LIMIT, sort_by: 'trending' }),
          api.courses.getAll({ limit: SECTION_LIMIT, sort_by: 'most_practiced' }),
          api.courses.getAll({ limit: SECTION_LIMIT, sort_by: 'top_test' }),
          api.courses.getAll({ limit: SECTION_LIMIT, sort_by: 'recent_test', sort_order: 'desc' }),
        ]);

        if (!active) return;
        setPrograms(programsResponse?.data?.programs || []);
        setSectionCourses({
          trending: mapCourseList(getCoursesFromResponse(trendingResponse)),
          mostPracticed: mapCourseList(getCoursesFromResponse(mostPracticedResponse)),
          top: mapCourseList(getCoursesFromResponse(topResponse)),
          recent: mapCourseList(getCoursesFromResponse(recentResponse)),
        });
      } catch (err) {
        if (!active) return;
        setPrograms([]);
        setAllCourses([]);
        setSectionCourses({
          trending: [],
          mostPracticed: [],
          top: [],
          recent: [],
        });
        setError(err?.message || 'Could not load courses right now.');
      } finally {
        if (active) setLoading(false);
      }
    };

    if (isAuthenticated) {
      setLoading(false);
    } else {
      load();
    }

    trackEvent('practice_page_viewed', {
      is_authenticated: isAuthenticated,
      plan: currentPlan?.name || 'visitor',
    });

    return () => {
      active = false;
    };
  }, [isAuthenticated, currentPlan?.name, mapCourseList, trackEvent]);

  const normalizedPrograms = useMemo(
    () =>
      (programs || [])
        .map((program) => ({
          id: String(program?.id || ''),
          name: toTitleCase(program?.name || program?.title || program?.program || ''),
          category: normalizeProgrammeCategory(program?.category || program?.type),
        }))
        .filter((program) => program.name && program.category),
    [programs]
  );

  const normalizedCourseCards = useMemo(
    () => (allCourses || []).map((course, index) => getCourseCardModel(course, index)),
    [allCourses]
  );

  const programOptions = useMemo(() => {
    const names = normalizedPrograms.map((program) => program.name).filter(Boolean);

    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }, [normalizedPrograms]);

  const levelOptions = CORE_LEVEL_OPTIONS;

  const semesterOptions = useMemo(() => {
    const semesters = allCourses.flatMap((course) => getCourseSemesters(course));
    return [...new Set(semesters.map((value) => normalizeLevelKey(value)))]
      .sort((a, b) => getLevelSortValue(a) - getLevelSortValue(b) || a.localeCompare(b));
  }, [allCourses]);

  const programCategoryMap = useMemo(() => {
    const map = new Map();
    normalizedPrograms.forEach((program) => {
      if (!program.name) return;
      map.set(normalizeText(program.name), program.category);
    });
    return map;
  }, [normalizedPrograms]);

  const filteredProgramOptions = useMemo(() => {
    return programOptions.filter((programName) => {
      if (filters.programCategory === 'all') return true;
      const category = programCategoryMap.get(normalizeText(programName)) || programName;
      return normalizeText(category) === normalizeText(filters.programCategory);
    });
  }, [filters.programCategory, programCategoryMap, programOptions]);

  const searchMatchedCourseCards = useMemo(() => {
    const search = normalizeText(deferredSearchQuery);
    if (!search) return [];

    return normalizedCourseCards
      .filter((course) => {
        const inSearch =
          normalizeText(`${course.title} ${course.code} ${course.programs.join(' ')}`).includes(search);
        return inSearch;
      });
  }, [deferredSearchQuery, normalizedCourseCards]);

  const filterMatchedCourseCards = useMemo(() => {
    return normalizedCourseCards.filter((course) => {
      if (course.offerings.length) {
        return course.offerings.some((offering) => catalogOfferingMatchesFilters(offering, deferredFilters));
      }

      if (deferredFilters.program !== 'all') {
        const matchesProgram = course.programs.some(
          (program) => normalizeText(program) === normalizeText(deferredFilters.program)
        );
        if (!matchesProgram) return false;
      }

      if (deferredFilters.programCategory !== 'all') {
        const categories = course.programs
          .map((program) => programCategoryMap.get(normalizeText(program)) || toTitleCase(program))
          .concat(toTitleCase(course.programs[0] || ''))
          .filter(Boolean);
        const matchesCategory = categories.some(
          (category) => normalizeText(category) === normalizeText(deferredFilters.programCategory)
        );
        if (!matchesCategory) return false;
      }

      if (deferredFilters.level !== 'all') {
        const matchesLevel = course.levels.some(
          (level) => normalizeLevelKey(level) === normalizeLevelKey(deferredFilters.level)
        );
        if (!matchesLevel) return false;
      }

      if (deferredFilters.semester !== 'all') {
        const matchesSemester = course.semesters.some(
          (semester) => normalizeLevelKey(semester) === normalizeLevelKey(deferredFilters.semester)
        );
        if (!matchesSemester) return false;
      }

      return true;
    });
  }, [deferredFilters, normalizedCourseCards, programCategoryMap]);

  const hasSearchQuery = useMemo(() => Boolean(normalizeText(searchQuery)), [searchQuery]);
  const hasActiveFilters = useMemo(
    () =>
      filters.programCategory !== 'all' ||
      filters.program !== 'all' ||
      filters.level !== 'all' ||
      filters.semester !== 'all',
    [filters.level, filters.program, filters.programCategory, filters.semester]
  );

  useEffect(() => {
    if (isAuthenticated) return;
    const shouldLoadCatalog = discoveryMode === 'filters' || hasSearchQuery;
    if (!shouldLoadCatalog || catalogLoaded || catalogLoading) return;
    loadCatalogCourses();
  }, [catalogLoaded, catalogLoading, discoveryMode, hasSearchQuery, isAuthenticated, loadCatalogCourses]);

  useEffect(() => {
    if (isAuthenticated || loading || catalogLoaded || catalogLoading) return undefined;
    return scheduleCatalogWarmup(loadCatalogCourses);
  }, [catalogLoaded, catalogLoading, isAuthenticated, loadCatalogCourses, loading]);

  const interactionResultCourses = useMemo(
    () => (discoveryMode === 'search' ? searchMatchedCourseCards : filterMatchedCourseCards),
    [discoveryMode, filterMatchedCourseCards, searchMatchedCourseCards]
  );

  const shouldShowInteractionResults = useMemo(
    () =>
      discoveryMode === 'search'
        ? hasSearchQuery
        : hasActiveFilters,
    [discoveryMode, hasActiveFilters, hasSearchQuery]
  );
  const visibleInteractionCourses = useIncrementalResults(interactionResultCourses, {
    active: shouldShowInteractionResults && !catalogLoading,
  });

  const showcasedCourseSections = useMemo(
    () => [
      {
        key: 'most-practiced',
        title: 'Most Practiced Items',
        items: sectionCourses.mostPracticed,
        empty: 'No most practiced items are available right now.',
      },
      {
        key: 'top-test-items',
        title: 'Top practice picks',
        items: sectionCourses.top,
        empty: 'No top practice picks are available right now.',
      },
      {
        key: 'recent-test-items',
        title: 'Recently Added Tests',
        items: sectionCourses.recent,
        empty: 'No recently added tests are available right now.',
      },
    ],
    [sectionCourses]
  );

  const myPracticeTotals = useMemo(() => {
    const courses = myPractice.courses;
    const itemsTotal = courses.reduce((sum, course) => sum + course.practiceTotal, 0);
    const itemsAttempted = courses.reduce((sum, course) => sum + course.practiceAttempted, 0);
    const overallProgress = itemsTotal
      ? Math.round((itemsAttempted / itemsTotal) * 100)
      : courses.length
        ? Math.round(courses.reduce((sum, course) => sum + course.practiceProgress, 0) / courses.length)
        : 0;
    return { itemsTotal, itemsAttempted, overallProgress };
  }, [myPractice.courses]);

  const showMyPractice =
    isAuthenticated && myPractice.loaded && !myPractice.missingProfile && myPractice.courses.length > 0;

  const practiceProfileLabels = useMemo(() => {
    const profile = myPractice.academicProfile || {};
    const programLabel = profile.program_name ? toTitleCase(profile.program_name) : 'Program not set';
    const categoryLabel = profile.programme_category
      ? normalizeProgrammeCategory(profile.programme_category) ||
        toTitleCase(profile.programme_category).replace(/\s*Education$/i, '')
      : '';
    const levelRaw = profile.level || '';
    const semesterRaw = profile.semester || '';
    const levelLabel = levelRaw
      ? (/level/i.test(String(levelRaw)) ? toTitleCase(levelRaw) : `Level ${levelRaw}`)
      : 'Level not set';
    const semesterLabel = semesterRaw
      ? (/semester/i.test(String(semesterRaw)) ? toTitleCase(semesterRaw) : `Semester ${semesterRaw}`)
      : 'Semester not set';
    return { programLabel, categoryLabel, levelLabel, semesterLabel };
  }, [myPractice.academicProfile]);

  const updateFilters = useCallback((changes) => {
    setFilters((prev) => ({ ...prev, ...changes }));
  }, []);

  const handleDiscoveryModeChange = useCallback((nextMode) => {
    if (nextMode === discoveryMode) return;
    playListPageToggleSound('toggle');
    setDiscoveryMode(nextMode);
  }, [discoveryMode]);

  const handleCourseImageError = (event, fallbackImage) => {
    const target = event.currentTarget;
    if (target.dataset.fallbackApplied === 'true') return;
    target.dataset.fallbackApplied = 'true';
    target.src = fallbackImage;
  };

  const renderCourseCard = (course, key) => {
    const destination = buildPracticePath(course);
    const fallbackImage = course.imageFallback || FALLBACK_IMAGES[0];
    const accurateCounts = courseContentCounts[normalizeCourseKey(course.title)] || null;
    const quizzes = Math.max(0, toSafeNumber(accurateCounts?.quizzes, toSafeNumber(course.quizzes, 0)));
    const exams = Math.max(0, toSafeNumber(accurateCounts?.exams, toSafeNumber(course.exams, 0)));
    const attempts = Math.max(0, toSafeNumber(course.attempts, 0));
    const displayTitle = stripPracticeCourseTitleSuffix(course.title);

    return (
      <Link
        key={key || `${course.id}-${course.title}`}
        to={destination}
        state={buildCourseRouteState(course)}
        className="learn-course-card"
        role="listitem"
      >
        <div className="learn-course-image">
          <img
            src={course.image || fallbackImage}
            alt={course.title}
            loading="lazy"
            decoding="async"
            onError={(event) => handleCourseImageError(event, fallbackImage)}
          />
        </div>
        <div className="learn-course-info">
          <strong className="learn-course-title">{displayTitle}</strong>
          <p className="learn-course-meta">
            <span className="learn-course-code">{course.code}</span>
            <span className="learn-course-credits">{course.creditsText}</span>
          </p>
          <div className="learn-course-pills">
            <span>{quizzes} Quizzes</span>
            <span>{exams} Exams</span>
            <span>{attempts} Attempts</span>
          </div>
        </div>
        <span className="learn-course-cta" aria-hidden="true">
          <FiChevronRight />
        </span>
      </Link>
    );
  };

  const renderMyPracticeCourseCard = (course, key) => {
    const destination = buildPracticePath(course);
    const fallbackImage = course.imageFallback || FALLBACK_IMAGES[0];
    const displayTitle = stripPracticeCourseTitleSuffix(course.title);
    const progress = Math.max(0, Math.min(100, course.practiceProgress));
    const accurateCounts = courseContentCounts[normalizeCourseKey(course.title)] || null;
    const quizzes = Math.max(0, toSafeNumber(accurateCounts?.quizzes, toSafeNumber(course.quizzes, 0)));
    const exams = Math.max(0, toSafeNumber(accurateCounts?.exams, toSafeNumber(course.exams, 0)));

    return (
      <Link
        key={key || `${course.id}-${course.title}`}
        to={destination}
        state={buildCourseRouteState(course)}
        className="learn-course-card learn-my-course-card"
        role="listitem"
      >
        <div className="learn-course-image">
          <img
            src={course.image || fallbackImage}
            alt={course.title}
            loading="lazy"
            decoding="async"
            onError={(event) => handleCourseImageError(event, fallbackImage)}
          />
        </div>
        <div className="learn-course-info">
          <strong className="learn-course-title">{displayTitle}</strong>
          <p className="learn-course-meta">
            <span className="learn-course-code">{course.code}</span>
            <span className="learn-course-credits">{course.creditsText}</span>
          </p>
          <div className="learn-course-pills">
            <span>{quizzes} Quizzes</span>
            <span>{exams} Exams</span>
          </div>
          {course.practiceTotal > 0 ? (
            <div className="learn-course-progress" aria-label={`${progress} percent complete`}>
              <div className="learn-course-progress-track">
                <div className="learn-course-progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <span className="learn-course-progress-label">
                {course.practiceAttempted}/{course.practiceTotal} practiced &middot; {progress}%
              </span>
            </div>
          ) : (
            <div className="learn-course-progress" aria-label="No practice items yet">
              <span className="learn-course-progress-label">No practice items yet</span>
            </div>
          )}
        </div>
        <span className="learn-course-cta" aria-hidden="true">
          <FiChevronRight />
        </span>
      </Link>
    );
  };

  const renderCourseSkeletonCard = (key) => (
    <div key={key} className="learn-course-card learn-course-card-skeleton" aria-hidden="true">
      <div className="learn-course-image shimmer-block" />
      <div className="learn-course-info">
        <span className="learn-skeleton-line learn-skeleton-line-title shimmer-block" />
        <span className="learn-skeleton-line learn-skeleton-line-meta shimmer-block" />
        <div className="learn-course-pills learn-skeleton-pills">
          <span className="shimmer-block" />
          <span className="shimmer-block" />
          <span className="shimmer-block" />
        </div>
      </div>
    </div>
  );

  const renderCourseSkeletonRow = (prefix, count = 6) =>
    Array.from({ length: count }, (_, index) => renderCourseSkeletonCard(`${prefix}-${index}`));

  return (
    <div className={`learn-redesign practice-redesign ${planTierClass} ${headerSheenReady ? 'page-header-sheen-ready' : ''}`}>
      <section className="learn-shell-header">
        <div className="learn-shell-header-icon" aria-hidden="true">
          <FiTarget />
        </div>
        <div className="learn-shell-header-copy">
          <h1 className="header-sheen-copy" key={`practice-header-title-${headerSheenCycle}`}>Practice</h1>
          <p className="header-sheen-copy" key={`practice-header-tagline-${headerSheenCycle}`}>
            "{PRACTICE_PAGE_QUOTE}" <span className="learn-shell-header-author">- {PRACTICE_PAGE_QUOTE_AUTHOR}</span>
          </p>
        </div>
      </section>

      <div className="learn-row-divider" aria-hidden="true" />

      {isAuthenticated ? (
        showMyPractice ? (
        <>
          <section className="learn-continue-section" aria-label="Continue practicing">
            <div className="learn-continue-card">
              <div className="learn-continue-progress">
                <div
                  className="learn-continue-ring"
                  style={{ '--progress': `${myPracticeTotals.overallProgress}%` }}
                >
                  <span>{myPracticeTotals.overallProgress}%</span>
                </div>
                <div className="learn-continue-progress-copy">
                  <h2>Your practice progress</h2>
                  <p>
                    {myPracticeTotals.itemsAttempted} of {myPracticeTotals.itemsTotal} practice items complete across{' '}
                    {myPractice.courses.length} course{myPractice.courses.length === 1 ? '' : 's'}.
                  </p>
                </div>
              </div>

              {myPractice.lastActivity ? (
                (() => {
                  const resumeCourse = myPractice.courses.find(
                    (course) => course.id === String(myPractice.lastActivity.course_id)
                  );
                  const fallbackImage = resumeCourse?.imageFallback || FALLBACK_IMAGES[0];
                  return (
                    <Link
                      to={`/practice/session/${myPractice.lastActivity.content_id}`}
                      state={{
                        coursePath: '/practice',
                        fromCoursePath: '/practice',
                        courseId: myPractice.lastActivity.course_id,
                        course: {
                          id: myPractice.lastActivity.course_id,
                          title: myPractice.lastActivity.course_title,
                        },
                      }}
                      className="learn-resume-card"
                    >
                      <div className="learn-resume-image">
                        <img
                          src={resumeCourse?.image || fallbackImage}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          onError={(event) => handleCourseImageError(event, fallbackImage)}
                        />
                      </div>
                      <div className="learn-resume-info">
                        <span className="learn-resume-kicker">Pick up where you left off</span>
                        <strong>
                          {stripPracticeCourseTitleSuffix(myPractice.lastActivity.content_title || 'Practice item')}
                        </strong>
                        <span className="learn-resume-course">
                          {stripPracticeCourseTitleSuffix(myPractice.lastActivity.course_title || '')}
                          {' · '}Last score {Math.round(myPractice.lastActivity.percent_score)}%
                        </span>
                        <div className="learn-resume-progress-bar">
                          <div
                            className="learn-resume-progress-fill"
                            style={{ width: `${Math.max(0, Math.min(100, myPractice.lastActivity.percent_score))}%` }}
                          />
                        </div>
                      </div>
                      <span className="learn-resume-cta">Continue</span>
                    </Link>
                  );
                })()
              ) : (
                <>
                  <div className="learn-continue-profile-divider" aria-hidden="true" />
                  <div className="learn-continue-profile" aria-label="Your academic profile">
                    {[
                      practiceProfileLabels.programLabel,
                      practiceProfileLabels.categoryLabel,
                      practiceProfileLabels.levelLabel,
                      practiceProfileLabels.semesterLabel,
                    ]
                      .filter(Boolean)
                      .map((label, index, items) => (
                        <span className="learn-continue-profile-item" key={label}>
                          {label}
                          {index < items.length - 1 ? (
                            <span className="learn-continue-profile-dot" aria-hidden="true">·</span>
                          ) : null}
                        </span>
                      ))}
                  </div>
                </>
              )}
            </div>
          </section>

          <div className="learn-row-divider" aria-hidden="true" />

          <section className="learn-section" aria-label="My practice courses">
            <div className="learn-section-head">
              <h2>My Practice Courses</h2>
              <span>{myPractice.courses.length}</span>
            </div>
            <div className="learn-my-courses-grid" role="list">
              {myPractice.courses.map((course, index) => renderMyPracticeCourseCard(course, `my-practice-course-${index}`))}
            </div>
          </section>

          <div className="learn-row-divider" aria-hidden="true" />
        </>
        ) : !myPractice.loaded ? (
          <>
            <section className="learn-continue-section" aria-label="Continue practicing">
              <div className="learn-continue-card">
                <div className="learn-continue-progress">
                  <div className="learn-continue-ring shimmer-block" aria-hidden="true" />
                  <div className="learn-continue-progress-copy">
                    <span className="learn-skeleton-line learn-skeleton-line-title shimmer-block" />
                    <span
                      className="learn-skeleton-line learn-skeleton-line-meta shimmer-block"
                      style={{ marginTop: '0.4rem' }}
                    />
                  </div>
                </div>

                <div className="learn-resume-card learn-resume-card-skeleton" aria-hidden="true">
                  <div className="learn-resume-image shimmer-block" />
                  <div className="learn-resume-info">
                    <span className="shimmer-block" style={{ width: '40%', height: '0.6rem', borderRadius: '999px' }} />
                    <span
                      className="shimmer-block"
                      style={{ width: '72%', height: '0.9rem', marginTop: '0.3rem', borderRadius: '999px' }}
                    />
                    <span
                      className="shimmer-block"
                      style={{ width: '52%', height: '0.7rem', marginTop: '0.25rem', borderRadius: '999px' }}
                    />
                  </div>
                </div>
              </div>
            </section>

            <div className="learn-row-divider" aria-hidden="true" />

            <section className="learn-section" aria-label="My practice courses">
              <div className="learn-section-head">
                <h2>My Practice Courses</h2>
              </div>
              <div className="learn-my-courses-grid" role="list">
                {renderCourseSkeletonRow('my-practice-courses-skeleton', 3)}
              </div>
            </section>
          </>
        ) : (
          <p className="learn-section-empty">You don't have any current courses yet.</p>
        )
      ) : (
        <>
          <section className="learn-search-panel" aria-label="Practice search and filters">
            <div className="learn-mode-switch" role="tablist" aria-label="Choose discovery mode">
              <button
                type="button"
                role="tab"
                aria-selected={discoveryMode === 'search'}
                className={`learn-mode-switch-btn ${discoveryMode === 'search' ? 'active' : ''}`}
                onClick={() => handleDiscoveryModeChange('search')}
              >
                Search
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={discoveryMode === 'filters'}
                className={`learn-mode-switch-btn ${discoveryMode === 'filters' ? 'active' : ''}`}
                onClick={() => handleDiscoveryModeChange('filters')}
              >
                Filters
              </button>
            </div>

            {discoveryMode === 'search' ? (
              <div className="learn-search-row">
                <label htmlFor="practice-course-search" className="learn-search-input-wrap">
                  <FiSearch />
                  <input
                    id="practice-course-search"
                    type="search"
                    placeholder="Search practice items by title or code"
                    value={searchInput}
                    onChange={(event) => {
                      const next = event.target.value;
                      setSearchInput(next);
                      setSearchQuery(next.trim());
                    }}
                  />
                </label>
              </div>
            ) : (
              <div className="learn-filter-grid">
                <LearnFilterDropdown
                  label="Category"
                  value={filters.programCategory}
                  options={[
                    { value: 'all', label: 'All Categories' },
                    ...PROGRAMME_CATEGORY_OPTIONS,
                  ]}
                  onChange={(nextValue) => updateFilters({ programCategory: nextValue, program: 'all' })}
                />

                <LearnFilterDropdown
                  label="Program"
                  value={filters.program}
                  options={[
                    { value: 'all', label: 'All Programs' },
                    ...filteredProgramOptions.map((programName) => ({ value: programName, label: programName })),
                  ]}
                  onChange={(nextValue) => updateFilters({ program: nextValue })}
                />

                <LearnFilterDropdown
                  label="Level"
                  value={filters.level}
                  options={[
                    { value: 'all', label: 'All Levels' },
                    ...levelOptions.map((level) => ({ value: level, label: `Level ${level}` })),
                  ]}
                  onChange={(nextValue) => updateFilters({ level: nextValue })}
                />

                <LearnFilterDropdown
                  label="Semester"
                  value={filters.semester}
                  options={[
                    { value: 'all', label: 'All Semesters' },
                    ...semesterOptions.map((semester) => ({ value: semester, label: `Semester ${semester}` })),
                  ]}
                  onChange={(nextValue) => updateFilters({ semester: nextValue })}
                />
              </div>
            )}
          </section>

          <div className="learn-row-divider" aria-hidden="true" />

          {shouldShowInteractionResults ? (
            <>
              <section className="learn-section" aria-label={discoveryMode === 'search' ? 'Search results' : 'Filter matches'}>
                <div className="learn-section-head">
                  <h2>{discoveryMode === 'search' ? 'Search Results' : 'Filter Matches'}</h2>
                  <span>{visibleInteractionCourses.totalCount}</span>
                </div>

                {catalogLoading && !catalogLoaded ? (
                  <div
                    className="learn-results-grid"
                    role="list"
                    aria-label={discoveryMode === 'search' ? 'Search results loading state' : 'Filter results loading state'}
                  >
                    {renderCourseSkeletonRow(`practice-interaction-${discoveryMode}-skeleton`)}
                  </div>
                ) : visibleInteractionCourses.totalCount === 0 ? (
                  <p className="learn-section-empty">
                    {discoveryMode === 'search'
                      ? 'No practice items matched your search.'
                      : 'No practice items matched your selected filters.'}
                  </p>
                ) : (
                  <div
                    className="learn-results-grid"
                    role="list"
                    aria-label={discoveryMode === 'search' ? 'Search results' : 'Filter matches'}
                  >
                    {visibleInteractionCourses.items.map((course, index) =>
                      renderCourseCard(course, `interaction-${discoveryMode}-${index}`)
                    )}
                  </div>
                )}
              </section>

              <div className="learn-row-divider" aria-hidden="true" />
            </>
          ) : null}

          <section className="learn-section practice-trending-section" aria-label="Trending practice items">
            <div className="learn-section-head">
              <h2>Trending Practice Items</h2>
              <span>{sectionCourses.trending.length}</span>
            </div>

            {loading ? (
              <LearnHorizontalSlider ariaLabel="Trending practice items slider loading state" autoSlide>
                {renderCourseSkeletonRow('practice-trending-skeleton')}
              </LearnHorizontalSlider>
            ) : sectionCourses.trending.length === 0 ? (
              <p className="learn-section-empty">No trending practice items are available right now.</p>
            ) : (
              <LearnHorizontalSlider ariaLabel="Trending practice items slider" autoSlide>
                {sectionCourses.trending.map((course, index) => renderCourseCard(course, `trending-${index}`))}
              </LearnHorizontalSlider>
            )}
          </section>

          <div className="learn-row-divider" aria-hidden="true" />

          {showcasedCourseSections.map((section, sectionIndex) => (
            <section className="learn-section" aria-label={section.title} key={section.key}>
              <div className="learn-section-head">
                <h2>{section.title}</h2>
                <span>{section.items.length}</span>
              </div>

              {sectionIndex === 0 && error ? <p className="learn-section-empty">{error}</p> : null}

              {loading ? (
                <LearnHorizontalSlider ariaLabel={`${section.title} slider loading state`}>
                  {renderCourseSkeletonRow(`${section.key}-skeleton`)}
                </LearnHorizontalSlider>
              ) : section.items.length === 0 ? (
                <p className="learn-section-empty">{section.empty}</p>
              ) : (
                <LearnHorizontalSlider ariaLabel={`${section.title} slider`}>
                  {section.items.map((course, index) => renderCourseCard(course, `${section.key}-${index}`))}
                </LearnHorizontalSlider>
              )}

              {sectionIndex < showcasedCourseSections.length - 1 ? (
                <div className="learn-row-divider" aria-hidden="true" />
              ) : null}
            </section>
          ))}
        </>
      )}

      {showContributionAppeal ? (
        <ContributionAppeal className="page-contribution-appeal" showPlansCta />
      ) : null}
    </div>
  );
}

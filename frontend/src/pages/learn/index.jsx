import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiBookOpen, FiChevronRight, FiSearch } from 'react-icons/fi';
import { useAuth } from '../../hooks/useAuth';
import { useSubscription } from '../../hooks/useSubscription';
import { useAnalytics } from '../../hooks/useAnalytics';
import useHeaderSheen from '../../hooks/useHeaderSheen';
import api from '../../services/api';
import { getPlanTierClass, isPaidPlan } from '../../utils/planTheme';
import ContributionAppeal from '../../components/subscription/ContributionAppeal';
import { getDisplayCourseCode } from '../../utils/courseCode';
import { buildCoursePath, buildCourseRouteState } from '../../utils/courseRouting';
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
import './Learn.css';

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
const LEARN_PAGE_QUOTE = 'Learning never exhausts the mind.';
const LEARN_PAGE_QUOTE_AUTHOR = 'Leonardo da Vinci';

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

const getCourseId = (course = {}) =>
  String(course.id || course.course_id || course.content_id || course.uuid || course.slug || '').trim();

const getCourseTitle = (course = {}) =>
  toTitleCase(course.title || course.name || course.course_title || course.course_name || 'Untitled Course');

const getCourseCode = (course = {}) => getDisplayCourseCode(course, 'N/A');

const getCourseCreditsText = (course = {}) => {
  const raw = course.credits ?? course.credit ?? course.credit_hours;
  const text = toText(raw);
  if (!text) return '3 Credits';
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

const getCourseCardModel = (course = {}, index = 0) => {
  const textLessonsFallback =
    typeof course?.text_lessons_count === 'number'
      ? null
      : toSafeNumber(
          course.totalLessons ??
            course.lessons_count ??
            course.lesson_count ??
            course.total_lessons,
          NaN,
        );

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
  const trendingScore =
    toSafeNumber(course.rating, 0) * 22 +
    toSafeNumber(course.enrolled_count ?? course.enrollment_count ?? course.popularity, 0) * 0.05 +
    toSafeNumber(course.offerings_count, 0) * 8 +
    toSafeNumber(course.completedLessons ?? course.completed_lessons, 0);

  const progress = Math.max(0, Math.min(100, Math.round(toSafeNumber(course.progress ?? course.progress_percentage, 0))));
  const completedLessonsCount = Math.max(0, Math.round(toSafeNumber(course.completedLessons ?? course.completed_lessons, 0)));

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
    trendingScore,
    progress,
    completedLessonsCount,
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

export default function LearnIndex() {
  const { user, isAuthenticated } = useAuth();
  const { currentPlan } = useSubscription();
  const { trackEvent } = useAnalytics();
  const { headerSheenReady, headerSheenCycle } = useHeaderSheen();
  useEffect(() => {
    const id = setTimeout(() => playUiSound('pageArriveLearn'), 500);
    return () => clearTimeout(id);
  }, []);

  const [myLearning, setMyLearning] = useState({
    loaded: false,
    missingProfile: true,
    courses: [],
    lastActivity: null,
    academicProfile: null,
  });

  const [programs, setPrograms] = useState([]);
  const [allCourses, setAllCourses] = useState([]);
  const [sectionCourses, setSectionCourses] = useState({
    trending: [],
    mostStudied: [],
    top: [],
    recent: [],
  });
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [error, setError] = useState('');

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
      setMyLearning({ loaded: true, missingProfile: true, courses: [], lastActivity: null, academicProfile: null });
      return undefined;
    }

    let active = true;
    (async () => {
      try {
        const response = await api.courses.getCurrent();
        if (!active) return;
        setMyLearning({
          loaded: true,
          missingProfile: Boolean(response?.data?.missing_profile),
          courses: mapCourseList(response?.data?.courses || []),
          lastActivity: response?.data?.last_activity || null,
          academicProfile: response?.data?.academic_profile || null,
        });
      } catch {
        if (!active) return;
        setMyLearning({ loaded: true, missingProfile: true, courses: [], lastActivity: null, academicProfile: null });
      }
    })();

    return () => {
      active = false;
    };
  }, [isAuthenticated, mapCourseList]);

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
    if (isAuthenticated) {
      setLoading(false);
      return undefined;
    }

    let active = true;

    const load = async () => {
      setLoading(true);
      setError('');
      setAllCourses([]);
      setCatalogLoaded(false);
      try {
        const [programsResponse, trendingResponse, mostStudiedResponse, topResponse, recentResponse] = await Promise.all([
          api.courses.getPrograms({ includeCounts: false }),
          api.courses.getAll({ limit: SECTION_LIMIT, sort_by: 'trending' }),
          api.courses.getAll({ limit: SECTION_LIMIT, sort_by: 'most_studied' }),
          api.courses.getAll({ limit: SECTION_LIMIT, sort_by: 'top' }),
          api.courses.getAll({ limit: SECTION_LIMIT, sort_by: 'recent', sort_order: 'desc' }),
        ]);

        if (!active) return;
        setPrograms(programsResponse?.data?.programs || []);
        setSectionCourses({
          trending: mapCourseList(getCoursesFromResponse(trendingResponse)),
          mostStudied: mapCourseList(getCoursesFromResponse(mostStudiedResponse)),
          top: mapCourseList(getCoursesFromResponse(topResponse)),
          recent: mapCourseList(getCoursesFromResponse(recentResponse)),
        });
      } catch (err) {
        if (!active) return;
        setPrograms([]);
        setAllCourses([]);
        setSectionCourses({
          trending: [],
          mostStudied: [],
          top: [],
          recent: [],
        });
        setError(err?.message || 'Could not load courses right now.');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [isAuthenticated, mapCourseList]);

  useEffect(() => {
    trackEvent('learn_page_viewed', {
      is_authenticated: isAuthenticated,
      plan: currentPlan?.name || 'visitor',
    });
  }, [isAuthenticated, currentPlan?.name, trackEvent]);

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
    if (isAuthenticated) return undefined;
    if (loading || catalogLoaded || catalogLoading) return undefined;
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
        key: 'most-studied',
        title: 'Most Studied Courses',
        items: sectionCourses.mostStudied,
        empty: 'No most studied courses are available right now.',
      },
      {
        key: 'top-courses',
        title: 'Top Courses',
        items: sectionCourses.top,
        empty: 'No top courses are available right now.',
      },
      {
        key: 'recent-courses',
        title: 'Recently Added Courses',
        items: sectionCourses.recent,
        empty: 'No recently added courses are available right now.',
      },
    ],
    [sectionCourses]
  );

  const myLearningTotals = useMemo(() => {
    const courses = myLearning.courses;
    const lessonsTotal = courses.reduce((sum, course) => sum + course.lessons, 0);
    const lessonsCompleted = courses.reduce((sum, course) => sum + course.completedLessonsCount, 0);
    const overallProgress = lessonsTotal
      ? Math.round((lessonsCompleted / lessonsTotal) * 100)
      : courses.length
        ? Math.round(courses.reduce((sum, course) => sum + course.progress, 0) / courses.length)
        : 0;
    return { lessonsTotal, lessonsCompleted, overallProgress };
  }, [myLearning.courses]);

  const showMyLearning =
    isAuthenticated && myLearning.loaded && !myLearning.missingProfile && myLearning.courses.length > 0;

  const learnerProfileLabels = useMemo(() => {
    const profile = myLearning.academicProfile || {};
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
  }, [myLearning.academicProfile]);

  const handleCourseImageError = (event, fallbackImage) => {
    const target = event.currentTarget;
    if (target.dataset.fallbackApplied === 'true') return;
    target.dataset.fallbackApplied = 'true';
    target.src = fallbackImage;
  };

  const updateFilters = useCallback((changes) => {
    setFilters((prev) => ({ ...prev, ...changes }));
  }, []);

  const handleDiscoveryModeChange = useCallback((nextMode) => {
    if (nextMode === discoveryMode) return;
    playListPageToggleSound('toggle');
    setDiscoveryMode(nextMode);
  }, [discoveryMode]);

  const renderCourseCard = (course, key) => {
    const fallbackImage = course.imageFallback || FALLBACK_IMAGES[0];

    return (
      <Link
        key={key || `${course.id}-${course.title}`}
        to={buildCoursePath(course)}
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
          <strong className="learn-course-title">{course.title}</strong>
          <p className="learn-course-meta">
            <span className="learn-course-code">{course.code}</span>
            <span className="learn-course-credits">{course.creditsText}</span>
          </p>
          <div className="learn-course-pills">
            <span>{Math.max(0, course.lessons)} Lessons</span>
            <span>{Math.max(0, course.exercises)} Exercises</span>
            <span>{Math.max(0, course.videos)} Videos</span>
          </div>
        </div>
        <span className="learn-course-cta" aria-hidden="true">
          <FiChevronRight />
        </span>
      </Link>
    );
  };

  const renderMyCourseCard = (course, key) => {
    const fallbackImage = course.imageFallback || FALLBACK_IMAGES[0];
    const progress = Math.max(0, Math.min(100, course.progress));

    return (
      <Link
        key={key || `${course.id}-${course.title}`}
        to={buildCoursePath(course)}
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
          <strong className="learn-course-title">{course.title}</strong>
          <p className="learn-course-meta">
            <span className="learn-course-code">{course.code}</span>
            <span className="learn-course-credits">{course.creditsText}</span>
          </p>
          <div className="learn-course-pills">
            <span>{Math.max(0, course.lessons)} Lessons</span>
            <span>{Math.max(0, course.exercises)} Exercises</span>
            <span>{Math.max(0, course.videos)} Videos</span>
          </div>
          <div className="learn-course-progress" aria-label={`${progress} percent complete`}>
            <div className="learn-course-progress-track">
              <div className="learn-course-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="learn-course-progress-label">{progress}% complete</span>
          </div>
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
    <div className={`learn-redesign ${planTierClass} ${headerSheenReady ? 'page-header-sheen-ready' : ''}`}>
      <section className="learn-shell-header">
        <div className="learn-shell-header-icon" aria-hidden="true">
          <FiBookOpen />
        </div>
        <div className="learn-shell-header-copy">
          <h1 className="header-sheen-copy" key={`learn-header-title-${headerSheenCycle}`}>Learn</h1>
          <p className="header-sheen-copy" key={`learn-header-tagline-${headerSheenCycle}`}>
            "{LEARN_PAGE_QUOTE}" <span className="learn-shell-header-author">- {LEARN_PAGE_QUOTE_AUTHOR}</span>
          </p>
        </div>
      </section>

      <div className="learn-row-divider" aria-hidden="true" />

      {isAuthenticated ? (
        showMyLearning ? (
          <>
            <section className="learn-continue-section" aria-label="Continue learning">
              <div className="learn-continue-card">
                <div className="learn-continue-progress">
                  <div
                    className="learn-continue-ring"
                    style={{ '--progress': `${myLearningTotals.overallProgress}%` }}
                  >
                    <span>{myLearningTotals.overallProgress}%</span>
                  </div>
                  <div className="learn-continue-progress-copy">
                    <h2>Your learning progress</h2>
                    <p>
                      {myLearningTotals.lessonsCompleted} of {myLearningTotals.lessonsTotal} lessons complete across{' '}
                      {myLearning.courses.length} course{myLearning.courses.length === 1 ? '' : 's'}.
                    </p>
                  </div>
                </div>

                {myLearning.lastActivity ? (
                  <Link
                    to={`/learn/lesson/${myLearning.lastActivity.lesson_id}`}
                    state={{
                      coursePath: '/learn',
                      fromCoursePath: '/learn',
                      courseId: myLearning.lastActivity.course_id,
                      course: {
                        id: myLearning.lastActivity.course_id,
                        title: myLearning.lastActivity.course_title,
                      },
                    }}
                    className="learn-resume-card"
                  >
                    <div className="learn-resume-image">
                      <img
                        src={myLearning.lastActivity.course_image || FALLBACK_IMAGES[0]}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        onError={(event) => handleCourseImageError(event, FALLBACK_IMAGES[0])}
                      />
                    </div>
                    <div className="learn-resume-info">
                      <span className="learn-resume-kicker">Pick up where you left off</span>
                      <strong>{myLearning.lastActivity.lesson_title}</strong>
                      <span className="learn-resume-course">{myLearning.lastActivity.course_title}</span>
                      <div className="learn-resume-progress-bar">
                        <div
                          className="learn-resume-progress-fill"
                          style={{ width: `${Math.max(0, Math.min(100, myLearning.lastActivity.progress))}%` }}
                        />
                      </div>
                    </div>
                    <span className="learn-resume-cta">Continue</span>
                  </Link>
                ) : (
                  <>
                    <div className="learn-continue-profile-divider" aria-hidden="true" />
                    <div className="learn-continue-profile" aria-label="Your academic profile">
                      {[
                        learnerProfileLabels.programLabel,
                        learnerProfileLabels.categoryLabel,
                        learnerProfileLabels.levelLabel,
                        learnerProfileLabels.semesterLabel,
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

            <section className="learn-section" aria-label="My courses">
              <div className="learn-section-head">
                <h2>My Courses</h2>
                <span>{myLearning.courses.length}</span>
              </div>
              <div className="learn-my-courses-grid" role="list">
                {myLearning.courses.map((course, index) => renderMyCourseCard(course, `my-course-${index}`))}
              </div>
            </section>
          </>
        ) : !myLearning.loaded ? (
          <>
            <section className="learn-continue-section" aria-label="Continue learning">
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

            <section className="learn-section" aria-label="My courses">
              <div className="learn-section-head">
                <h2>My Courses</h2>
              </div>
              <div className="learn-my-courses-grid" role="list">
                {renderCourseSkeletonRow('my-courses-skeleton', 3)}
              </div>
            </section>
          </>
        ) : (
          <p className="learn-section-empty">You don't have any current courses yet.</p>
        )
      ) : (
        <>
          <section className="learn-search-panel" aria-label="Course search and filters">
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
                <label htmlFor="learn-course-search" className="learn-search-input-wrap">
                  <FiSearch />
                  <input
                    id="learn-course-search"
                    type="search"
                    placeholder="Search courses by title or code"
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
                    {renderCourseSkeletonRow(`interaction-${discoveryMode}-skeleton`)}
                  </div>
                ) : visibleInteractionCourses.totalCount === 0 ? (
                  <p className="learn-section-empty">
                    {discoveryMode === 'search'
                      ? 'No courses matched your search.'
                      : 'No courses matched your selected filters.'}
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

          <section className="learn-section learn-trending-section" aria-label="Trending courses">
            <div className="learn-section-head">
              <h2>Trending Courses</h2>
              <span>{sectionCourses.trending.length}</span>
            </div>

            {loading ? (
              <LearnHorizontalSlider ariaLabel="Trending courses slider loading state" autoSlide>
                {renderCourseSkeletonRow('trending-skeleton')}
              </LearnHorizontalSlider>
            ) : sectionCourses.trending.length === 0 ? (
              <p className="learn-section-empty">No trending courses are available right now.</p>
            ) : (
              <LearnHorizontalSlider ariaLabel="Trending courses slider" autoSlide>
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

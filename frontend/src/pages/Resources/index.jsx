import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiEye,
  FiFileText,
  FiFolder,
  FiHardDrive,
  FiSearch,
} from 'react-icons/fi';
import { useAuth } from '../../hooks/useAuth';
import { useSubscription } from '../../hooks/useSubscription';
import { useAnalytics } from '../../hooks/useAnalytics';
import useHeaderSheen from '../../hooks/useHeaderSheen';
import api from '../../services/api';
import { getPlanTierClass, isPaidPlan } from '../../utils/planTheme';
import ContributionAppeal from '../../components/subscription/ContributionAppeal';
import { consumeGuestContentView } from '../../utils/guestContentAccess';
import { recordLastActivity, ACTIVITY_TYPES } from '../../utils/lastActivity';
import { getDisplayCourseCode } from '../../utils/courseCode';
import { saveBlobAsFile, withDownloadLock } from '../../utils/downloadManager';
import { playUiSound } from '../../utils/uiSounds';
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
import ResourceFilePreviewModal from '../../components/resources/ResourceFilePreviewModal';
import DownloadCountdownModal from '../../components/resources/DownloadCountdownModal';
import PlsHorizontalSlider from '../PLS/components/HorizontalSlider';
import '../learn/Learn.css';
import '../PLS/PLS.css';
import './ResourcesDashboard.css';

const SECTION_LIMIT = 10;
const RESOURCES_PAGE_QUOTE = 'An investment in knowledge pays the best interest.';
const RESOURCES_PAGE_QUOTE_AUTHOR = 'Benjamin Franklin';

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
  String(course.id || course.course_id || course.uuid || course.slug || '').trim();

const getCourseTitle = (course = {}) =>
  toTitleCase(course.title || course.name || course.course_title || course.course_name || 'Untitled Course');

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

const formatFileSizeLabel = (value) => {
  const bytes = toSafeNumber(value, 0);
  if (bytes <= 0) return '0 KB';
  const units = ['Bytes', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const converted = bytes / Math.pow(1024, index);
  const rounded = converted >= 10 ? Math.round(converted) : Math.round(converted * 10) / 10;
  return `${rounded} ${units[index]}`;
};

const getQuestionTypeLabel = ({ title = '', category = '', tags = [] } = {}) => {
  const source = `${title} ${category} ${toArray(tags).join(' ')}`.toLowerCase();
  if (source.includes('outline')) return 'Outline';
  if (source.includes('answer') || source.includes('solution') || source.includes('worked')) return 'Answer';
  if (source.includes('exam')) return 'Exam';
  if (source.includes('quiz') || source.includes('test')) return 'Quiz';
  return 'Exam';
};

const getQuestionTypeTone = (label = '') => {
  const value = String(label).toLowerCase();
  if (value.includes('outline')) return 'outline';
  if (value.includes('answer')) return 'answer';
  if (value.includes('exam')) return 'exam';
  if (value.includes('quiz')) return 'quiz';
  return 'quiz';
};

const getFileSubTypeLabel = ({ title = '', category = '', tags = [] } = {}) => {
  const source = `${title} ${category} ${toArray(tags).join(' ')}`.toLowerCase().replace(/\s+/g, ' ');
  if (source.includes('external')) return 'External';
  if (source.includes('internal')) return 'Internal';
  if (source.includes('sect a') || source.includes('section a') || source.includes('set a')) return 'Section A';
  if (source.includes('sect b') || source.includes('section b') || source.includes('set b')) return 'Section B';
  if (source.includes('outline')) return 'Outline';
  return 'Internal';
};

const getFileSubTypeDisplay = ({ subType = '', questionType = '' } = {}) => {
  const normalizedSubType = String(subType).trim();
  const normalizedQuestion = String(questionType).trim();

  if (/outline/i.test(normalizedSubType) || /outline/i.test(normalizedQuestion)) return 'Course Outline';
  if (/external/i.test(normalizedSubType)) return `External ${normalizedQuestion || 'Quiz'}`.trim();
  if (/internal/i.test(normalizedSubType)) return `Internal ${normalizedQuestion || 'Quiz'}`.trim();
  if (/section\s*[ab]/i.test(normalizedSubType)) return `${normalizedSubType} ${normalizedQuestion || 'Exam'}`.trim();
  return normalizedSubType || normalizedQuestion || 'Internal Quiz';
};

const getFileYearLabel = ({ year = '', title = '', createdAt = '', uploadedAt = '' } = {}) => {
  const explicitYear = String(year || '').trim();
  if (/^(19|20)\d{2}$/.test(explicitYear)) return explicitYear;

  const titleMatch = String(title).match(/\b(19|20)\d{2}\b/);
  if (titleMatch) return titleMatch[0];

  const dateValue = createdAt || uploadedAt;
  const date = new Date(dateValue);
  if (!Number.isNaN(date.getTime())) return String(date.getFullYear());

  return String(new Date().getFullYear());
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

const buildFileSearchText = ({
  title = '',
  fileName = '',
  courseName = '',
  courseCode = '',
  questionType = '',
  subType = '',
  uploader = '',
  year = '',
  category = '',
  tags = [],
} = {}) => {
  const normalizedCategory = toText(category).replace(/[_-]+/g, ' ');
  const normalizedTags = toArray(tags)
    .map((tag) => (typeof tag === 'string' ? tag : tag?.name || tag?.title || ''))
    .join(' ');
  const aliasKeywords = [];
  const curriculumSource = `${title} ${fileName} ${courseName} ${normalizedCategory} ${normalizedTags}`;

  if (/\bges\b|curriculum|framework|guideline|standard|syllabus|\bnts\b|policy/i.test(curriculumSource)) {
    aliasKeywords.push('ges curriculum curriculum policy framework guideline standard syllabus nts');
  }

  if (normalizeText(courseName) === 'general studies') {
    aliasKeywords.push('general curriculum studies ges curriculum');
  }

  return normalizeText(
    [
      title,
      fileName,
      courseName,
      courseCode,
      questionType,
      subType,
      uploader,
      year,
      normalizedCategory,
      normalizedTags,
      aliasKeywords.join(' '),
    ].join(' ')
  );
};

const matchesSearchQuery = (haystack = '', query = '') => {
  const normalizedHaystack = normalizeText(haystack);
  const tokens = normalizeText(query)
    .split(/\s+/)
    .filter(Boolean);

  if (!tokens.length) return false;
  return tokens.every((token) => normalizedHaystack.includes(token));
};

const getFilesFromResponse = (response) => response?.files || response?.data?.files || [];

const getResourceFileCardModel = (file = {}, index = 0, courseMetaMap = new Map(), fallbackCourses = []) => {
  const rawTitle = toText(file?.title || file?.file_name || `File ${index + 1}`);
  const rawCourseName = toText(file?.course || file?.course_name || file?.subject || 'General Studies');
  const fallbackCourseName =
    rawCourseName ||
    fallbackCourses[index % (fallbackCourses.length || 1)]?.title ||
    'General Studies';
  const resolvedCourse = courseMetaMap.get(normalizeText(fallbackCourseName));

  const category = toText(file?.category || file?.type || file?.file_category);
  const tags = toArray(file?.tags);
  const questionType = getQuestionTypeLabel({ title: rawTitle, category, tags });
  const questionTone = getQuestionTypeTone(questionType);
  const subType = getFileSubTypeDisplay({
    subType: getFileSubTypeLabel({ title: rawTitle, category, tags }),
    questionType,
  });

  const downloads = Math.max(
    0,
    Math.round(toSafeNumber(file?.downloads ?? file?.download_count ?? file?.stats?.downloads, 0))
  );
  const views = Math.max(
    0,
    Math.round(toSafeNumber(file?.views ?? file?.view_count ?? file?.stats?.views, 0))
  );

  const fileName = toText(file?.file_name || `${rawTitle}.pdf`);
  const courseName = toTitleCase(fallbackCourseName);
  const courseCode = getDisplayCourseCode(
    {
      ...(resolvedCourse || {}),
      course_code: file?.course_code || resolvedCourse?.course_code,
      code: resolvedCourse?.code || file?.course_code,
    },
    'CRS 100'
  );
  const uploader = toTitleCase(
    file?.uploader || file?.uploader_name || file?.uploaded_by || file?.creator_name || 'Learnda Creator'
  );
  const year = getFileYearLabel({
    year: file?.year,
    title: rawTitle,
    createdAt: file?.created_at,
    uploadedAt: file?.uploaded_at,
  });
  const rawFileLevel = toText(file?.level);
  const rawFileSemester = toText(file?.semester);
  const fileLevel = rawFileLevel ? normalizeLevelKey(rawFileLevel) : '';
  const fileSemester = rawFileSemester ? normalizeLevelKey(rawFileSemester) : '';
  const resolvedOfferings = toArray(resolvedCourse?.offerings).filter((offering) => {
    if (fileLevel && normalizeLevelKey(offering?.level) !== fileLevel) return false;
    if (fileSemester && normalizeLevelKey(offering?.semester) !== fileSemester) return false;
    return true;
  });

  return {
    id: String(file?.id || `${normalizeText(rawTitle).replace(/\s+/g, '-')}-${index + 1}`),
    sourceFileId: file?.id || file?.file_id || file?.resource_id || file?.content_id || '',
    fileName,
    title: toTitleCase(rawTitle),
    courseName,
    courseCode,
    creditsText:
      resolvedCourse?.creditsText ||
      (toText(file?.credit || file?.credits) ? `${toText(file?.credit || file?.credits)} Credits` : '2 Credits'),
    questionType,
    questionTone,
    uploader,
    year,
    category,
    tags,
    subType,
    downloads,
    views,
    fileSize: formatFileSizeLabel(file?.file_size || file?.size),
    levels: [...new Set([toText(file?.level), ...(resolvedCourse?.levels || [])].map(normalizeLevelKey).filter(Boolean))],
    semesters: [
      ...new Set([toText(file?.semester), ...(resolvedCourse?.semesters || [])].map(normalizeLevelKey).filter(Boolean)),
    ],
    programs: [
      ...new Set(
        [...toArray(file?.programs), ...toArray(resolvedCourse?.programs), toText(file?.program), toText(file?.department)]
          .map((value) => (typeof value === 'string' ? value : value?.name || value?.title || ''))
          .map(toTitleCase)
          .filter(Boolean)
      ),
    ],
    offerings: resolvedOfferings,
    isPremium: Boolean(file?.is_premium),
    fileUrl: file?.file_url || file?.url || '',
    searchText: buildFileSearchText({
      title: rawTitle,
      fileName,
      courseName,
      courseCode,
      questionType,
      subType,
      uploader,
      year,
      category,
      tags,
    }),
  };
};

export default function ResourcesIndex() {
  const { user, isAuthenticated } = useAuth();
  const { currentPlan } = useSubscription();
  const { trackEvent } = useAnalytics();
  const [searchParams] = useSearchParams();
  const [downloadingResourceId, setDownloadingResourceId] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [pendingDownloadItem, setPendingDownloadItem] = useState(null);
  const { headerSheenReady, headerSheenCycle } = useHeaderSheen();

  useEffect(() => {
    const id = setTimeout(() => playUiSound('pageArriveResources'), 500);
    return () => clearTimeout(id);
  }, []);

  const [programs, setPrograms] = useState([]);
  const [allCourses, setAllCourses] = useState([]);
  const [allFiles, setAllFiles] = useState([]);
  const [sectionFiles, setSectionFiles] = useState({
    trending: [],
    mostAccessed: [],
    top: [],
    recent: [],
  });
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [error, setError] = useState('');

  const [myFiles, setMyFiles] = useState({
    loaded: false,
    missingProfile: true,
    courses: [],
    resources: [],
    academicProfile: null,
  });
  const [accessedFileIds, setAccessedFileIds] = useState(() => new Set());
  const [expandedFileGroups, setExpandedFileGroups] = useState({});

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

  const mapFileList = useCallback(
    (files = [], courseMetaMap = new Map(), fallbackCourses = []) =>
      files.map((file, index) => getResourceFileCardModel(file, index, courseMetaMap, fallbackCourses)),
    []
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setMyFiles({ loaded: true, missingProfile: true, courses: [], resources: [], academicProfile: null });
      setAccessedFileIds(new Set());
      return undefined;
    }

    let active = true;
    (async () => {
      try {
        const [currentResponse, accessedResponse] = await Promise.all([
          api.courses.getCurrent(),
          api.resources.getAccessedFileIds().catch(() => null),
        ]);
        if (!active) return;
        setMyFiles({
          loaded: true,
          missingProfile: Boolean(currentResponse?.data?.missing_profile),
          courses: currentResponse?.data?.courses || [],
          resources: currentResponse?.data?.resources || [],
          academicProfile: currentResponse?.data?.academic_profile || null,
        });
        setAccessedFileIds(new Set((accessedResponse?.data?.file_ids || []).map(String)));
      } catch {
        if (!active) return;
        setMyFiles({ loaded: true, missingProfile: true, courses: [], resources: [], academicProfile: null });
        setAccessedFileIds(new Set());
      }
    })();

    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  const loadCatalogResources = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const [coursesResponse, filesResponse] = await Promise.all([
        api.courses.getAll({ limit: 1000 }),
        api.resources.getFiles(),
      ]);

      setAllCourses(coursesResponse?.data?.courses || []);
      setAllFiles(getFilesFromResponse(filesResponse));
      setCatalogLoaded(true);
    } catch (err) {
      setAllCourses([]);
      setAllFiles([]);
      setError((previous) => previous || err?.message || 'Could not load files right now.');
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
      setAllFiles([]);
      setCatalogLoaded(false);
      try {
        const [programsResponse, trendingResponse, mostAccessedResponse, topResponse, recentResponse] = await Promise.all([
          api.courses.getPrograms({ includeCounts: false }),
          api.resources.getFiles({ limit: SECTION_LIMIT, sort_by: 'trending', sort_order: 'desc' }),
          api.resources.getFiles({ limit: SECTION_LIMIT, sort_by: 'most_accessed', sort_order: 'desc' }),
          api.resources.getFiles({ limit: SECTION_LIMIT, sort_by: 'top', sort_order: 'desc' }),
          api.resources.getFiles({ limit: SECTION_LIMIT, sort_by: 'recent', sort_order: 'desc' }),
        ]);

        if (!active) return;
        setPrograms(programsResponse?.data?.programs || []);
        setSectionFiles({
          trending: mapFileList(getFilesFromResponse(trendingResponse)),
          mostAccessed: mapFileList(getFilesFromResponse(mostAccessedResponse)),
          top: mapFileList(getFilesFromResponse(topResponse)),
          recent: mapFileList(getFilesFromResponse(recentResponse)),
        });
      } catch (err) {
        if (!active) return;
        setPrograms([]);
        setAllCourses([]);
        setAllFiles([]);
        setSectionFiles({
          trending: [],
          mostAccessed: [],
          top: [],
          recent: [],
        });
        setError(err?.message || 'Could not load files right now.');
      } finally {
        if (active) setLoading(false);
      }
    };

    if (isAuthenticated) {
      setLoading(false);
    } else {
      load();
    }

    trackEvent('resources_page_viewed', {
      is_authenticated: isAuthenticated,
      plan: currentPlan?.name || 'visitor',
    });

    return () => {
      active = false;
    };
  }, [currentPlan?.name, isAuthenticated, mapFileList, trackEvent]);

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
    () =>
      (allCourses || []).map((course) => ({
        id: getCourseId(course),
        title: getCourseTitle(course),
        code: getCourseCode(course),
        creditsText: getCourseCreditsText(course),
        programs: getCoursePrograms(course),
        levels: getCourseLevels(course),
        semesters: getCourseSemesters(course),
        offerings: getCatalogOfferingFilters(course),
      })),
    [allCourses]
  );

  const courseMetaMap = useMemo(() => {
    const map = new Map();
    normalizedCourseCards.forEach((course) => {
      if (!course.title) return;
      map.set(normalizeText(course.title), course);
    });
    return map;
  }, [normalizedCourseCards]);

  const programOptions = useMemo(() => {
    const names = normalizedPrograms.map((program) => program.name).filter(Boolean);

    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }, [normalizedPrograms]);

  const levelOptions = CORE_LEVEL_OPTIONS;

  const semesterOptions = useMemo(() => {
    const semesters = allFiles.flatMap((file) => [file?.semester]).filter(Boolean);
    return [...new Set(semesters.map((value) => normalizeLevelKey(value)))]
      .sort((a, b) => getLevelSortValue(a) - getLevelSortValue(b) || a.localeCompare(b));
  }, [allFiles]);

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

  const normalizedFileCards = useMemo(() => {
    return mapFileList(allFiles, courseMetaMap, normalizedCourseCards);
  }, [allFiles, courseMetaMap, mapFileList, normalizedCourseCards]);

  const searchMatchedFileCards = useMemo(() => {
    const search = normalizeText(deferredSearchQuery);
    if (!search) return [];

    return normalizedFileCards.filter((item) => matchesSearchQuery(item.searchText, search));
  }, [deferredSearchQuery, normalizedFileCards]);

  const filterMatchedFileCards = useMemo(() => {
    return normalizedFileCards.filter((item) => {
      if (item.offerings.length) {
        return item.offerings.some((offering) => catalogOfferingMatchesFilters(offering, deferredFilters));
      }

      if (deferredFilters.program !== 'all') {
        const matchesProgram = item.programs.some(
          (program) => normalizeText(program) === normalizeText(deferredFilters.program)
        );
        if (!matchesProgram) return false;
      }

      if (deferredFilters.programCategory !== 'all') {
        const categories = item.programs
          .map((program) => programCategoryMap.get(normalizeText(program)) || toTitleCase(program))
          .filter(Boolean);
        const matchesCategory = categories.some(
          (category) => normalizeText(category) === normalizeText(deferredFilters.programCategory)
        );
        if (!matchesCategory) return false;
      }

      if (deferredFilters.level !== 'all') {
        const matchesLevel = item.levels.some(
          (level) => normalizeLevelKey(level) === normalizeLevelKey(deferredFilters.level)
        );
        if (!matchesLevel) return false;
      }

      if (deferredFilters.semester !== 'all') {
        const matchesSemester = item.semesters.some(
          (semester) => normalizeLevelKey(semester) === normalizeLevelKey(deferredFilters.semester)
        );
        if (!matchesSemester) return false;
      }

      return true;
    });
  }, [deferredFilters, normalizedFileCards, programCategoryMap]);

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
    loadCatalogResources();
  }, [catalogLoaded, catalogLoading, discoveryMode, hasSearchQuery, isAuthenticated, loadCatalogResources]);

  useEffect(() => {
    if (isAuthenticated || loading || catalogLoaded || catalogLoading) return undefined;
    return scheduleCatalogWarmup(loadCatalogResources);
  }, [catalogLoaded, catalogLoading, isAuthenticated, loadCatalogResources, loading]);

  useEffect(() => {
    const q = (searchParams.get('q') || '').trim();
    if (!q) return;
    setSearchInput(q);
    setSearchQuery(q);
    setDiscoveryMode('search');
  }, [searchParams]);

  const interactionResultFiles = useMemo(
    () => (discoveryMode === 'search' ? searchMatchedFileCards : filterMatchedFileCards),
    [discoveryMode, filterMatchedFileCards, searchMatchedFileCards]
  );

  const shouldShowInteractionResults = useMemo(
    () =>
      discoveryMode === 'search'
        ? hasSearchQuery
        : hasActiveFilters,
    [discoveryMode, hasActiveFilters, hasSearchQuery]
  );
  const visibleInteractionFiles = useIncrementalResults(interactionResultFiles, {
    active: shouldShowInteractionResults && !catalogLoading,
  });

  const showcasedFileSections = useMemo(
    () => [
      {
        key: 'most-accessed-files',
        title: 'Most Accessed Files',
        items: sectionFiles.mostAccessed,
        empty: 'No most accessed files are available right now.',
      },
      {
        key: 'top-files',
        title: 'Top Files',
        items: sectionFiles.top,
        empty: 'No top files are available right now.',
      },
      {
        key: 'recent-files',
        title: 'Recently Added Files',
        items: sectionFiles.recent,
        empty: 'No recently added files are available right now.',
      },
    ],
    [sectionFiles]
  );

  const myFileGroups = useMemo(() => {
    const safeCourses = (myFiles.courses || []).slice(0, 12).map((course, index) => ({
      id: getCourseId(course) || `my-course-${index}`,
      title: getCourseTitle(course),
      code: getCourseCode(course),
      creditsText: getCourseCreditsText(course),
      by: toTitleCase(course?.department || course?.program || course?.faculty || 'Academic'),
    }));

    const courseMetaMap = new Map();
    safeCourses.forEach((course) => {
      if (course.title) courseMetaMap.set(normalizeText(course.title), course);
    });

    const mappedFiles = mapFileList(myFiles.resources, courseMetaMap, safeCourses);
    const grouped = new Map();

    mappedFiles.forEach((file) => {
      const key = normalizeText(file.courseName) || 'general';
      if (!grouped.has(key)) {
        const matchedCourse = safeCourses.find((course) => normalizeText(course.title) === key);
        grouped.set(key, {
          id: matchedCourse?.id || key,
          title: file.courseName,
          code: file.courseCode,
          creditsText: file.creditsText,
          by: matchedCourse?.by || 'Academic',
          items: [],
        });
      }
      grouped.get(key).items.push(file);
    });

    safeCourses.forEach((course) => {
      const key = normalizeText(course.title);
      if (key && !grouped.has(key)) {
        grouped.set(key, {
          id: course.id,
          title: course.title,
          code: course.code,
          creditsText: course.creditsText,
          by: course.by,
          items: [],
        });
      }
    });

    return Array.from(grouped.values()).map((group) => ({ ...group, count: group.items.length }));
  }, [mapFileList, myFiles.courses, myFiles.resources]);

  const totalMyFilesCount = myFileGroups.reduce((sum, group) => sum + group.count, 0);

  const myFilesTotals = useMemo(() => {
    const filesTotal = totalMyFilesCount;
    const filesAccessed = myFileGroups.reduce(
      (sum, group) =>
        sum + group.items.filter((item) => accessedFileIds.has(String(item.sourceFileId))).length,
      0
    );
    const overallProgress = filesTotal ? Math.round((filesAccessed / filesTotal) * 100) : 0;
    return { filesTotal, filesAccessed, overallProgress };
  }, [accessedFileIds, myFileGroups, totalMyFilesCount]);

  const filesProfileLabels = useMemo(() => {
    const profile = myFiles.academicProfile || {};
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
  }, [myFiles.academicProfile]);

  const showMyFiles = isAuthenticated && myFiles.loaded && !myFiles.missingProfile && myFileGroups.length > 0;

  const toggleFileGroup = (groupId) => {
    setExpandedFileGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const updateFilters = useCallback((changes) => {
    setFilters((prev) => ({ ...prev, ...changes }));
  }, []);

  const handleDiscoveryModeChange = useCallback((nextMode) => {
    if (nextMode === discoveryMode) return;
    playListPageToggleSound('toggle');
    setDiscoveryMode(nextMode);
  }, [discoveryMode]);

  const executeDownload = useCallback(
    async (item) => {
      if (!item) return;

      await withDownloadLock(
        async () => {
          const downloadId = item.sourceFileId || item.id;
          setDownloadingResourceId(downloadId);
          try {
            trackEvent('resources_file_download_attempt', {
              file_id: downloadId,
              type: item.questionType,
              level: item.levels?.[0] || '100',
            });

            if (item.sourceFileId) {
              await api.resources.trackView(item.sourceFileId);
              const blob = await api.resources.downloadFile(item.sourceFileId);
              saveBlobAsFile(blob, item.fileName || `${item.courseName}.pdf`);
              playUiSound('fileDownload');
              return;
            }

            if (item.fileUrl) {
              window.open(item.fileUrl, '_blank', 'noopener,noreferrer');
            }
          } catch (downloadError) {
            console.error('Failed to download file:', downloadError);
          } finally {
            setDownloadingResourceId(null);
            setPendingDownloadItem(null);
          }
        },
        () => trackEvent('resources_file_download_blocked_active_download', {
          file_id: item.sourceFileId || item.id,
        })
      );
    },
    [trackEvent]
  );

  const handleDownload = useCallback(
    (item) => {
      if (!item) return;
      if (!isAuthenticated) {
        const access = consumeGuestContentView({ isAuthenticated, contentType: 'resource_file', contentId: item.id });
        if (!access.allowed) {
          window.dispatchEvent(new CustomEvent('openAuthModal', { detail: 'register' }));
          return;
        }
      }

      if (item.isPremium && currentPlan?.name === 'Basic Student') {
        window.dispatchEvent(
          new CustomEvent('openUpgradePrompt', {
            detail: { feature: 'premium_content', plan: 'Serious Student' },
          })
        );
        return;
      }

      setPendingDownloadItem(item);
    },
    [currentPlan?.name, isAuthenticated]
  );

  const handleView = useCallback(
    (item) => {
      if (!item) return;

      if (!isAuthenticated) {
        const access = consumeGuestContentView({ isAuthenticated, contentType: 'resource_file', contentId: item.id });
        if (!access.allowed) {
          window.dispatchEvent(new CustomEvent('openAuthModal', { detail: 'register' }));
          return;
        }
      }

      if (item.isPremium && currentPlan?.name === 'Basic Student') {
        window.dispatchEvent(
          new CustomEvent('openUpgradePrompt', {
            detail: { feature: 'premium_content', plan: 'Serious Student' },
          })
        );
        return;
      }

      recordLastActivity({
        type: ACTIVITY_TYPES.FILES,
        title: item.title || item.fileName || 'Your files',
        subtitle: 'Resource file',
        path: '/resources',
      });

      if (item.sourceFileId) {
        setPreviewFile({
          sourceFileId: item.sourceFileId,
          fileName: item.fileName,
          title: item.title,
        });
        trackEvent('resources_file_preview_open', { file_id: item.sourceFileId });
        return;
      }

      if (item.fileUrl) {
        window.open(item.fileUrl, '_blank', 'noopener,noreferrer');
      }
    },
    [currentPlan?.name, isAuthenticated, trackEvent]
  );

  const closePreview = useCallback(() => setPreviewFile(null), []);

  const renderFileCard = (item, key) => {
    const tone = item.questionTone || getQuestionTypeTone(item.questionType);

    return (
      <article key={key || item.id} className={`pls-file-item resources-file-item pls-file-item-${tone}`} role="listitem">
        <div className="pls-file-row-top">
          <div className={`pls-file-icon pls-file-icon-${tone}`} aria-hidden="true">
            <FiFileText />
          </div>
          <div className="pls-file-top-meta">
            <span className={`pls-file-top-pill pls-file-top-pill-${tone}`}>{item.questionType}</span>
            <span className="pls-file-top-pill pls-file-top-pill-uploader" title={item.uploader}>
              {item.uploader}
            </span>
          </div>
        </div>

        <div className="pls-file-divider" aria-hidden="true"></div>

        <p className="pls-file-course" title={item.courseName}>
          {item.courseName}
        </p>

        <div className="pls-file-row-split">
          <span className="pls-file-pill">{item.year}</span>
          <span className="pls-file-pill">{item.subType}</span>
        </div>

        <div className="pls-file-stats">
          <span className="pls-file-stat">
            <FiDownload />
            {item.downloads.toLocaleString()}
          </span>
          <span className="pls-file-stat">
            <FiEye />
            {item.views.toLocaleString()}
          </span>
          <span className="pls-file-stat">
            <FiHardDrive />
            {item.fileSize}
          </span>
        </div>

        <div className="pls-file-divider" aria-hidden="true"></div>

        <div className="pls-file-actions">
          <button
            type="button"
            className="pls-file-action"
            onClick={() => handleDownload(item)}
            disabled={Boolean(downloadingResourceId)}
          >
            <FiDownload />
            <span>{downloadingResourceId === (item.sourceFileId || item.id) ? 'Downloading...' : 'Download'}</span>
          </button>
          <button
            type="button"
            className="pls-file-action"
            onClick={() => handleView(item)}
          >
            <FiEye />
            <span>View</span>
          </button>
        </div>
      </article>
    );
  };

  const renderFileSkeletonCard = (key) => (
    <article key={key} className="pls-file-item resources-file-item resources-file-item-skeleton" aria-hidden="true">
      <div className="pls-file-row-top">
        <div className="pls-file-icon shimmer-block" />
        <div className="pls-file-top-meta">
          <span className="pls-file-top-pill shimmer-block" />
          <span className="pls-file-top-pill pls-file-top-pill-uploader shimmer-block" />
        </div>
      </div>
      <div className="pls-file-divider" aria-hidden="true"></div>
      <span className="pls-file-course resources-skeleton-line shimmer-block" />
      <div className="pls-file-row-split">
        <span className="pls-file-pill shimmer-block" />
        <span className="pls-file-pill shimmer-block" />
      </div>
      <div className="pls-file-stats">
        <span className="pls-file-stat shimmer-block" />
        <span className="pls-file-stat shimmer-block" />
        <span className="pls-file-stat shimmer-block" />
      </div>
      <div className="pls-file-divider" aria-hidden="true"></div>
      <div className="pls-file-actions">
        <span className="pls-file-action shimmer-block" />
        <span className="pls-file-action shimmer-block" />
      </div>
    </article>
  );

  const renderFileSkeletonRow = (prefix, count = 6) =>
    Array.from({ length: count }, (_, index) => renderFileSkeletonCard(`${prefix}-${index}`));

  return (
    <div className={`learn-redesign resources-redesign ${planTierClass} ${headerSheenReady ? 'page-header-sheen-ready' : ''}`}>
      <section className="learn-shell-header">
        <div className="learn-shell-header-icon" aria-hidden="true">
          <FiFolder />
        </div>
        <div className="learn-shell-header-copy">
          <h1 className="header-sheen-copy" key={`resources-header-title-${headerSheenCycle}`}>Files</h1>
          <p className="header-sheen-copy" key={`resources-header-tagline-${headerSheenCycle}`}>
            "{RESOURCES_PAGE_QUOTE}"{' '}
            <span className="learn-shell-header-author">- {RESOURCES_PAGE_QUOTE_AUTHOR}</span>
          </p>
        </div>
      </section>

      <div className="learn-row-divider" aria-hidden="true" />

      {isAuthenticated ? (
        showMyFiles ? (
          <>
          <section className="learn-continue-section" aria-label="File access progress">
            <div className="learn-continue-card">
              <div className="learn-continue-progress">
                <div
                  className="learn-continue-ring"
                  style={{ '--progress': `${myFilesTotals.overallProgress}%` }}
                >
                  <span>{myFilesTotals.overallProgress}%</span>
                </div>
                <div className="learn-continue-progress-copy">
                  <h2>Your files progress</h2>
                  <p>
                    {myFilesTotals.filesAccessed} of {myFilesTotals.filesTotal} files accessed across{' '}
                    {myFileGroups.length} course{myFileGroups.length === 1 ? '' : 's'}.
                  </p>
                </div>
              </div>

              <div className="learn-continue-profile-divider" aria-hidden="true" />
              <div className="learn-continue-profile" aria-label="Your academic profile">
                {[
                  filesProfileLabels.programLabel,
                  filesProfileLabels.categoryLabel,
                  filesProfileLabels.levelLabel,
                  filesProfileLabels.semesterLabel,
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
            </div>
          </section>

          <div className="learn-row-divider" aria-hidden="true" />

          <section className="pls-files-section" aria-label="My files">
            <div className="pls-files-header">
              <h3>My Files ({totalMyFilesCount})</h3>
            </div>
            <hr className="pls-files-divider" />

            <div className="pls-files-groups" id="resources-files-course-groups">
              {myFileGroups.map((group, groupIndex) => {
                const isExpanded = Boolean(expandedFileGroups[group.id]);
                const panelId = `resources-files-group-${String(group.id).replace(/[^a-zA-Z0-9_-]/g, '-')}`;

                return (
                  <article key={group.id} className="pls-files-course-block">
                    <button
                      type="button"
                      className="pls-files-course-header"
                      onClick={() => toggleFileGroup(group.id)}
                      aria-expanded={isExpanded}
                      aria-controls={panelId}
                    >
                      <div className="pls-files-course-title-row">
                        <div className="pls-files-course-title-main">
                          <h4>{group.title}</h4>
                          <span className="pls-files-course-count">{group.count} Files</span>
                        </div>
                        <span className={`pls-files-course-chevron ${isExpanded ? 'expanded' : ''}`} aria-hidden="true">
                          <FiChevronDown />
                        </span>
                      </div>
                      <div className="pls-files-course-meta">
                        <span className="pls-files-course-meta-pill">
                          <strong>Code:</strong> {group.code}
                        </span>
                        <span className="pls-files-course-meta-pill">
                          <strong>Credit:</strong> {group.creditsText}
                        </span>
                        <span className="pls-files-course-meta-pill">
                          <strong>By:</strong> {group.by}
                        </span>
                      </div>
                    </button>

                    <div
                      id={panelId}
                      className={`pls-files-panel ${isExpanded ? 'expanded' : 'collapsed'}`}
                      role="region"
                      aria-hidden={!isExpanded}
                    >
                      <div className="pls-files-panel-inner">
                        {group.items.length === 0 ? (
                          <p className="learn-section-empty">No files uploaded for this course yet.</p>
                        ) : (
                          <PlsHorizontalSlider
                            trackClassName="pls-files-track"
                            role="list"
                            ariaLabel={`${group.title} files slider`}
                            leftLabel={`Scroll ${group.title} files left`}
                            rightLabel={`Scroll ${group.title} files right`}
                          >
                            {group.items.map((item, index) => renderFileCard(item, `${group.id}-file-${index}`))}
                          </PlsHorizontalSlider>
                        )}
                      </div>
                    </div>

                    {groupIndex < myFileGroups.length - 1 ? <hr className="pls-files-group-divider" /> : null}
                  </article>
                );
              })}
            </div>
          </section>
          </>
        ) : !myFiles.loaded ? (
          <>
          <section className="learn-continue-section" aria-label="File access progress">
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

              <div className="learn-continue-profile-divider" aria-hidden="true" />
              <div className="learn-continue-profile" aria-hidden="true">
                <span className="shimmer-block" style={{ width: '5rem', height: '0.85rem', borderRadius: '999px' }} />
                <span
                  className="shimmer-block"
                  style={{ width: '4rem', height: '0.85rem', borderRadius: '999px', marginLeft: '0.6rem' }}
                />
                <span
                  className="shimmer-block"
                  style={{ width: '4.5rem', height: '0.85rem', borderRadius: '999px', marginLeft: '0.6rem' }}
                />
              </div>
            </div>
          </section>

          <div className="learn-row-divider" aria-hidden="true" />

          <section className="pls-files-section" aria-label="My files">
            <div className="pls-files-header">
              <h3>My Files</h3>
            </div>
            <hr className="pls-files-divider" />

            <div className="pls-files-groups">
              {[0, 1].map((groupIndex) => (
                <article key={`my-files-skeleton-${groupIndex}`} className="pls-files-course-block" aria-hidden="true">
                  <div className="pls-files-course-header">
                    <div className="pls-files-course-title-row">
                      <div className="pls-files-course-title-main">
                        <span className="shimmer-block" style={{ width: '9rem', height: '1rem', borderRadius: '999px' }} />
                        <span className="pls-files-course-count shimmer-block" style={{ minWidth: '4rem', color: 'transparent' }}>
                          &nbsp;
                        </span>
                      </div>
                    </div>
                    <div className="pls-files-course-meta">
                      <span className="shimmer-block" style={{ width: '5rem', height: '1.4rem', borderRadius: '999px' }} />
                      <span className="shimmer-block" style={{ width: '5rem', height: '1.4rem', borderRadius: '999px' }} />
                      <span className="shimmer-block" style={{ width: '5rem', height: '1.4rem', borderRadius: '999px' }} />
                    </div>
                  </div>

                  <div className="pls-files-panel expanded">
                    <div className="pls-files-panel-inner">
                      <div className="pls-files-track">
                        {renderFileSkeletonRow(`my-files-skeleton-${groupIndex}`, 3)}
                      </div>
                    </div>
                  </div>

                  {groupIndex === 0 ? <hr className="pls-files-group-divider" /> : null}
                </article>
              ))}
            </div>
          </section>
          </>
        ) : (
          <p className="learn-section-empty">You don't have any current courses yet.</p>
        )
      ) : (
        <>
          <section className="learn-search-panel" aria-label="Resources search and filters">
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
                <label htmlFor="resources-file-search" className="learn-search-input-wrap">
                  <FiSearch />
                  <input
                    id="resources-file-search"
                    type="search"
                    placeholder="Search files by course, type, year, or uploader"
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
                  <span>{visibleInteractionFiles.totalCount}</span>
                </div>

                {catalogLoading && !catalogLoaded ? (
                  <LearnHorizontalSlider
                    ariaLabel={discoveryMode === 'search' ? 'Search results slider loading state' : 'Filter results slider loading state'}
                  >
                    {renderFileSkeletonRow(`resources-interaction-${discoveryMode}-skeleton`)}
                  </LearnHorizontalSlider>
                ) : visibleInteractionFiles.totalCount === 0 ? (
                  <p className="learn-section-empty">
                    {discoveryMode === 'search'
                      ? 'No files matched your search.'
                      : 'No files matched your selected filters.'}
                  </p>
                ) : (
                  <LearnHorizontalSlider
                    ariaLabel={discoveryMode === 'search' ? 'Search results slider' : 'Filter results slider'}
                  >
                    {visibleInteractionFiles.items.map((item, index) =>
                      renderFileCard(item, `interaction-${discoveryMode}-${index}`)
                    )}
                  </LearnHorizontalSlider>
                )}
              </section>

              <div className="learn-row-divider" aria-hidden="true" />
            </>
          ) : null}

          <section className="learn-section" aria-label="Trending files">
            <div className="learn-section-head">
              <h2>Trending Files</h2>
              <span>{sectionFiles.trending.length}</span>
            </div>

            {loading ? (
              <LearnHorizontalSlider ariaLabel="Trending files slider loading state" autoSlide>
                {renderFileSkeletonRow('trending-files-skeleton')}
              </LearnHorizontalSlider>
            ) : sectionFiles.trending.length === 0 ? (
              <p className="learn-section-empty">No trending files are available right now.</p>
            ) : (
              <LearnHorizontalSlider ariaLabel="Trending files slider" autoSlide>
                {sectionFiles.trending.map((item, index) => renderFileCard(item, `trending-${index}`))}
              </LearnHorizontalSlider>
            )}
          </section>

          <div className="learn-row-divider" aria-hidden="true" />

          {showcasedFileSections.map((section, sectionIndex) => (
            <section className="learn-section" aria-label={section.title} key={section.key}>
              <div className="learn-section-head">
                <h2>{section.title}</h2>
                <span>{section.items.length}</span>
              </div>

              {sectionIndex === 0 && error ? <p className="learn-section-empty">{error}</p> : null}

              {loading ? (
                <LearnHorizontalSlider ariaLabel={`${section.title} slider loading state`}>
                  {renderFileSkeletonRow(`${section.key}-skeleton`)}
                </LearnHorizontalSlider>
              ) : section.items.length === 0 ? (
                <p className="learn-section-empty">{section.empty}</p>
              ) : (
                <LearnHorizontalSlider ariaLabel={`${section.title} slider`}>
                  {section.items.map((item, index) => renderFileCard(item, `${section.key}-${index}`))}
                </LearnHorizontalSlider>
              )}

              {sectionIndex < showcasedFileSections.length - 1 ? (
                <div className="learn-row-divider" aria-hidden="true" />
              ) : null}
            </section>
          ))}
        </>
      )}

      {showContributionAppeal ? (
        <ContributionAppeal className="page-contribution-appeal" showPlansCta />
      ) : null}

      <ResourceFilePreviewModal
        open={Boolean(previewFile)}
        file={previewFile}
        onClose={closePreview}
      />
      <DownloadCountdownModal
        open={Boolean(pendingDownloadItem)}
        fileName={pendingDownloadItem?.fileName || pendingDownloadItem?.title || 'resource file'}
        isProcessing={Boolean(downloadingResourceId)}
        onCancel={() => {
          if (!downloadingResourceId) setPendingDownloadItem(null);
        }}
        onConfirm={() => executeDownload(pendingDownloadItem)}
      />
    </div>
  );
}

const { Op } = require('sequelize');
const config = require('../config/env');
const {
  AcademicProfile,
  Course,
  CourseOffering,
  Content,
  Institution,
  Program,
  ResourceFile,
  User
} = require('../models');
const { getAcademicProfile } = require('../utils/onboarding');
const {
  buildResourceDisplayKey,
  extractTitleFromFileName,
  pickBestResourceCandidate
} = require('../utils/resourceClassifier');
const {
  formatAffiliateCourseCode,
  getAffiliateUniversityName,
  resolveAffiliateUniversityCode
} = require('../utils/courseCatalog');
const { normalizeProgramCategory } = require('../utils/studentIdentity');
const {
  fetchCourseLessonProgressBundle,
  fetchCoursePracticeProgressBundle,
  summarizeCatalogFromLessonRows,
} = require('./learningProgressService');

const USER_PROGRAM_TO_CATALOG_CATEGORY = Object.freeze({
  'Primary Education': ['Primary'],
  'JHS Education': ['JHS'],
  'Early Childhood Education': ['ECE']
});

const CATALOG_TO_USER_PROGRAM_CATEGORY = Object.freeze({
  Primary: 'Primary Education',
  JHS: 'JHS Education',
  ECE: 'Early Childhood Education'
});

const USER_TO_CATALOG_PROGRAM_CATEGORY = Object.freeze({
  'Primary Education': 'Primary',
  'JHS Education': 'JHS',
  'Early Childhood Education': 'ECE'
});

const normalizeSemester = (value) => (String(value || '').trim() === '2' ? '2' : '1');

// Canonical course title (lowercase) → alternative titles used by some programmes
const COURSE_TITLE_ALIASES = {
  'child and adolescent development and learning': [
    'child development & learning',
    'child development and learning',
  ],
};

const buildAliasLookup = (courseTitles) => {
  const lookup = new Map();
  courseTitles.forEach((title) => {
    const key = title.toLowerCase().trim();
    (COURSE_TITLE_ALIASES[key] || []).forEach((alias) => {
      lookup.set(alias.toLowerCase().trim(), title);
    });
  });
  return lookup;
};

const normalizeSubject = (course) => (
  course.metadata?.category ||
  course.department ||
  course.metadata?.takenBy ||
  'General'
);

const normalizeCourseImage = (course) => {
  const raw =
    course.metadata?.image ||
    course.metadata?.image_url ||
    course.metadata?.thumbnail_url ||
    course.metadata?.thumbnail ||
    '';
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return null;
  if (/^(https?:)?\/\//i.test(text)) return text;
  if (text.startsWith('/')) return text;
  if (text.includes('/')) return `/${text}`;
  return `/uploads/assets/courses/${text}`;
};

const toSafeNumber = (value, fallback = 0) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
};

const toTimestamp = (value) => {
  const timestamp = new Date(value || '').getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const getCourseRecencyBoost = (course = {}) => {
  const timestamp = toTimestamp(course.latest_resource_at || course.updated_at || course.created_at);
  if (!timestamp) return 0;
  const dayAge = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
  return Math.max(0, 180 - dayAge);
};

const getCourseSortMetric = (course = {}, sortBy = 'title') => {
  const totalLessons = toSafeNumber(course.totalLessons, 0);
  const offeringsCount = toSafeNumber(course.offerings_count, 0);
  const rating = toSafeNumber(course.rating, 0);
  const resourceViews = toSafeNumber(course.resource_views, 0);
  const resourceDownloads = toSafeNumber(course.resource_downloads, 0);
  const recencyBoost = getCourseRecencyBoost(course);

  switch (String(sortBy || 'title').trim().toLowerCase()) {
    case 'trending':
      return resourceViews * 0.14 + resourceDownloads * 0.3 + totalLessons * 7 + offeringsCount * 10 + rating * 60 + recencyBoost * 4;
    case 'most_studied':
      return resourceViews * 0.2 + resourceDownloads * 0.18 + totalLessons * 12 + offeringsCount * 6 + recencyBoost * 2;
    case 'top':
      return rating * 100 + offeringsCount * 18 + totalLessons * 8 + resourceViews * 0.08 + resourceDownloads * 0.16;
    case 'most_practiced':
      return resourceDownloads * 0.34 + resourceViews * 0.1 + totalLessons * 10 + offeringsCount * 6 + rating * 40 + recencyBoost * 2;
    case 'top_test':
      return rating * 92 + resourceDownloads * 0.28 + resourceViews * 0.1 + totalLessons * 9 + offeringsCount * 8;
    case 'recent':
    case 'recently_added':
    case 'recent_test':
      return toTimestamp(course.latest_resource_at || course.updated_at || course.created_at);
    default:
      return 0;
  }
};

const sortCourseSummaries = (courses = [], sortBy = 'title', sortOrder = 'asc') => {
  const normalizedSortBy = String(sortBy || 'title').trim().toLowerCase();
  const normalizedSortOrder = String(sortOrder || '').trim().toLowerCase();
  const descendingScoreSort = normalizedSortOrder !== 'asc';

  return [...courses].sort((left, right) => {
    if (normalizedSortBy === 'title') {
      const titleCompare = String(left?.title || '').localeCompare(String(right?.title || ''));
      if (titleCompare !== 0) {
        return normalizedSortOrder === 'desc' ? -titleCompare : titleCompare;
      }
    } else {
      const leftMetric = getCourseSortMetric(left, normalizedSortBy);
      const rightMetric = getCourseSortMetric(right, normalizedSortBy);
      if (leftMetric !== rightMetric) {
        return descendingScoreSort ? rightMetric - leftMetric : leftMetric - rightMetric;
      }
    }

    return String(left?.title || '').localeCompare(String(right?.title || ''));
  });
};

const buildCourseSummary = (course, offerings = [], resourceStats = {}, options = {}) => {
  const programNames = new Set();
  const levelSet = new Set();
  const semesterSet = new Set();

  offerings.forEach((offering) => {
    if (offering.program?.name) programNames.add(offering.program.name);
    if (offering.level) levelSet.add(offering.level);
    if (offering.semester) semesterSet.add(offering.semester);
  });

  const affiliateUniversityCode = resolveAffiliateUniversityCode({
    course,
    offerings,
    fallbackAffiliateUniversity: options.fallbackAffiliateUniversity,
    fallbackAffiliateUniversityCode: options.fallbackAffiliateUniversityCode
  });

  return {
    id: course.id,
    key: course.key,
    title: course.title,
    code: formatAffiliateCourseCode(course.code, affiliateUniversityCode),
    credits: course.credits,
    department: course.department,
    metadata: course.metadata || {},
    affiliate_university_code: affiliateUniversityCode,
    affiliate_university: getAffiliateUniversityName(affiliateUniversityCode),
    subject: normalizeSubject(course),
    description:
      course.metadata?.description ||
      course.metadata?.organizedBy ||
      course.metadata?.category ||
      course.department ||
      '',
    outline: course.metadata?.outline || course.metadata?.syllabus || '',
    syllabus: course.metadata?.syllabus || course.metadata?.outline || '',
    requirements: course.metadata?.requirements || '',
    prerequisites: course.metadata?.prerequisites || course.metadata?.requirements || '',
    big_picture: course.metadata?.big_picture || course.metadata?.bigPicture || '',
    bigPicture: course.metadata?.bigPicture || course.metadata?.big_picture || '',
    introduction: course.metadata?.introduction || course.metadata?.intro || '',
    intro: course.metadata?.intro || course.metadata?.introduction || '',
    totalLessons: toSafeNumber(options.lessonCount, 0),
    lessons_count: toSafeNumber(options.lessonCount, 0),
    text_lessons_count: toSafeNumber(options.text_lessons_count, 0),
    video_lessons_count: toSafeNumber(options.video_lessons_count, 0),
    prelims_count: toSafeNumber(options.prelims_count, 0),
    lesson_exercises_count: toSafeNumber(options.lesson_exercises_count, 0),
    exercises_count: toSafeNumber(
      options.lesson_exercises_count ?? options.exercises_count,
      0
    ),
    videos_count: toSafeNumber(options.video_lessons_count ?? options.videos_count, 0),
    resource_count: toSafeNumber(resourceStats.count, 0),
    completedLessons: toSafeNumber(options.completedLessons, 0),
    completed_lessons: toSafeNumber(options.completedLessons, 0),
    started_lessons: toSafeNumber(options.startedLessons, 0),
    progress: toSafeNumber(options.progress, 0),
    progress_percentage: toSafeNumber(options.progress, 0),
    practice_total: toSafeNumber(options.practice_total, 0),
    practice_attempted: toSafeNumber(options.practice_attempted, 0),
    practice_progress: toSafeNumber(options.practice_progress, 0),
    practice_best_score: toSafeNumber(options.practice_best_score, 0),
    practice_last_attempted_at: options.practice_last_attempted_at || null,
    image: normalizeCourseImage(course),
    image_url: normalizeCourseImage(course),
    instructor: 'Sharether Instructor',
    rating: 4.7,
    enrolled: true,
    programs: Array.from(programNames),
    levels: Array.from(levelSet),
    semesters: Array.from(semesterSet),
    offering_filters: offerings.map((offering) => ({
      program_id: offering.program?.id || null,
      program_key: offering.program?.key || null,
      program_name: offering.program?.name || null,
      program_category: offering.program?.category || null,
      level: offering.level || null,
      semester: offering.semester || null
    })),
    offerings_count: offerings.length,
    resource_views: toSafeNumber(resourceStats.views, 0),
    resource_downloads: toSafeNumber(resourceStats.downloads, 0),
    latest_resource_at: resourceStats.latest_resource_at || null,
    created_at: course.created_at || null,
    updated_at: course.updated_at || null
  };
};

const serializeAcademicProfile = (scope) => ({
  institution_id: scope.institution_id || null,
  affiliate_university: scope.affiliate_university || null,
  programme_category: scope.programme_category || null,
  program_id: scope.program_id || null,
  program_name: scope.program_name || null,
  level: scope.level || null,
  semester: scope.semester || null,
  index_number: scope.index_number || null
});

const loadAcademicProfileRecord = async (user) => {
  if (user?.academic_profile && typeof user.academic_profile === 'object') {
    return user.academic_profile;
  }

  if (!user?.id) return null;

  return AcademicProfile.findOne({
    where: { user_id: user.id },
    include: [
      {
        model: Program,
        as: 'program_record',
        required: false
      }
    ]
  });
};

const resolveProgramRecord = async ({ user, profileRecord }) => {
  const embeddedProgramRecord =
    profileRecord?.program_record ||
    profileRecord?.programRecord ||
    null;

  if (embeddedProgramRecord) {
    return embeddedProgramRecord;
  }

  const programId = profileRecord?.program_id || user?.program_id || null;
  if (programId) {
    return Program.findByPk(programId);
  }

  const normalizedUser = typeof user?.toJSON === 'function'
    ? user.toJSON()
    : { ...(user || {}) };
  const profile = getAcademicProfile({
    ...normalizedUser,
    academic_profile: profileRecord || normalizedUser?.academic_profile || null
  });
  const programName = String(
    profile?.program_name ||
    normalizedUser?.academic_program ||
    normalizedUser?.program ||
    ''
  ).trim();
  const programmeCategory = normalizeProgramCategory(
    profile?.programme_category ||
    normalizedUser?.programme_category ||
    ''
  );
  const catalogCategory = USER_TO_CATALOG_PROGRAM_CATEGORY[programmeCategory] || null;

  if (!programName) return null;

  const programWhere = { name: programName };
  if (catalogCategory) {
    programWhere.category = catalogCategory;
  }

  return Program.findOne({ where: programWhere });
};

const resolveAcademicScope = async (user) => {
  const profileRecord = await loadAcademicProfileRecord(user);
  const resolvedProgramRecord = await resolveProgramRecord({ user, profileRecord });
  const normalizedUser = typeof user?.toJSON === 'function'
    ? user.toJSON()
    : { ...(user || {}) };
  const profile = getAcademicProfile({
    ...normalizedUser,
    academic_profile: profileRecord || normalizedUser?.academic_profile || null
  });

  const fallbackProgramCategory = normalizeProgramCategory(
    profile?.programme_category ||
    normalizedUser?.programme_category ||
    CATALOG_TO_USER_PROGRAM_CATEGORY[resolvedProgramRecord?.category] ||
    ''
  );

  return {
    institution_id: profile?.institution_id || normalizedUser?.institution_id || null,
    affiliate_university: profile?.affiliate_university || normalizedUser?.affiliate_university || null,
    programme_category: fallbackProgramCategory || null,
    program_id: profile?.program_id || normalizedUser?.program_id || resolvedProgramRecord?.id || null,
    program_name:
      profile?.program_name ||
      resolvedProgramRecord?.name ||
      normalizedUser?.academic_program ||
      normalizedUser?.program ||
      null,
    level: profile?.level || normalizedUser?.level || null,
    semester: normalizeSemester(profile?.semester || normalizedUser?.semester || config.academic.defaultSemester),
    index_number: profile?.index_number || normalizedUser?.index_number || null
  };
};

const buildSearchClause = (value) => {
  const query = String(value || '').trim();
  if (!query) return null;
  return {
    [Op.or]: [
      { title: { [Op.iLike]: `%${query}%` } },
      { code: { [Op.iLike]: `%${query}%` } },
      { department: { [Op.iLike]: `%${query}%` } }
    ]
  };
};

const getProgramCategoryFilters = (programmeCategory) => {
  if (!programmeCategory) return [];
  const normalized = normalizeProgramCategory(programmeCategory);
  if (normalized && USER_PROGRAM_TO_CATALOG_CATEGORY[normalized]) {
    return USER_PROGRAM_TO_CATALOG_CATEGORY[normalized];
  }
  return [programmeCategory];
};

const hasPaidPlanAccess = (user) => {
  const planName =
    user?.subscription?.plan?.name ||
    user?.current_plan ||
    user?.selected_plan?.name ||
    'Basic Student';
  return String(planName).trim().toLowerCase() !== 'basic student';
};

const dedupeResources = (resources, preferPremium = false) => {
  const grouped = new Map();

  resources.forEach((resourceModel) => {
    const file = typeof resourceModel.toJSON === 'function' ? resourceModel.toJSON() : resourceModel;
    const normalized = {
      ...file,
      title: file.title || extractTitleFromFileName(file.file_name),
      uploader_name: file.uploader?.full_name || file.uploader_name || 'Sharether Contributor'
    };
    const key = buildResourceDisplayKey(normalized);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(normalized);
  });

  return Array.from(grouped.values())
    .map((group) => pickBestResourceCandidate(group, preferPremium))
    .filter(Boolean)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
};

const fetchResourceFilesForCourses = async ({ courseTitles, level, semester, preferPremium }) => {
  if (!Array.isArray(courseTitles) || !courseTitles.length) return [];

  const aliasLookup = buildAliasLookup(courseTitles);
  const allSearchTitles = [...courseTitles, ...Array.from(aliasLookup.keys())];

  const resources = await ResourceFile.findAll({
    where: {
      [Op.and]: [
        {
          [Op.or]: allSearchTitles.map((t) => ({ course: { [Op.iLike]: t } }))
        },
        {
          [Op.or]: [
            { level: null },
            { level: '' },
            ...(level ? [{ level }] : [])
          ]
        },
        {
          [Op.or]: [
            { semester: null },
            { semester: '' },
            ...(semester ? [{ semester }] : [])
          ]
        }
      ]
    },
    include: [
      {
        model: User,
        as: 'uploader',
        attributes: ['id', 'full_name'],
        required: false
      }
    ],
    order: [['created_at', 'DESC']]
  });

  const deduped = dedupeResources(resources, preferPremium);

  if (!aliasLookup.size) return deduped;
  return deduped.map((file) => {
    const canonical = aliasLookup.get(String(file.course || '').toLowerCase().trim());
    return canonical ? { ...file, course: canonical } : file;
  });
};

// Across every course the learner has access to, find the lesson worth resuming:
// the most recently viewed lesson that isn't finished yet, falling back to the
// most recently viewed lesson overall (e.g. everything so far is complete).
const resolveLastActivity = (groupedCourses, lessonProgressBundle) => {
  let inProgress = null;
  let mostRecent = null;

  groupedCourses.forEach(({ course }, courseId) => {
    const lessonRows = lessonProgressBundle.lessonsByCourseId.get(String(courseId)) || [];
    lessonRows.forEach((lesson) => {
      const lastViewedAt = lesson?.user_engagement?.last_viewed_at;
      const timestamp = toTimestamp(lastViewedAt);
      if (!timestamp) return;

      const progress = toSafeNumber(lesson?.user_engagement?.progress_percentage, 0);
      const entry = {
        lesson_id: lesson.id,
        lesson_title: lesson.title,
        course_id: course.id,
        course_title: course.title,
        course_image: normalizeCourseImage(course),
        progress,
        last_viewed_at: lastViewedAt,
        timestamp
      };

      if (progress > 0 && progress < 100 && (!inProgress || timestamp > inProgress.timestamp)) {
        inProgress = entry;
      }
      if (!mostRecent || timestamp > mostRecent.timestamp) {
        mostRecent = entry;
      }
    });
  });

  const chosen = inProgress || mostRecent;
  if (!chosen) return null;
  const { timestamp, ...activity } = chosen;
  return activity;
};

const fetchCurrentLearning = async ({ user, query = {} }) => {
  const scope = await resolveAcademicScope(user);
  const resolvedLevel = String(query.level || scope.level || '').trim();
  const resolvedSemester = normalizeSemester(query.semester || scope.semester);

  const missingProfile = !scope.programme_category || !resolvedLevel;
  if (missingProfile) {
    return {
      courses: [],
      resources: [],
      lastActivity: null,
      lastPracticeActivity: null,
      academicProfile: {
        ...serializeAcademicProfile(scope),
        level: resolvedLevel || null,
        semester: resolvedSemester
      },
      missingProfile: true,
      resolvedProgramCategories: []
    };
  }

  const courseWhere = buildSearchClause(query.q || query.search);
  const fetchOfferings = async ({ programId = null, categoryFilters = [] } = {}) => {
    const offeringWhere = {
      level: resolvedLevel,
      semester: resolvedSemester
    };
    const programWhere = {};

    if (programId) {
      offeringWhere.program_id = programId;
    } else if (categoryFilters.length === 1) {
      programWhere.category = categoryFilters[0];
    } else if (categoryFilters.length > 1) {
      programWhere.category = { [Op.in]: categoryFilters };
    }

    return CourseOffering.findAll({
      where: offeringWhere,
      include: [
        {
          model: Course,
          as: 'course',
          required: true,
          ...(courseWhere ? { where: courseWhere } : {})
        },
        {
          model: Program,
          as: 'program',
          attributes: ['id', 'key', 'name', 'category', 'institution_id', 'metadata'],
          include: [
            {
              model: Institution,
              as: 'institution',
              attributes: ['id', 'name', 'metadata'],
              required: false
            }
          ],
          required: Boolean(Object.keys(programWhere).length),
          ...(Object.keys(programWhere).length ? { where: programWhere } : {})
        }
      ],
      order: [
        [{ model: Course, as: 'course' }, 'title', 'ASC'],
        ['level', 'ASC'],
        ['semester', 'ASC']
      ]
    });
  };

  let resolvedProgramCategories = getProgramCategoryFilters(scope.programme_category);
  let offerings = scope.program_id
    ? await fetchOfferings({ programId: scope.program_id })
    : await fetchOfferings({ categoryFilters: resolvedProgramCategories });

  if (!offerings.length && scope.program_id && resolvedProgramCategories.length) {
    offerings = await fetchOfferings({ categoryFilters: resolvedProgramCategories });
  }

  const groupedCourses = new Map();
  offerings.forEach((offering) => {
    if (!offering?.course?.id) return;
    const courseId = offering.course.id;
    if (!groupedCourses.has(courseId)) {
      groupedCourses.set(courseId, {
        course: offering.course,
        offerings: []
      });
    }
    groupedCourses.get(courseId).offerings.push(offering);
  });

  // Merge user's custom-enrolled courses, then apply exclusions
  if (user?.id) {
    const profileRecord = await AcademicProfile.findOne({ where: { user_id: user.id } });
    const enrolledIds = Array.isArray(profileRecord?.metadata?.enrolled_course_ids)
      ? profileRecord.metadata.enrolled_course_ids.filter(Boolean)
      : [];
    const excludedIds = new Set(
      Array.isArray(profileRecord?.metadata?.excluded_course_ids)
        ? profileRecord.metadata.excluded_course_ids.filter(Boolean)
        : []
    );

    // Remove excluded programme courses
    for (const id of excludedIds) groupedCourses.delete(id);

    const missingIds = enrolledIds.filter((id) => !groupedCourses.has(id) && !excludedIds.has(id));
    if (missingIds.length) {
      const extraCourses = await Course.findAll({
        where: { id: { [Op.in]: missingIds } },
        include: [
          {
            model: CourseOffering,
            as: 'offerings',
            include: [
              {
                model: Program,
                as: 'program',
                attributes: ['id', 'key', 'name', 'category', 'institution_id', 'metadata'],
                include: [
                  {
                    model: Institution,
                    as: 'institution',
                    attributes: ['id', 'name', 'metadata'],
                    required: false
                  }
                ],
                required: false
              }
            ],
            required: false
          }
        ]
      });

      extraCourses.forEach((course) => {
        groupedCourses.set(course.id, { course, offerings: course.offerings || [] });
      });
    }
  }

  const courseTitles = Array.from(groupedCourses.values()).map(({ course }) => course.title).filter(Boolean);
  let resources = [];
  try {
    resources = await fetchResourceFilesForCourses({
      courseTitles,
      level: resolvedLevel,
      semester: resolvedSemester,
      preferPremium: hasPaidPlanAccess(user)
    });
  } catch (error) {
    console.error('fetchCurrentLearning resource fetch failed:', error);
    resources = [];
  }

  const resourceCounts = resources.reduce((acc, item) => {
    const key = String(item.course || '').trim();
    if (!key) return acc;
    const existing = acc[key] || {
      count: 0,
      views: 0,
      downloads: 0,
      latest_resource_at: null
    };
    const itemCreatedAt = item.created_at || item.uploaded_at || null;
    const existingTimestamp = toTimestamp(existing.latest_resource_at);
    const itemTimestamp = toTimestamp(itemCreatedAt);
    acc[key] = {
      count: existing.count + 1,
      views: existing.views + toSafeNumber(item.views, 0),
      downloads: existing.downloads + toSafeNumber(item.downloads, 0),
      latest_resource_at: itemTimestamp >= existingTimestamp ? itemCreatedAt : existing.latest_resource_at
    };
    return acc;
  }, {});

  let lessonProgressBundle = { lessonsByCourseId: new Map(), metricsByCourseId: new Map() };
  try {
    lessonProgressBundle = await fetchCourseLessonProgressBundle({
      courses: Array.from(groupedCourses.values()).map(({ course }) => course),
      userId: user?.id || null,
    });
  } catch (error) {
    console.error('fetchCurrentLearning lesson progress fetch failed:', error);
  }

  let practiceProgressBundle = { metricsByCourseId: new Map(), lastActivity: null };
  try {
    practiceProgressBundle = await fetchCoursePracticeProgressBundle({
      courses: Array.from(groupedCourses.values()).map(({ course }) => course),
      userId: user?.id || null,
    });
  } catch (error) {
    console.error('fetchCurrentLearning practice progress fetch failed:', error);
  }

  const lastActivity = resolveLastActivity(groupedCourses, lessonProgressBundle);
  const lastPracticeActivity = practiceProgressBundle.lastActivity;

  const normalizedLimit = Math.max(0, Number(query.limit) || 0);
  const sortBy = query.sort_by || 'title';
  const sortOrder = query.sort_order || 'asc';

  const courses = sortCourseSummaries(
    Array.from(groupedCourses.values()).map(({ course, offerings: matchedOfferings }) => {
      const lessonRows = lessonProgressBundle.lessonsByCourseId.get(String(course.id)) || [];
      const catalog = summarizeCatalogFromLessonRows(lessonRows);
      return buildCourseSummary(course, matchedOfferings, resourceCounts[course.title] || {}, {
        fallbackAffiliateUniversity: scope.affiliate_university,
        lessonCount: lessonRows.length,
        ...(lessonProgressBundle.metricsByCourseId.get(String(course.id)) || {}),
        ...(practiceProgressBundle.metricsByCourseId.get(String(course.id)) || {}),
        ...catalog,
      });
    }),
    sortBy,
    sortOrder
  ).slice(0, normalizedLimit > 0 ? normalizedLimit : undefined);

  return {
    courses,
    resources,
    lastActivity,
    lastPracticeActivity,
    academicProfile: {
      ...serializeAcademicProfile(scope),
      level: resolvedLevel || null,
      semester: resolvedSemester
    },
    missingProfile: false,
    resolvedProgramCategories
  };
};

module.exports = {
  resolveAcademicScope,
  getProgramCategoryFilters,
  fetchCurrentLearning
};

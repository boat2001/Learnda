const express = require('express');
const { Op } = require('sequelize');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { normalizeProgramCategory } = require('../utils/studentIdentity');
const { fetchCurrentLearning } = require('../services/currentLearningService');
const {
  fetchCourseLessonProgressBundle,
  summarizeCatalogFromLessonRows
} = require('../services/learningProgressService');
const { getCourseStudyMetrics } = require('../services/courseRosterMetricsService');
const {
  UCC_AFFILIATE_CODE,
  formatAffiliateCourseCode,
  getAffiliateUniversityName,
  resolveAffiliateUniversityCode
} = require('../utils/courseCatalog');
const {
  AcademicProfile,
  Course,
  CourseOffering,
  Institution,
  Program,
  ResourceFile,
  sequelize
} = require('../models');

const router = express.Router();
const PUBLIC_CATALOG_FALLBACK_AFFILIATE_CODE = UCC_AFFILIATE_CODE;

const USER_PROGRAM_TO_CATALOG_CATEGORY = Object.freeze({
  'Primary Education': ['Primary'],
  'JHS Education': ['JHS'],
  'Early Childhood Education': ['ECE']
});

const normalizeSubject = (course) => {
  return (
    course.metadata?.category ||
    course.department ||
    course.metadata?.takenBy ||
    'General'
  );
};

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

const getPublicAffiliateFallbackCode = (course) => {
  const normalizedCode = String(course?.code || '').trim().toUpperCase();
  return /^\d+[A-Z]?$/.test(normalizedCode) ? PUBLIC_CATALOG_FALLBACK_AFFILIATE_CODE : null;
};

const mapOffering = (offering) => {
  const affiliateUniversityCode = resolveAffiliateUniversityCode({
    course: offering?.course,
    offerings: offering ? [offering] : []
  });

  return {
    id: offering.id,
    level: offering.level,
    semester: offering.semester,
    files_path: offering.files_path,
    metadata: offering.metadata || {},
    affiliate_university_code: affiliateUniversityCode,
    affiliate_university: getAffiliateUniversityName(affiliateUniversityCode),
    program: offering.program
      ? {
          id: offering.program.id,
          key: offering.program.key,
          name: offering.program.name,
          category: offering.program.category,
          institution_id: offering.program.institution_id || null,
          institution: offering.program.institution
            ? {
                id: offering.program.institution.id,
                name: offering.program.institution.name,
                metadata: offering.program.institution.metadata || {}
              }
            : null
        }
      : null,
    course: offering.course
      ? {
          id: offering.course.id,
          key: offering.course.key,
          title: offering.course.title,
          code: formatAffiliateCourseCode(offering.course.code, affiliateUniversityCode),
          credits: offering.course.credits,
          department: offering.course.department,
          affiliate_university_code: affiliateUniversityCode,
          affiliate_university: getAffiliateUniversityName(affiliateUniversityCode)
        }
      : null
  };
};

const getCourseResourceStats = async (courseTitles = []) => {
  const normalizedTitles = [...new Set(
    courseTitles
      .map((title) => String(title || '').trim())
      .filter(Boolean)
  )];
  if (!normalizedTitles.length) return new Map();

  let rows = [];
  try {
    rows = await ResourceFile.findAll({
      attributes: [
        'course',
        [sequelize.fn('count', sequelize.col('id')), 'count'],
        [sequelize.fn('sum', sequelize.col('views')), 'views'],
        [sequelize.fn('sum', sequelize.col('downloads')), 'downloads'],
        [sequelize.fn('max', sequelize.col('created_at')), 'latest_resource_at']
      ],
      where: { course: { [Op.in]: normalizedTitles } },
      group: ['course']
    });
  } catch (error) {
    console.error('getCourseResourceStats resource query failed:', error);
    return new Map();
  }

  const map = new Map();
  rows.forEach((row) => {
    const course = row.get('course');
    if (course) {
      map.set(course, {
        count: Number(row.get('count')) || 0,
        views: Number(row.get('views')) || 0,
        downloads: Number(row.get('downloads')) || 0,
        latest_resource_at: row.get('latest_resource_at') || null
      });
    }
  });

  // Count lessons from all_content view joined with courses for title matching
  let lessonRows = [];
  try {
    lessonRows = await sequelize.query(
      `SELECT c.title AS course, COUNT(ac.id)::int AS count
       FROM all_content ac
       INNER JOIN courses c ON c.id = ac.course_id
       WHERE ac.content_type IN ('lesson','video_lesson')
         AND ac.status = 'published'
         AND c.title IN (:titles)
       GROUP BY c.title`,
      { replacements: { titles: normalizedTitles }, type: sequelize.QueryTypes.SELECT }
    );
  } catch (error) {
    console.error('getCourseResourceStats lesson count query failed:', error);
    return map;
  }

  lessonRows.forEach((row) => {
    const course = row.course;
    if (!course) return;
    const existing = map.get(course) || { count: 0, views: 0, downloads: 0, latest_resource_at: null };
    map.set(course, { ...existing, count: existing.count + (Number(row.count) || 0) });
  });

  return map;
};

const getPublishedLessonsForCourse = async (course, userId = null) => {
  if (!course?.id || !course?.title) return [];

  let progressBundle = { lessonsByCourseId: new Map(), metricsByCourseId: new Map() };
  try {
    progressBundle = await fetchCourseLessonProgressBundle({
      courses: [course],
      userId: userId || null,
    });
  } catch (error) {
    console.error('getPublishedLessonsForCourse progress bundle failed:', error);
  }

  const countChunks = (lessonDocument) => {
    const chunks = lessonDocument?.chunks;
    if (Array.isArray(chunks)) return chunks.length;
    if (chunks && typeof chunks === 'object') return Object.keys(chunks).length;
    return 0;
  };

  return (progressBundle.lessonsByCourseId.get(String(course.id)) || []).filter((item) => {
    // Keep videos, lessons without document info, and lessons that have at least one chunk.
    // Reject only lessons whose lesson_document exists with an explicitly empty chunks set.
    if (item.file_url || item.metadata?.video_url) return true;
    const chunks = item.lesson_document?.chunks;
    if (chunks === undefined || chunks === null) return true;
    return countChunks(item.lesson_document) > 0;
  }).map((item) => {
    const metadata = item.metadata || {};
    const durationMinutes = Number(item.duration_minutes || metadata.duration_minutes || metadata.reading_time || 0) || 0;
    // The list view only needs how many chunks a lesson has, not the full content.
    // The heavy lesson_document/exercises/objectives are fetched on demand in the viewer.
    const chunkCount = countChunks(item.lesson_document);
    return {
      id: item.id,
      title: item.title,
      description: item.description || metadata.summary || '',
      duration: durationMinutes > 0 ? `${durationMinutes} min` : 'Text lesson',
      duration_minutes: durationMinutes || null,
      reading_time: durationMinutes || null,
      topic: metadata.topic || metadata.category || 'lesson',
      lesson_role: metadata.lesson_role || metadata.content_role || metadata.section_role || 'lesson',
      completed: Boolean(item.completed || item.user_engagement?.completed),
      progress: Number(item.progress || item.progress_percentage || 0) || 0,
      progress_percent: Number(item.progress_percent || item.progress_percentage || item.progress || 0) || 0,
      progress_percentage: Number(item.progress_percentage || item.progress || 0) || 0,
      user_engagement: item.user_engagement || null,
      user_interactions: item.user_interactions || null,
      is_premium: Boolean(item.is_premium),
      type: item.content_type,
      content_type: item.content_type,
      lesson_number: metadata.lesson_number || metadata.sequence || null,
      sequence: Number(metadata.sequence || metadata.lesson_number || 0) || 0,
      thumbnail: item.thumbnail_url || metadata.thumbnail_url || null,
      thumbnail_url: item.thumbnail_url || metadata.thumbnail_url || null,
      image_url: item.thumbnail_url || metadata.thumbnail_url || null,
      featured_image: metadata.featured_image || null,
      video_url: item.file_url || metadata.video_url || null,
      file_url: item.file_url || null,
      metadata,
      chunk_count: chunkCount || null,
      downloads: 0,
      views: Math.max(0, Number(item.stats?.total_views ?? 0) || 0),
      view_count: Math.max(0, Number(item.stats?.total_views ?? 0) || 0),
      stats: item.stats
        ? { total_views: Math.max(0, Number(item.stats.total_views ?? 0) || 0) }
        : { total_views: 0 }
    };
  });
};

const normalizeCatalogCategoryFilters = (values = []) => {
  const normalized = new Set();

  values.forEach((value) => {
    const text = String(value || '').trim();
    if (!text) return;

    const normalizedUserProgram = normalizeProgramCategory(text);
    if (normalizedUserProgram && USER_PROGRAM_TO_CATALOG_CATEGORY[normalizedUserProgram]) {
      USER_PROGRAM_TO_CATALOG_CATEGORY[normalizedUserProgram].forEach((category) => normalized.add(category));
      return;
    }

    normalized.add(text);
  });

  return Array.from(normalized);
};

const buildCourseQueryContext = ({ query = {}, user = null, useUserAcademicProfile = false } = {}) => {
  const {
    q,
    search,
    programId,
    programKey,
    level,
    semester,
    limit = 100,
    offset = 0,
    sort_by = 'title',
    sort_order = 'asc'
  } = query;
  const academicProgramValues = [];

  if (query.programCategory) academicProgramValues.push(query.programCategory);
  if (useUserAcademicProfile && user?.program) academicProgramValues.push(user.program);

  const resolvedProgramCategories = normalizeCatalogCategoryFilters(academicProgramValues);
  const resolvedLevel = level || (useUserAcademicProfile ? user?.level : null);
  const resolvedSemester = semester || (useUserAcademicProfile ? user?.semester : null);

  return {
    q,
    search,
    programId,
    programKey,
    level: resolvedLevel,
    semester: resolvedSemester,
    limit,
    offset,
    sortBy: sort_by,
    sortOrder: sort_order,
    resolvedProgramCategories
  };
};

const fetchCourseSummaries = async ({
  q,
  search,
  programId,
  programKey,
  level,
  semester,
  limit = 100,
  offset = 0,
  sortBy = 'title',
  sortOrder = 'asc',
  resolvedProgramCategories = []
} = {}) => {
  const query = (q || search || '').trim();

  const offeringWhere = {};
  if (level) offeringWhere.level = level;
  if (semester) offeringWhere.semester = semester;

  const programWhere = {};
  if (programId) programWhere.id = programId;
  if (programKey) programWhere.key = programKey;
  if (resolvedProgramCategories.length === 1) {
    programWhere.category = resolvedProgramCategories[0];
  } else if (resolvedProgramCategories.length > 1) {
    programWhere.category = { [Op.in]: resolvedProgramCategories };
  }

  const courseWhere = {};
  if (query) {
    courseWhere[Op.or] = [
      { title: { [Op.iLike]: `%${query}%` } },
      { code: { [Op.iLike]: `%${query}%` } },
      { department: { [Op.iLike]: `%${query}%` } }
    ];
  }

  const hasOfferingFilter = Object.keys(offeringWhere).length > 0;
  const hasProgramFilter = Object.keys(programWhere).length > 0;

  const fetchedCourses = await Course.findAll({
    ...(Object.keys(courseWhere).length ? { where: courseWhere } : {}),
    include: [
      {
        model: CourseOffering,
        as: 'offerings',
        // Use INNER JOIN only when filtering by level/semester/program so that
        // courses without any CourseOffering still appear in the catalogue.
        required: hasOfferingFilter || hasProgramFilter,
        ...(hasOfferingFilter ? { where: offeringWhere } : {}),
        include: [
          {
            model: Program,
            as: 'program',
            attributes: ['id', 'key', 'name', 'category', 'institution_id', 'metadata'],
            required: hasProgramFilter,
            ...(hasProgramFilter ? { where: programWhere } : {}),
            include: [
              {
                model: Institution,
                as: 'institution',
                attributes: ['id', 'name', 'metadata'],
                required: false
              }
            ]
          }
        ]
      }
    ],
    order: [['title', 'ASC']]
  });

  const groupedCourses = new Map();
  fetchedCourses.forEach((course) => {
    if (!course?.id) return;
    groupedCourses.set(course.id, {
      course,
      offerings: course.offerings || []
    });
  });

  const resourceMap = await getCourseResourceStats(
    Array.from(groupedCourses.values()).map(({ course }) => course?.title)
  );

  const catalogCoursesPayload = Array.from(groupedCourses.values()).map(({ course }) => course);
  const catalogProgressBundle =
    catalogCoursesPayload.length > 0
      ? await fetchCourseLessonProgressBundle({
          courses: catalogCoursesPayload,
          userId: null,
        })
      : null;

  const normalizedLimit = Math.max(0, Number(limit) || 0);
  const normalizedOffset = Math.max(0, Number(offset) || 0);

  const sortedSummaries = sortCourseSummaries(
    Array.from(groupedCourses.values()).map(({ course, offerings: matchedOfferings }) => {
      const resourceStats = resourceMap.get(course.title) || {};
      const lessonRows = catalogProgressBundle?.lessonsByCourseId?.get(String(course.id)) || [];
      const catalog = summarizeCatalogFromLessonRows(lessonRows);
      return buildCourseSummary(course, matchedOfferings, resourceStats, {
        fallbackAffiliateUniversityCode: getPublicAffiliateFallbackCode(course),
        lessonCount: lessonRows.length,
        ...catalog,
      });
    }),
    sortBy,
    sortOrder
  );

  return sortedSummaries
    .slice(
      normalizedOffset,
      normalizedLimit > 0 ? normalizedOffset + normalizedLimit : undefined
    );
};

router.get('/programs', async (req, res) => {
  try {
    const { category } = req.query;
    const includeCounts = String(
      req.query.includeCounts ?? req.query.include_counts ?? 'false'
    ).toLowerCase() === 'true';
    const programWhere = {};
    if (category) programWhere.category = category;

    const programs = await Program.findAll({
      where: programWhere,
      order: [['category', 'ASC'], ['name', 'ASC']]
    });

    let offeringMap = new Map();
    let courseMap = new Map();

    if (includeCounts) {
      const offeringCounts = await CourseOffering.findAll({
        attributes: ['program_id', [sequelize.fn('count', sequelize.col('id')), 'offerings_count']],
        group: ['program_id']
      });
      const courseCounts = await CourseOffering.findAll({
        attributes: [
          'program_id',
          [sequelize.fn('count', sequelize.fn('distinct', sequelize.col('course_id'))), 'courses_count']
        ],
        group: ['program_id']
      });

      offeringMap = new Map(
        offeringCounts.map((row) => [row.program_id, Number(row.get('offerings_count')) || 0])
      );
      courseMap = new Map(
        courseCounts.map((row) => [row.program_id, Number(row.get('courses_count')) || 0])
      );
    }

    const payload = programs.map((program) => ({
      id: program.id,
      key: program.key,
      name: program.name,
      category: program.category,
      metadata: program.metadata || {},
      offerings_count: offeringMap.get(program.id) || 0,
      courses_count: courseMap.get(program.id) || 0
    }));

    res.json({ success: true, data: { programs: payload } });
  } catch (error) {
    console.error('Programs list error:', error);
    res.status(500).json({ success: false, error: 'Failed to load programs' });
  }
});

router.get('/programs/:programId', async (req, res) => {
  try {
    const { programId } = req.params;
    const { level, semester } = req.query;

    const program = await Program.findByPk(programId);
    if (!program) {
      return res.status(404).json({ success: false, error: 'Program not found' });
    }

    const offeringWhere = { program_id: programId };
    if (level) offeringWhere.level = level;
    if (semester) offeringWhere.semester = semester;

    const offerings = await CourseOffering.findAll({
      where: offeringWhere,
      include: [
        { model: Course, as: 'course' },
        {
          model: Program,
          as: 'program',
          include: [
            {
              model: Institution,
              as: 'institution',
              attributes: ['id', 'name', 'metadata'],
              required: false
            }
          ]
        }
      ],
      order: [['level', 'ASC'], ['semester', 'ASC']]
    });

    res.json({
      success: true,
      data: {
        program: {
          id: program.id,
          key: program.key,
          name: program.name,
          category: program.category,
          metadata: program.metadata || {}
        },
        offerings: offerings.map(mapOffering)
      }
    });
  } catch (error) {
    console.error('Program detail error:', error);
    res.status(500).json({ success: false, error: 'Failed to load program' });
  }
});

router.get('/offerings', async (req, res) => {
  try {
    const { programId, programKey, level, semester } = req.query;
    const offeringWhere = {};
    if (programId) offeringWhere.program_id = programId;
    if (level) offeringWhere.level = level;
    if (semester) offeringWhere.semester = semester;

    const programWhere = {};
    if (programKey) programWhere.key = programKey;

    const offerings = await CourseOffering.findAll({
      where: offeringWhere,
      include: [
        { model: Course, as: 'course' },
        {
          model: Program,
          as: 'program',
          include: [
            {
              model: Institution,
              as: 'institution',
              attributes: ['id', 'name', 'metadata'],
              required: false
            }
          ],
          ...(programKey ? { where: programWhere } : {})
        }
      ],
      order: [['level', 'ASC'], ['semester', 'ASC']]
    });

    res.json({ success: true, data: { offerings: offerings.map(mapOffering) } });
  } catch (error) {
    console.error('Offerings list error:', error);
    res.status(500).json({ success: false, error: 'Failed to load offerings' });
  }
});

const listCourses = async (req, res) => {
  try {
    const payload = await fetchCourseSummaries(buildCourseQueryContext({ query: req.query }));

    res.json({ success: true, data: { courses: payload } });
  } catch (error) {
    console.error('Courses list error:', error);
    res.status(500).json({ success: false, error: 'Failed to load courses' });
  }
};

router.get('/', listCourses);
router.get('/enrolled', listCourses);

router.get('/current', authenticate, async (req, res) => {
  try {
    const learning = await fetchCurrentLearning({
      user: req.user,
      query: req.query
    });

    return res.json({
      success: true,
      data: {
        courses: learning.courses,
        resources: learning.resources,
        last_activity: learning.lastActivity || null,
        last_practice_activity: learning.lastPracticeActivity || null,
        academic_profile: learning.academicProfile,
        resolved_program_categories: learning.resolvedProgramCategories,
        missing_profile: learning.missingProfile
      }
    });
  } catch (error) {
    console.error('Current courses error:', error);
    return res.status(500).json({ success: false, error: 'Failed to load current courses' });
  }
});

router.get('/user-enrolled', authenticate, async (req, res) => {
  try {
    const profileRecord = await AcademicProfile.findOne({ where: { user_id: req.user.id } });
    const enrolledIds = Array.isArray(profileRecord?.metadata?.enrolled_course_ids)
      ? profileRecord.metadata.enrolled_course_ids.filter(Boolean)
      : [];

    if (!enrolledIds.length) {
      return res.json({ success: true, data: { courses: [] } });
    }

    const courses = await Course.findAll({
      where: { id: { [Op.in]: enrolledIds } },
      include: [
        {
          model: CourseOffering,
          as: 'offerings',
          include: [
            {
              model: Program,
              as: 'program',
              attributes: ['id', 'key', 'name', 'category', 'institution_id', 'metadata'],
              required: false
            }
          ],
          required: false
        }
      ]
    });

    const summaries = courses.map((course) =>
      buildCourseSummary(course, course.offerings || [], {})
    );

    return res.json({ success: true, data: { courses: summaries } });
  } catch (error) {
    console.error('User enrolled courses error:', error);
    return res.status(500).json({ success: false, error: 'Failed to load enrolled courses' });
  }
});

router.post('/user-enrolled/:courseId', authenticate, async (req, res) => {
  try {
    const { courseId } = req.params;

    const [course, profileRecord] = await Promise.all([
      Course.findByPk(courseId),
      AcademicProfile.findOne({ where: { user_id: req.user.id } })
    ]);

    if (!course) return res.status(404).json({ success: false, error: 'Course not found' });
    if (!profileRecord) return res.status(404).json({ success: false, error: 'Academic profile not found' });

    const existing = Array.isArray(profileRecord.metadata?.enrolled_course_ids)
      ? profileRecord.metadata.enrolled_course_ids
      : [];

    if (!existing.includes(courseId)) {
      await profileRecord.update({
        metadata: { ...profileRecord.metadata, enrolled_course_ids: [...existing, courseId] }
      });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Add enrolled course error:', error);
    return res.status(500).json({ success: false, error: 'Failed to add course' });
  }
});

router.delete('/user-enrolled/:courseId', authenticate, async (req, res) => {
  try {
    const { courseId } = req.params;
    const profileRecord = await AcademicProfile.findOne({ where: { user_id: req.user.id } });

    if (!profileRecord) return res.status(404).json({ success: false, error: 'Academic profile not found' });

    const existing = Array.isArray(profileRecord.metadata?.enrolled_course_ids)
      ? profileRecord.metadata.enrolled_course_ids
      : [];

    await profileRecord.update({
      metadata: {
        ...profileRecord.metadata,
        enrolled_course_ids: existing.filter((id) => id !== courseId)
      }
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('Remove enrolled course error:', error);
    return res.status(500).json({ success: false, error: 'Failed to remove course' });
  }
});

router.get('/user-excluded', authenticate, async (req, res) => {
  try {
    const profileRecord = await AcademicProfile.findOne({ where: { user_id: req.user.id } });
    const excludedIds = Array.isArray(profileRecord?.metadata?.excluded_course_ids)
      ? profileRecord.metadata.excluded_course_ids.filter(Boolean)
      : [];
    return res.json({ success: true, data: { excluded_course_ids: excludedIds } });
  } catch (error) {
    console.error('Get excluded courses error:', error);
    return res.status(500).json({ success: false, error: 'Failed to get excluded courses' });
  }
});

router.post('/user-excluded/:courseId', authenticate, async (req, res) => {
  try {
    const { courseId } = req.params;
    const profileRecord = await AcademicProfile.findOne({ where: { user_id: req.user.id } });
    if (!profileRecord) return res.status(404).json({ success: false, error: 'Academic profile not found' });

    const existing = Array.isArray(profileRecord.metadata?.excluded_course_ids)
      ? profileRecord.metadata.excluded_course_ids
      : [];

    if (!existing.includes(courseId)) {
      await profileRecord.update({
        metadata: { ...profileRecord.metadata, excluded_course_ids: [...existing, courseId] }
      });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('Exclude course error:', error);
    return res.status(500).json({ success: false, error: 'Failed to exclude course' });
  }
});

router.delete('/user-excluded/:courseId', authenticate, async (req, res) => {
  try {
    const { courseId } = req.params;
    const profileRecord = await AcademicProfile.findOne({ where: { user_id: req.user.id } });
    if (!profileRecord) return res.status(404).json({ success: false, error: 'Academic profile not found' });

    const existing = Array.isArray(profileRecord.metadata?.excluded_course_ids)
      ? profileRecord.metadata.excluded_course_ids
      : [];

    await profileRecord.update({
      metadata: {
        ...profileRecord.metadata,
        excluded_course_ids: existing.filter((id) => id !== courseId)
      }
    });
    return res.json({ success: true });
  } catch (error) {
    console.error('Restore excluded course error:', error);
    return res.status(500).json({ success: false, error: 'Failed to restore course' });
  }
});

router.get('/:courseId', optionalAuth, async (req, res) => {
  try {
    const course = await Course.findByPk(req.params.courseId, {
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
              ]
            }
          ]
        }
      ]
    });

    if (!course) {
      return res.status(404).json({ success: false, error: 'Course not found' });
    }

    const [resourceCount] = await Promise.all([
      ResourceFile.count({ where: { course: course.title } })
    ]);
    let progressBundle = { lessonsByCourseId: new Map(), metricsByCourseId: new Map() };
    try {
      progressBundle = await fetchCourseLessonProgressBundle({
        courses: [course],
        userId: req.user?.id || null,
      });
    } catch (error) {
      console.error('Course detail progress bundle failed:', error);
    }
    const lessonRows = progressBundle.lessonsByCourseId.get(String(course.id)) || [];
    const catalog = summarizeCatalogFromLessonRows(lessonRows);
    const courseProgress = progressBundle.metricsByCourseId.get(String(course.id)) || {};
    const studyMetrics = await getCourseStudyMetrics(course.id);
    const summary = buildCourseSummary(
      course,
      course.offerings || [],
      { count: resourceCount },
      {
        fallbackAffiliateUniversityCode: getPublicAffiliateFallbackCode(course),
        lessonCount: lessonRows.length,
        ...catalog,
        ...courseProgress,
      }
    );

    res.json({
      success: true,
      data: {
        ...summary,
        ...studyMetrics,
        offerings: (course.offerings || []).map(mapOffering)
      }
    });
  } catch (error) {
    console.error('Course detail error:', error);
    res.status(500).json({ success: false, error: 'Failed to load course' });
  }
});

router.get('/:courseId/lessons', optionalAuth, async (req, res) => {
  try {
    const course = await Course.findByPk(req.params.courseId);
    if (!course) {
      return res.status(404).json({ success: false, error: 'Course not found' });
    }

    const contentLessons = await getPublishedLessonsForCourse(course, req.user?.id || null);
    const lessons = contentLessons.length
      ? contentLessons
      : (await ResourceFile.findAll({
          where: { course: course.title },
          order: [['created_at', 'DESC']]
        })).map((file) => ({
          id: file.id,
          title: file.title,
          duration: file.file_size ? `${Math.round(file.file_size / 1024)} KB` : 'PDF',
          topic: file.category || 'resource',
          completed: false,
          file_url: file.file_url,
          file_type: file.file_type,
          downloads: file.downloads || 0,
          views: file.views || 0,
          is_premium: file.is_premium
        }));

    res.json({ success: true, data: { lessons } });
  } catch (error) {
    console.error('Course lessons error:', error);
    res.status(500).json({ success: false, error: 'Failed to load lessons' });
  }
});

router.get('/:courseId/progress', optionalAuth, async (req, res) => {
  try {
    const course = await Course.findByPk(req.params.courseId, {
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
              ]
            }
          ]
        }
      ]
    });
    if (!course) {
      return res.status(404).json({ success: false, error: 'Course not found' });
    }
    const [resourceCount] = await Promise.all([
      ResourceFile.count({ where: { course: course.title } })
    ]);
    let progressBundle = { lessonsByCourseId: new Map(), metricsByCourseId: new Map() };
    try {
      progressBundle = await fetchCourseLessonProgressBundle({
        courses: [course],
        userId: req.user?.id || null,
      });
    } catch (error) {
      console.error('Course progress bundle failed:', error);
    }
    const lessonRows = progressBundle.lessonsByCourseId.get(String(course.id)) || [];
    const catalog = summarizeCatalogFromLessonRows(lessonRows);
    const courseProgress = progressBundle.metricsByCourseId.get(String(course.id)) || {};
    const studyMetrics = await getCourseStudyMetrics(course.id);
    const summary = buildCourseSummary(
      course,
      course.offerings || [],
      { count: resourceCount },
      {
        fallbackAffiliateUniversityCode: getPublicAffiliateFallbackCode(course),
        lessonCount: lessonRows.length,
        ...catalog,
        ...courseProgress,
      }
    );
    res.json({ success: true, data: { ...summary, ...studyMetrics } });
  } catch (error) {
    console.error('Course progress error:', error);
    res.status(500).json({ success: false, error: 'Failed to load course progress' });
  }
});

router.post('/:courseId/enroll', async (req, res) => {
  res.json({ success: true, data: { enrolled: true } });
});

module.exports = router;

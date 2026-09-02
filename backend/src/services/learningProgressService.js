const { Op } = require('sequelize');
const db = require('../models');
const { ContentEngagement, ContentStats, sequelize } = db;

const normalizeKey = (value) => String(value || '').trim().toLowerCase();

// Emit the expensive no-lessons diagnostic at most once per process.
let lessonDiagnosticsLogged = false;

const buildCourseIndex = (courses = []) => {
  const byId = new Map();
  const byTitle = new Map();

  courses.forEach((course) => {
    if (!course) return;
    const courseId = String(course.id || course.course_id || '').trim();
    const courseTitle = normalizeKey(course.title);

    if (courseId) byId.set(courseId, String(course.id || course.course_id));
    if (courseTitle) byTitle.set(courseTitle, String(course.id || course.course_id));
  });

  return { byId, byTitle };
};

const resolveLessonCourseId = (lesson, courseIndex) => {
  const metadata = lesson?.metadata || {};
  const metadataCourseId = String(
    metadata.course_id ||
      metadata.courseId ||
      lesson?.course_id ||
      ''
  ).trim();

  if (metadataCourseId && courseIndex.byId.has(metadataCourseId)) {
    return courseIndex.byId.get(metadataCourseId);
  }

  const titleCandidates = [
    metadata.course,
    metadata.course_title,
    metadata.course_name,
    lesson?.course,
  ];

  for (const candidate of titleCandidates) {
    const normalized = normalizeKey(candidate);
    if (normalized && courseIndex.byTitle.has(normalized)) {
      return courseIndex.byTitle.get(normalized);
    }
  }

  return null;
};

const toJsonRecord = (model) => (typeof model?.toJSON === 'function' ? model.toJSON() : model);

const buildLessonProgressMap = (engagements = []) => {
  const grouped = new Map();

  engagements.forEach((engagementModel) => {
    const engagement = toJsonRecord(engagementModel);
    const contentId = String(engagement?.content_id || '').trim();
    if (!contentId) return;
    if (!grouped.has(contentId)) grouped.set(contentId, []);
    grouped.get(contentId).push(engagement);
  });

  const progressMap = new Map();

  grouped.forEach((entries, contentId) => {
    const sorted = [...entries].sort(
      (left, right) => new Date(left?.created_at || 0).getTime() - new Date(right?.created_at || 0).getTime()
    );

    const latestLearning = sorted.reduce((latest, entry) => {
      if (!entry || !['view', 'complete'].includes(entry.action)) return latest;
      if (!latest) return entry;
      return new Date(entry.created_at).getTime() >= new Date(latest.created_at).getTime() ? entry : latest;
    }, null);
    const latestCompletion = sorted.reduce((latest, entry) => {
      if (!entry || entry.action !== 'complete') return latest;
      if (!latest) return entry;
      return new Date(entry.created_at).getTime() >= new Date(latest.created_at).getTime() ? entry : latest;
    }, null);
    const latestMetadata =
      latestLearning?.metadata ||
      latestCompletion?.metadata ||
      {};
    const progressPercentage = sorted.reduce((max, entry) => {
      const nextValue = Number(entry?.progress_percentage ?? entry?.metadata?.progress_percentage ?? 0) || 0;
      return Math.max(max, nextValue);
    }, 0);
    const completed = sorted.some((entry) => entry?.action === 'complete' || entry?.metadata?.completed);

    progressMap.set(contentId, {
      completed,
      progressPercentage: Math.max(completed ? 100 : 0, progressPercentage),
      durationSeconds: Number(
        latestLearning?.duration_seconds ||
          latestCompletion?.duration_seconds ||
          0
      ) || 0,
      lastViewedAt: latestLearning?.created_at || null,
      completedAt: latestCompletion?.created_at || null,
      metadata: latestMetadata,
      lessonState:
        latestMetadata?.lesson_state ||
        latestCompletion?.metadata?.lesson_state ||
        null,
      completionSummary:
        latestCompletion?.metadata?.completion_summary ||
        latestMetadata?.completion_summary ||
        null,
      finalAssessment:
        latestMetadata?.final_assessment ||
        latestCompletion?.metadata?.final_assessment ||
        null,
    });
  });

  return progressMap;
};

const applyLessonProgress = (lessonModel, progressMap) => {
  const lesson = toJsonRecord(lessonModel);
  const progressEntry = progressMap.get(String(lesson.id)) || null;
  const progressPercentage = progressEntry?.progressPercentage || 0;
  const completed = Boolean(progressEntry?.completed);

  return {
    ...lesson,
    completed,
    progress: progressPercentage,
    progress_percent: progressPercentage,
    progress_percentage: progressPercentage,
    user_interactions: {
      ...(lesson.user_interactions || {}),
      progress: progressPercentage,
      completed,
    },
    user_engagement: {
      ...(lesson.user_engagement || {}),
      completed,
      progress_percentage: progressPercentage,
      time_spent_seconds: progressEntry?.durationSeconds || 0,
      metadata: progressEntry?.metadata || {},
      lesson_state: progressEntry?.lessonState || null,
      completion_summary: progressEntry?.completionSummary || null,
      final_assessment: progressEntry?.finalAssessment || null,
      last_viewed_at: progressEntry?.lastViewedAt || null,
      completed_at: progressEntry?.completedAt || null,
    },
  };
};

const catalogGetLessonRole = (lesson = {}) =>
  String(
    lesson?.lesson_role ||
      lesson?.metadata?.lesson_role ||
      lesson?.metadata?.content_role ||
      lesson?.metadata?.section_role ||
      ''
  )
    .trim()
    .toLowerCase();

const catalogNormalizedLessonType = (lesson = {}) => {
  const raw = String(lesson?.type || lesson?.content_type || '').trim().toLowerCase();
  if (!raw) return 'text_lesson';
  if (raw === 'video' || raw.includes('video')) return 'video';
  return 'text_lesson';
};

const catalogNormalizeDocChunks = (lesson = {}) => {
  const metadata = lesson?.metadata || {};
  const doc =
    lesson?.lesson_document ||
    metadata?.lesson_document ||
    metadata?.lesson_payload ||
    null;
  if (!doc?.chunks) return [];
  if (Array.isArray(doc.chunks)) return doc.chunks;
  return Object.entries(doc.chunks || {})
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([chunkId, chunk]) => ({ id: chunkId, ...(chunk || {}) }));
};

const catalogChunkHasParagraphBody = (chunk = {}) => {
  if (Array.isArray(chunk?.paragraphs) && chunk.paragraphs.length > 0) return true;
  const cc = chunk?.chunk_content;
  return Boolean(cc && typeof cc === 'object' && Object.keys(cc).length > 0);
};

const catalogLessonHasUnstructuredBody = (lesson = {}) => {
  const meta = lesson?.metadata || {};
  if (Array.isArray(meta.paragraphs) && meta.paragraphs.length) return true;
  return Boolean(
    String(meta.lesson_body_html || '').trim() ||
      String(meta.body || '').trim() ||
      String(lesson?.content || '').trim() ||
      String(lesson?.description || '').trim()
  );
};

const catalogLessonHasVideoPayload = (lesson = {}) => {
  const meta = lesson?.metadata || {};
  return Boolean(
    String(lesson?.file_url || '').trim() ||
      String(lesson?.video_url || '').trim() ||
      String(meta.video_url || '').trim() ||
      String(meta.file_url || '').trim()
  );
};

/**
 * Count learner "exercise" steps (per-chunk interactions) for one content row.
 * Mirrors CourseDetail / LessonViewer: prelims have no chunk exercises; structured chunks + optional video segment count.
 */
const catalogCountExerciseSteps = (lesson = {}) => {
  if (catalogGetLessonRole(lesson) === 'prelim') return 0;

  const chunks = catalogNormalizeDocChunks(lesson);
  const substantive = chunks.filter(catalogChunkHasParagraphBody);
  const isVideo = catalogNormalizedLessonType(lesson) === 'video';

  // When exercises are stored, some chunk positions may be `null` — a deliberate
  // "this chunk has no exercise" marker (e.g. an intro/outro chunk with nothing
  // testable; see LessonViewer.jsx / lessonAssessment.js buildLessonBlocks, which
  // reads exercises[index % exercises.length] positionally). Count only the
  // positions that actually carry a real exercise so this mirrors what the
  // viewer renders. Without a stored exercises array, the viewer auto-generates
  // a filler exercise for every chunk, so fall back to counting all chunks.
  const storedExercises = Array.isArray(lesson?.exercises) ? lesson.exercises : [];
  let n;
  if (storedExercises.length > 0) {
    n = substantive.reduce(
      (count, _chunk, idx) => count + (storedExercises[idx % storedExercises.length] ? 1 : 0),
      0
    );
  } else {
    n = substantive.length;
  }
  if (isVideo && catalogLessonHasVideoPayload(lesson)) {
    n += 1;
  }

  if (n === 0) {
    if (Array.isArray(lesson?.exercises) && lesson.exercises.length > 0) {
      return lesson.exercises.length;
    }
    if (Array.isArray(lesson?.metadata?.exercises) && lesson.metadata.exercises.length > 0) {
      return lesson.metadata.exercises.length;
    }
    if (catalogLessonHasUnstructuredBody(lesson)) return 1;
    if (isVideo && catalogLessonHasVideoPayload(lesson)) return 1;
    return 0;
  }
  return n;
};

const summarizeCatalogFromLessonRows = (rows = []) => {
  let textLessons = 0;
  let videoLessons = 0;
  let prelims = 0;
  let exerciseSteps = 0;

  rows.forEach((lesson) => {
    const role = catalogGetLessonRole(lesson);
    const isVideo = catalogNormalizedLessonType(lesson) === 'video';
    if (role === 'prelim') {
      prelims += 1;
    } else if (isVideo) {
      videoLessons += 1;
    } else {
      textLessons += 1;
    }
    exerciseSteps += catalogCountExerciseSteps(lesson);
  });

  return {
    text_lessons_count: textLessons,
    video_lessons_count: videoLessons,
    prelims_count: prelims,
    lesson_exercises_count: exerciseSteps,
    total_curriculum_items: rows.length,
  };
};

const summarizeCourseLessons = (lessons = []) => {
  const totalLessons = lessons.length;
  if (!totalLessons) {
    return {
      totalLessons: 0,
      completedLessons: 0,
      progress: 0,
      startedLessons: 0,
    };
  }

  const progressValues = lessons.map((lesson) => {
    const raw = Number(
      lesson?.progress_percentage ??
        lesson?.progress_percent ??
        lesson?.progress ??
        lesson?.user_engagement?.progress_percentage ??
        lesson?.user_interactions?.progress ??
        0
    );
    return Number.isFinite(raw) ? raw : 0;
  });

  const completedLessons = lessons.filter((lesson) => Boolean(
    lesson?.completed ||
      lesson?.user_engagement?.completed ||
      lesson?.progress_percentage >= 100 ||
      lesson?.progress === 100
  )).length;
  const startedLessons = progressValues.filter((value) => value > 0).length;
  const progress = Math.round(
    progressValues.reduce((sum, value) => sum + value, 0) / Math.max(totalLessons, 1)
  );

  return {
    totalLessons,
    completedLessons,
    progress,
    startedLessons,
  };
};

/**
 * Build a SQL fragment to match lessons for a given course.
 * Lessons in the new schema have an explicit course_id column OR metadata references.
 */
const buildCourseSqlClause = (course, paramPrefix) => {
  const clauses = [];
  const params = {};

  if (course?.id) {
    clauses.push(`(ac.course_id = :${paramPrefix}_cid::uuid OR ac.metadata->>'course_id' = :${paramPrefix}_cidStr OR ac.metadata->>'courseId' = :${paramPrefix}_cidStr)`);
    params[`${paramPrefix}_cid`] = String(course.id);
    params[`${paramPrefix}_cidStr`] = String(course.id);
  }

  const titleValue = String(course?.title || '').trim();
  if (titleValue) {
    clauses.push(`(ac.metadata->>'course' = :${paramPrefix}_title OR ac.metadata->>'course_title' = :${paramPrefix}_title OR ac.metadata->>'course_name' = :${paramPrefix}_title)`);
    params[`${paramPrefix}_title`] = titleValue;
  }

  return { clause: clauses.length ? `(${clauses.join(' OR ')})` : null, params };
};

const fetchCourseLessonProgressBundle = async ({ courses = [], userId = null }) => {
  const normalizedCourses = (Array.isArray(courses) ? courses : [])
    .map((course) => toJsonRecord(course))
    .filter((course) => course?.id && course?.title);

  const empty = {
    lessonsByCourseId: new Map(),
    metricsByCourseId: new Map(),
  };
  if (!normalizedCourses.length) return empty;

  // Build combined SQL for all courses using the new Lesson table
  // (lessons have explicit course_id + metadata fallback; video_lessons also carry metadata)
  const allClauses = [];
  let allParams = {};

  normalizedCourses.forEach((course, idx) => {
    const { clause, params } = buildCourseSqlClause(course, `c${idx}`);
    if (clause) { allClauses.push(clause); allParams = { ...allParams, ...params }; }
  });

  if (!allClauses.length) return empty;

  // Query lessons from the all_content view (covers Lesson + VideoLesson rows),
  // restricted to the requested course(s) so we don't scan the entire library.
  // Explicit column list (everything `ac.*` had EXCEPT `final_assessment`):
  // that column is the lesson's bank of final-test-only questions, used
  // exclusively by the single-lesson viewer — never read anywhere in this
  // course-listing/progress path — but it's real per-lesson JSONB weight
  // (and this query already runs at least twice per course-page load, once
  // for course detail and once for the lessons list), so it's worth not
  // paying to fetch, parse, and discard it here.
  const sql = `
    SELECT
      ac.id, ac.content_type, ac.subtype, ac.title, ac.description, ac.status, ac.is_premium,
      ac.creator_id, ac.depth_level, ac.tags, ac.thumbnail_url, ac.file_url, ac.video_url,
      ac.duration_minutes, ac.word_count, ac.published_at, ac.created_at, ac.updated_at,
      ac.course_id, ac.lesson_number, ac.level, ac.category, ac.tone, ac.body, ac.author,
      ac.metadata, ac.lesson_document, ac.exercises, ac.objectives, ac.questions, ac.sections,
      cs.total_views, cs.total_completions, cs.like_count, cs.save_count, cs.avg_time_spent
    FROM all_content ac
    LEFT JOIN content_stats cs ON cs.content_id = ac.id
    WHERE ac.status = 'published'
      AND ac.content_type IN ('lesson', 'video_lesson')
      AND (${allClauses.join(' OR ')})
    ORDER BY
      ac.lesson_number ASC NULLS LAST,
      ac.published_at ASC,
      ac.created_at ASC
  `;

  // Fetch only the requested courses' lessons and bucket them in JS
  let rawLessonRows = [];
  try {
    rawLessonRows = await sequelize.query(sql, {
      replacements: allParams,
      type: sequelize.QueryTypes.SELECT,
    });
  } catch (error) {
    console.error('fetchCourseLessonProgressBundle all_content query failed:', error.message);
  }

  // If no lessons found, log table-level diagnostics once per process so live
  // issues (stale all_content view, missing data) are visible without scanning
  // every table on every request.
  if (!rawLessonRows.length && !lessonDiagnosticsLogged) {
    lessonDiagnosticsLogged = true;
    console.warn('⚠️ No lessons found for courses:', normalizedCourses.map((c) => ({ id: c.id, title: c.title })));
    try {
      const courseIds = normalizedCourses.map((c) => String(c.id)).filter(Boolean);
      const stats = await sequelize.query(`
        SELECT 
          'lessons_total' AS metric, COUNT(*) AS count FROM lessons
        UNION ALL
        SELECT 'lessons_published', COUNT(*) FROM lessons WHERE status = 'published'
        UNION ALL
        SELECT 'lessons_with_course_id', COUNT(*) FROM lessons WHERE course_id IS NOT NULL
        UNION ALL
        SELECT 'lessons_for_these_courses', COUNT(*) FROM lessons WHERE course_id IN (:courseIds)
        UNION ALL
        SELECT 'video_lessons_total', COUNT(*) FROM video_lessons
        UNION ALL
        SELECT 'video_lessons_published', COUNT(*) FROM video_lessons WHERE status = 'published'
        UNION ALL
        SELECT 'video_lessons_for_these_courses', COUNT(*) FROM video_lessons WHERE course_id IN (:courseIds)
      `, {
        replacements: { courseIds },
        type: sequelize.QueryTypes.SELECT,
      });
      console.warn('Database stats:', stats);
    } catch (diagError) {
      console.error('Diagnostic query failed:', diagError.message);
    }
  }


  const lessonIds = rawLessonRows.map((row) => row.id).filter(Boolean);
  let progressMap = new Map();
  if (userId && lessonIds.length) {
    try {
      progressMap = buildLessonProgressMap(
        await ContentEngagement.findAll({
          where: {
            user_id: userId,
            content_id: { [Op.in]: lessonIds },
            action: { [Op.in]: ['view', 'complete'] },
          },
          order: [['created_at', 'ASC']],
        })
      );
    } catch (error) {
      console.error('fetchCourseLessonProgressBundle engagement fetch failed:', error);
      progressMap = new Map();
    }
  }

  const courseIndex = buildCourseIndex(normalizedCourses);
  const lessonsByCourseId = new Map();

  // Augment each raw view-row with stats and normalize for consumers
  const { normalizeRow } = require('../utils/contentLookup');

  // If the all_content view doesn't expose lesson_document/metadata, batch-fetch from Lesson model
  const missingDocIds = rawLessonRows
    .filter((r) => r.content_type === 'lesson' && !r.lesson_document && !r.metadata?.lesson_document)
    .map((r) => r.id)
    .filter(Boolean);

  const lessonDocMap = new Map();
  if (missingDocIds.length > 0) {
    const { Op } = require('sequelize');
    try {
      const fullLessons = await db.Lesson.findAll({
        where: { id: { [Op.in]: missingDocIds } },
        attributes: ['id', 'lesson_document', 'exercises', 'objectives', 'metadata'],
        raw: true,
      });
      fullLessons.forEach((l) => lessonDocMap.set(l.id, l));
    } catch (error) {
      console.error('fetchCourseLessonProgressBundle failed to load lesson docs:', error);
    }
  }

  rawLessonRows.forEach((rawRow) => {
    const normalized = normalizeRow(rawRow);
    // Attach stats sub-object expected by callers
    normalized.stats = {
      total_views: rawRow.total_views || 0,
      total_completions: rawRow.total_completions || 0,
      like_count: rawRow.like_count || 0,
      save_count: rawRow.save_count || 0,
      avg_time_spent: rawRow.avg_time_spent || 0,
    };
    // Enrich with lesson_document/exercises if view didn't expose them
    if (lessonDocMap.has(normalized.id)) {
      const full = lessonDocMap.get(normalized.id);
      if (full.lesson_document) normalized.lesson_document = full.lesson_document;
      if (full.exercises) normalized.exercises = full.exercises;
      if (full.objectives) normalized.objectives = full.objectives;
      if (full.metadata && Object.keys(full.metadata).length > 0) {
        normalized.metadata = { ...full.metadata, ...(normalized.metadata || {}) };
      }
    }
    const lesson = applyLessonProgress(normalized, progressMap);
    const courseId = resolveLessonCourseId(lesson, courseIndex);
    if (!courseId) return;
    if (!lessonsByCourseId.has(courseId)) lessonsByCourseId.set(courseId, []);
    lessonsByCourseId.get(courseId).push(lesson);
  });

  const metricsByCourseId = new Map();
  normalizedCourses.forEach((course) => {
    const courseId = String(course.id || course.course_id);
    metricsByCourseId.set(courseId, summarizeCourseLessons(lessonsByCourseId.get(courseId) || []));
  });

  return {
    lessonsByCourseId,
    metricsByCourseId,
  };
};

const buildPracticeCourseMetrics = (rows = [], completionsByContentId) => {
  const total = rows.length;
  let attempted = 0;
  let bestScore = 0;
  let lastAttemptedAt = null;

  rows.forEach((row) => {
    const completions = completionsByContentId.get(String(row.id)) || [];
    if (!completions.length) return;
    attempted += 1;
    completions.forEach((entry) => {
      const score = Number(entry?.metadata?.practice_summary?.percent_score ?? 0) || 0;
      if (score > bestScore) bestScore = score;
      const timestamp = new Date(entry?.created_at || 0).getTime();
      if (timestamp && (!lastAttemptedAt || timestamp > new Date(lastAttemptedAt).getTime())) {
        lastAttemptedAt = entry?.created_at || lastAttemptedAt;
      }
    });
  });

  return {
    practice_total: total,
    practice_attempted: attempted,
    practice_progress: total > 0 ? Math.round((attempted / total) * 100) : 0,
    practice_best_score: Math.round(bestScore),
    practice_last_attempted_at: lastAttemptedAt,
  };
};

/**
 * Practice-specific counterpart to fetchCourseLessonProgressBundle: buckets quiz/
 * past_question content by course and, per user, resolves which items have a
 * recorded completion (see contentController.complete, which writes practice
 * results into ContentEngagement.metadata.practice_summary). Also surfaces the
 * single most recent completion across all requested courses so the caller can
 * offer a "continue where you left off" resume point.
 */
const fetchCoursePracticeProgressBundle = async ({ courses = [], userId = null }) => {
  const normalizedCourses = (Array.isArray(courses) ? courses : [])
    .map((course) => toJsonRecord(course))
    .filter((course) => course?.id && course?.title);

  const empty = { metricsByCourseId: new Map(), lastActivity: null };
  if (!normalizedCourses.length) return empty;

  const allClauses = [];
  let allParams = {};

  normalizedCourses.forEach((course, idx) => {
    const { clause, params } = buildCourseSqlClause(course, `p${idx}`);
    if (clause) { allClauses.push(clause); allParams = { ...allParams, ...params }; }
  });

  if (!allClauses.length) return empty;

  // Quizzes/exams live in text_items, which all_content exposes with a constant
  // content_type of 'text_item' — the quiz/past_question distinction is in `subtype`.
  const sql = `
    SELECT ac.id, ac.content_type, ac.subtype, ac.title, ac.course_id, ac.metadata, ac.created_at
    FROM all_content ac
    WHERE ac.status = 'published'
      AND ac.content_type = 'text_item'
      AND ac.subtype IN ('quiz', 'past_question')
      AND (${allClauses.join(' OR ')})
  `;

  let rawPracticeRows = [];
  try {
    rawPracticeRows = await sequelize.query(sql, {
      replacements: allParams,
      type: sequelize.QueryTypes.SELECT,
    });
  } catch (error) {
    console.error('fetchCoursePracticeProgressBundle all_content query failed:', error.message);
  }

  const courseIndex = buildCourseIndex(normalizedCourses);
  const practiceByCourseId = new Map();
  const rowsById = new Map();

  rawPracticeRows.forEach((row) => {
    rowsById.set(String(row.id), row);
    const courseId = resolveLessonCourseId(row, courseIndex);
    if (!courseId) return;
    if (!practiceByCourseId.has(courseId)) practiceByCourseId.set(courseId, []);
    practiceByCourseId.get(courseId).push(row);
  });

  const completionsByContentId = new Map();
  let lastActivity = null;

  if (userId && rawPracticeRows.length) {
    try {
      const practiceIds = rawPracticeRows.map((row) => row.id).filter(Boolean);
      const engagements = await ContentEngagement.findAll({
        where: {
          user_id: userId,
          content_id: { [Op.in]: practiceIds },
          action: 'complete',
        },
        order: [['created_at', 'ASC']],
      });

      engagements.forEach((engagementModel) => {
        const engagement = toJsonRecord(engagementModel);
        const contentId = String(engagement?.content_id || '').trim();
        if (!contentId) return;
        if (!completionsByContentId.has(contentId)) completionsByContentId.set(contentId, []);
        completionsByContentId.get(contentId).push(engagement);

        const timestamp = new Date(engagement?.created_at || 0).getTime();
        if (!timestamp) return;
        if (!lastActivity || timestamp > lastActivity.timestamp) {
          const row = rowsById.get(contentId);
          const courseId = row ? resolveLessonCourseId(row, courseIndex) : null;
          const course = courseId
            ? normalizedCourses.find((candidate) => String(candidate.id) === courseId)
            : null;

          lastActivity = {
            content_id: contentId,
            content_title: row?.title || '',
            content_type: row?.subtype || row?.content_type || null,
            course_id: courseId,
            course_title: course?.title || null,
            percent_score: Number(engagement?.metadata?.practice_summary?.percent_score ?? 0) || 0,
            passed: Boolean(engagement?.metadata?.practice_summary?.passed),
            last_attempted_at: engagement?.created_at || null,
            timestamp,
          };
        }
      });
    } catch (error) {
      console.error('fetchCoursePracticeProgressBundle engagement fetch failed:', error);
    }
  }

  const metricsByCourseId = new Map();
  normalizedCourses.forEach((course) => {
    const courseId = String(course.id || course.course_id);
    metricsByCourseId.set(
      courseId,
      buildPracticeCourseMetrics(practiceByCourseId.get(courseId) || [], completionsByContentId)
    );
  });

  return { metricsByCourseId, lastActivity };
};

module.exports = {
  fetchCourseLessonProgressBundle,
  fetchCoursePracticeProgressBundle,
  summarizeCourseLessons,
  summarizeCatalogFromLessonRows,
  applyLessonProgress,
};

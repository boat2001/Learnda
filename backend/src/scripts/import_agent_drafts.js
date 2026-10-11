'use strict';
/**
 * Import no-API agent-generated JSON drafts into Learnda.
 *
 * Put completed JSON files in:
 *   uploads/_generated-content/agent-drafts/lessons/*.json
 *   uploads/_generated-content/agent-drafts/quiz/*.json
 *   uploads/_generated-content/agent-drafts/past_question/*.json
 *
 * Each file can either be a full packet with a "generated" property, or the generated
 * JSON itself with a "context" property.
 *
 * Usage:
 *   node src/scripts/import_agent_drafts.js --dry-run
 *   node src/scripts/import_agent_drafts.js --kind=lessons
 *   node src/scripts/import_agent_drafts.js --kind=practice
 *   node src/scripts/import_agent_drafts.js --force
 */

const fs = require('fs');
const path = require('path');
const { Op, Sequelize } = require('sequelize');
const { BACKEND_ROOT, readJson } = require('./import_pipeline/extraction');
const {
  safeText,
  toSlug,
  validateLessonOutput,
  normalizeLessonExercises,
  buildLessonDocument,
  countLessonWords,
  firstLessonExcerpt,
  validatePracticeOutput,
  normalizePracticeOutput,
} = require('./import_pipeline/content_builders');

const DRAFT_ROOT = path.join(BACKEND_ROOT, 'uploads', '_generated-content', 'agent-drafts');

function parseArgs(argv) {
  const args = { dryRun: false, force: false, kind: 'all', course: null };
  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--force') args.force = true;
    else {
      const kind = /^--kind=(lessons|practice|all)$/.exec(arg);
      if (kind) args.kind = kind[1];
      const course = /^--course=(.+)$/.exec(arg);
      if (course) args.course = course[1].trim().toLowerCase();
    }
  }
  return args;
}

function loadEnv() {
  for (const name of ['.env', '.env.development.local', '.env.local', '.env.development']) {
    const envPath = path.join(BACKEND_ROOT, name);
    if (fs.existsSync(envPath)) {
      require('dotenv').config({ path: envPath });
      return;
    }
  }
}

function walkJson(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkJson(full));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) out.push(full);
  }
  return out;
}

function loadDraft(filePath) {
  const payload = readJson(filePath, null);
  if (!payload) throw new Error(`Invalid JSON: ${filePath}`);
  const generated = sanitizeDeep(payload.generated || payload.draft || payload.output || payload);
  const context = sanitizeDeep(payload.context || generated.context || {});
  const kind = payload.kind || generated.kind || (context.lesson_number ? 'lesson' : 'practice');
  const subtype = payload.subtype || generated.subtype || context.subtype || (
    filePath.replace(/\\/g, '/').includes('/past_question/') ? 'past_question' :
      filePath.replace(/\\/g, '/').includes('/quiz/') ? 'quiz' : null
  );
  return { payload, generated, context, kind, subtype };
}

function sanitizeString(value) {
  return String(value || '')
    .split('')
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || code >= 32;
    })
    .join('');
}

function sanitizeDeep(value) {
  if (typeof value === 'string') return sanitizeString(value);
  if (Array.isArray(value)) return value.map(sanitizeDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, sanitizeDeep(entry)])
    );
  }
  return value;
}

function normalizeKeyText(value) {
  return safeText(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function questionSignature(generated) {
  const questions = Array.isArray(generated?.questions) ? generated.questions : [];
  return questions
    .slice(0, 12)
    .map((question) => normalizeKeyText(question.prompt || question.question || question.text).slice(0, 80))
    .filter(Boolean)
    .join('|');
}

function draftDuplicateKey({ generated, context, kind, subtype }) {
  const course = normalizeKeyText(context.course_id || context.course_title || context.course_code || context.course);
  const title = normalizeKeyText(generated.title || context.source_title);
  const year = normalizeKeyText(context.year || generated?.metadata?.year);
  const sourceId = normalizeKeyText(context.source_id);
  if (sourceId) return `${kind}:${subtype || ''}:source:${sourceId}`;
  if (kind === 'lesson') return `${kind}:${course}:lesson:${context.lesson_number || ''}:${title}`;
  return `${kind}:${subtype || ''}:${course}:${year}:${title}:${questionSignature(generated)}`;
}

async function getCreator(db) {
  return db.User.findOne({
    where: { role: { [Op.in]: ['admin', 'contributor', 'lecturer'] } },
    order: [['created_at', 'ASC']],
  });
}

async function ensureContentStats(db, contentId) {
  await db.ContentStats.findOrCreate({
    where: { content_id: contentId },
    defaults: { content_id: contentId, total_views: 0, last_updated: new Date() },
  });
}

async function resolveCourse(db, context) {
  if (context.course_id) {
    const byId = await db.Course.findByPk(context.course_id);
    if (byId) return byId;
  }
  const courseText = safeText(context.course_title || context.course || context.course_code);
  if (!courseText) return null;
  return db.Course.findOne({
    where: {
      [Op.or]: [
        { title: { [Op.iLike]: `%${courseText}%` } },
        { code: { [Op.iLike]: `%${courseText}%` } },
      ],
    },
  });
}

async function importLesson(db, filePath, generated, context, creator, args) {
  const validationErrors = validateLessonOutput(generated);
  if (validationErrors.length) {
    return { status: 'invalid', errors: validationErrors };
  }

  const course = await resolveCourse(db, context);
  if (!course) return { status: 'invalid', errors: ['Could not resolve course.'] };

  // --course filter: skip lessons not matching the requested course code/title
  if (args.course) {
    const normalize = (s) => (s || '').toLowerCase().replace(/[\s\-_]+/g, '');
    const filterVal = normalize(args.course);
    const courseCode = normalize(course.code);
    const courseTitle = normalize(course.title);
    if (!courseCode.includes(filterVal) && !courseTitle.includes(filterVal)) {
      return { status: 'skipped', reason: 'course_filter' };
    }
  }

  const lessonNumber = Number(context.lesson_number || generated.lesson_number || 1);
  const existing = await db.Lesson.findOne({ where: { course_id: course.id, lesson_number: lessonNumber } });
  if (!args.force && existing) return { status: 'skipped', id: existing.id, reason: 'lesson_exists' };

  const lessonDocument = buildLessonDocument(generated, lessonNumber);
  const wordCount = countLessonWords(lessonDocument);
  const durationMinutes = Math.max(6, Math.round(wordCount / 160));
  if (args.dryRun) return { status: 'dry-run', title: generated.title };

  const lessonFields = {
    title: safeText(generated.title),
    description: safeText(generated.description) || firstLessonExcerpt(lessonDocument),
    course_id: course.id,
    lesson_number: lessonNumber,
    status: 'pending',
    is_premium: false,
    creator_id: creator.id,
    depth_level: 'basic',
    tags: [...new Set([...(generated.tags || []), 'lesson', 'agent-generated', 'pdf-import'].map(safeText).filter(Boolean))],
    word_count: wordCount,
    duration_minutes: durationMinutes,
    reading_time: durationMinutes,
    slug: toSlug(course.title, 'lesson', lessonNumber),
    level: context.level || null,
    semester: context.semester || null,
    source: 'agent_generated_from_notes',
    lesson_document: lessonDocument,
    exercises: normalizeLessonExercises(generated.exercises || []),
    objectives: (generated.objectives || []).map(safeText).filter(Boolean),
    metadata: {
      source: 'agent_import',
      source_packet: path.relative(BACKEND_ROOT, filePath).replace(/\\/g, '/'),
      source_note_id: context.source_id || null,
      source_note_title: context.source_title || null,
      source_file_name: context.source_file_name || null,
      source_file_path: context.source_file_path || null,
      source_file_url: context.source_file_url || null,
    },
  };

  let lesson;
  if (args.force && existing) {
    // Always preserve the existing status — never downgrade a published/review lesson to pending
    const existingStatus = existing.status || lessonFields.status;
    const preservedPublishedAt = existing.published_at || (existingStatus === 'published' ? new Date() : null);
    const preservedFields = {
      ...lessonFields,
      status: existingStatus,
      published_at: preservedPublishedAt,
    };
    await existing.update(preservedFields);
    lesson = existing;
  } else {
    lesson = await db.Lesson.create(lessonFields);
  }
  await ensureContentStats(db, lesson.id);
  return { status: 'imported', id: lesson.id };
}

async function importPractice(db, filePath, generated, context, subtype, creator, args) {
  const expectedSubtype = subtype || generated.subtype || 'quiz';
  const validationErrors = validatePracticeOutput(generated, expectedSubtype);
  if (validationErrors.length) {
    return { status: 'invalid', errors: validationErrors };
  }

  const course = await resolveCourse(db, context);
  const normalized = normalizePracticeOutput(generated);
  if (!args.force) {
    const existing = await db.TextItem.findOne({
      where: {
        subtype: expectedSubtype,
        [Op.or]: [
          { title: normalized.title },
          context.source_id
            ? Sequelize.where(
                Sequelize.cast(Sequelize.col('metadata'), 'jsonb'),
                '@>',
                JSON.stringify({ source_resource_id: context.source_id })
              )
            : { title: normalized.title },
        ],
      },
    });
    if (existing) return { status: 'skipped', id: existing.id, reason: 'practice_exists' };
  }

  const durationMinutes = Number(normalized.metadata.time_limit_minutes || normalized.metadata.duration_minutes || 0) ||
    Math.max(expectedSubtype === 'past_question' ? 40 : 15, Math.round(normalized.questions.length * (expectedSubtype === 'past_question' ? 1.25 : 0.75)));
  if (args.dryRun) return { status: 'dry-run', title: normalized.title };

  const item = await db.TextItem.create({
    subtype: expectedSubtype,
    title: normalized.title,
    description: normalized.description,
    body: normalized.description,
    category: expectedSubtype,
    status: 'pending',
    is_premium: false,
    creator_id: creator.id,
    depth_level: expectedSubtype === 'past_question' ? 'enhanced' : 'basic',
    tags: [...new Set([...normalized.tags, expectedSubtype, 'agent-generated', 'pdf-import'].map(safeText).filter(Boolean))],
    word_count: null,
    reading_time: durationMinutes,
    questions: normalized.questions,
    sections: normalized.sections,
    metadata: {
      ...normalized.metadata,
      questions: normalized.questions,
      course: context.course_title || course?.title || null,
      course_title: course?.title || context.course_title || null,
      course_id: course?.id || context.course_id || null,
      course_code: course?.code || context.course_code || null,
      level: context.level || null,
      semester: context.semester || null,
      year: context.year || normalized.metadata.year || null,
      source: 'agent_import',
      source_packet: path.relative(BACKEND_ROOT, filePath).replace(/\\/g, '/'),
      source_resource_id: context.source_id || null,
      source_file_name: context.source_file_name || null,
      source_file_path: context.source_file_path || null,
      source_file_url: context.source_file_url || null,
      time_limit_minutes: durationMinutes,
    },
  });
  await ensureContentStats(db, item.id);
  return { status: 'imported', id: item.id };
}

async function main() {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));
  const db = require('../models');
  await db.sequelize.authenticate();
  const creator = await getCreator(db);
  if (!creator) throw new Error('No admin/contributor/lecturer user found to assign as creator.');

  const files = [
    ...(args.kind === 'all' || args.kind === 'lessons' ? walkJson(path.join(DRAFT_ROOT, 'lessons')) : []),
    ...(args.kind === 'all' || args.kind === 'practice' ? walkJson(path.join(DRAFT_ROOT, 'quiz')) : []),
    ...(args.kind === 'all' || args.kind === 'practice' ? walkJson(path.join(DRAFT_ROOT, 'past_question')) : []),
  ];
  const totals = { files: files.length, imported: 0, skipped: 0, invalid: 0, dryRun: args.dryRun };
  const seenDrafts = new Set();

  for (const filePath of files) {
    const { generated, context, kind, subtype } = loadDraft(filePath);
    const duplicateKey = draftDuplicateKey({ generated, context, kind, subtype });
    if (!args.force && seenDrafts.has(duplicateKey)) {
      totals.skipped += 1;
      console.log(`[skipped] ${path.relative(BACKEND_ROOT, filePath)} duplicate_in_batch`);
      continue;
    }
    seenDrafts.add(duplicateKey);
    const result = kind === 'lesson'
      ? await importLesson(db, filePath, generated, context, creator, args)
      : await importPractice(db, filePath, generated, context, subtype, creator, args);

    if (result.status === 'imported' || result.status === 'dry-run') totals.imported += 1;
    else if (result.status === 'skipped') totals.skipped += 1;
    else totals.invalid += 1;
    console.log(`[${result.status}] ${path.relative(BACKEND_ROOT, filePath)} ${result.id || result.reason || (result.errors || []).join('; ') || ''}`);
  }

  console.log(JSON.stringify(totals, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      const db = require('../models');
      await db.sequelize.close();
    } catch (_) {
      // Ignore shutdown errors.
    }
  });

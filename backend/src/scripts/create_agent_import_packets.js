'use strict';
/**
 * Create no-API work packets for Codex/manual agents.
 *
 * Usage:
 *   node src/scripts/create_agent_import_packets.js --kind=lessons --course="Child Development" --limit=5
 *   node src/scripts/create_agent_import_packets.js --kind=practice --type=quiz --limit=5
 *   node src/scripts/create_agent_import_packets.js --kind=practice --type=past_question --no-ocr
 */

const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const {
  BACKEND_ROOT,
  normalizeText,
  ensureDir,
  extractSourceText,
  writeJson,
} = require('./import_pipeline/extraction');
const { safeText, toSlug } = require('./import_pipeline/content_builders');

const PACKET_ROOT = path.join(BACKEND_ROOT, 'uploads', '_generated-content', 'agent-packets');
const QUIZ_CATEGORIES = new Set(['quiz', 'quiz_internal', 'quiz_external', 'sample_questions']);
const EXAM_CATEGORIES = new Set(['exam', 'past_question', 'past_questions']);

function parseArgs(argv) {
  const args = {
    kind: 'lessons',
    type: '',
    course: '',
    limit: 0,
    ocr: true,
  };

  for (const arg of argv) {
    if (arg === '--no-ocr') args.ocr = false;
    else {
      const kind = /^--kind=(lessons|practice)$/.exec(arg);
      const type = /^--type=(quiz|past_question)$/.exec(arg);
      const course = /^--course=(.+)$/.exec(arg);
      const limit = /^--limit=(\d+)$/.exec(arg);
      if (kind) args.kind = kind[1];
      if (type) args.type = type[1];
      if (course) args.course = course[1].trim();
      if (limit) args.limit = Number.parseInt(limit[1], 10);
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

function inferPracticeSubtype(resource) {
  const category = safeText(resource.category).toLowerCase();
  const name = `${resource.file_name || ''} ${resource.title || ''}`.toLowerCase();
  if (QUIZ_CATEGORIES.has(category) || /\bquiz\b/.test(name)) return 'quiz';
  if (EXAM_CATEGORIES.has(category) || /(past question|end(?:\s+of)?\s+sem|exam|resit|mock)/i.test(name)) return 'past_question';
  return null;
}

function isLikelyNote(resource) {
  const subtype = inferPracticeSubtype(resource);
  return !subtype;
}

function sourceTitle(row, fallback = 'Source') {
  return safeText(row.title || row.file_name || fallback);
}

async function collectLessonSources(db, args) {
  const courseWhere = args.course
    ? {
        [Op.or]: [
          { title: { [Op.iLike]: `%${args.course}%` } },
          { code: { [Op.iLike]: `%${args.course}%` } },
        ],
      }
    : {};
  let courses = await db.Course.findAll({
    where: courseWhere,
    include: [{ model: db.CourseOffering, as: 'offerings', attributes: ['level', 'semester'], required: false }],
    order: [['title', 'ASC']],
  });
  if (args.limit) courses = courses.slice(0, args.limit);

  const packets = [];
  for (const course of courses) {
    const resourceFiles = await db.ResourceFile.findAll({
      where: { course: { [Op.iLike]: `%${course.title}%` } },
      order: [['created_at', 'ASC']],
    });
    const notes = resourceFiles.filter(isLikelyNote)
      .sort((a, b) => sourceTitle(a).localeCompare(sourceTitle(b), undefined, { numeric: true }));
    notes.forEach((note, index) => {
      packets.push({
        kind: 'lesson',
        source: note,
        course,
        lessonNumber: index + 1,
        totalLessons: notes.length,
        nextTitle: notes[index + 1] ? sourceTitle(notes[index + 1]) : null,
        previousTitle: notes[index - 1] ? sourceTitle(notes[index - 1]) : null,
      });
    });
  }

  return args.limit ? packets.slice(0, args.limit) : packets;
}

async function matchCourse(db, resource) {
  const courseText = safeText(resource.course);
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

async function collectPracticeSources(db, args) {
  const where = {};
  const conditions = [];
  if (args.course) {
    conditions.push(
      { course: { [Op.iLike]: `%${args.course}%` } },
      { title: { [Op.iLike]: `%${args.course}%` } },
      { file_name: { [Op.iLike]: `%${args.course}%` } }
    );
  }
  if (args.type === 'past_question') {
    conditions.push(
      { category: { [Op.in]: ['exam', 'past_question', 'past_questions'] } },
      { title: { [Op.iLike]: '%exam%' } },
      { file_name: { [Op.iLike]: '%exam%' } },
      { title: { [Op.iLike]: '%past%' } },
      { file_name: { [Op.iLike]: '%past%' } },
      { title: { [Op.iLike]: '%end%sem%' } },
      { file_name: { [Op.iLike]: '%end%sem%' } }
    );
  }
  if (args.type === 'quiz') {
    conditions.push(
      { category: { [Op.in]: ['quiz', 'quiz_internal', 'quiz_external', 'sample_questions'] } },
      { title: { [Op.iLike]: '%quiz%' } },
      { file_name: { [Op.iLike]: '%quiz%' } }
    );
  }
  if (conditions.length) where[Op.or] = conditions;

  const rows = await db.ResourceFile.findAll({
    where,
    order: [['created_at', 'ASC']],
  });

  const packets = [];
  for (const row of rows) {
    const subtype = inferPracticeSubtype(row);
    if (!subtype || (args.type && args.type !== subtype)) continue;
    packets.push({
      kind: 'practice',
      subtype,
      source: row,
      course: await matchCourse(db, row),
    });
  }

  return args.limit ? packets.slice(0, args.limit) : packets;
}

function lessonInstructions(packet) {
  return [
    'Generate one Learnda lesson JSON from extracted_text.',
    'Lesson 1 opens with a warm course welcome instead of a recap.',
    'Lessons 2-N open with a specific recap of the previous lesson, naming real ideas from it.',
    'Create 3-5 chunks total. Use analogies, rhetorical questions, Ghanaian examples, and clean HTML paragraphs/lists.',
    'Final chunk heading is "What\'s Coming Up" unless this is the last lesson; last lesson heading is "What You\'ve Achieved".',
    'Create 4-6 exercises grounded in the exact lesson content. Allowed types: multiple_choice, true_false, short_answer.',
    'Return JSON with title, description, tags, objectives, chunks, exercises.',
    `Course: ${packet.course.title}. Lesson ${packet.lessonNumber} of ${packet.totalLessons}. Source: ${sourceTitle(packet.source)}.`,
  ];
}

function practiceInstructions(packet) {
  const isQuiz = packet.subtype === 'quiz';
  return [
    `Generate one Learnda ${isQuiz ? 'quiz' : 'past-question exam pack'} JSON from extracted_text.`,
    isQuiz
      ? 'Prefer objective multiple-choice questions with four options and one answer. Mark uncertain answers with needs_review=true.'
      : 'Preserve Section A/Section B, marks, duration, year, and course code where visible. Theory questions use type="theory" with keywords/rubric.',
    'Do not invent unsupported questions.',
    'Return JSON with title, description, tags, metadata, sections, questions.',
    `Source: ${sourceTitle(packet.source)}. Course: ${safeText(packet.course?.title || packet.source.course)}.`,
  ];
}

function draftTemplate(packet) {
  if (packet.kind === 'lesson') {
    return {
      title: '',
      description: '',
      tags: [],
      objectives: [],
      chunks: [
        { heading: '', paragraphs: ['<p></p>'] },
      ],
      exercises: [
        { type: 'multiple_choice', prompt: '', options: ['', '', '', ''], answer: '', explanation: '' },
      ],
    };
  }

  return {
    title: '',
    description: '',
    tags: [],
    metadata: { needs_review: false, review_notes: '' },
    sections: {},
    questions: [
      { type: 'multiple_choice', section: '', prompt: '', options: ['', '', '', ''], answer: '', explanation: '', needs_review: false },
    ],
  };
}

async function writePacket(packet, args) {
  const packetDir = path.join(PACKET_ROOT, packet.kind === 'lesson' ? 'lessons' : packet.subtype);
  ensureDir(packetDir);
  const title = sourceTitle(packet.source);
  const idSuffix = safeText(packet.source.id).slice(0, 8);
  const filePath = path.join(packetDir, `${toSlug(packet.kind, title, idSuffix)}.json`);
  const { text, diagnostics } = await extractSourceText(packet.source, { ocr: args.ocr });
  const payload = {
    packet_version: 1,
    kind: packet.kind,
    subtype: packet.subtype || null,
    status: text ? 'ready' : 'needs_extraction_review',
    instructions: packet.kind === 'lesson' ? lessonInstructions(packet) : practiceInstructions(packet),
    context: {
      course_id: packet.course?.id || null,
      course_title: packet.course?.title || packet.source.course || null,
      course_code: packet.course?.code || null,
      level: packet.source.level || packet.course?.offerings?.[0]?.level || null,
      semester: packet.source.semester || packet.course?.offerings?.[0]?.semester || null,
      year: packet.source.year || null,
      lesson_number: packet.lessonNumber || null,
      total_lessons: packet.totalLessons || null,
      previous_title: packet.previousTitle || null,
      next_title: packet.nextTitle || null,
      source_id: packet.source.id || null,
      source_title: title,
      source_file_name: packet.source.file_name || null,
      source_file_path: packet.source.file_path || null,
      source_file_url: packet.source.file_url || null,
      source_category: packet.source.category || null,
    },
    extraction: diagnostics,
    extracted_text: normalizeText(text),
    draft_output_template: draftTemplate(packet),
  };

  writeJson(filePath, payload);
  return { filePath, status: payload.status, chars: payload.extracted_text.length };
}

async function main() {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));
  const db = require('../models');
  await db.sequelize.authenticate();

  const packets = args.kind === 'lessons'
    ? await collectLessonSources(db, args)
    : await collectPracticeSources(db, args);
  const totals = { packets: packets.length, ready: 0, needsReview: 0 };

  for (const packet of packets) {
    const result = await writePacket(packet, args);
    if (result.status === 'ready') totals.ready += 1;
    else totals.needsReview += 1;
    console.log(`[${result.status}] ${path.relative(BACKEND_ROOT, result.filePath)} (${result.chars} chars)`);
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

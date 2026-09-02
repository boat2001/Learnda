'use strict';
/**
 * Generate draft Learnda lessons from uploaded notes.
 *
 * Usage:
 *   node src/scripts/generate_lessons_from_notes.js --dry-run
 *   node src/scripts/generate_lessons_from_notes.js --course="Child Development"
 *   node src/scripts/generate_lessons_from_notes.js --limit=3
 *   node src/scripts/generate_lessons_from_notes.js --force
 *   node src/scripts/generate_lessons_from_notes.js --no-ocr
 *   node src/scripts/generate_lessons_from_notes.js --save-invalid-drafts
 */

const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const {
  BACKEND_ROOT,
  normalizeText,
  ensureDir,
  writeJson,
  extractSourceText,
  upsertManifestEntry,
  outputTextPathForSource,
} = require('./import_pipeline/extraction');
const { callClaudeJson, DEFAULT_CLAUDE_MODEL } = require('./import_pipeline/claude');
const {
  safeText,
  toSlug,
  validateLessonOutput,
  normalizeLessonExercises,
  buildLessonDocument,
  countLessonWords,
  firstLessonExcerpt,
} = require('./import_pipeline/content_builders');

const MAX_NOTE_CHARS = 60_000;
const API_DELAY_MS = 1_500;
const OUT_ROOT = path.join(BACKEND_ROOT, 'uploads', '_generated-content', 'lessons');
const EXTRACTED_ROOT = path.join(OUT_ROOT, '_extracted-text');
const DIAGNOSTICS_ROOT = path.join(OUT_ROOT, '_diagnostics');
const MANIFEST_PATH = path.join(OUT_ROOT, '_manifest.json');

function parseArgs(argv) {
  const args = {
    dryRun: false,
    force: false,
    course: '',
    limit: 0,
    ocr: true,
    saveInvalidDrafts: false,
  };

  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--force') args.force = true;
    else if (arg === '--no-ocr') args.ocr = false;
    else if (arg === '--save-invalid-drafts') args.saveInvalidDrafts = true;
    else {
      const course = /^--course=(.+)$/.exec(arg);
      const limit = /^--limit=(\d+)$/.exec(arg);
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
      return envPath;
    }
  }
  return null;
}

function buildLessonPrompt({
  course,
  courseTitle,
  courseLevel,
  courseSemester,
  lessonNumber,
  totalLessons,
  noteTitle,
  noteText,
  previousLessonContext,
  nextNoteTitle,
}) {
  const isFirst = lessonNumber === 1;
  const isLast = lessonNumber === totalLessons;
  const openingInstruction = isFirst
    ? `Lesson 1 must open with a warm course welcome instead of a recap. Introduce "${courseTitle}", why it matters, how it connects to the learner's studies, and what students will be able to do by the end of the course.`
    : `Lessons 2-N must open with a specific recap of the previous lesson. Name real ideas from the previous lesson context below and explain how they connect to this lesson. Do not use generic wording.`;
  const closingInstruction = isLast
    ? `The final chunk heading must be exactly "What You've Achieved". It should summarize the important learning from the course and encourage practical application.`
    : `The final chunk heading must be exactly "What's Coming Up". Tease the next lesson "${nextNoteTitle || 'the next lesson'}" by naming one or two specific concepts students will meet.`;

  return `You are an expert educational content designer for Learnda, a learning platform for Ghanaian university students.

Transform the extracted course notes into one structured, engaging Learnda lesson. Do not merely summarize or reformat the source. Build a lesson students can read, understand, and practise with.

COURSE CONTEXT
Course title: ${courseTitle}
Course code: ${safeText(course?.code)}
Level: ${safeText(courseLevel)}
Semester: ${safeText(courseSemester)}
Lesson: ${lessonNumber} of ${totalLessons}
Source note title: ${noteTitle}
Next lesson title: ${nextNoteTitle || 'None - this is the last lesson'}

PREVIOUS LESSON CONTEXT
${previousLessonContext || 'No previous lesson. This is Lesson 1.'}

STRICT LESSON STRUCTURE
1. Opening chunk:
${openingInstruction}

2. Content chunks:
- Create 3 to 5 total chunks, including opening and final chunk.
- Every chunk must have a clear, specific heading.
- Paragraphs must use clean HTML strings: <p>, <strong>, <em>, <ul>, <ol>, and <li> are allowed.
- Use analogies, rhetorical questions, and Ghanaian examples where they fit naturally.
- Write conversationally to the student, not as a textbook index.

3. Final chunk:
${closingInstruction}

4. Exercises:
- Create 4 to 6 exercises grounded in the exact lesson content.
- Allowed types only: "multiple_choice", "true_false", "short_answer".
- multiple_choice must have exactly 4 options and the answer must exactly match one option.
- true_false options must be exactly ["True", "False"].
- short_answer must include a concise model answer in "answer".
- Every exercise must include a teaching explanation.

5. Objectives:
- Create 3 to 4 objectives.
- Start each objective with an action verb such as Explain, Identify, Compare, Apply, Analyse, or Evaluate.

EXTRACTED COURSE NOTES
---
${noteText.slice(0, MAX_NOTE_CHARS)}
---

Return only valid JSON using this exact shape:
{
  "title": "Specific lesson title",
  "description": "Two sentence lesson description.",
  "tags": ["tag1", "tag2", "tag3"],
  "objectives": ["Objective 1", "Objective 2", "Objective 3"],
  "chunks": [
    {
      "heading": "Chunk heading",
      "paragraphs": [
        "<p>HTML paragraph.</p>"
      ]
    }
  ],
  "exercises": [
    {
      "type": "multiple_choice",
      "prompt": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": "Option A",
      "explanation": "Teaching explanation."
    }
  ]
}`;
}

function summarizeGeneratedLesson(generated) {
  const headings = (generated.chunks || []).map((chunk) => safeText(chunk.heading)).filter(Boolean);
  const objectives = Array.isArray(generated.objectives) ? generated.objectives.map(safeText).filter(Boolean) : [];
  return [
    `Previous lesson title: ${safeText(generated.title)}`,
    headings.length ? `Real ideas/chunk headings: ${headings.join('; ')}` : '',
    objectives.length ? `Objectives: ${objectives.join('; ')}` : '',
  ].filter(Boolean).join('\n');
}

function noteKey(note) {
  return safeText(note.id || note.file_path || note.file_url || note.file_name || note.title);
}

function noteTitle(note, fallbackNumber) {
  return safeText(note.title || note.file_name || `Note ${fallbackNumber}`);
}

function isLikelyNote(resource) {
  const category = safeText(resource.category).toLowerCase();
  if (!category) return true;
  if (['past_question', 'past_questions', 'quiz', 'quiz_internal', 'quiz_external', 'sample_questions', 'exam'].includes(category)) {
    return false;
  }
  return !/(quiz|exam|past question|past_questions)/i.test(category);
}

async function ensureContentStats(db, contentId) {
  await db.ContentStats.findOrCreate({
    where: { content_id: contentId },
    defaults: { content_id: contentId, total_views: 0, last_updated: new Date() },
  });
}

async function getCreator(db) {
  return db.User.findOne({
    where: { role: { [Op.in]: ['admin', 'contributor', 'lecturer'] } },
    order: [['created_at', 'ASC']],
  });
}

async function collectNotesForCourse(db, courseTitle) {
  const resourceFiles = await db.ResourceFile.findAll({
    where: { course: { [Op.iLike]: `%${courseTitle}%` } },
    order: [['created_at', 'ASC']],
  });

  const seen = new Set();
  const notes = [];
  for (const note of resourceFiles.filter(isLikelyNote)) {
    const key = noteKey(note);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    notes.push(note);
  }

  notes.sort((a, b) => noteTitle(a, 0).localeCompare(noteTitle(b, 0), undefined, { numeric: true }));
  return notes;
}

async function main() {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));
  const model = process.env.CLAUDE_MODEL || DEFAULT_CLAUDE_MODEL;

  if (!args.dryRun && !process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set.');
  }

  ensureDir(EXTRACTED_ROOT);
  ensureDir(DIAGNOSTICS_ROOT);

  const db = require('../models');
  await db.sequelize.authenticate();

  const creator = await getCreator(db);
  if (!creator) throw new Error('No admin/contributor/lecturer user found to assign as creator.');

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
  if (args.limit > 0) courses = courses.slice(0, args.limit);

  const totals = {
    courses: courses.length,
    processed: 0,
    extracted: 0,
    drafted: 0,
    invalid: 0,
    skipped: 0,
    errors: 0,
    dryRun: args.dryRun,
    model,
  };

  for (const course of courses) {
    const courseTitle = course.title;
    const notes = await collectNotesForCourse(db, courseTitle);
    if (!notes.length) {
      console.log(`[skip] ${courseTitle} - no notes found`);
      totals.skipped += 1;
      continue;
    }

    console.log(`\n[course] ${courseTitle} - ${notes.length} note(s)`);
    const courseLevel = course.offerings?.[0]?.level || null;
    const courseSemester = course.offerings?.[0]?.semester || null;
    const totalLessons = notes.length;
    let previousLessonContext = '';

    for (let index = 0; index < notes.length; index += 1) {
      const note = notes[index];
      const lessonNumber = index + 1;
      const sourceTitle = noteTitle(note, lessonNumber);
      const nextNoteTitle = index < notes.length - 1 ? noteTitle(notes[index + 1], lessonNumber + 1) : null;
      totals.processed += 1;

      if (!args.force) {
        const existing = await db.Lesson.findOne({ where: { course_id: course.id, lesson_number: lessonNumber } });
        if (existing) {
          console.log(`  [skip] Lesson ${lessonNumber} already exists (${existing.id})`);
          previousLessonContext = [
            `Previous lesson title: ${existing.title}`,
            Array.isArray(existing.objectives) && existing.objectives.length ? `Objectives: ${existing.objectives.join('; ')}` : '',
          ].filter(Boolean).join('\n');
          totals.skipped += 1;
          continue;
        }
      }

      const { text, diagnostics } = await extractSourceText(note, { ocr: args.ocr });
      const manifestKey = noteKey(note) || `${course.id}:${lessonNumber}`;
      const outPath = outputTextPathForSource(EXTRACTED_ROOT, note, `lesson-${lessonNumber}`);
      const manifestEntry = {
        ...diagnostics,
        courseId: course.id,
        courseTitle,
        lessonNumber,
        output: path.relative(BACKEND_ROOT, outPath).replace(/\\/g, '/'),
      };

      if (!args.dryRun && text) {
        ensureDir(path.dirname(outPath));
        fs.writeFileSync(outPath, text, 'utf8');
      }
      if (!args.dryRun) upsertManifestEntry(MANIFEST_PATH, manifestKey, manifestEntry);

      if (!text) {
        console.warn(`  [warn] Lesson ${lessonNumber} - no extractable text (${diagnostics.error || diagnostics.status})`);
        totals.errors += 1;
        continue;
      }
      totals.extracted += 1;

      if (args.dryRun) {
        console.log(`  [dry-run] Lesson ${lessonNumber}: "${sourceTitle}" - ${text.length} chars via ${diagnostics.method || 'unknown'}`);
        continue;
      }

      try {
        process.stdout.write(`  [generate] Lesson ${lessonNumber}: ${sourceTitle}... `);
        const prompt = buildLessonPrompt({
          course,
          courseTitle,
          courseLevel,
          courseSemester,
          lessonNumber,
          totalLessons,
          noteTitle: sourceTitle,
          noteText: normalizeText(text),
          previousLessonContext,
          nextNoteTitle,
        });
        const response = await callClaudeJson(prompt, { model, maxTokens: 7000, temperature: 0.45 });
        const generated = response.json;
        const validationErrors = validateLessonOutput(generated);

        if (validationErrors.length && !args.saveInvalidDrafts) {
          const diagPath = path.join(DIAGNOSTICS_ROOT, `${toSlug(courseTitle, lessonNumber, sourceTitle)}.json`);
          writeJson(diagPath, {
            kind: 'lesson_validation_failed',
            courseId: course.id,
            courseTitle,
            lessonNumber,
            sourceTitle,
            validationErrors,
            extraction: diagnostics,
            model: response.model,
            usage: response.usage,
            raw: response.raw,
            parsed: generated,
          });
          console.log('invalid');
          console.warn(`  [invalid] ${validationErrors.join(' ')}`);
          totals.invalid += 1;
          continue;
        }

        const lessonDocument = buildLessonDocument(generated, lessonNumber);
        const wordCount = countLessonWords(lessonDocument);
        const durationMinutes = Math.max(6, Math.round(wordCount / 160));
        const description = safeText(generated.description) || firstLessonExcerpt(lessonDocument);
        const tags = [...new Set([
          ...(Array.isArray(generated.tags) ? generated.tags.map(safeText).filter(Boolean) : []),
          'lesson',
          'ai-generated',
          'pdf-import',
          toSlug(courseTitle).slice(0, 40),
        ])];

        const lesson = await db.Lesson.create({
          title: safeText(generated.title) || sourceTitle,
          description,
          course_id: course.id,
          lesson_number: lessonNumber,
          status: 'draft',
          is_premium: false,
          creator_id: creator.id,
          depth_level: 'basic',
          tags,
          word_count: wordCount,
          duration_minutes: durationMinutes,
          reading_time: durationMinutes,
          slug: toSlug(courseTitle, 'lesson', lessonNumber),
          level: courseLevel,
          semester: courseSemester,
          source: 'ai_generated_from_notes',
          lesson_document: lessonDocument,
          exercises: normalizeLessonExercises(generated.exercises || []),
          objectives: Array.isArray(generated.objectives) ? generated.objectives.map(safeText).filter(Boolean) : [],
          metadata: {
            source: 'pdf_import',
            source_note_id: note.id,
            source_note_title: sourceTitle,
            source_file_name: note.file_name || null,
            source_file_path: note.file_path || null,
            source_file_url: note.file_url || null,
            extraction: diagnostics,
            import_model: response.model,
            import_usage: response.usage,
            validation_errors: validationErrors,
            summary: description,
          },
        });

        await ensureContentStats(db, lesson.id);
        previousLessonContext = summarizeGeneratedLesson(generated);
        console.log(`saved draft ${lesson.id} (${wordCount} words)`);
        totals.drafted += 1;
        await new Promise((resolve) => setTimeout(resolve, API_DELAY_MS));
      } catch (error) {
        process.stdout.write('\n');
        console.error(`  [error] Lesson ${lessonNumber}: ${error.message}`);
        totals.errors += 1;
      }
    }
  }

  console.log('\nSummary');
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

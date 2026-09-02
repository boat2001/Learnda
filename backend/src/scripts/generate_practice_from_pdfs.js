'use strict';
/**
 * Generate draft quizzes and past-question packs from ResourceFile PDFs.
 *
 * Usage:
 *   node src/scripts/generate_practice_from_pdfs.js --dry-run
 *   node src/scripts/generate_practice_from_pdfs.js --type=quiz
 *   node src/scripts/generate_practice_from_pdfs.js --type=past_question
 *   node src/scripts/generate_practice_from_pdfs.js --course="Child Development"
 *   node src/scripts/generate_practice_from_pdfs.js --limit=5
 *   node src/scripts/generate_practice_from_pdfs.js --force
 *   node src/scripts/generate_practice_from_pdfs.js --no-ocr
 */

const fs = require('fs');
const path = require('path');
const { Op, Sequelize } = require('sequelize');
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
  validatePracticeOutput,
  normalizePracticeOutput,
  wordCountFromText,
} = require('./import_pipeline/content_builders');

const MAX_SOURCE_CHARS = 70_000;
const API_DELAY_MS = 1_500;
const OUT_ROOT = path.join(BACKEND_ROOT, 'uploads', '_generated-content', 'practice');
const EXTRACTED_ROOT = path.join(OUT_ROOT, '_extracted-text');
const DIAGNOSTICS_ROOT = path.join(OUT_ROOT, '_diagnostics');
const MANIFEST_PATH = path.join(OUT_ROOT, '_manifest.json');

const QUIZ_CATEGORIES = new Set(['quiz', 'quiz_internal', 'quiz_external', 'sample_questions']);
const EXAM_CATEGORIES = new Set(['exam', 'past_question', 'past_questions']);

function parseArgs(argv) {
  const args = {
    dryRun: false,
    force: false,
    limit: 0,
    course: '',
    type: '',
    ocr: true,
    saveInvalidDrafts: false,
  };

  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--force') args.force = true;
    else if (arg === '--no-ocr') args.ocr = false;
    else if (arg === '--save-invalid-drafts') args.saveInvalidDrafts = true;
    else {
      const limit = /^--limit=(\d+)$/.exec(arg);
      const course = /^--course=(.+)$/.exec(arg);
      const type = /^--type=(quiz|past_question)$/.exec(arg);
      if (limit) args.limit = Number.parseInt(limit[1], 10);
      if (course) args.course = course[1].trim();
      if (type) args.type = type[1];
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

function sourceTitle(resource) {
  return safeText(resource.title || resource.file_name || 'Practice PDF');
}

function buildPracticePrompt({ resource, subtype, course, extractedText }) {
  const isQuiz = subtype === 'quiz';
  const typeLabel = isQuiz ? 'quiz' : 'past-question exam pack';
  const questionPolicy = isQuiz
    ? `Prefer objective multiple-choice questions with four options and one answer. If the answer cannot be confidently inferred from the paper, keep the question but set "needs_review": true.`
    : `Preserve paper structure where visible: Section A, Section B, marks, duration, year, and course code. Objective questions should be auto-gradable multiple_choice items. Theory or essay questions should use type "theory" with keywords or a marking guide for self-review, not strict grading.`;

  return `You are converting an extracted Sharether PDF into a draft ${typeLabel} for Ghanaian university students.

SOURCE CONTEXT
File title: ${sourceTitle(resource)}
File name: ${safeText(resource.file_name)}
Resource category: ${safeText(resource.category)}
Course from resource: ${safeText(resource.course)}
Matched course title: ${safeText(course?.title)}
Matched course code: ${safeText(course?.code)}
Level: ${safeText(resource.level)}
Semester: ${safeText(resource.semester)}
Year: ${safeText(resource.year)}

RULES
- Return only valid JSON.
- Create a title and two-sentence description.
- ${questionPolicy}
- Do not invent questions that are not supported by the extracted text.
- If OCR or extraction looks incomplete, add metadata.needs_review=true and explain why in metadata.review_notes.
- Use type "multiple_choice", "true_false", or "theory" only.
- multiple_choice questions should have exactly 4 options when possible.
- Store section labels such as "Section A" or "Section B" on each question when visible.

EXTRACTED TEXT
---
${normalizeText(extractedText).slice(0, MAX_SOURCE_CHARS)}
---

Return this JSON shape:
{
  "title": "Practice title",
  "description": "Two sentence description.",
  "tags": ["tag1", "tag2"],
  "metadata": {
    "paper_type": "${subtype}",
    "course_code": "${safeText(course?.code)}",
    "year": "${safeText(resource.year)}",
    "time_limit_minutes": 0,
    "needs_review": false,
    "review_notes": ""
  },
  "sections": {
    "A": { "title": "Section A", "instructions": "", "marks": "" }
  },
  "questions": [
    {
      "type": "multiple_choice",
      "section": "Section A",
      "prompt": "Question text?",
      "options": ["A", "B", "C", "D"],
      "answer": "A",
      "explanation": "Why the answer is correct.",
      "topic": "Topic",
      "needs_review": false
    }
  ]
}`;
}

async function getCreator(db) {
  return db.User.findOne({
    where: { role: { [Op.in]: ['admin', 'contributor', 'lecturer'] } },
    order: [['created_at', 'ASC']],
  });
}

async function matchCourse(db, resource) {
  const courseText = safeText(resource.course);
  const fileText = `${resource.title || ''} ${resource.file_name || ''}`;
  const codeMatch = fileText.match(/\b[A-Z]{2,4}\s*\d{3}[A-Z]{0,3}\b/i);
  const code = codeMatch ? codeMatch[0].toUpperCase().replace(/\s+/g, ' ') : '';

  if (code) {
    const byCode = await db.Course.findOne({ where: { code: { [Op.iLike]: `%${code}%` } } });
    if (byCode) return byCode;
  }

  if (courseText) {
    const byTitle = await db.Course.findOne({
      where: {
        [Op.or]: [
          { title: { [Op.iLike]: `%${courseText}%` } },
          { code: { [Op.iLike]: `%${courseText}%` } },
        ],
      },
    });
    if (byTitle) return byTitle;
  }

  return null;
}

async function collectResources(db, args) {
  const where = {};
  if (args.course) {
    where[Op.or] = [
      { course: { [Op.iLike]: `%${args.course}%` } },
      { title: { [Op.iLike]: `%${args.course}%` } },
      { file_name: { [Op.iLike]: `%${args.course}%` } },
    ];
  }

  const rows = await db.ResourceFile.findAll({
    where,
    order: [['created_at', 'ASC']],
    limit: args.limit || undefined,
  });

  return rows
    .map((row) => ({ row, subtype: inferPracticeSubtype(row) }))
    .filter((entry) => entry.subtype && (!args.type || entry.subtype === args.type))
    .slice(0, args.limit || undefined);
}

async function existingImport(db, subtype, resource) {
  const matches = await db.TextItem.findAll({
    where: {
      subtype,
      [Op.or]: [
        { title: sourceTitle(resource) },
        Sequelize.where(
          Sequelize.cast(Sequelize.col('metadata'), 'jsonb'),
          '@>',
          JSON.stringify({ source_resource_id: resource.id })
        ),
      ],
    },
    limit: 1,
  });
  return matches[0] || null;
}

async function ensureContentStats(db, contentId) {
  await db.ContentStats.findOrCreate({
    where: { content_id: contentId },
    defaults: { content_id: contentId, total_views: 0, last_updated: new Date() },
  });
}

function practiceDurationMinutes(normalized, subtype) {
  const explicit = Number(normalized.metadata?.time_limit_minutes || normalized.metadata?.duration_minutes || 0);
  if (Number.isFinite(explicit) && explicit > 0) return Math.round(explicit);
  const perQuestion = subtype === 'past_question' ? 1.25 : 0.75;
  return Math.max(subtype === 'past_question' ? 40 : 15, Math.round(normalized.questions.length * perQuestion));
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

  const resources = await collectResources(db, args);
  const totals = {
    resources: resources.length,
    extracted: 0,
    drafted: 0,
    invalid: 0,
    skipped: 0,
    errors: 0,
    dryRun: args.dryRun,
    model,
  };

  for (const { row: resource, subtype } of resources) {
    const title = sourceTitle(resource);
    const key = `${subtype}:${resource.id || title}`;

    if (!args.force) {
      const existing = await existingImport(db, subtype, resource);
      if (existing) {
        console.log(`[skip] ${title} already imported (${existing.id})`);
        totals.skipped += 1;
        continue;
      }
    }

    const course = await matchCourse(db, resource);
    const { text, diagnostics } = await extractSourceText(resource, { ocr: args.ocr });
    const outPath = outputTextPathForSource(path.join(EXTRACTED_ROOT, subtype), resource, toSlug(subtype, title));
    const manifestEntry = {
      ...diagnostics,
      subtype,
      matchedCourseId: course?.id || null,
      matchedCourseTitle: course?.title || null,
      output: path.relative(BACKEND_ROOT, outPath).replace(/\\/g, '/'),
    };

    if (!args.dryRun && text) {
      ensureDir(path.dirname(outPath));
      fs.writeFileSync(outPath, text, 'utf8');
      upsertManifestEntry(MANIFEST_PATH, key, manifestEntry);
    }

    if (!text) {
      console.warn(`[warn] ${title} - no extractable text (${diagnostics.error || diagnostics.status})`);
      if (!args.dryRun) upsertManifestEntry(MANIFEST_PATH, key, manifestEntry);
      totals.errors += 1;
      continue;
    }
    totals.extracted += 1;

    if (args.dryRun) {
      console.log(`[dry-run] ${subtype}: ${title} - ${text.length} chars via ${diagnostics.method || 'unknown'}`);
      continue;
    }

    try {
      process.stdout.write(`[generate] ${subtype}: ${title}... `);
      const response = await callClaudeJson(
        buildPracticePrompt({ resource, subtype, course, extractedText: text }),
        { model, maxTokens: 7000, temperature: 0.25 }
      );
      const validationErrors = validatePracticeOutput(response.json, subtype);

      if (validationErrors.length && !args.saveInvalidDrafts) {
        const diagPath = path.join(DIAGNOSTICS_ROOT, `${toSlug(subtype, title)}.json`);
        writeJson(diagPath, {
          kind: 'practice_validation_failed',
          subtype,
          sourceResourceId: resource.id,
          sourceTitle: title,
          validationErrors,
          extraction: diagnostics,
          model: response.model,
          usage: response.usage,
          raw: response.raw,
          parsed: response.json,
        });
        console.log('invalid');
        console.warn(`  [invalid] ${validationErrors.join(' ')}`);
        totals.invalid += 1;
        continue;
      }

      const normalized = normalizePracticeOutput(response.json);
      const durationMinutes = practiceDurationMinutes(normalized, subtype);
      const questionsNeedReview = normalized.questions.some((question) => question.needs_review);
      const metadata = {
        ...normalized.metadata,
        questions: normalized.questions,
        course: resource.course || course?.title || null,
        course_title: course?.title || resource.course || null,
        course_id: course?.id || null,
        course_code: course?.code || normalized.metadata.course_code || null,
        level: resource.level || null,
        semester: resource.semester || null,
        year: resource.year || normalized.metadata.year || null,
        source: 'pdf_import',
        source_resource_id: resource.id,
        source_file_name: resource.file_name || null,
        source_file_path: resource.file_path || null,
        source_file_url: resource.file_url || null,
        source_category: resource.category || null,
        extraction: diagnostics,
        import_model: response.model,
        import_usage: response.usage,
        validation_errors: validationErrors,
        needs_review: Boolean(normalized.metadata.needs_review || questionsNeedReview || diagnostics.status !== 'ok'),
        time_limit_minutes: durationMinutes,
      };

      const item = await db.TextItem.create({
        subtype,
        title: normalized.title || title,
        description: normalized.description || `Imported from ${title}.`,
        body: normalized.description || null,
        category: subtype === 'quiz' ? 'quiz' : 'past_question',
        status: 'draft',
        is_premium: false,
        creator_id: creator.id,
        depth_level: subtype === 'past_question' ? 'enhanced' : 'basic',
        tags: [...new Set([
          ...normalized.tags,
          subtype,
          'pdf-import',
          'ai-generated',
          course?.code ? toSlug(course.code) : '',
        ].filter(Boolean))],
        word_count: wordCountFromText(text),
        reading_time: durationMinutes,
        questions: normalized.questions,
        sections: normalized.sections,
        metadata,
      });

      await ensureContentStats(db, item.id);
      console.log(`saved draft ${item.id} (${normalized.questions.length} questions)`);
      totals.drafted += 1;
      await new Promise((resolve) => setTimeout(resolve, API_DELAY_MS));
    } catch (error) {
      process.stdout.write('\n');
      console.error(`[error] ${title}: ${error.message}`);
      totals.errors += 1;
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

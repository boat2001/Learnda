'use strict';
/**
 * generate_practice_from_filesystem.js
 *
 * Companion to generate_practice_from_pdfs.js — this one scans the resources
 * folder directly instead of reading ResourceFile DB records. Use it to catch
 * quiz/exam PDFs that aren't yet registered in the database.
 *
 * Usage:
 *   node src/scripts/generate_practice_from_filesystem.js --dry-run
 *   node src/scripts/generate_practice_from_filesystem.js --type=quiz
 *   node src/scripts/generate_practice_from_filesystem.js --type=past_question
 *   node src/scripts/generate_practice_from_filesystem.js --limit=20
 *   node src/scripts/generate_practice_from_filesystem.js --offset=50 --limit=50
 *   node src/scripts/generate_practice_from_filesystem.js --force
 *   node src/scripts/generate_practice_from_filesystem.js --course="Computer Literacy"
 *   node src/scripts/generate_practice_from_filesystem.js --no-ocr
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
  validatePracticeOutput,
  normalizePracticeOutput,
  wordCountFromText,
} = require('./import_pipeline/content_builders');

const RESOURCES_ROOT = path.join(BACKEND_ROOT, 'uploads', 'resources');
const MAX_SOURCE_CHARS = 70_000;
const API_DELAY_MS = 1_500;
const OUT_ROOT = path.join(BACKEND_ROOT, 'uploads', '_generated-content', 'practice');
const EXTRACTED_ROOT = path.join(OUT_ROOT, '_extracted-text');
const DIAGNOSTICS_ROOT = path.join(OUT_ROOT, '_diagnostics');
const MANIFEST_PATH = path.join(OUT_ROOT, '_manifest.json');

// ── Arg parsing ───────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    dryRun: false,
    force: false,
    limit: 0,
    offset: 0,
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
      const m = (pattern) => pattern.exec(arg);
      const limit = m(/^--limit=(\d+)$/);
      const offset = m(/^--offset=(\d+)$/);
      const course = m(/^--course=(.+)$/);
      const type = m(/^--type=(quiz|past_question)$/);
      if (limit) args.limit = Number.parseInt(limit[1], 10);
      if (offset) args.offset = Number.parseInt(offset[1], 10);
      if (course) args.course = course[1].trim().toLowerCase();
      if (type) args.type = type[1];
    }
  }
  return args;
}

function loadEnv() {
  for (const name of ['.env', '.env.development.local', '.env.local', '.env.development']) {
    const p = path.join(BACKEND_ROOT, name);
    if (fs.existsSync(p)) { require('dotenv').config({ path: p }); return; }
  }
}

// ── File classification ───────────────────────────────────────────────────────

function classifySubtype(filename) {
  const name = filename;
  if (/Internal Quiz/i.test(name)) return 'quiz';
  if (/(External Quiz|Zonal(?:\s+Based)? Quiz)/i.test(name)) return 'quiz';
  if (/(Sample Quiz|Sample Questions?|Obj Questions?|Essay Questions?|Trial Questions?|Answered Questions?)/i.test(name)) return 'quiz';
  if (/\bQuiz\b/i.test(name)) return 'quiz';
  if (/(End.of.Sem|End-of-Sem|Resit|Past Question|Mock Exam)/i.test(name) && !/Sample|Example/i.test(name)) return 'past_question';
  return null;
}

function classifyCategory(filename) {
  if (/Internal Quiz/i.test(filename)) return 'quiz_internal';
  if (/(External Quiz|Zonal(?:\s+Based)? Quiz)/i.test(filename)) return 'quiz_external';
  if (/(Sample Quiz|Sample Questions?)/i.test(filename)) return 'sample_questions';
  if (/\bQuiz\b/i.test(filename)) return 'quiz_internal';
  if (/(End.of.Sem|End-of-Sem|Resit|Past Question|Mock Exam)/i.test(filename)) return 'past_question';
  return 'other';
}

function extractYear(filename) {
  const m = filename.match(/\b(19|20)\d{2}\b/);
  return m ? m[0] : null;
}

function deriveLevelSemester(relPath) {
  const parts = relPath.replace(/\\/g, '/').split('/');
  let level = null;
  let semester = null;
  for (const p of parts) {
    if (/^(100|200|300|400)$/.test(p)) level = p;
    const sm = /^sem-(\d)$/i.exec(p);
    if (sm) semester = sm[1];
  }
  return { level, semester };
}

function cleanTitle(filename) {
  return filename
    .replace(/\s*-\s*Learnda\.com/gi, '')
    .replace(/\.pdf$/i, '')
    .trim();
}

// ── Filesystem scan ───────────────────────────────────────────────────────────

function* walkPdfs(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walkPdfs(full);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) yield full;
  }
}

function collectFiles(args) {
  const all = [];
  for (const fullPath of walkPdfs(RESOURCES_ROOT)) {
    const filename = path.basename(fullPath);
    // Skip "Set 2" duplicates (answer sheets)
    if (/set\s*2/i.test(filename)) continue;

    const subtype = classifySubtype(filename);
    if (!subtype) continue;
    if (args.type && subtype !== args.type) continue;
    if (args.course && !filename.toLowerCase().includes(args.course)) continue;

    all.push({ fullPath, filename, subtype });
  }
  // Sort for deterministic ordering
  all.sort((a, b) => a.fullPath.localeCompare(b.fullPath));
  return all.slice(args.offset, args.limit ? args.offset + args.limit : undefined);
}

// ── Course matching ───────────────────────────────────────────────────────────

async function matchCourse(db, filename, relPath) {
  // Try course code from filename first
  const codeMatch = filename.match(/\b[A-Z]{2,4}\s*\d{3}[A-Z]{0,3}\b/i);
  if (codeMatch) {
    const byCode = await db.Course.findOne({
      where: { code: { [Op.iLike]: `%${codeMatch[0].replace(/\s+/g, ' ')}%` } },
    });
    if (byCode) return byCode;
  }
  // Try title match against the cleaned filename (first segment before year)
  const titlePart = cleanTitle(filename).split(/\s*-\s*/)[0].trim();
  if (titlePart) {
    const byTitle = await db.Course.findOne({
      where: { title: { [Op.iLike]: `%${titlePart}%` } },
    });
    if (byTitle) return byTitle;
  }
  // Try course folder name
  const parts = relPath.replace(/\\/g, '/').split('/');
  const courseFolder = parts[parts.length - 2] || '';
  if (courseFolder) {
    const folderTitle = courseFolder.replace(/-/g, ' ');
    const byFolder = await db.Course.findOne({
      where: { title: { [Op.iLike]: `%${folderTitle}%` } },
    });
    if (byFolder) return byFolder;
  }
  return null;
}

// ── Duplicate check ───────────────────────────────────────────────────────────

async function findExisting(db, subtype, title, filePath) {
  const matches = await db.TextItem.findAll({
    where: {
      subtype,
      [Op.or]: [
        { title },
        {
          metadata: {
            [Op.contains]: { source_file_path: filePath },
          },
        },
      ],
    },
    limit: 1,
  });
  return matches[0] || null;
}

// ── Prompt ────────────────────────────────────────────────────────────────────

function buildPrompt({ title, filename, subtype, course, relPath, extractedText }) {
  const { level, semester } = deriveLevelSemester(relPath);
  const year = extractYear(filename);
  const category = classifyCategory(filename);
  const isQuiz = subtype === 'quiz';
  const typeLabel = isQuiz ? 'quiz' : 'past-question exam pack';
  const questionPolicy = isQuiz
    ? `Prefer objective multiple-choice questions with four options and one answer. If the answer cannot be confidently inferred, keep the question but set "needs_review": true.`
    : `Preserve paper structure: Section A (objective MCQ → multiple_choice), Section B (essay/theory → type "theory" with marking keywords). Include marks where visible.`;

  return `You are converting an extracted Learnda PDF into a draft ${typeLabel} for Ghanaian university students.

SOURCE CONTEXT
File title: ${title}
File name: ${filename}
Resource category: ${category}
Matched course title: ${safeText(course?.title)}
Matched course code: ${safeText(course?.code)}
Level: ${level || ''}
Semester: ${semester || ''}
Year: ${year || ''}

RULES
- Return only valid JSON.
- Create a title and two-sentence description.
- ${questionPolicy}
- Do not invent questions not supported by the extracted text.
- If OCR is incomplete, add metadata.needs_review=true and explain in metadata.review_notes.
- Use type "multiple_choice", "true_false", or "theory" only.
- multiple_choice questions must have exactly 4 options.
- Store section labels ("Section A", "Section B") on each question when visible.

EXTRACTED TEXT
---
${normalizeText(extractedText).slice(0, MAX_SOURCE_CHARS)}
---

Return this JSON shape:
{
  "title": "...",
  "description": "Two sentence description.",
  "tags": ["tag1", "tag2"],
  "metadata": {
    "paper_type": "${subtype}",
    "course_code": "${safeText(course?.code)}",
    "year": "${year || ''}",
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

// ── Stats helper ──────────────────────────────────────────────────────────────

async function ensureContentStats(db, contentId) {
  await db.ContentStats.findOrCreate({
    where: { content_id: contentId },
    defaults: { content_id: contentId, total_views: 0, last_updated: new Date() },
  });
}

function practiceDuration(normalized, subtype) {
  const explicit = Number(normalized.metadata?.time_limit_minutes || 0);
  if (Number.isFinite(explicit) && explicit > 0) return Math.round(explicit);
  const perQ = subtype === 'past_question' ? 1.25 : 0.75;
  return Math.max(subtype === 'past_question' ? 40 : 15, Math.round(normalized.questions.length * perQ));
}

// ── Main ──────────────────────────────────────────────────────────────────────

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
  console.log('DB connected.');

  const creator = await db.User.findOne({
    where: { role: { [Op.in]: ['admin', 'contributor', 'lecturer'] } },
    order: [['created_at', 'ASC']],
  });
  if (!creator) throw new Error('No admin/contributor/lecturer user found.');

  const files = collectFiles(args);
  console.log(`Processing ${files.length} PDF(s)...\n`);

  const totals = { files: files.length, extracted: 0, drafted: 0, invalid: 0, skipped: 0, errors: 0 };

  for (const { fullPath, filename, subtype } of files) {
    const title = cleanTitle(filename);
    const relPath = path.relative(RESOURCES_ROOT, fullPath);
    const key = `${subtype}:${relPath}`;

    if (!args.force) {
      const existing = await findExisting(db, subtype, title, fullPath);
      if (existing) {
        console.log(`[skip] ${title} (${existing.id})`);
        totals.skipped += 1;
        continue;
      }
    }

    const course = await matchCourse(db, filename, relPath);
    const source = { file_path: fullPath, file_name: filename, title };
    const { text, diagnostics } = await extractSourceText(source, { ocr: args.ocr });

    const outPath = outputTextPathForSource(
      path.join(EXTRACTED_ROOT, subtype),
      { file_name: filename, title },
      toSlug(subtype, title),
    );

    if (!args.dryRun && text) {
      ensureDir(path.dirname(outPath));
      fs.writeFileSync(outPath, text, 'utf8');
      upsertManifestEntry(MANIFEST_PATH, key, {
        ...diagnostics,
        subtype,
        matchedCourseId: course?.id || null,
        matchedCourseTitle: course?.title || null,
        output: path.relative(BACKEND_ROOT, outPath).replace(/\\/g, '/'),
      });
    }

    if (!text) {
      console.warn(`[warn] ${title} — no extractable text (${diagnostics.error || diagnostics.status})`);
      totals.errors += 1;
      continue;
    }
    totals.extracted += 1;

    if (args.dryRun) {
      console.log(`[dry-run] ${subtype}: ${title} — ${text.length} chars via ${diagnostics.method || 'unknown'}`);
      continue;
    }

    try {
      process.stdout.write(`[generate] ${subtype}: ${title}... `);
      const response = await callClaudeJson(
        buildPrompt({ title, filename, subtype, course, relPath, extractedText: text }),
        { model, maxTokens: 7000, temperature: 0.25 },
      );

      const validationErrors = validatePracticeOutput(response.json, subtype);
      if (validationErrors.length && !args.saveInvalidDrafts) {
        const diagPath = path.join(DIAGNOSTICS_ROOT, `${toSlug(subtype, title)}.json`);
        writeJson(diagPath, {
          kind: 'practice_validation_failed',
          subtype,
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
      const durationMinutes = practiceDuration(normalized, subtype);
      const questionsNeedReview = normalized.questions.some((q) => q.needs_review);
      const { level, semester } = deriveLevelSemester(relPath);

      const metadata = {
        ...normalized.metadata,
        questions: normalized.questions,
        course: course?.title || null,
        course_title: course?.title || null,
        course_id: course?.id || null,
        course_code: course?.code || normalized.metadata.course_code || null,
        level: level || null,
        semester: semester || null,
        year: extractYear(filename) || normalized.metadata.year || null,
        source: 'filesystem_import',
        source_file_name: filename,
        source_file_path: fullPath,
        source_category: classifyCategory(filename),
        extraction: diagnostics,
        import_model: response.model,
        import_usage: response.usage,
        validation_errors: validationErrors,
        needs_review: Boolean(
          normalized.metadata.needs_review || questionsNeedReview || diagnostics.status !== 'ok',
        ),
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
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(async () => {
    try { const db = require('../models'); await db.sequelize.close(); } catch (_) { /* Best-effort cleanup. */ }
  });

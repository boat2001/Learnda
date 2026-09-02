'use strict';
/**
 * Converts inline math already present in lesson content — written as plain
 * unicode (², −, ±, √, /) — into LaTeX delimited with $...$, so KaTeX (already
 * wired into LessonViewer.jsx) actually typesets it: proper italic variables,
 * a real fraction bar, a real radical — instead of it rendering as flat text.
 * Covers both the lesson_document paragraphs AND the exercises/final_assessment
 * question banks (prompt/options/explanation/correctAnswer), since exercise
 * questions carry the same plain-unicode math and are shown just as often.
 *
 * Scoped to lessons with a meaningful density of math notation (a pre-filter
 * on unicode math-symbol count), and within those, only converts spans it can
 * positively isolate as pure, self-contained math (see
 * lib/math_typesetting_helpers.js for the exact rules) — never partial
 * phrases guessed out of running prose.
 *
 * Fully deterministic (no API, no Math.random).
 *
 * Usage:
 *   node src/scripts/convert_inline_math_to_latex.js --dry-run --show
 *   node src/scripts/convert_inline_math_to_latex.js --dry-run --show --id=<lesson-uuid>
 *   node src/scripts/convert_inline_math_to_latex.js            # full run, all qualifying lessons
 */

require('dotenv').config({ path: '.env.development.local' });
require('dotenv').config({ path: '.env' });

const fs = require('fs');
const path = require('path');
const { Sequelize, QueryTypes } = require('sequelize');
const { convertMathInHtml, convertExerciseArray } = require('./lib/math_typesetting_helpers');

const BACKUP_DIR = path.join(__dirname, '..', '..', 'data', 'inline-math-latex-backups');
const MIN_SYMBOL_HITS = 6; // pre-filter: only touch lessons with real math density

// Raw course outline/notes/marking-scheme dumps are scraped syllabi and
// bibliographies, not narrative teaching prose — their numbered list markers
// ("1.", "2.") and APA citation fragments ("(2015).", "(7th ed).") are bare
// numbers/years, not formulas, and get mistaken for pure math far more easily
// than in real teaching text. Same skip-list used by
// convert_exercises_to_objective.js, for the same reason.
const REFERENCE_DUMP_TITLE = /course outline|course notes|test questions|test your skills|marking scheme|- ms$|sample notes|sample anwsered|special questions|study guide|small note|four skills/i;

// --force bypasses the math-density pre-filter (see below) so an already
// partially-converted lesson can be re-scanned for newly-unlocked
// conversions. That bypass is deliberately restricted to this specific,
// individually-reviewed set of lessons — a hard safety rail against a
// --force run (without --id) sweeping in lessons that were never reviewed
// for this pipeline's false-positive risks, which happened once already.
const FORCE_ALLOWLIST_TITLES = [
  'Coordinate Geometry', 'Differentiation Rules', 'Equations and Inequalities',
  'From Arithmetic to Algebra', 'Inside the Atom', 'Integration: Indefinite',
  'Limits: What a Function', 'Mathematical Proof', 'Mechanics: Motion',
  'Quadratic Expressions', 'Sequences and Series', 'Thermodynamics and Electricity',
  'Algebraic Expressions', 'Increasing/Decreasing Functions',
];

function parseArgs(argv) {
  const args = { dryRun: false, show: false, id: '', force: false };
  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--show') args.show = true;
    // Bypasses the math-density pre-filter — needed when re-running against
    // a lesson this script already partially converted: earlier conversions
    // replace raw unicode symbols with $...$ LaTeX, so the SAME lesson's
    // *remaining* symbol count can legitimately drop below the threshold even
    // though more convertible math is still left in its unconverted text.
    else if (arg === '--force') args.force = true;
    else {
      const m = /^--id=(.+)$/.exec(arg);
      if (m) args.id = m[1];
    }
  }
  return args;
}

function symbolHitCount(lessonDocument) {
  const s = JSON.stringify(lessonDocument || {});
  return (s.match(/[±√²³¹⁴⁵⁶⁷⁸⁹⁰]/g) || []).length;
}

function convertLesson(lesson, { force = false } = {}) {
  const doc = lesson.lesson_document;
  if (!doc || !Array.isArray(doc.chunks)) {
    return { status: 'skipped', reason: 'no lesson_document.chunks' };
  }
  if (REFERENCE_DUMP_TITLE.test(String(lesson.title || ''))) {
    return { status: 'skipped', reason: 'reference-dump title (skipped for quality)' };
  }
  const isForceAllowed = force && FORCE_ALLOWLIST_TITLES.some((t) => String(lesson.title || '').includes(t));
  if (!isForceAllowed && symbolHitCount(doc) < MIN_SYMBOL_HITS) {
    return { status: 'skipped', reason: 'below math-density threshold' };
  }

  let count = 0;
  const nextChunks = doc.chunks.map((chunk) => {
    if (!Array.isArray(chunk.paragraphs)) return chunk;

    const nextParagraphs = chunk.paragraphs.map((paragraph) => {
      const { html, count: n } = convertMathInHtml(paragraph.body_html || '');
      count += n;
      return n > 0 ? { ...paragraph, body_html: html } : paragraph;
    });

    let nextChunkContent = chunk.chunk_content;
    if (chunk.chunk_content && typeof chunk.chunk_content === 'object') {
      nextChunkContent = { ...chunk.chunk_content };
      for (const paragraph of nextParagraphs) {
        if (nextChunkContent[paragraph.id]) {
          nextChunkContent[paragraph.id] = { ...nextChunkContent[paragraph.id], body_html: paragraph.body_html };
        }
      }
    }

    return { ...chunk, paragraphs: nextParagraphs, chunk_content: nextChunkContent };
  });

  const exercisesResult = convertExerciseArray(lesson.exercises);
  count += exercisesResult.count;
  const finalAssessmentResult = convertExerciseArray(lesson.final_assessment);
  count += finalAssessmentResult.count;

  if (count === 0) return { status: 'skipped', reason: 'no convertible spans found' };

  return {
    status: 'converted',
    count,
    lessonDocument: { ...doc, chunks: nextChunks },
    exercises: exercisesResult.exercises,
    finalAssessment: finalAssessmentResult.exercises,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is not set.');

  const sequelize = new Sequelize(databaseUrl, { dialect: 'postgres', logging: false });

  const where = [];
  const repl = {};
  if (args.id) { where.push('id = :id'); repl.id = args.id; }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const lessons = await sequelize.query(
    `SELECT id, title, lesson_document, exercises, final_assessment FROM lessons ${whereSql} ORDER BY title`,
    { type: QueryTypes.SELECT, replacements: repl }
  );

  console.log(`Lessons scanned: ${lessons.length}${args.dryRun ? '  (DRY RUN — no writes)' : ''}\n`);

  if (!args.dryRun) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `lesson-documents-backup-${stamp}.json`);
    fs.writeFileSync(
      backupPath,
      JSON.stringify(
        lessons.map((l) => ({
          id: l.id,
          title: l.title,
          lesson_document: l.lesson_document,
          exercises: l.exercises,
          final_assessment: l.final_assessment,
        })),
        null,
        2
      )
    );
    console.log(`Backup written: ${backupPath}\n`);
  }

  const totals = { converted: 0, skipped: 0, spansConverted: 0 };

  for (let i = 0; i < lessons.length; i += 1) {
    const lesson = lessons[i];
    const out = convertLesson(lesson, { force: args.force });
    if (out.status !== 'converted') {
      totals.skipped += 1;
      continue;
    }

    if (!args.dryRun) {
      await sequelize.query(
        `UPDATE lessons SET lesson_document = :doc, exercises = :ex, final_assessment = :fa, updated_at = now() WHERE id = :id`,
        {
          replacements: {
            doc: JSON.stringify(out.lessonDocument),
            ex: JSON.stringify(out.exercises),
            fa: JSON.stringify(out.finalAssessment),
            id: lesson.id,
          },
        }
      );
    }

    totals.converted += 1;
    totals.spansConverted += out.count;
    console.log(`[${i + 1}/${lessons.length}] converted ${lesson.title.slice(0, 55).padEnd(55)} spans converted=${out.count}`);

    if (args.show) {
      out.lessonDocument.chunks.forEach((chunk, ci) => {
        (chunk.paragraphs || []).forEach((p, pi) => {
          if (p.body_html && p.body_html.includes('$')) {
            console.log(`      chunk ${ci} par ${pi}: ${p.body_html}`);
          }
        });
      });
      (out.exercises || []).forEach((e, ei) => {
        if (e && JSON.stringify(e).includes('$')) {
          console.log(`      exercise ${ei}: ${JSON.stringify(e)}`);
        }
      });
      (out.finalAssessment || []).forEach((e, ei) => {
        if (e && JSON.stringify(e).includes('$')) {
          console.log(`      final_assessment ${ei}: ${JSON.stringify(e)}`);
        }
      });
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`lessons converted: ${totals.converted}   skipped: ${totals.skipped}`);
  console.log(`total math spans converted to LaTeX: ${totals.spansConverted}`);

  await sequelize.close();
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { convertLesson };

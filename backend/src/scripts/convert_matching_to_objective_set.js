'use strict';
/**
 * One-time migration: converts every existing per-chunk 'matching' exercise
 * (a two-column term/definition matching UI) into 'objective_set' — a series
 * of standalone multiple-choice questions answered one at a time. Matching
 * required scanning two separately-scrolling lists to find a pair, which
 * doesn't work well on the small screens most of Sharether's users are on;
 * objective_set reuses the same battle-tested single-question MC UI already
 * used everywhere else in the lesson flow.
 *
 * No pairs are discarded — every term/definition pair becomes its own MC
 * question, so a chunk that had several pairs simply gets several questions
 * presented one at a time within the same exercise slot (see
 * frontend/src/pages/learn/LessonViewer.jsx objective_set handling).
 *
 * Distractors for each question are pulled from sibling pairs in the same
 * exercise first, then from other matching exercises in the same lesson.
 *
 * Fully deterministic (no API, no Math.random) — see buildObjectiveSetFromPairs
 * in lib/lesson_text_helpers.js.
 *
 * Usage:
 *   node src/scripts/convert_matching_to_objective_set.js --dry-run
 *   node src/scripts/convert_matching_to_objective_set.js --dry-run --show --limit=5
 *   node src/scripts/convert_matching_to_objective_set.js --id=<lesson-uuid>
 *   node src/scripts/convert_matching_to_objective_set.js            # full run, all lessons
 */

require('dotenv').config({ path: '.env.development.local' });
require('dotenv').config({ path: '.env' });

const fs = require('fs');
const path = require('path');
const { Sequelize, QueryTypes } = require('sequelize');
const { extractSubstantiveChunks, buildObjectiveSetFromPairs } = require('./lib/lesson_text_helpers');

const BACKUP_DIR = path.join(__dirname, '..', '..', 'data', 'matching-to-objective-set-backups');

function parseArgs(argv) {
  const args = { dryRun: false, show: false, limit: 0, id: '' };
  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--show') args.show = true;
    else {
      let m;
      if ((m = /^--limit=(\d+)$/.exec(arg))) args.limit = Number(m[1]);
      else if ((m = /^--id=(.+)$/.exec(arg))) args.id = m[1];
    }
  }
  return args;
}

function convertLesson(lesson) {
  const exercises = Array.isArray(lesson.exercises) ? lesson.exercises : [];
  const matchingIndexes = exercises
    .map((ex, i) => (ex?.type === 'matching' ? i : -1))
    .filter((i) => i >= 0);

  if (matchingIndexes.length === 0) {
    return { status: 'skipped', reason: 'no matching exercises' };
  }

  const chunks = extractSubstantiveChunks(lesson.lesson_document);
  if (chunks.length !== exercises.length) {
    return { status: 'skipped', reason: `chunk/exercise count mismatch (chunks=${chunks.length}, exercises=${exercises.length})` };
  }

  // Pool every definition from every matching exercise in this lesson, so a
  // small (3-pair) matching exercise can still borrow plausible distractors
  // from OTHER matching exercises elsewhere in the same lesson.
  const lessonWideDefinitions = matchingIndexes.flatMap((i) =>
    (exercises[i].pairs || []).map((pair) => pair.definition)
  );

  let converted = 0;
  const nextExercises = exercises.map((ex, i) => {
    if (ex?.type !== 'matching') return ex;
    const pairs = Array.isArray(ex.pairs) ? ex.pairs : [];
    if (pairs.length === 0) return ex; // nothing to convert, leave as-is (shouldn't happen)
    converted += 1;
    const extraPool = lessonWideDefinitions.filter(
      (def) => !pairs.some((pair) => pair.definition === def)
    );
    return buildObjectiveSetFromPairs(pairs, chunks[i], extraPool);
  });

  const withIds = nextExercises.map((e, i) => (e ? { id: `exercise-${i + 1}`, ...e } : null));

  return { status: 'converted', converted, exercises: withIds };
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
  const limitSql = args.limit ? `LIMIT ${args.limit}` : '';

  const lessons = await sequelize.query(
    `SELECT id, title, lesson_document, exercises FROM lessons ${whereSql} ORDER BY title ${limitSql}`,
    { type: QueryTypes.SELECT, replacements: repl }
  );

  console.log(`Lessons scanned: ${lessons.length}${args.dryRun ? '  (DRY RUN — no writes)' : ''}\n`);

  if (!args.dryRun) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `exercises-backup-${stamp}.json`);
    fs.writeFileSync(
      backupPath,
      JSON.stringify(lessons.map((l) => ({ id: l.id, title: l.title, exercises: l.exercises })), null, 2)
    );
    console.log(`Backup written: ${backupPath}\n`);
  }

  const totals = { converted: 0, skipped: 0, questionsCreated: 0 };

  for (let i = 0; i < lessons.length; i += 1) {
    const lesson = lessons[i];
    const out = convertLesson(lesson);
    if (out.status !== 'converted') {
      totals.skipped += 1;
      continue;
    }

    if (!args.dryRun) {
      await sequelize.query(
        `UPDATE lessons SET exercises = :ex, updated_at = now() WHERE id = :id`,
        { replacements: { ex: JSON.stringify(out.exercises), id: lesson.id } }
      );
    }

    const questionsCreated = out.exercises
      .filter((e) => e?.type === 'objective_set')
      .reduce((sum, e) => sum + (e.questions?.length || 0), 0);
    totals.converted += 1;
    totals.questionsCreated += questionsCreated;
    console.log(
      `[${i + 1}/${lessons.length}] converted ${lesson.title.slice(0, 45).padEnd(45)} matching exercises converted=${out.converted} questions created=${questionsCreated}`
    );

    if (args.show) {
      out.exercises.forEach((e, idx) => {
        if (e?.type !== 'objective_set') return;
        console.log(`      chunk ${idx}: ${e.questions.length} questions`);
        e.questions.forEach((q, qi) => console.log(`        ${qi + 1}. ${q.prompt} -> ${q.correctAnswer}`));
      });
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`lessons converted: ${totals.converted}   skipped (no matching found): ${totals.skipped}`);
  console.log(`total objective_set questions created: ${totals.questionsCreated}`);

  await sequelize.close();
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { convertLesson };

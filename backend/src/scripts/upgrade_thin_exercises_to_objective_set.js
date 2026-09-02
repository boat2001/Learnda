'use strict';
/**
 * One-time migration: upgrades existing single-question per-chunk exercises
 * (multiple_choice/true_false) to a multi-question 'objective_set' — still
 * answered one at a time, never all at once — whenever the chunk's own text
 * supports two or three distinct, independently-testable facts (capped at 3).
 * A chunk that only yields one fact (or none) is left as a single question;
 * nothing is invented that isn't in the text.
 *
 * This is the "existing content" counterpart to the same upgrade path now
 * built into convert_exercises_to_objective.js's tryUpgradeExercise, so newly
 * authored lessons get this automatically and already-converted lessons get
 * it via this script.
 *
 * Fully deterministic (no API, no Math.random) — see buildObjectiveSetFromFacts
 * in lib/lesson_text_helpers.js.
 *
 * Usage:
 *   node src/scripts/upgrade_thin_exercises_to_objective_set.js --dry-run
 *   node src/scripts/upgrade_thin_exercises_to_objective_set.js --dry-run --show --limit=5
 *   node src/scripts/upgrade_thin_exercises_to_objective_set.js --id=<lesson-uuid>
 *   node src/scripts/upgrade_thin_exercises_to_objective_set.js            # full run, all lessons
 */

require('dotenv').config({ path: '.env.development.local' });
require('dotenv').config({ path: '.env' });

const fs = require('fs');
const path = require('path');
const { Sequelize, QueryTypes } = require('sequelize');
const {
  safeText,
  extractSubstantiveChunks,
  pickDeclarativeSentence,
  pickDeclarativeSentences,
  buildObjectiveSetFromFacts,
} = require('./lib/lesson_text_helpers');

const BACKUP_DIR = path.join(__dirname, '..', '..', 'data', 'thin-exercise-upgrade-backups');
const UPGRADABLE_TYPES = new Set(['multiple_choice', 'true_false']);

// Same conservative skip-list used by convert_exercises_to_objective.js — raw
// course outline/notes/marking-scheme dumps aren't narrative teaching prose,
// so declarative-sentence extraction from them is unreliable.
const REFERENCE_DUMP_TITLE = /course outline|course notes|test questions|test your skills|marking scheme|- ms$|sample notes|sample anwsered|special questions|study guide|small note|four skills/i;

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
  const chunks = extractSubstantiveChunks(lesson.lesson_document);
  if (chunks.length === 0 || exercises.length !== chunks.length) {
    return { status: 'skipped', reason: `chunk/exercise count mismatch (chunks=${chunks.length}, exercises=${exercises.length})` };
  }
  if (REFERENCE_DUMP_TITLE.test(safeText(lesson.title))) {
    return { status: 'skipped', reason: 'reference-dump title (skipped for quality)' };
  }

  let upgraded = 0;
  const nextExercises = exercises.map((ex, i) => {
    if (!ex || !UPGRADABLE_TYPES.has(safeText(ex.type))) return ex;
    const chunk = chunks[i];
    const facts = pickDeclarativeSentences(chunk.text, { allowPronouns: false, count: 3 });
    if (facts.length < 2) return ex;

    const otherChunkFacts = chunks
      .filter((c) => c.heading !== chunk.heading)
      .map((c) => pickDeclarativeSentence(c.text, { allowPronouns: false }))
      .filter(Boolean);

    upgraded += 1;
    return buildObjectiveSetFromFacts(facts, chunk, otherChunkFacts);
  });

  if (upgraded === 0) {
    return { status: 'skipped', reason: 'no chunk had >=2 distinct facts' };
  }

  const withIds = nextExercises.map((e, i) => (e ? { id: `exercise-${i + 1}`, ...e } : null));
  return { status: 'converted', upgraded, exercises: withIds };
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

  const totals = { converted: 0, skipped: 0, chunksUpgraded: 0, questionsCreated: 0 };

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
    totals.chunksUpgraded += out.upgraded;
    totals.questionsCreated += questionsCreated;
    console.log(
      `[${i + 1}/${lessons.length}] converted ${lesson.title.slice(0, 45).padEnd(45)} chunks upgraded=${out.upgraded} total objective_set questions in lesson=${questionsCreated}`
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
  console.log(`lessons converted: ${totals.converted}   skipped: ${totals.skipped}`);
  console.log(`chunks upgraded to objective_set: ${totals.chunksUpgraded}   total questions created: ${totals.questionsCreated}`);

  await sequelize.close();
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { convertLesson };

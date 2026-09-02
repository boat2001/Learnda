'use strict';
/**
 * One-time cleanup: trims every existing 'objective_set' exercise down to at
 * most 3 questions. The original matching-to-objective_set migration allowed
 * up to 5 (inherited from the old matching-pairs cap); the cap was tightened
 * to 3 afterward — beyond that, "one at a time" stops feeling like a single
 * exercise and starts feeling like a quiz. Only trims (keeps the first 3,
 * already the ones closest to the chunk's primary content); never invents or
 * reorders.
 *
 * Usage:
 *   node src/scripts/cap_objective_set_questions.js --dry-run
 *   node src/scripts/cap_objective_set_questions.js            # full run, all lessons
 */

require('dotenv').config({ path: '.env.development.local' });
require('dotenv').config({ path: '.env' });

const fs = require('fs');
const path = require('path');
const { Sequelize, QueryTypes } = require('sequelize');

const BACKUP_DIR = path.join(__dirname, '..', '..', 'data', 'objective-set-cap-backups');
const MAX_QUESTIONS = 3;

function parseArgs(argv) {
  const args = { dryRun: false };
  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true;
  }
  return args;
}

function capLesson(lesson) {
  const exercises = Array.isArray(lesson.exercises) ? lesson.exercises : [];
  let trimmed = 0;

  const nextExercises = exercises.map((ex) => {
    if (ex?.type !== 'objective_set' || !Array.isArray(ex.questions) || ex.questions.length <= MAX_QUESTIONS) {
      return ex;
    }
    trimmed += 1;
    return { ...ex, questions: ex.questions.slice(0, MAX_QUESTIONS) };
  });

  if (trimmed === 0) return { status: 'skipped' };
  return { status: 'converted', trimmed, exercises: nextExercises };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is not set.');

  const sequelize = new Sequelize(databaseUrl, { dialect: 'postgres', logging: false });

  const lessons = await sequelize.query(
    `SELECT id, title, exercises FROM lessons`,
    { type: QueryTypes.SELECT }
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

  const totals = { converted: 0, skipped: 0, exercisesTrimmed: 0 };

  for (let i = 0; i < lessons.length; i += 1) {
    const lesson = lessons[i];
    const out = capLesson(lesson);
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

    totals.converted += 1;
    totals.exercisesTrimmed += out.trimmed;
    console.log(`[${i + 1}/${lessons.length}] trimmed ${lesson.title.slice(0, 55).padEnd(55)} exercises trimmed=${out.trimmed}`);
  }

  console.log(`\n=== Summary ===`);
  console.log(`lessons touched: ${totals.converted}   untouched: ${totals.skipped}`);
  console.log(`total exercises trimmed to <= ${MAX_QUESTIONS} questions: ${totals.exercisesTrimmed}`);

  await sequelize.close();
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { capLesson };

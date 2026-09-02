'use strict';
/**
 * Rewrite em-dash (—) usage in lesson content into punctuation a human writer
 * would actually use (see lib/humanize_text.js for the rules). Touches every
 * user-facing text field: title, description, lesson_document (chunk
 * headings + paragraph body_html), exercises, final_assessment, objectives.
 * `metadata` is left untouched (technical, not shown to learners).
 *
 * Usage:
 *   node src/scripts/humanize_lesson_em_dashes.js --dry-run --show --limit=5
 *   node src/scripts/humanize_lesson_em_dashes.js --dry-run --id=<lesson-uuid> --show
 *   node src/scripts/humanize_lesson_em_dashes.js --course="Algebraic Thinking"
 *   node src/scripts/humanize_lesson_em_dashes.js            # full run, all lessons
 */

require('dotenv').config({ path: '.env.development.local' });
require('dotenv').config({ path: '.env' });

const fs = require('fs');
const path = require('path');
const { Sequelize, QueryTypes } = require('sequelize');
const { humanizeEmDashes, humanizeDeep } = require('./lib/humanize_text');

const BACKUP_DIR = path.join(__dirname, '..', '..', 'data', 'lesson-humanize-backups');
const TEXT_FIELDS = ['lesson_document', 'exercises', 'final_assessment', 'objectives'];

function parseArgs(argv) {
  const args = { dryRun: false, show: false, limit: 0, course: '', id: '' };
  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--show') args.show = true;
    else {
      let m;
      if ((m = /^--limit=(\d+)$/.exec(arg))) args.limit = Number(m[1]);
      else if ((m = /^--course=(.+)$/.exec(arg))) args.course = m[1].replace(/^["']|["']$/g, '');
      else if ((m = /^--id=(.+)$/.exec(arg))) args.id = m[1];
    }
  }
  return args;
}

function countDashes(value) {
  if (typeof value === 'string') return (value.match(/—/g) || []).length;
  if (Array.isArray(value)) return value.reduce((sum, v) => sum + countDashes(v), 0);
  if (value && typeof value === 'object') {
    return Object.values(value).reduce((sum, v) => sum + countDashes(v), 0);
  }
  return 0;
}

function humanizeLesson(lesson) {
  const before = {
    title: lesson.title,
    description: lesson.description,
    ...Object.fromEntries(TEXT_FIELDS.map((f) => [f, lesson[f]])),
  };
  const dashesBefore = countDashes(before);
  if (dashesBefore === 0) return { status: 'skipped', reason: 'no em-dash' };

  const after = {
    title: humanizeEmDashes(lesson.title),
    description: humanizeEmDashes(lesson.description),
  };
  for (const field of TEXT_FIELDS) after[field] = humanizeDeep(lesson[field]);

  return { status: 'humanized', before, after, dashesBefore, dashesAfter: countDashes(after) };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is not set.');

  const sequelize = new Sequelize(databaseUrl, { dialect: 'postgres', logging: false });

  const where = [];
  const repl = {};
  if (args.id) { where.push('id = :id'); repl.id = args.id; }
  if (args.course) {
    where.push("(title ILIKE :course OR metadata->>'course' ILIKE :course OR metadata->>'course_title' ILIKE :course)");
    repl.course = `%${args.course}%`;
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limitSql = args.limit ? `LIMIT ${args.limit}` : '';

  const lessons = await sequelize.query(
    `SELECT id, title, description, lesson_document, exercises, final_assessment, objectives, metadata
     FROM lessons ${whereSql} ORDER BY title ${limitSql}`,
    { type: QueryTypes.SELECT, replacements: repl }
  );

  console.log(`Lessons matched: ${lessons.length}${args.dryRun ? '  (DRY RUN — no writes)' : ''}\n`);

  if (!args.dryRun) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `humanize-backup-${stamp}.json`);
    fs.writeFileSync(
      backupPath,
      JSON.stringify(
        lessons.map((l) => ({
          id: l.id,
          title: l.title,
          description: l.description,
          lesson_document: l.lesson_document,
          exercises: l.exercises,
          final_assessment: l.final_assessment,
          objectives: l.objectives,
        })),
        null,
        2
      )
    );
    console.log(`Backup written: ${backupPath}\n`);
  }

  const totals = { humanized: 0, skipped: 0, dashesRemoved: 0 };

  for (let i = 0; i < lessons.length; i += 1) {
    const lesson = lessons[i];
    const out = humanizeLesson(lesson);

    if (out.status !== 'humanized') {
      totals.skipped += 1;
      continue;
    }

    if (!args.dryRun) {
      await sequelize.query(
        `UPDATE lessons SET title = :title, description = :description, lesson_document = :ld,
         exercises = :ex, final_assessment = :fa, objectives = :obj, updated_at = now() WHERE id = :id`,
        {
          replacements: {
            id: lesson.id,
            title: out.after.title,
            description: out.after.description,
            ld: JSON.stringify(out.after.lesson_document),
            ex: JSON.stringify(out.after.exercises),
            fa: JSON.stringify(out.after.final_assessment),
            obj: JSON.stringify(out.after.objectives),
          },
        }
      );
    }

    totals.humanized += 1;
    totals.dashesRemoved += out.dashesBefore - out.dashesAfter;
    console.log(
      `[${i + 1}/${lessons.length}] ✅ ${lesson.title.slice(0, 55).padEnd(55)} em-dashes ${out.dashesBefore} -> ${out.dashesAfter}`
    );

    if (args.show) {
      const beforeStr = JSON.stringify(out.before.lesson_document);
      const afterStr = JSON.stringify(out.after.lesson_document);
      let idx = 0;
      let shown = 0;
      while (shown < 3) {
        idx = beforeStr.indexOf('—', idx);
        if (idx === -1) break;
        console.log(`      BEFORE: ...${beforeStr.slice(Math.max(0, idx - 60), idx + 60)}...`);
        idx += 1;
        shown += 1;
      }
      console.log(`      AFTER (still has em-dash?): ${afterStr.includes('—')}`);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`lessons humanized: ${totals.humanized}   skipped (no em-dash): ${totals.skipped}`);
  console.log(`total em-dashes removed: ${totals.dashesRemoved}`);

  await sequelize.close();
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { humanizeLesson };

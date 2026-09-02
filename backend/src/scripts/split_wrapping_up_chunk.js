'use strict';
/**
 * Rename the "What's Coming Up" bookend chunk to "Wrapping Up" and split its
 * content into two labelled sub-sections within that SAME chunk (one page in
 * the lesson flow, not two separate chunks):
 *   "Lesson Summary"   — recap of the current lesson
 *   "Coming Up Next"   — preview of the next lesson
 * ("What You've Achieved" chunks — used on a course's final lesson, where
 * there is no next lesson to preview — are a different, single-purpose
 * bookend and are left untouched; the two never co-occur in one lesson.)
 *
 * The split point:
 *   - 2 paragraphs already present -> paragraph 0 = summary, paragraph 1 = coming up.
 *   - 1 paragraph (the common case) -> sentence-split, find the first sentence
 *     that names the next lesson ("Lesson 5", "In our next/final lesson",
 *     "Next, you will move into ..."); everything before it is the summary,
 *     that sentence onward is "coming up next". If the trigger is the very
 *     first sentence (no real recap text exists — mostly raw course-outline
 *     lessons), the "Lesson Summary" section is omitted rather than shown empty.
 *
 * The original `paragraphs` array is left untouched (other tooling — the
 * exercise-alignment/matching scripts — reads plain chunk text from it and
 * doesn't need to know about sub-sections); a new `sections` array is added
 * alongside it purely for the frontend's sub-headed rendering.
 *
 * Usage:
 *   node src/scripts/split_wrapping_up_chunk.js --dry-run --show --limit=10
 *   node src/scripts/split_wrapping_up_chunk.js            # full run, all lessons
 */

require('dotenv').config({ path: '.env.development.local' });
require('dotenv').config({ path: '.env' });

const fs = require('fs');
const path = require('path');
const { Sequelize, QueryTypes } = require('sequelize');
const { splitSentences, safeText } = require('./lib/lesson_text_helpers');

const BACKUP_DIR = path.join(__dirname, '..', '..', 'data', 'wrapping-up-split-backups');
const COMING_UP_HEADING = /what'?s coming up/i;
const NEW_TITLE = 'Wrapping Up';
const NEW_EMOJI = '🎬';
const NEXT_LESSON_TRIGGER = /\b(lesson\s+\d+|next,?\s+you\s+will\s+move\s+into|in\s+our\s+(final|next)\s+lesson)/i;

function parseArgs(argv) {
  const args = { dryRun: false, show: false, limit: 0 };
  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--show') args.show = true;
    else {
      const m = /^--limit=(\d+)$/.exec(arg);
      if (m) args.limit = Number(m[1]);
    }
  }
  return args;
}

const stripHtml = (v) => String(v ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

function wrapParagraph(id, text) {
  return { id, body_html: `<p>${safeText(text)}</p>` };
}

/**
 * Returns { summaryParagraphs, comingUpParagraphs } — summaryParagraphs may
 * be empty (chunk has no real recap text before the next-lesson mention).
 */
function splitChunkContent(paragraphs) {
  const texts = paragraphs.map((p) => stripHtml(p?.body_html || p?.bodyHtml || p?.html || p?.content || p?.text || ''));

  if (texts.length >= 2) {
    return {
      summaryParagraphs: [wrapParagraph('summary_0', texts[0])],
      comingUpParagraphs: texts.slice(1).map((t, i) => wrapParagraph(`coming_up_${i}`, t)),
    };
  }

  const sentences = splitSentences(texts[0] || '');
  const triggerIdx = sentences.findIndex((s) => NEXT_LESSON_TRIGGER.test(s));
  const splitAt = triggerIdx === -1 ? sentences.length : triggerIdx; // no trigger (shouldn't happen; verified 0 misses) -> treat it all as summary

  const summaryText = sentences.slice(0, splitAt).join(' ').trim();
  const comingUpText = sentences.slice(splitAt).join(' ').trim();

  return {
    summaryParagraphs: summaryText ? [wrapParagraph('summary_0', summaryText)] : [],
    comingUpParagraphs: comingUpText ? [wrapParagraph('coming_up_0', comingUpText)] : [],
  };
}

function renameHeadingText(heading) {
  const h = safeText(heading);
  // Replace the "What's Coming Up" phrase and swap its emoji, preserving any
  // OTHER trailing emoji that might already sit alongside it (defensive; in
  // practice each heading carries exactly the one bookend emoji).
  const withoutEmoji = h.replace(/\p{Extended_Pictographic}|\p{Regional_Indicator}/gu, '').trim();
  const renamedBase = withoutEmoji.replace(COMING_UP_HEADING, NEW_TITLE);
  return `${renamedBase} ${NEW_EMOJI}`.trim();
}

function convertLesson(lesson) {
  const doc = lesson.lesson_document || {};
  const rawChunks = Array.isArray(doc.chunks)
    ? doc.chunks
    : Object.entries(doc.chunks || {}).map(([id, c]) => ({ id, ...(c || {}) }));

  const targetIndex = rawChunks.findIndex((c) => COMING_UP_HEADING.test(c?.heading || c?.chunk_head || ''));
  if (targetIndex === -1) return { status: 'skipped', reason: 'no "coming up" chunk' };

  const target = rawChunks[targetIndex];
  const paragraphs = Array.isArray(target.paragraphs) ? target.paragraphs : [];
  if (paragraphs.length === 0) return { status: 'skipped', reason: 'coming-up chunk has no paragraphs' };

  const { summaryParagraphs, comingUpParagraphs } = splitChunkContent(paragraphs);
  const sections = [];
  if (summaryParagraphs.length) sections.push({ id: 'summary', title: 'Lesson Summary', paragraphs: summaryParagraphs });
  if (comingUpParagraphs.length) sections.push({ id: 'coming-up-next', title: 'Coming Up Next', paragraphs: comingUpParagraphs });

  const newHeading = renameHeadingText(target.heading || target.chunk_head || '');
  const updatedChunk = { ...target, sections };
  if (target.heading) updatedChunk.heading = newHeading;
  if (target.chunk_head) updatedChunk.chunk_head = newHeading;

  const nextChunks = [...rawChunks];
  nextChunks[targetIndex] = updatedChunk;
  const newDoc = { ...doc, chunks: nextChunks };

  return {
    status: 'converted',
    newDoc,
    hasSummary: summaryParagraphs.length > 0,
    oldHeading: target.heading || target.chunk_head || '',
    newHeading,
    summaryPreview: summaryParagraphs.map((p) => stripHtml(p.body_html)).join(' ').slice(0, 100),
    comingUpPreview: comingUpParagraphs.map((p) => stripHtml(p.body_html)).join(' ').slice(0, 100),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is not set.');
  const sequelize = new Sequelize(databaseUrl, { dialect: 'postgres', logging: false });

  const limitSql = args.limit ? `LIMIT ${args.limit}` : '';
  const lessons = await sequelize.query(
    `SELECT id, title, lesson_document FROM lessons ORDER BY title ${limitSql}`,
    { type: QueryTypes.SELECT }
  );

  console.log(`Lessons: ${lessons.length}${args.dryRun ? '  (DRY RUN — no writes)' : ''}\n`);

  if (!args.dryRun) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `lesson-document-backup-${stamp}.json`);
    fs.writeFileSync(
      backupPath,
      JSON.stringify(lessons.map((l) => ({ id: l.id, title: l.title, lesson_document: l.lesson_document })), null, 2)
    );
    console.log(`Backup written: ${backupPath}\n`);
  }

  let converted = 0;
  let skipped = 0;
  let noSummary = 0;

  for (let i = 0; i < lessons.length; i += 1) {
    const lesson = lessons[i];
    const out = convertLesson(lesson);
    if (out.status !== 'converted') {
      skipped += 1;
      continue;
    }

    converted += 1;
    if (!out.hasSummary) noSummary += 1;

    if (args.show) {
      console.log(`[${i + 1}/${lessons.length}] ${lesson.title.slice(0, 50)}`);
      console.log(`   "${out.oldHeading}" -> "${out.newHeading}"`);
      if (out.hasSummary) console.log(`   Lesson Summary: ${out.summaryPreview}...`);
      else console.log(`   (no Lesson Summary — chunk had no recap text)`);
      console.log(`   Coming Up Next: ${out.comingUpPreview}...`);
    }

    if (!args.dryRun) {
      await sequelize.query(
        `UPDATE lessons SET lesson_document = :doc, updated_at = now() WHERE id = :id`,
        { replacements: { doc: JSON.stringify(out.newDoc), id: lesson.id } }
      );
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`converted: ${converted}   skipped (no coming-up chunk): ${skipped}   no-summary (coming-up-only): ${noSummary}`);

  await sequelize.close();
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { convertLesson, splitChunkContent, renameHeadingText };

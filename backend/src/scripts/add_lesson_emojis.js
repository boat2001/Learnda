'use strict';
/**
 * Add topic-matching emoji to lesson titles and chunk headings that don't
 * already have one. Deterministic (no API) — matches keywords/phrases against
 * a curated subject dictionary built from this curriculum's actual topics.
 *
 * House style already established in ~23% of the corpus (kept, not reinvented):
 *   structural "bookend" chunk headings get a FIXED emoji regardless of topic —
 *     "Quick Recap" / "Recap" -> 🔙 (22 existing uses, vs 4 for 🔁)
 *     "What's Coming Up"      -> 👀 (93 existing uses)
 *     "What You've Achieved"  -> 🏆🎉 (5 existing uses)
 *   "Welcome ..." chunks and everything else are topic-specific (dictionary match).
 *
 * Usage:
 *   node src/scripts/add_lesson_emojis.js --dry-run --show
 *   node src/scripts/add_lesson_emojis.js --dry-run --show --limit=10
 *   node src/scripts/add_lesson_emojis.js            # full run, all lessons
 */

require('dotenv').config({ path: '.env.development.local' });
require('dotenv').config({ path: '.env' });

const fs = require('fs');
const path = require('path');
const { Sequelize, QueryTypes } = require('sequelize');
const { extractSubstantiveChunks, safeText } = require('./lib/lesson_text_helpers');

const BACKUP_DIR = path.join(__dirname, '..', '..', 'data', 'lesson-emoji-backups');
// Extended_Pictographic misses country-flag sequences (two Regional_Indicator
// code points, e.g. 🇬🇭) — without the second alternative, an already-flagged
// heading like "...🇬🇭" reads as emoji-less and gets a redundant one appended.
const HAS_EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

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

// ---------------------------------------------------------------------------
// Structural bookend convention (already dominant in the corpus — reused as-is).
// ---------------------------------------------------------------------------
const RECAP_PATTERN = /^(quick )?recap\b/i;
const COMING_UP_PATTERN = /what'?s coming up/i;
const ACHIEVED_PATTERN = /what you'?ve achieved/i;

// ---------------------------------------------------------------------------
// Topic dictionary — [regex, emoji] pairs, checked in order. Earlier / more
// specific entries win; general single-word entries sit at the bottom as a
// safety net. A title/heading can match up to 2 entries from different
// "families" (tracked to avoid near-duplicate picks like 🔢 + 🧮).
// ---------------------------------------------------------------------------
const DICTIONARY = [
  // --- Child & adolescent development / psychology --------------------------
  [/prenatal|before birth|in utero/i, '🤰'],
  [/\bidentity\b.*(stage|erikson)|erikson/i, '🪜'],
  [/moral development|right from wrong|kohlberg/i, '⚖️'],
  [/attribution theory|goal.?setting/i, '🎯'],
  [/motivation/i, '🔥'],
  [/behaviouris|classical conditioning|operant conditioning/i, '🐕'],
  [/cognitive development|piaget/i, '🧠'],
  [/social learning|bandura|bobo doll/i, '👀'],
  [/social development/i, '🤝'],
  [/emotional development|feelings/i, '❤️'],
  [/physical development|bodies in motion|growth.*matur|maturation/i, '🌱'],
  [/play and development|play is learning|parten/i, '🧸'],
  [/individual differences|learning styles|vark/i, '🧩'],
  [/special education(al)? needs|inclusive|adhd/i, '🌈'],
  [/humanistic|maslow/i, '🌻'],
  [/language development|how children learn to talk/i, '🗣️'],
  [/child.*adolescent|teacher.*role.*(child|adolescent)/i, '🧒'],
  [/family, community/i, '🏘️'],

  // --- Citizenship / civics / governance -------------------------------------
  [/citizen|citizenship|who is a citizen|belonging/i, '🇬🇭'],
  [/democracy|election|political part(y|ies)/i, '🗳️'],
  [/rights.*dut(y|ies)|human rights/i, '⚖️'],
  [/constitution/i, '📜'],

  // --- Curriculum & pedagogy studies -----------------------------------------
  [/curriculum vs\.? syllabus|syllabus/i, '📑'],
  [/curriculum development/i, '🛠️'],
  [/curriculum evaluation|cipp/i, '📊'],
  [/curriculum implementation/i, '🚀'],
  [/what is curriculum/i, '📘'],
  [/lesson planning|classroom management/i, '🗓️'],
  [/teaching method|exposition|questioning|discovery learning|cooperative learning/i, '👩‍🏫'],
  [/pedagogical content knowledge|\bpck\b/i, '🔑'],
  [/principles of effective teaching/i, '⭐'],
  [/from philosophy to practice|professional teacher/i, '🎓'],
  [/what is education for|aims of education/i, '🎯'],
  [/orientation.*(student|professional teacher)/i, '🚪'],
  [/supervised teaching|sts\b|school placement/i, '📋'],
  [/in.?service education|inset/i, '🔄'],
  [/technology in education|ict integration/i, '💡'],

  // --- Research / library / information literacy -----------------------------
  [/research design|research method|research mindset|what is research/i, '🔬'],
  [/sampling/i, '🎲'],
  [/data collection|questionnaire|interview/i, '📝'],
  [/data analysis|statistics|quantitative|qualitative/i, '📊'],
  [/library|catalogue|librar(y|ies)|call numbers?|physical collections?/i, '📚'],
  [/boolean search|boolean operators?|search strateg|search quer|information overload/i, '🔎'],
  [/information literacy|craap|evaluat.*(source|internet)/i, '🧭'],
  [/internet as an information resource|world wide web|digital communication/i, '🌐'],

  // --- Mathematics --------------------------------------------------------
  [/calculus|differentiation|derivative/i, '📈'],
  // "Integration" collides with "ICT Integration" (education-technology topic,
  // not the calculus operation) — exclude that sense explicitly.
  [/integration/i, '📈', /\bict\b|\btechnology\b|\beducation\b|\bteaching\b/i],
  [/limits?:? what a function/i, '📉'],
  [/increasing.*decreasing|optimisation/i, '📐'],
  [/coordinate geometry/i, '📐'],
  [/sequences and series/i, '🔁'],
  [/sets, relations, and functions|relations:|functions:/i, '🔗'],
  [/quadratic/i, '🧮'],
  [/equations and inequalities/i, '⚖️'],
  [/algebraic (thinking|expressions)|from arithmetic to algebra|elementary algebra|factorisation|distributive law/i, '🔢'],
  [/ethnomathematics|mathematics in ghana/i, '🌍'],
  [/mathematical proof/i, '🧩'],
  [/mathematics and reality|models, applications/i, '🌌'],
  [/what is mathematics/i, '🔢'],
  [/nature of mathematics/i, '➗'],
  [/teaching mathematics|methods of teaching (primary school )?mathematics/i, '👩‍🏫'],
  [/number sense|counting|concept of number/i, '🔢'],

  // --- Computing / IT -------------------------------------------------------
  [/what is a computer|computer literacy/i, '💻'],
  [/classification of computers/i, '🖥️'],
  [/network|communications technology/i, '📡'],
  [/database|from files to databases/i, '🗄️'],
  [/data representation|memory.*storage/i, '💾'],
  [/fundamentals of it/i, '💻'],

  // --- Physics / science ------------------------------------------------------
  [/atom|atomic physics|nucleus|isotope/i, '⚛️'],
  [/mechanics|motion.*forces|newton/i, '🎳'],
  [/thermodynamics|electricity/i, '⚡'],
  [/general physics|measurement/i, '🔭'],

  // --- Language, linguistics, literature --------------------------------------
  [/phonetics|phonology|sounds and systems|consonants|vowel/i, '🔤'],
  [/clause|subordination|sentence/i, '✍️'],
  [/what is language|design features|hockett/i, '🗣️'],
  [/lexical relations|communication\b/i, '💬'],
  [/oral literature|praise poetry|proverbs|storytelling/i, '📜'],
  [/writer'?s craft|finding stories/i, '✒️'],
  [/language and linguistics/i, '🗣️'],
  [/english (on the curriculum|clause)/i, '📖'],
  [/ghanaian language|creative writing/i, '✍️'],

  // --- Social studies / geography / history ------------------------------------
  [/africa'?s economy|resources, trade/i, '💹'],
  [/africa in the world|colonial legac(y|ies)|\bcolonial(ism)?\b|\bcivilisations?\b|\bgeography\b/i, '🌍'],
  [/people and land|human.?environment|land tenure/i, '🗺️'],
  [/human land issues/i, '🗺️'],
  [/global studies in africa/i, '🌍'],
  [/social studies/i, '🏛️'],

  // --- Agriculture -------------------------------------------------------------
  [/agricultur|farm(ing)?|animal farming/i, '🌾'],

  // --- Health / PE ---------------------------------------------------------------
  [/health.*(physical fitness|safety)|nutrition|disease|pre.?school child/i, '🩺'],
  [/skill.?related fitness|training principles/i, '💪'],
  [/wellness/i, '🧘'],

  // --- Generic teaching/course-admin fallbacks (checked last) --------------------
  [/course outline|course notes|study guide|sample notes|special questions|test questions|test your skills|marking scheme|- ms$|slidified notes|observation report|placement handbook|scoring/i, '📔'],
  [/welcome/i, '👋'],
];

// Entries are [pattern, emoji] or [pattern, emoji, exclude] — `exclude`
// guards against a word colliding across two unrelated senses in this corpus
// (e.g. "integration" the calculus operation vs. "ICT Integration" the
// education-technology topic).
function pickEmoji(text) {
  const picks = [];
  for (const [pattern, emoji, exclude] of DICTIONARY) {
    if (picks.includes(emoji)) continue;
    if (exclude && exclude.test(text)) continue;
    if (pattern.test(text)) {
      picks.push(emoji);
      if (picks.length >= 2) break;
    }
  }
  return picks;
}

// Per-course fallback so nothing is left without an emoji even if no
// dictionary entry fires (rare, but titles like "Databases" alone could miss).
const COURSE_FALLBACK = [
  [/algebra|calculus|mathematics/i, '🔢'],
  [/computer|\bit\b|\bict\b|database/i, '💻'],
  [/physics/i, '⚛️'],
  [/child|adolescent|development/i, '🌱'],
  [/citizenship/i, '🇬🇭'],
  [/curriculum|teaching|education|pedagog/i, '🎓'],
  [/research|information literacy|library/i, '🔬'],
  [/language|linguistic|phonetic|clause|english/i, '🗣️'],
  [/literature|writing|poetry/i, '📜'],
  [/social studies|africa|land/i, '🌍'],
  [/agricultur|farm/i, '🌾'],
  [/health|fitness/i, '🩺'],
];

function pickEmojiWithFallback(text) {
  const picks = pickEmoji(text);
  if (picks.length > 0) return picks;
  for (const [pattern, emoji] of COURSE_FALLBACK) {
    if (pattern.test(text)) return [emoji];
  }
  return ['📘'];
}

function emojiForHeading(heading) {
  const h = safeText(heading);
  if (RECAP_PATTERN.test(h)) return ['🔙'];
  if (COMING_UP_PATTERN.test(h)) return ['👀'];
  if (ACHIEVED_PATTERN.test(h)) return ['🏆', '🎉'];
  return pickEmojiWithFallback(h);
}

function appendEmoji(text, emojis) {
  return `${safeText(text)} ${emojis.join('')}`.trim();
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
    const backupPath = path.join(BACKUP_DIR, `titles-and-chunks-backup-${stamp}.json`);
    fs.writeFileSync(
      backupPath,
      JSON.stringify(lessons.map((l) => ({ id: l.id, title: l.title, lesson_document: l.lesson_document })), null, 2)
    );
    console.log(`Backup written: ${backupPath}\n`);
  }

  let titlesChanged = 0;
  let headingsChanged = 0;

  for (let i = 0; i < lessons.length; i += 1) {
    const lesson = lessons[i];
    let newTitle = lesson.title;
    if (!HAS_EMOJI.test(lesson.title)) {
      const emojis = pickEmojiWithFallback(lesson.title);
      newTitle = appendEmoji(lesson.title, emojis);
      titlesChanged += 1;
    }

    const doc = lesson.lesson_document || {};
    let rawChunks = doc.chunks;
    const isArrayChunks = Array.isArray(rawChunks);
    const chunkEntries = isArrayChunks
      ? rawChunks.map((c, idx) => [idx, c])
      : Object.entries(rawChunks || {});

    let docChanged = false;
    const nextChunks = isArrayChunks ? [...(rawChunks || [])] : { ...(rawChunks || {}) };

    chunkEntries.forEach(([key, chunk]) => {
      if (!chunk || typeof chunk !== 'object') return;
      const heading = chunk.heading || chunk.chunk_head || '';
      if (!heading || HAS_EMOJI.test(heading)) return;
      const emojis = emojiForHeading(heading);
      const newHeading = appendEmoji(heading, emojis);
      const updatedChunk = { ...chunk };
      if (chunk.heading) updatedChunk.heading = newHeading;
      if (chunk.chunk_head) updatedChunk.chunk_head = newHeading;
      nextChunks[key] = updatedChunk;
      docChanged = true;
      headingsChanged += 1;
    });

    const newDoc = docChanged ? { ...doc, chunks: nextChunks } : doc;

    if (args.show && (newTitle !== lesson.title || docChanged)) {
      console.log(`[${i + 1}/${lessons.length}] "${lesson.title}" -> "${newTitle}"`);
      if (docChanged) {
        chunkEntries.forEach(([key, chunk]) => {
          const before = chunk?.heading || chunk?.chunk_head || '';
          const after = (isArrayChunks ? nextChunks[key] : nextChunks[key])?.heading
            || (isArrayChunks ? nextChunks[key] : nextChunks[key])?.chunk_head || '';
          if (before !== after) console.log(`      "${before}" -> "${after}"`);
        });
      }
    }

    if (!args.dryRun && (newTitle !== lesson.title || docChanged)) {
      await sequelize.query(
        `UPDATE lessons SET title = :title, lesson_document = :doc, updated_at = now() WHERE id = :id`,
        { replacements: { title: newTitle, doc: JSON.stringify(newDoc), id: lesson.id } }
      );
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`titles updated: ${titlesChanged}   chunk headings updated: ${headingsChanged}`);

  await sequelize.close();
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { pickEmojiWithFallback, emojiForHeading };

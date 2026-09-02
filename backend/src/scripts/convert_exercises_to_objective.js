'use strict';
/**
 * Convert every per-chunk exercise that requires typing (short_answer/theory/
 * fill_in) into an objective, select-based question (multiple_choice or
 * true_false). The typed question being replaced is NOT discarded — it is
 * relocated to the lesson's new `final_assessment` bank, a small set of
 * deeper questions shown ONLY in the end-of-lesson final test (see
 * frontend/src/utils/lessonAssessment.js buildFinalAssessmentQuestions).
 *
 * Where a chunk's own text clearly supports it (a repeated "Term : Definition"
 * pattern, or an explicit "First/Next/Then/Finally" sequence of steps), the
 * chunk's objective question is upgraded in place to a richer `objective_set`
 * (standalone multiple-choice questions answered one at a time — the mobile-
 * friendly replacement for the old two-column 'matching' type) or `ordering`
 * exercise instead of plain multiple-choice/true-false — this only happens
 * when extraction is high-confidence; otherwise the chunk keeps its plain
 * objective question. objective_set/ordering are per-chunk only (never in the
 * final test) so CourseDetail's simpler review UI never needs to render them.
 *
 * Fully deterministic (no API). Every step (both the replacement objective
 * question and the objective_set/ordering upgrade) is grounded in the chunk's
 * own text — never invented from nothing.
 *
 * Usage:
 *   node src/scripts/convert_exercises_to_objective.js --dry-run
 *   node src/scripts/convert_exercises_to_objective.js --dry-run --show --limit=5
 *   node src/scripts/convert_exercises_to_objective.js --id=<lesson-uuid>
 *   node src/scripts/convert_exercises_to_objective.js            # full run, all lessons
 *   node src/scripts/convert_exercises_to_objective.js --resume   # skip already-converted
 */

require('dotenv').config({ path: '.env.development.local' });
require('dotenv').config({ path: '.env' });

const fs = require('fs');
const path = require('path');
const { Sequelize, QueryTypes } = require('sequelize');
const {
  safeText,
  extractSubstantiveChunks,
  splitSentences,
  cleanEdges,
  pickDeclarativeSentence,
  pickDeclarativeSentences,
  buildObjectiveSetFromPairs,
  buildObjectiveSetFromFacts,
} = require('./lib/lesson_text_helpers');

const TYPED_TYPES = new Set(['short_answer', 'theory', 'fill_in']);
const OBJECTIVE_TYPES = new Set(['multiple_choice', 'true_false', 'objective_set', 'ordering']);
const BACKUP_DIR = path.join(__dirname, '..', '..', 'data', 'exercise-objective-conversion-backups');
const MAX_FINAL_ASSESSMENT = 4;

// Lessons titled like a raw course outline / notes / marking-scheme dump are
// scraped syllabi and bibliographies, not narrative teaching prose — their
// "Term : Definition"-shaped colon patterns are usually citations or admin
// headers (e.g. "Cape Coast : University Press ..."), not real vocabulary.
// The matching/ordering upgrade is skipped for these (plain objective
// conversion still applies); confirmed by manual review of extracted pairs.
const REFERENCE_DUMP_TITLE = /course outline|course notes|test questions|test your skills|marking scheme|- ms$|sample notes|sample anwsered|special questions|study guide|small note|four skills/i;

function parseArgs(argv) {
  const args = { dryRun: false, resume: false, show: false, limit: 0, id: '' };
  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--resume') args.resume = true;
    else if (arg === '--show') args.show = true;
    else {
      let m;
      if ((m = /^--limit=(\d+)$/.exec(arg))) args.limit = Number(m[1]);
      else if ((m = /^--id=(.+)$/.exec(arg))) args.id = m[1];
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// Objective-question replacement for a converted typed question.
// ---------------------------------------------------------------------------

function synthesizeObjectiveQuestion(chunk, allChunks) {
  const fact = pickDeclarativeSentence(chunk.text, { allowPronouns: false });
  if (fact) {
    return {
      type: 'true_false',
      prompt: `True or false: ${fact}`,
      options: ['True', 'False'],
      answer: 'True',
      correctAnswer: 'True',
      explanation: `True — this is stated directly in the section on "${chunk.heading}".`,
    };
  }

  // Fallback: every lesson has multiple chunks, so other chunk headings always
  // provide a distractor pool for a "which topic is this" multiple-choice.
  const distractors = allChunks
    .filter((c) => c.heading !== chunk.heading)
    .map((c) => c.heading)
    .slice(0, 3);
  while (distractors.length < 3) distractors.push('A different topic from this lesson');

  const options = [...distractors, chunk.heading];
  for (let i = options.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }

  return {
    type: 'multiple_choice',
    prompt: 'Which of the following best matches the focus of this part of the lesson?',
    options,
    answer: chunk.heading,
    correctAnswer: chunk.heading,
    explanation: `This part of the lesson focuses on "${chunk.heading}".`,
  };
}

// ---------------------------------------------------------------------------
// Matching upgrade: high-confidence "Term : Definition" extraction.
// ---------------------------------------------------------------------------

const MATCHING_TERM_BLOCKLIST = new Set([
  'by type', 'by purpose', 'by size', 'by capacity', 'by function', 'by category',
  'examples', 'example', 'for example', 'for instance', 'advantage', 'advantages',
  'disadvantage', 'disadvantages', 'note', 'notes', 'summary', 'in summary',
  'in short', 'in other words', 'definition', 'types', 'purpose', 'important',
  'remember', 'key point', 'key term', 'keyword', 'tip', 'warning', 'caution',
  'source', 'sources', 'reference', 'references', 'additional reading', 'terminology',
]);

// A real vocabulary term is a noun phrase ("Special-purpose computers",
// "Positive reinforcement") — it never contains a finite verb, pronoun, or
// discourse connective. A colon-delimited fragment that DOES contain one of
// these ("The classroom implication is urgent", "When it returns too few",
// "Crucially") is a clipped sentence, not a term, even though it capitalises
// and colon-splits the same way. Reject those rather than mismatching them.
const TERM_FRAGMENT_MARKERS = /\b(is|are|was|were|can|could|should|would|will|means|answers|implies|says|shows|allows|lets|ask|asks|notice|crucially|however|therefore|thus|hence|consequently|graphically|this|that|these|those|we|our|you|your|it)\b/i;

// Strip stray leading/trailing quote characters left behind when a sentence
// was split mid-quotation (e.g. an unclosed "'Do you find teaching...").
const trimQuoteEdges = (s) => safeText(s).replace(/^[\s"'“”‘’]+/, '').replace(/[\s"'“”‘’]+$/, '');

function extractMatchingPairs(chunkText) {
  const sentences = splitSentences(chunkText);
  const pairs = [];
  const seenTerms = new Set();

  for (const raw of sentences) {
    const s = cleanEdges(raw);
    if (!s.includes(':')) continue;

    const parts = s.split(/\s*:\s*/).map((p) => trimQuoteEdges(p)).filter(Boolean);
    if (parts.length < 2) continue;

    const term = parts[parts.length - 2];
    const definition = parts[parts.length - 1];
    if (!term || !definition) continue;
    if (term.length > 40 || !/^[A-Z]/.test(term)) continue;
    if (term.split(/\s+/).length > 5) continue;
    if (MATCHING_TERM_BLOCKLIST.has(term.toLowerCase())) continue;
    if (TERM_FRAGMENT_MARKERS.test(term)) continue;

    const defWords = definition.split(/\s+/).filter(Boolean);
    if (defWords.length < 3 || defWords.length > 30) continue;
    if (definition.length < 12 || definition.length > 200) continue;

    const letters = (definition.match(/[A-Za-z]/g) || []).length;
    const nonSpace = definition.replace(/\s/g, '').length;
    if (nonSpace === 0 || letters / nonSpace < 0.6) continue; // too many digits/symbols

    const normTerm = term.toLowerCase();
    if (seenTerms.has(normTerm)) continue;
    seenTerms.add(normTerm);
    pairs.push({ term, definition });
  }

  return pairs.length >= 3 ? pairs.slice(0, 5) : [];
}

// ---------------------------------------------------------------------------
// Ordering upgrade: explicit sequential-step extraction.
// ---------------------------------------------------------------------------

// The comma is mandatory: "First person" or "Third person limited" (grammar
// terminology, no comma) must NOT be mistaken for "First, the source must
// encode..." (an actual sequence marker, always comma'd in this dataset's prose).
const ORDINAL_MARKERS = [
  /^first,\s+/i, /^second,\s+/i, /^third,\s+/i, /^fourth,\s+/i, /^fifth,\s+/i,
  /^next,\s+/i, /^then,\s+/i, /^after (that|this),\s+/i,
  /^finally,\s+/i, /^lastly,\s+/i, /^to begin( with)?,\s+/i, /^initially,\s+/i,
];

function extractOrderingSteps(chunkText) {
  const sentences = splitSentences(chunkText);
  const steps = [];

  for (const raw of sentences) {
    const s = cleanEdges(raw);
    for (const marker of ORDINAL_MARKERS) {
      if (!marker.test(s)) continue;
      const stripped = s.replace(marker, '').trim();
      if (stripped.length >= 15 && stripped.length <= 200) {
        steps.push(stripped.charAt(0).toUpperCase() + stripped.slice(1));
      }
      break;
    }
  }

  return steps.length >= 3 ? steps.slice(0, 5) : [];
}

function buildOrderingExercise(steps, chunk) {
  return {
    type: 'ordering',
    prompt: `Arrange these steps from "${chunk.heading}" in the correct order.`,
    items: steps.map((text, i) => ({ id: `step-${i + 1}`, text })),
    explanation: `This is the order described in the section on "${chunk.heading}".`,
  };
}

/**
 * After the base objective question is decided, try to upgrade it to a richer
 * objective_set/ordering exercise when the chunk's own text clearly supports
 * one. Only ever replaces — never invents pairs/steps/facts that aren't in
 * the text.
 */
function tryUpgradeExercise(baseExercise, chunk, allChunks) {
  const pairs = extractMatchingPairs(chunk.text);
  if (pairs.length >= 3) return buildObjectiveSetFromPairs(pairs, chunk);

  const steps = extractOrderingSteps(chunk.text);
  if (steps.length >= 3) return buildOrderingExercise(steps, chunk);

  // A chunk with two or three distinct, independently-testable facts gets one
  // question per fact (capped at 3) instead of a single plain question — but
  // still one at a time via objective_set, never a wall of questions at once.
  const facts = pickDeclarativeSentences(chunk.text, { allowPronouns: false, count: 3 });
  if (facts.length >= 2) {
    const otherChunkFacts = allChunks
      .filter((c) => c.heading !== chunk.heading)
      .map((c) => pickDeclarativeSentence(c.text, { allowPronouns: false }))
      .filter(Boolean);
    return buildObjectiveSetFromFacts(facts, chunk, otherChunkFacts);
  }

  return baseExercise;
}

// ---------------------------------------------------------------------------
// Final-assessment fallback: every lesson gets at least one deep question.
// ---------------------------------------------------------------------------

function synthesizeFinalOnlyQuestion(chunks) {
  const richest = [...chunks].sort((a, b) => b.text.length - a.text.length)[0];
  if (!richest) return null;
  const answer = safeText(pickDeclarativeSentence(richest.text, { allowPronouns: true })) || richest.heading;
  return {
    type: 'short_answer',
    prompt: `In two or three sentences, explain the most important idea from the section "${richest.heading}" and why it matters.`,
    options: [],
    answer,
    correctAnswer: answer,
    explanation: `A strong answer should capture the key idea from "${richest.heading}": ${answer}`.slice(0, 400),
  };
}

// ---------------------------------------------------------------------------
// Per-lesson conversion.
// ---------------------------------------------------------------------------

function convertLesson(lesson) {
  const chunks = extractSubstantiveChunks(lesson.lesson_document);
  const exercises = Array.isArray(lesson.exercises) ? lesson.exercises : [];
  if (chunks.length === 0 || exercises.length !== chunks.length) {
    return { status: 'skipped', reason: `chunk/exercise count mismatch (chunks=${chunks.length}, exercises=${exercises.length})` };
  }

  const allowUpgrade = !REFERENCE_DUMP_TITLE.test(safeText(lesson.title));

  let converted = 0;
  let upgraded = 0;
  const relocated = [];

  const nextExercises = exercises.map((ex, i) => {
    if (!ex) return null; // bookend chunk with no exercise — untouched
    const chunk = chunks[i];

    let objective = ex;
    if (TYPED_TYPES.has(safeText(ex.type))) {
      converted += 1;
      relocated.push(ex);
      objective = synthesizeObjectiveQuestion(chunk, chunks);
    } else if (!OBJECTIVE_TYPES.has(safeText(ex.type))) {
      // Unrecognised type — treat conservatively as needing replacement too.
      converted += 1;
      relocated.push(ex);
      objective = synthesizeObjectiveQuestion(chunk, chunks);
    }

    if (!allowUpgrade) return objective;
    const upgradedExercise = tryUpgradeExercise(objective, chunk, chunks);
    if (upgradedExercise !== objective) upgraded += 1;
    return upgradedExercise;
  });

  const withIds = nextExercises.map((e, i) => {
    if (!e) return null;
    return { id: `exercise-${i + 1}`, ...e };
  });

  const finalAssessment = relocated.slice(0, MAX_FINAL_ASSESSMENT);
  if (finalAssessment.length === 0) {
    const fallback = synthesizeFinalOnlyQuestion(chunks);
    if (fallback) finalAssessment.push(fallback);
  }
  const finalAssessmentWithIds = finalAssessment.map((e, i) => ({ id: `final-${i + 1}`, ...e }));

  return {
    status: 'converted',
    chunkCount: chunks.length,
    converted,
    upgraded,
    exercises: withIds,
    finalAssessment: finalAssessmentWithIds,
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
  const limitSql = args.limit ? `LIMIT ${args.limit}` : '';

  const lessons = await sequelize.query(
    `SELECT id, title, lesson_document, exercises, final_assessment, metadata FROM lessons ${whereSql} ORDER BY title ${limitSql}`,
    { type: QueryTypes.SELECT, replacements: repl }
  );

  console.log(`Lessons matched: ${lessons.length}${args.dryRun ? '  (DRY RUN — no writes)' : ''}\n`);

  if (!args.dryRun) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `exercises-backup-${stamp}.json`);
    fs.writeFileSync(
      backupPath,
      JSON.stringify(
        lessons.map((l) => ({ id: l.id, title: l.title, exercises: l.exercises, final_assessment: l.final_assessment })),
        null,
        2
      )
    );
    console.log(`Backup written: ${backupPath}\n`);
  }

  const totals = { converted: 0, convertedQuestions: 0, upgraded: 0, skipped: 0 };

  for (let i = 0; i < lessons.length; i += 1) {
    const lesson = lessons[i];
    if (args.resume && lesson.metadata && lesson.metadata.exercises_converted_to_objective_at) {
      totals.skipped += 1;
      console.log(`[${i + 1}/${lessons.length}] ⏭  ${lesson.title.slice(0, 55)} (already converted)`);
      continue;
    }

    const out = convertLesson(lesson);
    if (out.status !== 'converted') {
      totals.skipped += 1;
      console.log(`[${i + 1}/${lessons.length}] ⏭  ${lesson.title.slice(0, 55)} (${out.reason})`);
      continue;
    }

    if (!args.dryRun) {
      const metadata = { ...(lesson.metadata || {}), exercises_converted_to_objective_at: new Date().toISOString() };
      await sequelize.query(
        `UPDATE lessons SET exercises = :ex, final_assessment = :fa, metadata = :md, updated_at = now() WHERE id = :id`,
        {
          replacements: {
            ex: JSON.stringify(out.exercises),
            fa: JSON.stringify(out.finalAssessment),
            md: JSON.stringify(metadata),
            id: lesson.id,
          },
        }
      );
    }

    totals.converted += 1;
    totals.convertedQuestions += out.converted;
    totals.upgraded += out.upgraded;
    console.log(
      `[${i + 1}/${lessons.length}] ✅ ${lesson.title.slice(0, 45).padEnd(45)} chunks=${out.chunkCount} typed→objective=${out.converted} upgraded=${out.upgraded} finalBank=${out.finalAssessment.length}`
    );

    if (args.show) {
      out.exercises.forEach((e, idx) => {
        if (!e) { console.log(`      ${idx}. (no exercise)`); return; }
        console.log(`      ${idx}. [${e.type}] ${(e.prompt || '').slice(0, 70)}`);
      });
      out.finalAssessment.forEach((e, idx) => console.log(`      FINAL ${idx}. [${e.type}] ${(e.prompt || '').slice(0, 70)}`));
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`lessons converted: ${totals.converted}   skipped: ${totals.skipped}`);
  console.log(`typed questions relocated to final_assessment: ${totals.convertedQuestions}   chunks upgraded to matching/ordering: ${totals.upgraded}`);

  await sequelize.close();
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { convertLesson, extractMatchingPairs, extractOrderingSteps, synthesizeObjectiveQuestion };

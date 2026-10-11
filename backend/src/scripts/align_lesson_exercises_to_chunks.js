'use strict';
/**
 * Align each lesson's `exercises` array to its `lesson_document.chunks`.
 *
 * The lesson viewer (frontend/src/utils/lessonAssessment.js) maps
 *   exercises[i] -> substantive-chunk[i]   (positional, with modulo wraparound)
 * There is no explicit chunk<->exercise link, so any count/order mismatch
 * surfaces as the wrong exercise under a chunk. Across the DB almost every
 * lesson is mismatched (5 chunks / 6 exercises, 5 chunks / 4 exercises, ...).
 *
 * This script rebuilds each lesson's exercises so there is EXACTLY one exercise
 * per substantive chunk, in chunk order, with exercise[i] testing chunk[i].
 * It is fully deterministic (no API):
 *   1. Match each EXISTING question to the chunk it actually tests, using a
 *      TF-IDF cosine similarity (with a multi-word phrase bonus) over the
 *      lesson's own chunks, solved as an optimal max-weight assignment.
 *   2. Surplus questions (more questions than chunks) are dropped.
 *   3. Any chunk left uncovered gets a NEW question synthesised from that
 *      chunk's own text (a true/false drawn from a real sentence, or a short
 *      "explain the key idea" question), so every chunk ends up with a
 *      grounded, gradeable exercise.
 *
 * Existing questions are preserved verbatim (only re-ordered / re-numbered).
 *
 * Usage:
 *   node src/scripts/align_lesson_exercises_to_chunks.js --dry-run
 *   node src/scripts/align_lesson_exercises_to_chunks.js --dry-run --show --limit=3
 *   node src/scripts/align_lesson_exercises_to_chunks.js --course="Algebraic Thinking"
 *   node src/scripts/align_lesson_exercises_to_chunks.js --id=<lesson-uuid>
 *   node src/scripts/align_lesson_exercises_to_chunks.js            # full run, all lessons
 *   node src/scripts/align_lesson_exercises_to_chunks.js --resume   # skip already-aligned
 */

require('dotenv').config({ path: '.env.development.local' });
require('dotenv').config({ path: '.env' });

const fs = require('fs');
const path = require('path');
const { Sequelize, QueryTypes } = require('sequelize');
const {
  safeText,
  STOP_WORDS,
  extractSubstantiveChunks,
  isBookendChunk,
  pickDeclarativeSentence,
} = require('./lib/lesson_text_helpers');

const ALLOWED_TYPES = new Set(['multiple_choice', 'true_false', 'short_answer']);
const BACKUP_DIR = path.join(__dirname, '..', '..', 'data', 'exercise-realign-backups');

// A pure max-sum assignment will happily force a question onto whatever chunk is
// left, even when it has near-zero relevance there (e.g. a fact about "digital vs
// analog computers" landing on the lesson's opening "Welcome" chunk just because
// that chunk was the only slot left). Empirically, weak matches (<0.10) land on a
// "Recap / Welcome / What's Coming Up / What You've Achieved" bookend chunk 76% of
// the time, vs only 19% for confident matches (>=0.30) — those chunks are almost
// always orientation-only and rarely deserve a borrowed fact from elsewhere. So we
// require much stronger evidence before letting a question sit on a bookend chunk;
// below the bar, the question is treated as unassigned there and the chunk instead
// gets a fresh question synthesised from its own (thin) text.
const MIN_MATCH_SCORE = 0.08;
const BOOKEND_MIN_MATCH_SCORE = 0.30;

function parseArgs(argv) {
  const args = { dryRun: false, resume: false, show: false, limit: 0, course: '', id: '' };
  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--resume') args.resume = true;
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

// ---------------------------------------------------------------------------
// Similarity: TF-IDF cosine over the lesson's own chunks + multi-word phrase bonus.
// ---------------------------------------------------------------------------

const tokenize = (value) =>
  safeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w));

const termFreq = (tokens) => {
  const tf = new Map();
  tokens.forEach((t) => tf.set(t, (tf.get(t) || 0) + 1));
  return tf;
};

// Content-word bigrams/trigrams, for the phrase-overlap bonus.
const contentPhrases = (value) => {
  const words = safeText(value).toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean);
  const phrases = new Set();
  for (let i = 0; i < words.length - 1; i += 1) {
    const a = words[i];
    const b = words[i + 1];
    if (a.length > 3 && b.length > 3 && !STOP_WORDS.has(a) && !STOP_WORDS.has(b)) {
      phrases.add(`${a} ${b}`);
      if (i < words.length - 2) {
        const c = words[i + 2];
        if (c.length > 3 && !STOP_WORDS.has(c)) phrases.add(`${a} ${b} ${c}`);
      }
    }
  }
  return [...phrases];
};

function buildLessonScorer(chunks) {
  const n = chunks.length;
  // Document frequency across chunks -> idf.
  const df = new Map();
  const chunkTokens = chunks.map((c) => {
    // Heading terms weighted x3 (repeat) so a question that names the chunk topic scores high.
    const tokens = [...tokenize(c.heading), ...tokenize(c.heading), ...tokenize(c.heading), ...tokenize(c.text)];
    const unique = new Set(tokens);
    unique.forEach((t) => df.set(t, (df.get(t) || 0) + 1));
    return tokens;
  });
  const idf = (t) => Math.log(1 + n / ((df.get(t) || 0) + 0.5));

  const toVec = (tokens) => {
    const tf = termFreq(tokens);
    const vec = new Map();
    let norm = 0;
    tf.forEach((count, t) => {
      const w = count * idf(t);
      vec.set(t, w);
      norm += w * w;
    });
    return { vec, norm: Math.sqrt(norm) || 1 };
  };

  const chunkVecs = chunkTokens.map(toVec);
  const chunkTextLower = chunks.map((c) => `${c.heading} ${c.text}`.toLowerCase());

  const score = (exercise, chunkIdx) => {
    const exTokens = [
      ...tokenize(exercise.prompt),
      ...tokenize(exercise.prompt),
      ...tokenize(Array.isArray(exercise.options) ? exercise.options.join(' ') : ''),
      ...tokenize(exercise.answer || exercise.correctAnswer),
      ...tokenize(exercise.answer || exercise.correctAnswer),
      ...tokenize(exercise.explanation),
    ];
    const { vec, norm } = toVec(exTokens);
    const cv = chunkVecs[chunkIdx];
    let dot = 0;
    vec.forEach((w, t) => {
      const cw = cv.vec.get(t);
      if (cw) dot += w * cw;
    });
    let cosine = dot / (norm * cv.norm);

    // Phrase bonus: distinctive multi-word phrases shared with the chunk body.
    const phrases = contentPhrases(`${exercise.prompt} ${exercise.answer || exercise.correctAnswer}`);
    let bonus = 0;
    for (const p of phrases) {
      if (chunkTextLower[chunkIdx].includes(p)) bonus += p.includes(' ') && p.split(' ').length === 3 ? 0.18 : 0.12;
      if (bonus >= 0.4) break;
    }
    return cosine + Math.min(bonus, 0.4);
  };

  return score;
}

/**
 * Optimal max-weight assignment of exercises -> distinct chunks (sizes are tiny,
 * <=6 exercises x <=5 chunks). DP over (exercise index, used-chunk bitmask).
 * `minScoreByChunk[c]` excludes (exercise, chunk) pairs below that chunk's own
 * confidence bar from ever being placed there — those chunks are left unfilled
 * (to be synthesised) rather than force-fit with a near-zero-relevance question.
 * Returns array `assignedExercise[chunkIdx] = exerciseIdx | -1`.
 */
function assignExercisesToChunks(scoreMatrix, exerciseCount, chunkCount, minScoreByChunk) {
  const memo = new Map();
  const choice = new Map();
  const key = (i, mask) => i * (1 << chunkCount) + mask;

  const solve = (i, mask) => {
    if (i === exerciseCount) return 0;
    const k = key(i, mask);
    if (memo.has(k)) return memo.get(k);

    // Option: skip this exercise (it becomes surplus).
    let best = solve(i + 1, mask);
    let bestChunk = -1;

    for (let c = 0; c < chunkCount; c += 1) {
      if (mask & (1 << c)) continue;
      if (scoreMatrix[i][c] < minScoreByChunk[c]) continue; // not a real match for this chunk
      const val = scoreMatrix[i][c] + solve(i + 1, mask | (1 << c));
      if (val > best + 1e-9) {
        best = val;
        bestChunk = c;
      }
    }
    memo.set(k, best);
    choice.set(k, bestChunk);
    return best;
  };

  solve(0, 0);

  const assigned = new Array(chunkCount).fill(-1);
  let mask = 0;
  for (let i = 0; i < exerciseCount; i += 1) {
    const c = choice.get(key(i, mask));
    if (c !== undefined && c >= 0) {
      assigned[c] = i;
      mask |= 1 << c;
    }
  }
  return assigned;
}

// ---------------------------------------------------------------------------
// Synthesis for chunks with no matching existing question.
// ---------------------------------------------------------------------------

function synthesizeQuestion(chunk) {
  const fact = pickDeclarativeSentence(chunk.text, { allowPronouns: false });
  if (fact) {
    return {
      type: 'true_false',
      prompt: `True or false: ${fact}`,
      options: ['True', 'False'],
      answer: 'True',
      correctAnswer: 'True',
      explanation: `True — this is stated directly in the section on "${chunk.heading}".`,
      _synth: true,
    };
  }

  // Fall back to an "explain the key idea" short-answer. Use the cleanest
  // available declarative sentence for the model answer (pronouns allowed —
  // welcome/orientation chunks are usually written in second person), else
  // fall back to the heading itself (always OCR-safe).
  const answer = safeText(pickDeclarativeSentence(chunk.text, { allowPronouns: true })) || chunk.heading;
  return {
    type: 'short_answer',
    prompt: `In one or two sentences, explain the key idea of this section: "${chunk.heading}".`,
    options: [],
    answer,
    correctAnswer: answer,
    explanation: `A good answer should capture the main point of "${chunk.heading}": ${answer}`.slice(0, 400),
    _synth: true,
  };
}

// ---------------------------------------------------------------------------
// Per-lesson alignment.
// ---------------------------------------------------------------------------

function alignLesson(lesson) {
  const chunks = extractSubstantiveChunks(lesson.lesson_document);
  if (chunks.length === 0) return { status: 'skipped', reason: 'no substantive chunks' };

  const existing = (Array.isArray(lesson.exercises) ? lesson.exercises : []).filter(
    (e) => e && ALLOWED_TYPES.has(safeText(e.type)) && safeText(e.prompt)
  );

  const score = buildLessonScorer(chunks);
  const matrix = existing.map((ex) => chunks.map((_, c) => score(ex, c)));
  const minScoreByChunk = chunks.map((chunk) => (isBookendChunk(chunk) ? BOOKEND_MIN_MATCH_SCORE : MIN_MATCH_SCORE));
  const assigned = assignExercisesToChunks(matrix, existing.length, chunks.length, minScoreByChunk);

  let matched = 0;
  let synthesized = 0;
  let skippedBookend = 0;
  const finalExercises = chunks.map((chunk, c) => {
    const exIdx = assigned[c];
    if (exIdx >= 0 && matrix[exIdx][c] >= minScoreByChunk[c]) {
      matched += 1;
      const ex = existing[exIdx];
      const answer = safeText(ex.answer || ex.correctAnswer);
      return {
        // Preserve the authored question verbatim; only its position changes.
        type: safeText(ex.type),
        prompt: safeText(ex.prompt),
        options: Array.isArray(ex.options) ? ex.options.map(safeText).filter(Boolean) : [],
        answer,
        correctAnswer: answer,
        explanation: safeText(ex.explanation),
        _chunk: chunk.heading,
        _score: matrix[exIdx][c],
      };
    }
    // Bookend chunks (welcome/recap/coming-up/achieved) are almost always
    // orientation-only — rather than manufacture a "no-brainer" filler
    // question just to fill the slot, leave them with no exercise at all.
    // The frontend (LessonViewer.jsx) understands a `null` at a chunk's
    // position as "no exercise for this chunk".
    if (isBookendChunk(chunk)) {
      skippedBookend += 1;
      return { _noExercise: true, _chunk: chunk.heading };
    }
    synthesized += 1;
    return { ...synthesizeQuestion(chunk), _chunk: chunk.heading };
  });

  const droppedCount = existing.length - matched;
  const withIds = finalExercises.map((e, i) => {
    if (e._noExercise) return null;
    const { _chunk, _score, _synth, ...rest } = e;
    return { id: `exercise-${i + 1}`, ...rest };
  });

  return {
    status: 'aligned',
    chunkCount: chunks.length,
    beforeCount: Array.isArray(lesson.exercises) ? lesson.exercises.length : 0,
    matched,
    synthesized,
    skippedBookend,
    dropped: droppedCount,
    exercises: withIds,
    detail: finalExercises,
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
  if (args.course) {
    where.push("(title ILIKE :course OR metadata->>'course' ILIKE :course OR metadata->>'course_title' ILIKE :course)");
    repl.course = `%${args.course}%`;
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limitSql = args.limit ? `LIMIT ${args.limit}` : '';

  const lessons = await sequelize.query(
    `SELECT id, title, lesson_document, exercises, metadata FROM lessons ${whereSql} ORDER BY title ${limitSql}`,
    { type: QueryTypes.SELECT, replacements: repl }
  );

  console.log(`Lessons matched: ${lessons.length}${args.dryRun ? '  (DRY RUN — no writes)' : ''}\n`);

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

  const totals = { aligned: 0, skipped: 0, matched: 0, synthesized: 0, skippedBookend: 0, dropped: 0 };

  for (let i = 0; i < lessons.length; i += 1) {
    const lesson = lessons[i];
    if (args.resume && lesson.metadata && lesson.metadata.exercises_aligned_at) {
      totals.skipped += 1;
      console.log(`[${i + 1}/${lessons.length}] ⏭  ${lesson.title.slice(0, 55)} (already aligned)`);
      continue;
    }

    const out = alignLesson(lesson);
    if (out.status !== 'aligned') {
      totals.skipped += 1;
      console.log(`[${i + 1}/${lessons.length}] ⏭  ${lesson.title.slice(0, 55)} (${out.reason})`);
      continue;
    }

    if (!args.dryRun) {
      const metadata = { ...(lesson.metadata || {}), exercises_aligned_at: new Date().toISOString() };
      await sequelize.query(
        `UPDATE lessons SET exercises = :ex, metadata = :md, updated_at = now() WHERE id = :id`,
        { replacements: { ex: JSON.stringify(out.exercises), md: JSON.stringify(metadata), id: lesson.id } }
      );
    }

    totals.aligned += 1;
    totals.matched += out.matched;
    totals.synthesized += out.synthesized;
    totals.skippedBookend += out.skippedBookend;
    totals.dropped += out.dropped;
    const effectiveCount = out.exercises.filter(Boolean).length;
    console.log(
      `[${i + 1}/${lessons.length}] ✅ ${lesson.title.slice(0, 45).padEnd(45)} chunks=${out.chunkCount} ex ${out.beforeCount}→${effectiveCount} (kept ${out.matched}, new ${out.synthesized}, no-ex ${out.skippedBookend}, dropped ${out.dropped})`
    );

    if (args.show) {
      out.detail.forEach((e, idx) => {
        if (e._noExercise) {
          console.log(`      ${idx}. [----] chunk="${e._chunk.slice(0, 30)}" · (no exercise — orientation-only chunk)`);
          return;
        }
        console.log(
          `      ${idx}. [${e._synth ? 'NEW ' : `${(e._score).toFixed(2)}`}] chunk="${e._chunk.slice(0, 30)}" · ${e.type} · ${e.prompt.slice(0, 70)}`
        );
      });
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`lessons aligned: ${totals.aligned}   skipped: ${totals.skipped}`);
  console.log(
    `questions kept: ${totals.matched}   synthesized: ${totals.synthesized}   no-exercise (bookend): ${totals.skippedBookend}   dropped (surplus): ${totals.dropped}`
  );

  await sequelize.close();
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { extractSubstantiveChunks, alignLesson, buildLessonScorer, synthesizeQuestion };

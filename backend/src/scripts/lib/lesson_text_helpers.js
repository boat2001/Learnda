'use strict';
/**
 * Shared deterministic (no-API) text helpers for lesson-content scripts:
 * extracting the frontend's "substantive chunks" from lesson_document, and
 * picking clean, gradeable sentences out of chunk prose for synthesised
 * questions. Used by align_lesson_exercises_to_chunks.js and
 * convert_exercises_to_objective.js — keep both scripts using the exact same
 * chunk-extraction rules the frontend uses, or their outputs drift apart.
 */

const stripHtml = (v) => String(v ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const safeText = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

// Mirror the viewer's stop-word list (frontend/src/utils/lessonAssessment.js).
const STOP_WORDS = new Set([
  'about', 'after', 'again', 'against', 'also', 'and', 'any', 'are', 'because', 'been', 'before',
  'being', 'below', 'between', 'both', 'but', 'can', 'cannot', 'could', 'did', 'does', 'doing',
  'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have', 'having', 'her', 'here',
  'hers', 'him', 'his', 'how', 'into', 'its', 'itself', 'just', 'lesson', 'main', 'more', 'most',
  'much', 'must', 'not', 'now', 'off', 'once', 'only', 'other', 'our', 'out', 'over', 'own', 'same',
  'she', 'should', 'some', 'such', 'than', 'that', 'the', 'their', 'them', 'then', 'there', 'these',
  'they', 'this', 'those', 'through', 'too', 'under', 'until', 'using', 'very', 'was', 'were', 'what',
  'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'will', 'with', 'would', 'you', 'your',
  'yours', 'yourself',
]);

/**
 * Extract substantive chunks in the exact order + filtering the frontend uses
 * (frontend/src/utils/lessonSchema.js -> normalizeLessonDocument). A chunk is
 * kept iff it has at least one paragraph with body text or a paragraph/chunk image.
 */
function extractSubstantiveChunks(lessonDocument) {
  const doc = lessonDocument || {};
  let rawChunks = doc.chunks;
  if (!rawChunks) return [];
  if (!Array.isArray(rawChunks)) {
    rawChunks = Object.entries(rawChunks)
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([id, chunk]) => ({ id, ...(chunk || {}) }));
  }

  const chunks = [];
  rawChunks.forEach((chunk, index) => {
    const rawParagraphs = Array.isArray(chunk?.paragraphs)
      ? chunk.paragraphs
      : Object.entries(chunk?.chunk_content || {})
          .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
          .map(([pid, p]) => (typeof p === 'string' ? { id: pid, body_html: p } : { id: pid, ...(p || {}) }));

    const paragraphTexts = rawParagraphs
      .map((p) => stripHtml(p?.body_html || p?.bodyHtml || p?.html || p?.content || p?.text || (typeof p === 'string' ? p : '')))
      .filter(Boolean);

    const hasImage = Boolean(
      chunk?.illustration && (chunk.illustration.image_url || chunk.illustration.src || chunk.illustration.imageUrl)
    );

    if (paragraphTexts.length === 0 && !hasImage) return; // dropped by the viewer -> no exercise slot

    chunks.push({
      order: chunks.length,
      docIndex: index,
      heading: safeText(chunk?.heading || chunk?.chunk_head || `Chunk ${index + 1}`),
      text: paragraphTexts.join(' '),
    });
  });

  return chunks;
}

const BOOKEND_HEADING = /^(welcome|quick recap|recap|what'?s coming up|what you'?ve achieved|coming up)/i;
const isBookendChunk = (chunk) => BOOKEND_HEADING.test(String(chunk?.heading || '').trim());

// Common abbreviations whose period is not a sentence boundary — without this,
// "The Rhind Papyrus (c. 1650 BCE)" or "note the call number (e.g. 025.4)"
// gets cut mid-abbreviation, producing a visibly truncated definition/fact
// ("...(c." / "...(e."). The period is swapped for a safe text sentinel (not
// a real character in normal prose) so it survives the sentence-boundary
// regex below, then restored to a literal period afterwards.
// Lookahead allows whitespace, comma, close-paren, or a digit (covers both
// "e.g. text" and cramped "c.1650" / "no.5" forms with no space at all).
const ABBREVIATION_PERIOD = /\b(e\.g|i\.e|c|cf|etc|vs|approx|no|pp|vol|ed|fig|dr|mr|mrs|ms|prof|st)\.(?=[\s,)\d]|$)/gi;
// A period between two digits ("025.4", "d = 0.5") is a decimal point, not a
// sentence end.
const DECIMAL_POINT = /(\d)\.(\d)/g;
const PERIOD_SENTINEL = "@@PERIOD@@";

const splitSentences = (text) => {
  const t = safeText(text);
  if (!t) return [];
  // Replace every period in the match (e.g. BOTH periods in "e.g."), not just
  // the trailing one — the abbreviation itself ("e\.g") can contain internal
  // periods that would otherwise still trip the sentence-boundary regex below.
  const guarded = t
    .replace(ABBREVIATION_PERIOD, (whole) => whole.split('.').join(PERIOD_SENTINEL))
    .replace(DECIMAL_POINT, (whole, before, after) => `${before}${PERIOD_SENTINEL}${after}`);
  const restore = (x) => x.split(PERIOD_SENTINEL).join(".");
  const matches = (guarded.match(/[^.!?]+[.!?]+/g) || [])
    .map((x) => restore(x).trim())
    .filter(Boolean);
  return matches.length ? matches : [restore(guarded)];
};

const META_PREFIX = /^(welcome|in this|by the end|this (lesson|section|chunk|unit)|we will|you will|let'?s|coming up|what'?s coming)/i;

// Trim stray leading/trailing quote/bullet/punctuation artefacts from OCR'd text.
const cleanEdges = (s) => safeText(s).replace(/^[^A-Za-z0-9]+/, '').replace(/[\s"'”’)]+$/, (m) => (/[.!?]$/.test(m) ? m : '')).trim();

/**
 * Reject sentences that are OCR garbage: concatenated words, formulae, heavy
 * digit/symbol content, or non-Latin gibberish. A synthesised question is only
 * as good as the sentence it quotes, so we are strict here.
 */
function looksClean(sentence) {
  const s = safeText(sentence);
  if (!s) return false;
  const words = s.split(/\s+/);
  // Strip surrounding punctuation (commas, periods, parens, quotes) before
  // judging whether a token is a real word — otherwise ordinary comma-separated
  // lists ("offices, banks, hospitals, ...") get misjudged as low-quality text.
  const wordy = words.filter((w) => /^[A-Za-z-]{3,}$/.test(w.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '')));
  if (wordy.length < 6) return false; // not enough real words
  if (words.some((w) => w.length > 22)) return false; // concatenated OCR run
  const letters = (s.match(/[A-Za-z]/g) || []).length;
  const nonSpace = s.replace(/\s/g, '').length;
  if (nonSpace === 0 || letters / nonSpace < 0.72) return false; // too many digits/symbols
  if (/[^\t\n\r\x20-\x7e’‘“”—–…]/.test(s)) return false; // stray non-standard glyphs
  if (wordy.length / words.length < 0.6) return false; // too many odd tokens
  return true;
}

/**
 * Find a clean, declarative (non-question, non-meta) sentence in the chunk's own
 * text. In strict mode (used for true/false facts) second-person/first-person
 * framing ("you", "we", "your") is excluded, since those read as instructions
 * rather than testable facts. Relaxed mode (used as a short-answer fallback)
 * allows pronouns so intro/welcome chunks — which are almost entirely written
 * in second person — can still yield a usable model answer.
 */
function pickDeclarativeSentence(chunkText, { allowPronouns = false } = {}) {
  const [first] = pickDeclarativeSentences(chunkText, { allowPronouns, count: 1 });
  return first || '';
}

// Same extraction/filtering as pickDeclarativeSentence, but returns up to
// `count` distinct qualifying sentences instead of just the first — used to
// judge whether a chunk has enough separate, testable facts to support more
// than one question (see buildObjectiveSetFromFacts below).
function pickDeclarativeSentences(chunkText, { allowPronouns = false, count = 1 } = {}) {
  const sentences = splitSentences(chunkText);
  const picked = [];
  for (const raw of sentences) {
    if (picked.length >= count) break;
    const s = cleanEdges(raw);
    const words = s.split(/\s+/);
    if (words.length < 8 || words.length > 40) continue;
    if (s.length < 45 || s.length > 240) continue;
    if (s.endsWith('?') || s.endsWith(':')) continue;
    if (META_PREFIX.test(s)) continue;
    if (!allowPronouns && /\byou\b|\bwe\b|\byour\b/i.test(s)) continue;
    if (!looksClean(s)) continue;
    picked.push(s.replace(/\s+/g, ' ').trim());
  }
  return picked;
}

function hashText(value = '') {
  let hash = 0;
  const input = String(value);
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) % 2147483647;
  }
  return Math.abs(hash);
}

// Shared by every objective_set question builder below: 4-option MC options
// for `correctAnswer`, drawn first from `siblingAnswers` (other correct answers
// in the same set), then `extraDistractorPool` (e.g. other chunks/exercises in
// the same lesson), then a generic filler as a last resort so every question
// always has 4 options. Fully deterministic: shuffled by a hash of the
// correct answer, never Math.random, so re-running produces identical output.
function buildMcOptions(correctAnswer, siblingAnswers, extraDistractorPool, fillerLabel) {
  const candidatePool = [...siblingAnswers, ...extraDistractorPool];
  const seen = new Set([safeText(correctAnswer).toLowerCase()]);
  const distractors = [];
  for (const candidate of candidatePool) {
    const norm = safeText(candidate).toLowerCase();
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    distractors.push(candidate);
    if (distractors.length >= 3) break;
  }
  while (distractors.length < 3) {
    distractors.push(fillerLabel);
  }

  const options = [correctAnswer, ...distractors];
  const seed = hashText(correctAnswer);
  for (let i = options.length - 1; i > 0; i -= 1) {
    const j = hashText(`${seed}-${i}`) % (i + 1);
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}

// Builds a mobile-friendly 'objective_set' exercise (standalone multiple-choice
// questions answered one at a time) from term/definition pairs — the shared
// replacement for the old 'matching' exercise type, which required scanning
// two separately-scrolling lists and didn't work well on small screens.
// Distractors for each question are drawn from sibling pairs in the same set
// first, then from extraDistractorPool (e.g. other pairs in the same lesson).
// Capped at 3 questions — one at a time is only worth it up to a point, and
// beyond 3 it stops feeling like "one exercise" and starts feeling like a quiz.
function buildObjectiveSetFromPairs(pairs, chunk, extraDistractorPool = []) {
  const allDefinitions = pairs.map((pair) => pair.definition);
  const cappedPairs = pairs.slice(0, 3);

  const questions = cappedPairs.map((pair) => {
    const siblingDefs = allDefinitions.filter((def) => def !== pair.definition);
    const options = buildMcOptions(
      pair.definition,
      siblingDefs,
      extraDistractorPool,
      `Not related to "${pair.term}"`
    );

    return {
      prompt: `Which definition matches "${pair.term}"?`,
      options,
      correctAnswer: pair.definition,
      explanation: `"${pair.term}" means: ${pair.definition}`,
    };
  });

  return {
    type: 'objective_set',
    prompt: `Answer these questions about "${chunk.heading}" one at a time.`,
    questions: questions.map((question, i) => ({ id: `question-${i + 1}`, ...question })),
    explanation: `These questions are drawn directly from the section on "${chunk.heading}".`,
  };
}

// A chunk with several distinct, independently-testable facts (not just one)
// gets more than one question instead of a single plain multiple-choice/
// true-false — but always one at a time via 'objective_set', never all at
// once. Each question asks which of 4 statements is the one actually made in
// this chunk; the wrong options are real sentences from OTHER chunks/lessons
// (extraDistractorPool), never invented, so they're plausible but clearly
// mismatched to this section on a careful read. Capped at 3 questions.
function buildObjectiveSetFromFacts(facts, chunk, extraDistractorPool = []) {
  const cappedFacts = facts.slice(0, 3);

  const questions = cappedFacts.map((fact, index) => {
    const siblingFacts = cappedFacts.filter((f, i) => i !== index);
    const options = buildMcOptions(
      fact,
      siblingFacts,
      extraDistractorPool,
      `A statement not covered in the section on "${chunk.heading}"`
    );

    return {
      prompt: 'Which of these statements is true according to this section?',
      options,
      correctAnswer: fact,
      explanation: `This is stated directly in the section on "${chunk.heading}": ${fact}`,
    };
  });

  return {
    type: 'objective_set',
    prompt: `Answer these questions about "${chunk.heading}" one at a time.`,
    questions: questions.map((question, i) => ({ id: `question-${i + 1}`, ...question })),
    explanation: `These questions are drawn directly from the section on "${chunk.heading}".`,
  };
}

module.exports = {
  stripHtml,
  safeText,
  STOP_WORDS,
  extractSubstantiveChunks,
  isBookendChunk,
  splitSentences,
  cleanEdges,
  looksClean,
  pickDeclarativeSentence,
  pickDeclarativeSentences,
  hashText,
  buildObjectiveSetFromPairs,
  buildObjectiveSetFromFacts,
};

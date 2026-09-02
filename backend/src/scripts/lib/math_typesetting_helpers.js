'use strict';
/**
 * Converts inline math notation already present in lesson HTML — written as
 * plain unicode (², −, ±, √, ÷, /) rather than LaTeX — into LaTeX delimited
 * with $...$, so the KaTeX pipeline already wired into LessonViewer.jsx
 * actually renders it (proper italic variables, a real fraction bar, a real
 * radical) instead of showing it as flat text.
 *
 * This only ever converts text spans it can positively identify as pure,
 * self-contained math — never partial phrases carved out of running prose —
 * because a wrong split (e.g. cutting a term in half) would render as
 * garbled or broken LaTeX, which is worse than leaving the text alone.
 * Two conservative extraction rules:
 *   1. The full contents of an <em>...</em> tag, when that whole span is
 *      pure math (content authors already isolate formulas this way in
 *      much of this corpus).
 *   2. Each individual sentence of a tag-free <li>/<p> (split the same
 *      decimal/abbreviation-safe way lesson_text_helpers.splitSentences
 *      does), optionally after a short "Label: " prefix (e.g. "Combine:
 *      2x + 8y"), when that whole sentence is pure math. Splitting sentence
 *      by sentence (rather than requiring the entire paragraph to qualify)
 *      both catches more real formulas and keeps multi-equation paragraphs
 *      from being mashed into a single cramped math block.
 * Anything not cleanly isolated this way (math embedded mid-sentence in
 * running prose with no separating punctuation) is left untouched rather
 * than guessed at.
 */

const { splitSentences } = require('./lesson_text_helpers');

const SUP_MAP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '⁺': '+', 'ⁿ': 'n', 'ⁱ': 'i' };
const SUB_MAP = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9', 'ₙ': 'n', 'ᵢ': 'i' };

const MATH_FUNCTION_WORDS = new Set([
  'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'ln', 'log', 'lim', 'exp', 'mod', 'deg', 'dx', 'dy', 'dt', 'ds', 'du',
]);

// Common short connectives that would otherwise pass the "<=2 letters" rule
// below (e.g. a sentence starting "So x = ..." or "in 3, 7, 11, ...") — these
// are prose, not math, no matter how short. Unit abbreviations are grouped in
// here too: real typesetting convention sets units upright, not in the
// italic variable font KaTeX would give them, so a formula mixed with units
// ("5 kg + 3 kg = 8 kg") is better left as plain text than styled wrong.
const ENGLISH_STOP_WORDS = new Set([
  'so', 'in', 'at', 'of', 'or', 'an', 'is', 'as', 'to', 'we', 'by', 'no', 'if', 'on',
  'kg', 'km', 'cm', 'mm', 'ms', 'hz', 'atm', 'mol', 'rpm', 'min', 'hr',
  'it', 'he', 'do', 'go', 'up', 'us', 'am', 'be', 'my', 'ok', 'hi', 'ha',
]);

// Whole-string check: every alphabetic run must be <=2 letters (a bare
// variable/short combo like "ac", "ab") or a whitelisted function name.
// requireMathSignal (default on) additionally demands at least one
// unambiguous math signal (a digit, '=', or a recognised operator/symbol —
// a bare +/- alone doesn't count, since that also matches ordinary
// hyphenated prose fragments) — turned off for the <em> rule, where the
// author already hand-picked this span for emphasis in a math-dense lesson,
// so a short unadorned token like "nx" or "ab" doesn't need extra proof.
function looksPureMath(text, { requireMathSignal = true } = {}) {
  const s = String(text).trim();
  if (!s) return false;
  if (s.length > 120) return false;
  if (requireMathSignal) {
    const hasMathSignal =
      /[0-9=×·÷√^_<>≤≥≠π]/.test(s) || /[⁰¹²³⁴⁵⁶⁷⁸⁹ⁿⁱ⁻⁺₀₁₂₃₄₅₆₇₈₉ₙᵢ]/.test(s);
    if (!hasMathSignal) return false;
  }
  // A bare number/year/list-marker ("1.", "(2015).", "23") has no variable or
  // operator for KaTeX styling to add anything to, and is exactly what a
  // numbered outline or an APA citation's year/edition looks like — reject
  // it rather than let citation dumps get mistaken for formulas.
  if (/^[\d\s().]+$/.test(s)) return false;
  // An ellipsis ("15, 19, 23...") signals descriptive "pattern continues"
  // prose, and its run of periods also confuses sentence-boundary splitting
  // upstream — never treat text containing one as a clean formula.
  if (s.includes('...')) return false;
  // A leading comma is the telltale sign of a stray fragment left over from
  // exactly that kind of bad split (e.g. "...15..., a = 3" splitting into
  // "15..." and ", a = 3") rather than a genuine formula, which never opens
  // with one.
  if (/^,/.test(s)) return false;
  // A morpheme/prefix fragment ("un-", "-ing") isn't math either, and (unlike
  // the cases above) only shows up once requireMathSignal is relaxed.
  if (/^-[a-z]+$|^[a-z]+-$/i.test(s)) return false;

  const words = s.match(/[A-Za-z]+/g) || [];
  for (const word of words) {
    const lower = word.toLowerCase();
    if (ENGLISH_STOP_WORDS.has(lower)) return false;
    if (word.length <= 2) continue;
    if (MATH_FUNCTION_WORDS.has(lower)) continue;
    return false;
  }

  if (/[^A-Za-z0-9\s+\-−±×·÷=<>≤≥≠()[\]{}^_/.,'′πθ√⁰¹²³⁴⁵⁶⁷⁸⁹ⁿⁱ⁻⁺₀₁₂₃₄₅₆₇₈₉ₙᵢ→∞]/.test(s)) return false;
  return true;
}

function findMatchingParen(s, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < s.length; i += 1) {
    if (s[i] === '(') depth += 1;
    else if (s[i] === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function convertSqrt(s) {
  let out = s;
  let idx;
  while ((idx = out.indexOf('√(')) !== -1) {
    const close = findMatchingParen(out, idx + 1);
    if (close === -1) break;
    const inner = out.slice(idx + 2, close);
    out = `${out.slice(0, idx)}\\sqrt{${inner}}${out.slice(close + 1)}`;
  }
  return out.replace(/√([A-Za-z0-9]+)/g, '\\sqrt{$1}');
}

// ASCII "^(...)" (as opposed to a unicode superscript char) needs its parens
// turned into braces — LaTeX's "^" only binds to the next single group, so
// left as literal parens, "x^(1/2)" would render as just "x" superscripted
// by "(", with "1/2)" dropping back to normal size afterward.
function convertCaretParens(s) {
  let out = s;
  let idx;
  while ((idx = out.indexOf('^(')) !== -1) {
    const close = findMatchingParen(out, idx + 1);
    if (close === -1) break;
    const inner = out.slice(idx + 2, close);
    out = `${out.slice(0, idx)}^{${inner}}${out.slice(close + 1)}`;
  }
  return out;
}

function convertSuperscripts(s) {
  return s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹ⁿⁱ⁻⁺]+/g, (run) => `^{${[...run].map((c) => SUP_MAP[c] || c).join('')}}`);
}

function convertSubscripts(s) {
  return s.replace(/[₀₁₂₃₄₅₆₇₈₉ₙᵢ]+/g, (run) => `_{${[...run].map((c) => SUB_MAP[c] || c).join('')}}`);
}

function topLevelPositions(s, ch) {
  let depth = 0;
  const positions = [];
  for (let i = 0; i < s.length; i += 1) {
    if (s[i] === '(' || s[i] === '{') depth += 1;
    else if (s[i] === ')' || s[i] === '}') depth -= 1;
    else if (s[i] === ch && depth === 0) positions.push(i);
  }
  return positions;
}

function stripOuterParens(s) {
  const t = s.trim();
  if (t[0] === '(' && t[t.length - 1] === ')' && findMatchingParen(t, 0) === t.length - 1) {
    return t.slice(1, -1).trim();
  }
  return t;
}

// A single top-level '/' becomes \frac{numerator}{denominator} — anything
// before a top-level '=' (e.g. "x = ") stays outside the fraction as a plain
// prefix. Left alone entirely (kept as a literal slash) if there's zero or
// more than one top-level '/', or ANY top-level '=' on the denominator side
// (e.g. Leibniz "d/dx[x^2] = 2x", where the slash isn't a numeric fraction at
// all) — the fraction's true numerator/denominator boundaries aren't
// reliably inferable once another equality follows the slash, and guessing
// wrong there silently swallows the rest of the string into the fraction.
function convertDivision(s) {
  const slashes = topLevelPositions(s, '/');
  if (slashes.length !== 1) return s;
  const [pos] = slashes;
  let left = s.slice(0, pos);
  const right = s.slice(pos + 1).trim();

  if (topLevelPositions(right, '=').length > 0) return s;

  const eqPositions = topLevelPositions(left, '=');
  let prefix = '';
  if (eqPositions.length > 1) return s;
  if (eqPositions.length === 1) {
    const [lastEq] = eqPositions;
    prefix = `${left.slice(0, lastEq + 1).trim()} `;
    left = left.slice(lastEq + 1);
  }

  return `${prefix}\\frac{${stripOuterParens(left)}}{${stripOuterParens(right)}}`;
}

function latexify(raw) {
  let s = raw.trim();
  s = convertSqrt(s);
  s = convertCaretParens(s);
  s = convertDivision(s);
  s = convertSuperscripts(s);
  s = convertSubscripts(s);
  s = s
    .replace(/−/g, '-')
    .replace(/–/g, '-')
    .replace(/±/g, '\\pm ')
    .replace(/×/g, '\\times ')
    .replace(/·/g, '\\cdot ')
    .replace(/÷/g, '\\div ')
    .replace(/≤/g, '\\le ')
    .replace(/≥/g, '\\ge ')
    .replace(/≠/g, '\\neq ')
    .replace(/→/g, '\\to ')
    .replace(/∞/g, '\\infty ')
    .replace(/π/g, '\\pi ')
    .replace(/θ/g, '\\theta ');
  return s.replace(/\s+/g, ' ').trim();
}

// Converts every safely-isolated math span in one paragraph's body_html.
// Returns { html, count } — count is how many spans were converted, so
// callers can track/report totals without a second pass.
// Final safety gate: actually parse the produced LaTeX through real KaTeX
// (not just our own regex logic) before ever writing it into lesson content.
// If latexify produced something KaTeX itself rejects, skip the conversion
// and leave the original text alone — an unconverted plain-text formula is
// a far better outcome than a broken/garbled one written into a live lesson.
let katex = null;
function isValidLatex(tex) {
  if (!katex) {
    // eslint-disable-next-line global-require
    katex = require('katex');
  }
  try {
    katex.renderToString(tex, { throwOnError: true, output: 'htmlAndMathml' });
    return true;
  } catch {
    return false;
  }
}

// Catches math left behind by the two rules above because it's embedded mid-
// sentence in running prose with no isolating punctuation (e.g. "3x and 7x
// (both have x¹); 5a² and −2a²...") — those clauses fail looksPureMath as a
// whole (real English words like "both", "have" are mixed in), but a single
// space-delimited token that itself contains a superscript/subscript
// character is unambiguous math no matter what surrounds it: no English word
// contains "²". Bounded to short alnum runs (<=4 chars either side of the
// super/subscript) with word-boundary lookaround, so it can only ever match
// a compact "5a²"/"x⁻³"-shaped token — never bleed into a real word that
// happens to end a sentence next to a stray character.
// Boundaries use \p{L}/\p{N} (any Unicode letter/digit), not just A-Za-z0-9 —
// otherwise an accented name like "Gödel" or "Erdős" has its first/last
// plain-ASCII letter ("G", "s") look "isolated" next to the non-ASCII letter
// beside it and gets mistaken for a bare one-letter variable.
const BARE_SUP_SUB_TOKEN = /(?<![\p{L}\p{N}])[−–]?[A-Za-z0-9]{0,4}[⁰¹²³⁴⁵⁶⁷⁸⁹ⁿⁱ⁻⁺₀₁₂₃₄₅₆₇₈₉ₙᵢ]+[A-Za-z0-9⁰¹²³⁴⁵⁶⁷⁸⁹ⁿⁱ⁻⁺₀₁₂₃₄₅₆₇₈₉ₙᵢ]{0,4}(?![\p{L}\p{N}])/gu;

// A short digit run immediately followed by a short LOWERCASE-letter run, no
// space, with an optional leading minus (e.g. "3x", "5a", "−3x") is just as
// unambiguous as the superscript case above: no English word is written as
// digits-then-letters with zero space. Deliberately restricted to lowercase
// trailing letters — fused unit shorthand like "60W", "5V", "10A" is common
// in this corpus's physics content and must stay upright text, not get
// italicised as if it were a coefficient-variable term.
const DIGIT_LETTER_TOKEN = /(?<![\p{L}\p{N}])[−–-]?[0-9]{1,3}[a-z]{1,3}(?![\p{L}\p{N}])/gu;
// Ordinal ("5th") and dimensionality ("2d", "3d") suffixes match the same
// digit+lowercase-letter shape but aren't variable terms; reuses the same
// unit-abbreviation stoplist as the whole-clause check for the same reason.
// "m"/"s" fused to a digit are as likely to be metres/seconds shorthand or
// (per "Technetium-99m") isotope notation as a coefficient-variable term —
// unlike the lowercase algebra letters, these aren't worth the false-positive
// risk on this corpus's physics/chemistry content.
const DIGIT_LETTER_INVALID_SUFFIX = new Set(['st', 'nd', 'rd', 'th', 'd', 'm', 's', ...ENGLISH_STOP_WORDS]);

function isGenuineDigitLetterToken(token) {
  const letters = (token.match(/[a-z]+$/) || [''])[0];
  return Boolean(letters) && !DIGIT_LETTER_INVALID_SUFFIX.has(letters);
}

function findProtectedRanges(html) {
  const ranges = [];
  const re = /\$[^$]*\$|<[^>]*>/g;
  let m;
  // eslint-disable-next-line no-cond-assign
  while ((m = re.exec(html))) {
    ranges.push([m.index, m.index + m[0].length]);
  }
  return ranges;
}

const stripTagsOnly = (s) => s.replace(/<[^>]*>/g, '');

// Global, tag-aware token matcher. Two things a naive "split around tags,
// process each chunk alone" approach gets wrong, both fixed here by working
// against the FULL original string instead of an isolated fragment:
//  1. A bare-letter/number match must not overlap an existing $...$ span or
//     an HTML tag itself (a tag name like "p" in "<p>" would otherwise look
//     like a standalone one-letter variable).
//  2. A match's true neighbouring characters must be found by walking the
//     full string and skipping over any tags in between — not just looking
//     within its own fragment — so "<strong>F</strong>irst" (a common
//     bold-first-letter mnemonic, e.g. FOIL) is correctly seen as "F" glued
//     to "irst" across the tag boundary, not an isolated letter.
function convertBareTokensWithRegex(html, regex, extraGuard) {
  let count = 0;
  const source = String(html);
  const protectedRanges = findProtectedRanges(source);
  const globalRegex = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`);

  let result = '';
  let lastIndex = 0;
  let m;
  // eslint-disable-next-line no-cond-assign
  while ((m = globalRegex.exec(source))) {
    const token = m[0];
    const start = m.index;
    const end = start + token.length;

    if (protectedRanges.some(([rs, re]) => start < re && end > rs)) continue;

    const prevVisible = stripTagsOnly(source.slice(0, start)).slice(-1);
    const nextVisible = stripTagsOnly(source.slice(end)).slice(0, 1);
    if (/[\p{L}\p{N}]/u.test(prevVisible) || /[\p{L}\p{N}]/u.test(nextVisible)) continue;

    if (extraGuard && !extraGuard(token, start, source)) continue;
    // A token that's ONLY super/subscript characters (e.g. a bare "²" left
    // over from "(x - 1)²", where the exponent actually applies to the whole
    // preceding parenthesised group) has no base for KaTeX to attach it to —
    // KaTeX renders that as a floating superscript over nothing rather than
    // erroring, so isValidLatex alone won't catch it.
    if (!/[A-Za-z0-9]/.test(token)) continue;
    const tex = latexify(token);
    if (!isValidLatex(tex)) continue;

    result += source.slice(lastIndex, start) + `$${tex}$`;
    lastIndex = end;
    count += 1;
  }
  result += source.slice(lastIndex);
  return { html: result, count };
}

// A bare number or a bare single-letter variable, with nothing attached, is
// the last and most ambiguous case — "5" or "x" alone could be anything. Two
// guards keep this safe: numbers reject a plausible 4-digit year (dates like
// "1637" and "1995" show up throughout the history-of-mathematics content)
// and reject anything immediately followed by a unit-ish word ("5 kg", "50 m
// north", "357 years"); letters reject the handful of single-letter strings
// that are themselves real English words ("a", "I", informal "o").
// The trailing lookahead excludes a following digit directly (avoids
// matching just "2" out of the decimal "2.5") and a following "." only when
// THAT period is itself followed by another digit (same reason, e.g. "2" in
// "2.5") — a period ending the sentence ("b = 0.") is fine to match through.
// Also excludes a following ",\d" — a thousands-separator comma continuing
// the same number ("216,000") — so it's left fully alone rather than
// converting just the first group and stranding ",000" as plain text.
const STANDALONE_NUMBER = /(?<![\p{L}\p{N}.])[−–-]?\d+(?![\p{L}\p{N}])(?!\.\d)(?!,\d)/gu;
// The lookbehind/lookahead also exclude a straight or curly apostrophe —
// without that, the "s" in a possessive ("atom's mass") or the "t" in a
// contraction ("won't", "can't") satisfies "no adjacent letter" just as
// well as a genuine bare variable would, and gets wrongly italicised.
const STANDALONE_LETTER = /(?<![\p{L}\p{N}'’])[a-zA-Z](?![\p{L}\p{N}'’])/gu;
const SINGLE_LETTER_STOP = new Set(['a', 'i', 'o']);
const NUMBER_FOLLOW_STOP = new Set([
  'kg', 'km', 'cm', 'mm', 'ms', 'hz', 'atm', 'mol', 'rpm', 'min', 'hr',
  'm', 's', 'w', 'v', 'n', 'j', 'cedis', 'pages', 'page', 'week', 'weeks',
  'year', 'years', 'day', 'days', 'hour', 'hours', 'second', 'seconds',
  'minute', 'minutes', 'times', 'students', 'marks', 'points', 'degrees',
  'units', 'people', 'cars',
]);
// A number right after one of these is a reference/label ("Lesson 2",
// "Example 3", "Step 5"), not a mathematical value.
const NUMBER_PRECEDE_STOP = new Set([
  'lesson', 'chapter', 'unit', 'section', 'part', 'step', 'grade', 'level',
  'week', 'day', 'page', 'example', 'question', 'figure', 'table', 'form',
  'class', 'semester',
]);

function isPlausibleYear(token) {
  const digits = token.replace(/^[−–-]/, '');
  if (digits.length !== 4) return false;
  const n = Number(digits);
  return n >= 1000 && n <= 2099;
}

function isConvertibleStandaloneNumber(token, offset, str) {
  if (isPlausibleYear(token)) return false;
  const after = str.slice(offset + token.length);
  const followingWord = (after.match(/^\s*([A-Za-z]+)/) || [null, ''])[1].toLowerCase();
  if (NUMBER_FOLLOW_STOP.has(followingWord)) return false;
  const before = stripTagsOnly(str.slice(0, offset));
  const precedingWord = (before.match(/([A-Za-z]+)\s*$/) || [null, ''])[1].toLowerCase();
  return !NUMBER_PRECEDE_STOP.has(precedingWord);
}

function isConvertibleStandaloneLetter(token, offset, str) {
  // "variable(s)"/"power(s)" — the English optional-plural marker, not a
  // variable named "s" — reject specifically when the token is "s",
  // bracketed by "(" and ")", and that "(" is glued directly onto a
  // preceding multi-letter WORD (no space) — a single preceding letter is a
  // function name instead ("f(s)"), which is genuine math and stays.
  if (token.toLowerCase() === 's') {
    const beforeParen = stripTagsOnly(str.slice(0, offset));
    const afterParen = stripTagsOnly(str.slice(offset + token.length));
    const precedingWord = (beforeParen.match(/([A-Za-z]+)\($/) || [])[1];
    if (precedingWord && precedingWord.length >= 2 && afterParen.startsWith(')')) {
      return false;
    }
  }
  // "°C" (degrees Celsius) is a unit, not the integration-constant/variable
  // "C" — reject specifically when directly preceded by a degree sign.
  if (token.toUpperCase() === 'C') {
    const prevVisible = stripTagsOnly(str.slice(0, offset)).slice(-1);
    if (prevVisible === '°') return false;
  }
  // "c.300 BCE" ("circa") is a date approximation, not the variable "c" —
  // reject specifically when directly followed by ".<digit>".
  if (token.toLowerCase() === 'c') {
    const after = stripTagsOnly(str.slice(offset + token.length, offset + token.length + 2));
    if (/^\.\d/.test(after)) return false;
  }
  // "e" and "g" (and "i", already excluded below) are single letters that
  // fall right out of "e.g."/"i.e." — check a short window of context for
  // those abbreviations so they don't get split into "$e$.$g$.".
  if (token.toLowerCase() === 'e' || token.toLowerCase() === 'g') {
    const context = (
      stripTagsOnly(str.slice(Math.max(0, offset - 4), offset)) +
      token +
      stripTagsOnly(str.slice(offset + token.length, offset + token.length + 4))
    ).toLowerCase();
    if (/e\.g\.|i\.e\./.test(context)) return false;
  }
  if (!SINGLE_LETTER_STOP.has(token.toLowerCase())) return true;
  // "a"/"i"/"o" are excluded by default (the article "a", the pronoun "I",
  // informal "o") — but "a = 0" or "5 = a" is unambiguous algebra regardless,
  // so allow the stop-listed letter through specifically when directly
  // flanked by "=" (skipping over any tags/whitespace in between).
  const prevVisible = stripTagsOnly(str.slice(0, offset)).trimEnd().slice(-1);
  const nextVisible = stripTagsOnly(str.slice(offset + token.length)).trimStart().slice(0, 1);
  return prevVisible === '=' || nextVisible === '=';
}

function convertBareSupSubTokens(html) {
  let count = 0;
  let out = String(html);

  const supSubResult = convertBareTokensWithRegex(out, BARE_SUP_SUB_TOKEN);
  out = supSubResult.html;
  count += supSubResult.count;

  const digitLetterResult = convertBareTokensWithRegex(out, DIGIT_LETTER_TOKEN, isGenuineDigitLetterToken);
  out = digitLetterResult.html;
  count += digitLetterResult.count;

  const numberResult = convertBareTokensWithRegex(out, STANDALONE_NUMBER, isConvertibleStandaloneNumber);
  out = numberResult.html;
  count += numberResult.count;

  const letterResult = convertBareTokensWithRegex(out, STANDALONE_LETTER, isConvertibleStandaloneLetter);
  out = letterResult.html;
  count += letterResult.count;

  return { html: out, count };
}

// Splits plain text into sentences (decimal/abbreviation-safe, via
// lesson_text_helpers.splitSentences) and converts each one independently —
// shared by the tag-free <li>/<p> rule, the <strong>Label</strong>: variant
// of that same rule, and exercise fields (which are plain text, no HTML at
// all). Returns { text, count }; a sentence that doesn't qualify is returned
// unchanged, so callers can join the result back together either way.
function convertSentencesInPlainText(text) {
  let count = 0;
  const original = String(text);
  const sentences = splitSentences(original);
  if (sentences.length === 0) return { text, count };

  // splitSentences' regex only captures runs ending in a terminator (.!?) —
  // trailing content after the LAST terminator (e.g. the dangling ")" that
  // closes an earlier-opened parenthetical, as in "...≠ 0.)") isn't part of
  // any match and would otherwise be silently dropped when the processed
  // sentences are joined back together. Recover it by walking forward
  // through the original text to find where the last sentence actually ends.
  let cursor = 0;
  let lastEnd = original.length;
  for (const sentence of sentences) {
    const idx = original.indexOf(sentence, cursor);
    if (idx === -1) break; // shouldn't happen, but never lose text if it does
    lastEnd = idx + sentence.length;
    cursor = lastEnd;
  }
  const trailingLeftover = original.slice(lastEnd);

  const converted = sentences.map((sentence) => {
    // splitSentences keeps the sentence-ending punctuation on the string —
    // pull it off before math-processing (else a trailing "." can get pulled
    // inside a \frac{...}{...} as part of the denominator) and put it back
    // outside the closing "$" afterward, as ordinary punctuation.
    const terminatorMatch = /([.!?]+)\s*$/.exec(sentence);
    const terminator = terminatorMatch ? terminatorMatch[1] : '';
    const body = terminator ? sentence.slice(0, terminatorMatch.index) : sentence;

    const colonIdx = body.indexOf(':');
    const label = colonIdx >= 0 ? body.slice(0, colonIdx) : '';
    const remainder = colonIdx >= 0 ? body.slice(colonIdx + 1) : body;
    const trimmedRemainder = remainder.trim();
    // A label prefix must itself be short, plain text (not already math) —
    // guards against colons that are actually inside a formula, e.g. ratios.
    if (label && (label.length > 40 || !/^[A-Za-z][A-Za-z0-9 '/-]*$/.test(label))) return sentence;
    if (!looksPureMath(trimmedRemainder)) return sentence;
    const tex = latexify(trimmedRemainder);
    if (!isValidLatex(tex)) return sentence;
    count += 1;
    const prefix = label ? `${label}: ` : '';
    return `${prefix}$${tex}$${terminator}`;
  });

  return { text: converted.join(' ') + trailingLeftover, count };
}

function convertMathInHtml(html) {
  let count = 0;
  let out = String(html || '');

  out = out.replace(/<em>([^<]+)<\/em>/g, (match, inner) => {
    // No hasMathSignal requirement here — the author already hand-picked
    // this span for emphasis in a math-dense lesson (e.g. "the answer is
    // <em>nx</em>"), so a short unadorned alphabetic token doesn't need a
    // digit/operator alongside it to be trusted as a formula.
    if (!looksPureMath(inner, { requireMathSignal: false })) return match;
    const tex = latexify(inner);
    if (!isValidLatex(tex)) return match;
    count += 1;
    return `$${tex}$`;
  });

  // "<li><strong>Label</strong>: rest of the sentence...</li>" — the same
  // shape as the tag-free rule below, just with the label itself bolded
  // instead of plain (extremely common in this corpus: "**Terms**: 5x², ...").
  // The <strong>...</strong> wrapper is left untouched; only the text after
  // the colon goes through per-sentence math conversion.
  out = out.replace(/<(li|p)><strong>([^<]+)<\/strong>:([^<]+)<\/\1>/g, (match, tag, label, rest) => {
    const { text: convertedRest, count: n } = convertSentencesInPlainText(rest.trim());
    if (n === 0) return match;
    count += n;
    return `<${tag}><strong>${label}</strong>: ${convertedRest}</${tag}>`;
  });

  out = out.replace(/<(li|p)>([^<]+)<\/\1>/g, (match, tag, inner) => {
    const { text: convertedText, count: n } = convertSentencesInPlainText(inner);
    if (n === 0) return match;
    count += n;
    return `<${tag}>${convertedText}</${tag}>`;
  });

  const bareTokenResult = convertBareSupSubTokens(out);
  out = bareTokenResult.html;
  count += bareTokenResult.count;

  return { html: out, count };
}

// For exercise prompt/option/explanation strings — plain text, no HTML tags
// at all, so the HTML-aware rules above don't apply. Runs the same
// sentence-level conversion plus the bare-token passes.
function convertMathInPlainText(text) {
  let count = 0;
  const sentenceResult = convertSentencesInPlainText(String(text || ''));
  let out = sentenceResult.text;
  count += sentenceResult.count;

  const bareTokenResult = convertBareSupSubTokens(out);
  out = bareTokenResult.html;
  count += bareTokenResult.count;

  return { text: out, count };
}

// Converts the plain-text fields of one stored exercise object (prompt,
// options, explanation, correctAnswer/answer) — and, for the richer types,
// the same fields nested one level down (objective_set's questions[],
// ordering's items[].text). correctAnswer/answer are converted independently
// rather than copied from whichever option they match: convertMathInPlainText
// is a pure function, so running it on the same source string twice always
// produces the same result, keeping the exercise's own answer-matching logic
// (a straight string comparison against the chosen option) working unchanged.
function convertExerciseObject(exercise) {
  if (!exercise || typeof exercise !== 'object') return { exercise, count: 0 };
  let count = 0;
  const next = { ...exercise };

  const convertField = (value) => {
    if (typeof value !== 'string' || !value) return value;
    const { text, count: n } = convertMathInPlainText(value);
    count += n;
    return text;
  };

  next.prompt = convertField(next.prompt);
  next.explanation = convertField(next.explanation);
  next.correctAnswer = convertField(next.correctAnswer);
  next.answer = convertField(next.answer);
  if (Array.isArray(next.options)) {
    next.options = next.options.map(convertField);
  }
  if (Array.isArray(next.questions)) {
    next.questions = next.questions.map((q) => {
      const { exercise: convertedQ, count: n } = convertExerciseObject(q);
      count += n;
      return convertedQ;
    });
  }
  if (Array.isArray(next.items)) {
    next.items = next.items.map((item) => {
      if (!item || typeof item.text !== 'string') return item;
      const { text, count: n } = convertMathInPlainText(item.text);
      count += n;
      return { ...item, text };
    });
  }

  return { exercise: next, count };
}

// Applies convertExerciseObject across a lesson's `exercises` or
// `final_assessment` array (either may contain `null` placeholder entries
// for bookend chunks with no exercise — passed through untouched).
function convertExerciseArray(exercises) {
  if (!Array.isArray(exercises)) return { exercises, count: 0 };
  let count = 0;
  const next = exercises.map((exercise) => {
    if (!exercise) return exercise;
    const { exercise: converted, count: n } = convertExerciseObject(exercise);
    count += n;
    return converted;
  });
  return { exercises: next, count };
}

module.exports = {
  looksPureMath,
  latexify,
  convertMathInHtml,
  convertMathInPlainText,
  convertExerciseArray,
};

'use strict';
/**
 * Deterministic (no-API) replacement of em-dash (—) usage in lesson prose with
 * punctuation a human writer would actually reach for. Em-dash asides are one
 * of the most recognisable LLM-writing tells; this rewrites them based on how
 * the surrounding text is shaped:
 *   - a paired aside ("X — Y — Z")            -> parenthetical  "X (Y) Z"
 *   - a trailing clause introducing a list     -> colon          "X: a, b, and c"
 *   - a trailing clause starting a Title Case
 *     fragment (headings like "Welcome — X")   -> hyphen         "X - Y"
 *   - everything else (asides, clause joins)   -> comma          "X, Y"
 * Only the em-dash character (—, U+2014) is touched. En-dashes used for
 * number/date ranges (1904–1987, −2 ≤ x < 3) are left alone.
 */

function humanizeEmDashes(text) {
  if (typeof text !== 'string' || !text.includes('—')) return text;
  let result = text;

  // Paired dash: "X — aside — Y" -> "X (aside) Y". The aside must not itself
  // cross a tag, existing parenthetical, or sentence boundary, or a genuinely
  // unrelated pair of single dashes elsewhere in the string could get fused
  // into one (and mangle any real "(...)" that sits between them).
  result = result.replace(/\s*—\s*([^—<>.!?()]{1,150}?)\s*—\s*/g, (m, aside, offset, str) => {
    const after = str.slice(offset + m.length);
    const needsComma = /^(and|but|or|nor)\b/i.test(after);
    return ` (${aside.trim()})${needsComma ? ',' : ''} `;
  });

  // Remaining single dashes.
  result = result.replace(/\s*—\s*/g, (m, offset, str) => {
    const after = str.slice(offset + m.length);
    const boundaryIdx = after.search(/[.!?<()]/);
    const span = boundaryIdx === -1 ? after : after.slice(0, boundaryIdx);
    const commaCount = (span.match(/,/g) || []).length;
    if (commaCount >= 2) return ': '; // "...three statuses — a, b, and c" -> list intro
    if (/^[A-Z]/.test(after)) return ' - '; // "Welcome — Subtitle" -> title/heading separator
    return ', ';
  });

  return result.replace(/ {2,}/g, ' ');
}

// Recursively rewrites every string leaf of a JSON-shaped value (arrays,
// plain objects, or a bare string). Used to apply humanizeEmDashes across an
// entire lesson_document / exercises / objectives JSONB blob without needing
// to know its exact shape up front.
function humanizeDeep(value) {
  if (typeof value === 'string') return humanizeEmDashes(value);
  if (Array.isArray(value)) return value.map(humanizeDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value)) out[key] = humanizeDeep(value[key]);
    return out;
  }
  return value;
}

module.exports = { humanizeEmDashes, humanizeDeep };

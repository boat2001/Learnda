const EXTERNAL_URL_RE = /https?:\/\/[^\s<>"{}|\\^`[\]]+|www\.[a-zA-Z0-9.-]+\.[a-z]{2,}[^\s]*/gi;
const REPEAT_CHAR_RE = /(.)\1{9,}/;

const MAX_LENGTH = 2000;
const DUPLICATE_WINDOW_MS = 10_000;

// Per-process rolling cache: "userId:context" → { body, time }
const _lastMsg = new Map();

function _extractDomain(rawUrl) {
  try {
    const url = rawUrl.startsWith('www.') ? `https://${rawUrl}` : rawUrl;
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return rawUrl.slice(0, 40);
  }
}

function hasExternalLinks(text) {
  EXTERNAL_URL_RE.lastIndex = 0;
  return EXTERNAL_URL_RE.test(text);
}

function neutralizeLinks(text) {
  EXTERNAL_URL_RE.lastIndex = 0;
  return text.replace(EXTERNAL_URL_RE, (match) => `[LINK:${_extractDomain(match)}]`);
}

/**
 * Validates message content. Returns { valid, error }.
 * Does NOT record the message — call processMessage() on the final save path.
 */
function validateMessage(body, userId, context = 'global') {
  if (body.length > MAX_LENGTH) {
    return { valid: false, error: `Messages cannot exceed ${MAX_LENGTH} characters.` };
  }
  if (REPEAT_CHAR_RE.test(body)) {
    return { valid: false, error: 'Please avoid repeating the same character excessively.' };
  }
  const key = `${userId}:${context}`;
  const last = _lastMsg.get(key);
  if (last && last.body === body && Date.now() - last.time < DUPLICATE_WINDOW_MS) {
    return { valid: false, error: 'You already sent this message.' };
  }
  return { valid: true };
}

/**
 * Validates, neutralizes external links, then records the message for duplicate detection.
 * Returns { valid, error?, body, linksNeutralized }.
 */
function processMessage(body, userId, context = 'global') {
  const check = validateMessage(body, userId, context);
  if (!check.valid) return { ...check, body, linksNeutralized: false };

  const linksNeutralized = hasExternalLinks(body);
  const processedBody = linksNeutralized ? neutralizeLinks(body) : body;

  _lastMsg.set(`${userId}:${context}`, { body, time: Date.now() });

  return { valid: true, body: processedBody, linksNeutralized };
}

module.exports = { processMessage, hasExternalLinks, MAX_LENGTH };

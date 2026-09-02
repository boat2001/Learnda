/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BACKEND_ROOT = path.resolve(__dirname, '..', '..');
const INPUT_DIR = path.join(BACKEND_ROOT, 'uploads', 'edutainment');
const OUTPUT_DIR = path.join(BACKEND_ROOT, 'data', 'edutainment');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'canonical_edutainment.json');

const CATEGORY_CONFIG = Object.freeze({
  articles: {
    file: 'articles.txt',
    contentType: 'edutainment',
    tone: 'fact',
    sourceCategory: 'facts',
    normalizedCategory: 'facts',
    countCategory: 'facts',
    slugPrefix: 'facts',
    tags: ['fact', 'did-you-know', 'edutainment']
  },
  stories: {
    file: 'stories.txt',
    contentType: 'edutainment',
    tone: 'story',
    normalizedCategory: 'stories',
    tags: ['story', 'edutainment']
  },
  facts: {
    file: 'facts.txt',
    contentType: 'edutainment',
    tone: 'fact',
    normalizedCategory: 'facts',
    tags: ['fact', 'did-you-know', 'edutainment']
  },
  quotes: {
    file: 'quotes.txt',
    contentType: 'quote',
    tone: 'quote',
    normalizedCategory: 'quotes',
    tags: ['quote', 'edutainment']
  },
  jokes: {
    file: 'jokes.txt',
    contentType: 'edutainment',
    tone: 'joke',
    normalizedCategory: 'jocular',
    tags: ['joke', 'jocular', 'edutainment']
  }
});

function toAsciiText(value) {
  return String(value || '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, '...')
    .replace(/\r/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .trim();
}

function slugify(value) {
  return toAsciiText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function toReadTimeLabel(text) {
  const wordCount = String(text || '').split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(wordCount / 180));
  return `${minutes} min read`;
}

function cleanEntryLines(lines = []) {
  const cleaned = lines
    .map((line) => toAsciiText(line))
    .filter(Boolean)
    .filter((line) => !/^(key lesson|lesson)\s*:\s*$/i.test(line))
    .map((line) => line.replace(/^\s*[-*]\s+/, '').trim());
  return cleaned;
}

function splitByNumericMarkers(rawText) {
  const normalized = toAsciiText(rawText);
  const matcher = /(?:^|\n)\s*(\d+)\.\s*([\s\S]*?)(?=(?:\n\s*\d+\.\s)|$)/g;
  const sections = [];
  let match = matcher.exec(normalized);
  while (match) {
    const blockText = toAsciiText(match[2] || '');
    if (blockText) sections.push(blockText);
    match = matcher.exec(normalized);
  }
  return sections;
}

function splitByStoryMarkers(rawText) {
  const chunks = rawText
    .split(/(?:^|\n)\s*Story\s+\d+\s*:\s*/gi)
    .map((part) => toAsciiText(part))
    .filter(Boolean);
  return chunks;
}

function createDedupeKey(categoryKey, title, body) {
  const raw = `${categoryKey}|${slugify(title)}|${slugify(body).slice(0, 120)}`;
  return crypto.createHash('sha1').update(raw).digest('hex');
}

function buildArticleItems(rawText) {
  const chunks = splitByNumericMarkers(rawText);
  return chunks.map((chunk, index) => {
    const lines = cleanEntryLines(chunk.split('\n'));
    const title = lines[0] || `Article ${index + 1}`;
    const bodyLines = lines.slice(1);
    const body = bodyLines.join('\n\n').trim();
    const keyLessonLine = bodyLines.find((line) => /^key lesson:/i.test(line)) || '';
    const keyLesson = keyLessonLine.replace(/^key lesson:\s*/i, '').trim();
    return {
      title,
      body,
      keyLesson,
      readTime: toReadTimeLabel(body || title)
    };
  }).filter((item) => item.body);
}

function buildStoryItems(rawText) {
  const chunks = splitByStoryMarkers(rawText);
  return chunks.map((chunk, index) => {
    const lines = cleanEntryLines(chunk.split('\n'));
    const title = lines[0] || `Story ${index + 1}`;
    const lessonLine = lines.find((line) => /^lesson:/i.test(line)) || '';
    const lesson = lessonLine.replace(/^lesson:\s*/i, '').trim();
    const contentLines = lines.slice(1).filter((line) => !/^lesson:/i.test(line));
    const body = contentLines.join('\n\n').trim();
    return {
      title,
      body,
      keyLesson: lesson,
      readTime: toReadTimeLabel(body || title)
    };
  }).filter((item) => item.body);
}

function buildFactItems(rawText) {
  const chunks = splitByNumericMarkers(rawText);
  return chunks.map((chunk, index) => {
    const line = toAsciiText(chunk.replace(/\n+/g, ' ').trim());
    const cleaned = line.replace(/^did you know\??\s*/i, '').trim();
    const title = `Did You Know #${index + 1}`;
    return {
      title,
      body: cleaned.endsWith('.') ? cleaned : `${cleaned}.`,
      keyLesson: '',
      readTime: '1 min read'
    };
  }).filter((item) => item.body);
}

function buildQuoteItems(rawText) {
  const chunks = splitByNumericMarkers(rawText);
  return chunks.map((chunk, index) => {
    const quoteText = toAsciiText(chunk.replace(/\n+/g, ' ').trim()).replace(/^"+|"+$/g, '');
    return {
      title: `Quote ${index + 1}`,
      body: quoteText,
      keyLesson: '',
      readTime: '1 min read'
    };
  }).filter((item) => item.body);
}

function buildJokeItems(rawText) {
  const chunks = splitByNumericMarkers(rawText);
  return chunks.map((chunk, index) => {
    const lines = cleanEntryLines(chunk.split('\n'));
    const body = lines.join('\n').trim();
    return {
      title: `Joke ${index + 1}`,
      body,
      keyLesson: '',
      readTime: '1 min read'
    };
  }).filter((item) => item.body);
}

function parseCategory(categoryKey, config) {
  const inputPath = path.join(INPUT_DIR, config.file);
  const raw = fs.readFileSync(inputPath, 'utf8');
  const withoutHeader = raw.replace(/^#.*$/m, '').trim();
  const diagnostics = {
    category: categoryKey,
    sourceFile: config.file,
    skipped: [],
    warnings: [],
    totalBlocks: 0,
    parsedItems: 0
  };

  let parsedItems = [];
  if (categoryKey === 'articles') parsedItems = buildArticleItems(withoutHeader);
  if (categoryKey === 'stories') parsedItems = buildStoryItems(withoutHeader);
  if (categoryKey === 'facts') parsedItems = buildFactItems(withoutHeader);
  if (categoryKey === 'quotes') parsedItems = buildQuoteItems(withoutHeader);
  if (categoryKey === 'jokes') parsedItems = buildJokeItems(withoutHeader);
  diagnostics.totalBlocks = parsedItems.length;

  const normalizedItems = parsedItems.map((item, index) => {
    const body = toAsciiText(item.body);
    const title = toAsciiText(item.title) || `${config.normalizedCategory} ${index + 1}`;
    if (!body) {
      diagnostics.skipped.push({
        index: index + 1,
        reason: 'empty_body',
        preview: title
      });
      return null;
    }
    if (body.length < 18) {
      diagnostics.warnings.push({
        index: index + 1,
        reason: 'very_short_body',
        preview: body
      });
    }
    const sourceCategory = config.sourceCategory || categoryKey;
    const slugPrefix = config.slugPrefix || sourceCategory;
    const slug = slugify(`${slugPrefix}-${index + 1}-${item.title}`);
    const dedupeKey = createDedupeKey(sourceCategory, item.title, item.body);
    return {
      sourceCategory,
      normalizedCategory: config.normalizedCategory,
      contentType: config.contentType,
      tone: config.tone,
      title: item.title,
      body: item.body,
      summary: item.keyLesson || item.body.split(/\n+/)[0] || item.title,
      keyLesson: item.keyLesson || null,
      readTime: item.readTime,
      tags: Array.from(new Set(config.tags)),
      slug,
      dedupeKey,
      sourcePath: `uploads/edutainment/${config.file}`
    };
  }).filter(Boolean);

  diagnostics.parsedItems = normalizedItems.length;
  return { items: normalizedItems, diagnostics };
}

function buildCanonicalPayload() {
  const entries = [];
  const byCategory = {};
  const diagnosticsByCategory = {};

  Object.entries(CATEGORY_CONFIG).forEach(([categoryKey, config]) => {
    const { items, diagnostics } = parseCategory(categoryKey, config);
    const countCategory = config.countCategory || categoryKey;
    byCategory[countCategory] = (byCategory[countCategory] || 0) + items.length;
    diagnosticsByCategory[categoryKey] = diagnostics;
    entries.push(...items);
  });

  const dedupeSet = new Set();
  const dedupeWarnings = [];
  const dedupedEntries = entries.filter((item) => {
    if (dedupeSet.has(item.dedupeKey)) {
      dedupeWarnings.push({
        reason: 'duplicate_dedupe_key',
        dedupeKey: item.dedupeKey,
        title: item.title,
        sourcePath: item.sourcePath
      });
      return false;
    }
    dedupeSet.add(item.dedupeKey);
    return true;
  });

  return {
    generatedAt: new Date().toISOString(),
    sourceDir: 'backend/uploads/edutainment',
    schemaVersion: 'edutainment.v1',
    totals: {
      beforeDedupe: entries.length,
      afterDedupe: dedupedEntries.length,
      byCategory
    },
    diagnostics: {
      dedupeWarnings,
      byCategory: diagnosticsByCategory
    },
    entries: dedupedEntries
  };
}

function main() {
  const payload = buildCanonicalPayload();
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Canonical edutainment data written to ${OUTPUT_FILE}`);
  console.log(`Total entries: ${payload.totals.afterDedupe}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  buildCanonicalPayload
};

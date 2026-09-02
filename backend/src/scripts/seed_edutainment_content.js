/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { connectAndSync, sequelize, TextItem, ContentStats, User } = require('../models');

const BACKEND_ROOT = path.resolve(__dirname, '..', '..');
const CANONICAL_PATH = path.join(BACKEND_ROOT, 'data', 'edutainment', 'canonical_edutainment.json');
const BLOGS_DATA_PATH = path.join(BACKEND_ROOT, 'data', 'blogs-data.php');

function safeReadJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing canonical data file: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function asDateValue(baseDate, offset) {
  return new Date(baseDate.getTime() + offset * 60 * 1000);
}

function toWordCount(value) {
  return String(value || '')
    .split(/\s+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean).length;
}

function decodeHtmlEntities(text) {
  if (!text) return text;
  const entityMap = {
    '&amp;': '&',
    '&quot;': '"',
    '&apos;': "'",
    '&lt;': '<',
    '&gt;': '>',
    '&nbsp;': ' ',
    '&ndash;': '-',
    '&mdash;': '-',
    '&ldquo;': '"',
    '&rdquo;': '"',
    '&lsquo;': "'",
    '&rsquo;': "'"
  };

  return Object.keys(entityMap).reduce(
    (output, key) => output.split(key).join(entityMap[key]),
    text
  )
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function normalizeLegacyText(value) {
  if (value === null || value === undefined) return '';
  let text = decodeHtmlEntities(String(value));
  const fixMap = {
    'â€™': "'",
    'â€˜': "'",
    'â€œ': '"',
    'â€': '"',
    'â€“': '-',
    'â€”': '-',
    'â€¢': '-',
    'â€¦': '...',
    'â€•': '-',
    'Â': '',
    'Ã¢â‚¬â„¢': "'",
    'Ã¢â‚¬â€œ': '-',
    'Ã¢â‚¬â€': '"'
  };

  Object.keys(fixMap).forEach((key) => {
    text = text.split(key).join(fixMap[key]);
  });

  return text
    .replace(/\r/g, '')
    .replace(/\t/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\s+\n/g, '\n')
    .trim()
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x00-\x7F]/g, '');
}

function slugify(value) {
  return normalizeLegacyText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function skipWhitespace(raw, index) {
  let cursor = index;
  while (cursor < raw.length && /\s/.test(raw[cursor])) cursor += 1;
  return cursor;
}

function readPhpString(raw, quoteIndex) {
  let value = '';
  let cursor = quoteIndex + 1;

  while (cursor < raw.length) {
    const char = raw[cursor];
    if (char === '\\' && cursor + 1 < raw.length) {
      value += raw[cursor + 1];
      cursor += 2;
      continue;
    }
    if (char === "'") {
      return { value, endIndex: cursor + 1 };
    }
    value += char;
    cursor += 1;
  }

  return { value, endIndex: raw.length };
}

function findMatchingBracket(raw, openIndex) {
  let depth = 0;
  let cursor = openIndex;
  let inString = false;

  while (cursor < raw.length) {
    const char = raw[cursor];

    if (inString) {
      if (char === '\\') {
        cursor += 2;
        continue;
      }
      if (char === "'") inString = false;
      cursor += 1;
      continue;
    }

    if (char === "'") {
      inString = true;
      cursor += 1;
      continue;
    }
    if (char === '[') depth += 1;
    if (char === ']') {
      depth -= 1;
      if (depth === 0) return cursor;
    }
    cursor += 1;
  }

  return -1;
}

function extractPhpStringField(block, key) {
  const match = new RegExp(`'${key}'\\s*=>\\s*(?:time_elapsed_string\\(\\s*)?`).exec(block);
  if (!match) return '';

  const quoteIndex = block.indexOf("'", match.index + match[0].length);
  if (quoteIndex < 0) return '';

  return normalizeLegacyText(readPhpString(block, quoteIndex).value);
}

function extractPhpArrayBlock(block, key) {
  const match = new RegExp(`'${key}'\\s*=>\\s*\\[`).exec(block);
  if (!match) return '';

  const openIndex = block.indexOf('[', match.index);
  const closeIndex = findMatchingBracket(block, openIndex);
  if (closeIndex < 0) return '';

  return block.slice(openIndex + 1, closeIndex);
}

function extractBlogParagraphs(block) {
  const textBlock = extractPhpArrayBlock(block, 'text_content');
  if (!textBlock) return [];

  const paragraphs = [];
  const keyRegex = /'par-[^']+'\s*=>\s*'/g;
  let match;

  while ((match = keyRegex.exec(textBlock))) {
    const quoteIndex = match.index + match[0].length - 1;
    const parsed = readPhpString(textBlock, quoteIndex);
    const paragraph = normalizeLegacyText(parsed.value);
    if (paragraph) paragraphs.push(paragraph);
    keyRegex.lastIndex = parsed.endIndex;
  }

  return paragraphs;
}

function parseBlogsData(filePath = BLOGS_DATA_PATH) {
  if (!fs.existsSync(filePath)) return [];

  const raw = fs.readFileSync(filePath, 'utf8');
  const postsStart = raw.indexOf('$blog_posts');
  if (postsStart < 0) return [];

  const openIndex = raw.indexOf('[', postsStart);
  const closeIndex = findMatchingBracket(raw, openIndex);
  if (openIndex < 0 || closeIndex < 0) return [];

  const postsBlock = raw.slice(openIndex + 1, closeIndex);
  const blogs = [];
  let cursor = 0;

  while (cursor < postsBlock.length) {
    const quoteIndex = postsBlock.indexOf("'", cursor);
    if (quoteIndex < 0) break;

    const titleString = readPhpString(postsBlock, quoteIndex);
    let afterTitle = skipWhitespace(postsBlock, titleString.endIndex);
    if (!postsBlock.startsWith('=>', afterTitle)) {
      cursor = titleString.endIndex;
      continue;
    }

    afterTitle = skipWhitespace(postsBlock, afterTitle + 2);
    if (postsBlock[afterTitle] !== '[') {
      cursor = afterTitle + 1;
      continue;
    }

    const entryCloseIndex = findMatchingBracket(postsBlock, afterTitle);
    if (entryCloseIndex < 0) break;

    const title = normalizeLegacyText(titleString.value);
    const block = postsBlock.slice(afterTitle + 1, entryCloseIndex);
    const paragraphs = extractBlogParagraphs(block);
    const brief = extractPhpStringField(block, 'blog_content_brief');
    const minTitle = extractPhpStringField(block, 'blog_content_min_title');
    const keywords = extractPhpStringField(block, 'blog_keywords');
    const keywordTags = keywords
      .split(',')
      .map((word) => normalizeLegacyText(word).toLowerCase())
      .filter(Boolean);

    if (title && (paragraphs.length || brief)) {
      blogs.push({
        title,
        body: paragraphs.join('\n\n') || brief,
        paragraphs,
        summary: brief || paragraphs[0] || title,
        keyLesson: minTitle || null,
        readTime: extractPhpStringField(block, 'read_time'),
        author: extractPhpStringField(block, 'blog_writer'),
        blogCategory: extractPhpStringField(block, 'blog_category'),
        imageSrc: extractPhpStringField(block, 'blog_post_image_src'),
        imageAlt: extractPhpStringField(block, 'blog_post_image_alt'),
        keywords,
        publishedAt: extractPhpStringField(block, 'blog_post_date'),
        sourcePath: 'data/blogs-data.php',
        sourceCategory: 'blogs',
        normalizedCategory: 'articles',
        contentType: 'blog',
        tone: 'article',
        slug: `articles-${blogs.length + 1}-${slugify(title)}`,
        tags: Array.from(new Set(['article', 'articles', 'blog', 'edutainment', ...keywordTags])),
        dedupeKey: `blog|${slugify(title)}`
      });
    }

    cursor = entryCloseIndex + 1;
  }

  return blogs;
}

function toDateOrFallback(value, fallback) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function toArticleImageUrl(imageSrc) {
  return imageSrc ? `/articles/${imageSrc}` : null;
}

function resolveTextSubtype(entry) {
  const category = String(entry.normalizedCategory || '').toLowerCase();
  const tone = String(entry.tone || '').toLowerCase();

  if (category === 'quotes' || tone === 'quote') return 'quote';
  if (category === 'facts' || tone === 'fact') return 'fact';
  if (category === 'stories' || tone === 'story') return 'story';
  if (category === 'jocular' || tone === 'joke') return 'jocular';
  if (category === 'articles' || tone === 'article') return 'article';
  return 'article';
}

function parseReadingMinutes(value, wordCount) {
  const explicit = String(value || '').match(/\d+/);
  if (explicit) return Number(explicit[0]);
  return Math.max(1, Math.ceil((wordCount || 0) / 200));
}

function buildCategoryDeleteWhere() {
  return {
    status: 'published',
    metadata: {
      [Op.contains]: {
        source_kind: 'edutainment_uploads'
      }
    }
  };
}

async function ensureSystemUser() {
  const [systemUser] = await User.findOrCreate({
    where: { email: 'system@sharether.com' },
    defaults: {
      full_name: 'Sharether System',
      password_hash: `seed-${Date.now()}`,
      role: 'admin'
    }
  });
  return systemUser;
}

function buildContentRow(entry, creatorId, index) {
  const now = new Date();
  const summary = entry.summary || entry.body || entry.title;
  const tags = Array.from(new Set([...(entry.tags || []), entry.normalizedCategory, entry.tone].filter(Boolean)));
  const fallbackPublishedAt = asDateValue(now, index);
  const featuredImage = toArticleImageUrl(entry.imageSrc);
  const wordCount = toWordCount(entry.body);

  return {
    subtype: resolveTextSubtype(entry),
    title: entry.title,
    description: summary,
    body: entry.body,
    author: entry.author || 'Sharether',
    category: entry.normalizedCategory,
    tone: entry.tone,
    key_lesson: entry.keyLesson || null,
    slug: entry.slug,
    creator_id: creatorId,
    status: 'published',
    is_premium: false,
    depth_level: 'basic',
    tags,
    word_count: wordCount,
    reading_time: parseReadingMinutes(entry.readTime, wordCount),
    metadata: {
      source_kind: 'edutainment_uploads',
      source_path: entry.sourcePath,
      source_category: entry.sourceCategory,
      normalized_category: entry.normalizedCategory,
      category: entry.normalizedCategory,
      tone: entry.tone,
      slug: entry.slug,
      read_time: entry.readTime,
      body: entry.body,
      content: entry.body,
      paragraphs: entry.paragraphs || null,
      summary,
      key_lesson: entry.keyLesson || null,
      dedupe_key: entry.dedupeKey,
      author: entry.author || null,
      writer: entry.author || null,
      blog_category: entry.blogCategory || null,
      featured_image: featuredImage,
      image_alt: entry.imageAlt || null,
      keywords: entry.keywords || null,
      published_at_original: entry.publishedAt || null
    },
    published_at: toDateOrFallback(entry.publishedAt, fallbackPublishedAt)
  };
}

async function seedEdutainment() {
  const payload = safeReadJson(CANONICAL_PATH);
  const canonicalEntries = Array.isArray(payload.entries) ? payload.entries : [];
  const blogEntries = parseBlogsData(BLOGS_DATA_PATH);
  const entries = [...canonicalEntries, ...blogEntries];
  if (!entries.length) {
    throw new Error('Canonical edutainment dataset is empty.');
  }

  await connectAndSync();
  const systemUser = await ensureSystemUser();

  const transaction = await sequelize.transaction();
  try {
    const removable = await TextItem.findAll({
      where: buildCategoryDeleteWhere(),
      attributes: ['id'],
      transaction
    });
    const removableIds = removable.map((item) => item.id);

    if (removableIds.length) {
      await ContentStats.destroy({
        where: { content_id: { [Op.in]: removableIds } },
        transaction
      });
      await TextItem.destroy({
        where: { id: { [Op.in]: removableIds } },
        transaction
      });
    }

    const contentRows = entries.map((entry, index) => buildContentRow(entry, systemUser.id, index));
    const createdRows = await TextItem.bulkCreate(contentRows, { returning: true, transaction });

    const statsRows = createdRows.map((content) => ({
      content_id: content.id,
      total_views: 0,
      last_updated: new Date()
    }));
    await ContentStats.bulkCreate(statsRows, { returning: false, transaction });

    await transaction.commit();

    console.log(`Removed previous seeded rows: ${removableIds.length}`);
    console.log(`Inserted edutainment rows: ${createdRows.length}`);
    console.log(`Included blog article rows: ${blogEntries.length}`);
  } catch (error) {
    await transaction.rollback();
    throw error;
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  seedEdutainment().catch((error) => {
    console.error('Edutainment seed failed:', error);
    sequelize.close();
    process.exitCode = 1;
  });
}

module.exports = {
  parseBlogsData,
  seedEdutainment
};

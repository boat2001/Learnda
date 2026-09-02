/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const {
  classifyResourceCategory,
  extractTitleFromFileName
} = require('../utils/resourceClassifier');

const {
  connectAndSync,
  sequelize,
  Program,
  Course,
  CourseOffering,
  Content,
  ContentMetadata,
  ContentStats,
  ResourceFile,
  Institution,
  User
} = require('../models');
const { ensureAcademicCatalogInstitutions } = require('../services/academicCatalogService');

const BACKEND_ROOT = path.resolve(__dirname, '..', '..');
const PROJECT_ROOT = path.resolve(BACKEND_ROOT, '..');
const LEGACY_ROOT = fs.existsSync(path.join(PROJECT_ROOT, 'sharether_onit'))
  ? path.join(PROJECT_ROOT, 'sharether_onit')
  : path.join(path.dirname(PROJECT_ROOT), 'sharether_onit');
const DOCS_ROOT = path.join(PROJECT_ROOT, 'docs');
const UPLOADS_ROOT = path.join(BACKEND_ROOT, 'uploads');
const INVENTORY_PATH = path.join(__dirname, 'seed_inventory.json');
const LESSON_SCHEMA_DOC_PATH = path.join(DOCS_ROOT, 'lesson-ui-schema.md');

function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    return '';
  }
}

function decodeHtmlEntities(text) {
  if (!text) return text;
  let output = text;
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

  Object.keys(entityMap).forEach((key) => {
    output = output.split(key).join(entityMap[key]);
  });

  output = output.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
  output = output.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  return output;
}

function normalizeText(value) {
  if (value === null || value === undefined) return '';
  let text = String(value);
  text = decodeHtmlEntities(text);

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

  text = text.replace(/\r/g, '');
  text = text.replace(/\t/g, ' ');
  text = text.replace(/[ ]{2,}/g, ' ');
  text = text.replace(/\s+\n/g, '\n');
  text = text.trim();

  // eslint-disable-next-line no-control-regex
  text = text.replace(/[^\x00-\x7F]/g, '');

  return text;
}

function normalizeRichText(value) {
  if (value === null || value === undefined) return '';
  let text = String(value);
  text = decodeHtmlEntities(text);

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

  text = text.replace(/\r/g, '');
  text = text.replace(/\t/g, ' ');
  text = text.replace(/[ ]{2,}/g, ' ');
  text = text.replace(/\n[ ]+/g, '\n');
  text = text.trim();
  // eslint-disable-next-line no-control-regex
  text = text.replace(/[^\x00-\x7F]/g, '');

  return text;
}

function stripHtmlTags(value) {
  return normalizeText(String(value || '').replace(/<[^>]+>/g, ' '));
}

function createIllustrationSlot(overrides = {}) {
  return {
    image_url: '',
    alt: '',
    caption: '',
    credit: '',
    placement: 'after',
    ...overrides
  };
}

function slugify(input) {
  return normalizeText(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function countBrackets(line) {
  const opens = (line.match(/\[/g) || []).length;
  const closes = (line.match(/\]/g) || []).length;
  return opens - closes;
}

function splitPhpArray(raw) {
  const parts = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i];
    if ((char === '"' || char === "'") && raw[i - 1] !== '\\') {
      if (!inQuote) {
        inQuote = true;
        quoteChar = char;
      } else if (quoteChar === char) {
        inQuote = false;
      }
      current += char;
      continue;
    }

    if (char === ',' && !inQuote) {
      parts.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts.map((part) => {
    const trimmed = part.trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"');
    }
    return trimmed;
  });
}
function parseProgramsInfo(filePath) {
  const lines = safeRead(filePath).split(/\r?\n/);
  const programs = [];
  let currentKey = null;

  lines.forEach((line) => {
    const keyMatch = line.match(/^\s*'([a-z][a-z0-9-]+)'\s*=>\s*\[/i);
    if (keyMatch) {
      currentKey = keyMatch[1];
    }

    const nameMatch = line.match(/'name'\s*=>\s*"([^"]+)"\s*,\s*'category'\s*=>\s*"([^"]+)"/i);
    if (nameMatch && currentKey) {
      programs.push({
        key: currentKey,
        name: normalizeText(nameMatch[1]),
        category: normalizeText(nameMatch[2])
      });
      currentKey = null;
    }
  });

  return programs;
}

function parseCoursesData(filePath) {
  const lines = safeRead(filePath).split(/\r?\n/);
  const courses = [];

  lines.forEach((line) => {
    const match = line.match(/^\s*\$([A-Za-z0-9_]+)\s*=\s*\[(.+)\];/);
    if (!match) return;

    const key = match[1];
    const parts = splitPhpArray(match[2]);
    if (parts.length < 4) return;

    const title = normalizeText(parts[0]);
    const code = normalizeText(parts[1]);
    const credits = normalizeText(parts[2]);
    const takenBy = normalizeText(parts[3]);

    courses.push({
      key,
      title,
      code,
      credits,
      takenBy
    });
  });

  return courses;
}

function parseCourseDetails(filePath) {
  const lines = safeRead(filePath).split(/\r?\n/);
  const details = {};
  let currentKey = null;
  let current = null;
  let depth = 0;
  let keyDepth = null;

  lines.forEach((line) => {
    const depthBefore = depth;
    const startMatch = line.match(/^\s*'([a-z0-9_]+)'\s*=>\s*\[/i);
    if (startMatch && !line.includes('$')) {
      currentKey = startMatch[1];
      current = {};
      keyDepth = depthBefore + 1;
    }

    if (currentKey) {
      const nameMatch = line.match(/"name"\s*=>\s*"([^"]*)"/);
      if (nameMatch) current.name = normalizeText(nameMatch[1]);

      const deptMatch = line.match(/"department"\s*=>\s*"([^"]*)"/);
      if (deptMatch) current.department = normalizeText(deptMatch[1]);

      const catMatch = line.match(/"category"\s*=>\s*"([^"]*)"/);
      if (catMatch) current.category = normalizeText(catMatch[1]);

      const orgMatch = line.match(/"organized_by"\s*=>\s*"([^"]*)"/);
      if (orgMatch) current.organizedBy = normalizeText(orgMatch[1]);

      const updatedMatch = line.match(/"last_updated"\s*=>\s*"([^"]*)"/);
      if (updatedMatch) current.lastUpdated = normalizeText(updatedMatch[1]);

      const imgMatch = line.match(/"img"\s*=>\s*"([^"]*)"/);
      if (imgMatch) current.image = normalizeText(imgMatch[1]);
    }

    depth += countBrackets(line);

    if (currentKey && keyDepth !== null && depth < keyDepth) {
      details[currentKey] = current;
      currentKey = null;
      current = null;
      keyDepth = null;
    }
  });

  return details;
}

function parseFilesDir(filePath) {
  const lines = safeRead(filePath).split(/\r?\n/);
  const dirMap = {};
  const regex = /^\s*\$([A-Za-z0-9_]+)_dir\s*=\s*"([^"]+)"/;

  lines.forEach((line) => {
    const match = line.match(regex);
    if (!match) return;
    const key = match[1];
    let dirPath = match[2].replace(/\\/g, '/');
    const marker = '/files/';
    if (dirPath.includes(marker)) {
      dirPath = dirPath.substring(dirPath.indexOf(marker) + marker.length);
    }
    dirPath = dirPath.replace(/^\.\.\//g, '');
    dirPath = dirPath.replace(/^\/+/, '');
    dirMap[key] = dirPath;
  });

  return dirMap;
}

function parseIndCourses(filePath) {
  const lines = safeRead(filePath).split(/\r?\n/);
  const offerings = [];
  let depth = 0;
  let currentProgram = null;
  let currentProgramName = null;
  let currentProgrammeGroup = null;
  let currentLevel = null;
  let currentSemester = null;
  let programDepth = null;
  let levelDepth = null;
  let semesterDepth = null;

  lines.forEach((line) => {
    const depthBefore = depth;

    const programmeMatch = line.match(/'programme'\s*=>\s*'([^']+)'/i);
    if (programmeMatch) currentProgrammeGroup = normalizeText(programmeMatch[1]);

    const programMatch = line.match(/^\s*'([a-z0-9-]+)'\s*=>\s*\[/i);
    if (programMatch && !line.includes('$') && !line.includes('programme') && !line.includes('fullname')) {
      currentProgram = programMatch[1];
      currentProgramName = null;
      programDepth = depthBefore + 1;
    }

    const fullnameMatch = line.match(/'fullname'\s*=>\s*'([^']+)'/i);
    if (fullnameMatch) currentProgramName = normalizeText(fullnameMatch[1]);

    const levelMatch = line.match(/^\s*(100|200|300|400)\s*=>\s*\[/);
    if (levelMatch) {
      currentLevel = levelMatch[1];
      levelDepth = depthBefore + 1;
    }

    const semMatch = line.match(/^\s*(1|2)\s*=>\s*\[/);
    if (semMatch && currentLevel) {
      currentSemester = semMatch[1];
      semesterDepth = depthBefore + 1;
    }

    const courseMatch = line.match(/^\s*'([a-z0-9_]+)'\s*=>\s*\[\$([a-z0-9_]+)\s*,\s*\$([a-z0-9_]+)_dir/i);
    if (courseMatch && currentProgram && currentLevel && currentSemester) {
      offerings.push({
        programKey: currentProgram,
        programName: currentProgramName,
        programmeGroup: currentProgrammeGroup,
        level: currentLevel,
        semester: currentSemester,
        courseKey: courseMatch[1],
        courseVar: courseMatch[2],
        dirVar: courseMatch[3]
      });
    }

    depth += countBrackets(line);

    if (semesterDepth !== null && depth < semesterDepth) {
      currentSemester = null;
      semesterDepth = null;
    }

    if (levelDepth !== null && depth < levelDepth) {
      currentLevel = null;
      levelDepth = null;
    }

    if (programDepth !== null && depth < programDepth) {
      currentProgram = null;
      currentProgramName = null;
      programDepth = null;
    }
  });

  return offerings;
}
function parseBlogs(filePath) {
  const lines = safeRead(filePath).split(/\r?\n/);
  const blogs = [];
  let inPosts = false;
  let current = null;
  let inText = false;

  lines.forEach((line) => {
    if (line.includes('$blog_posts') && line.includes('[')) {
      inPosts = true;
      return;
    }

    if (inPosts && line.trim().startsWith('];')) {
      if (current) blogs.push(current);
      inPosts = false;
      current = null;
      return;
    }

    if (!inPosts) return;

    const titleMatch = line.match(/^\s*'([^']+)'\s*=>\s*\[/);
    if (titleMatch && titleMatch[1] !== 'text_content') {
      if (current) blogs.push(current);
      current = {
        title: normalizeText(titleMatch[1]),
        paragraphs: []
      };
      inText = false;
      return;
    }

    if (!current) return;

    const dateMatch = line.match(/blog_post_date'\s*=>\s*time_elapsed_string\('([^']+)'\)/);
    if (dateMatch) current.publishedAt = normalizeText(dateMatch[1]);

    const readMatch = line.match(/read_time'\s*=>\s*'([^']*)'/);
    if (readMatch) current.readTime = normalizeText(readMatch[1]);

    const writerMatch = line.match(/blog_writer'\s*=>\s*'([^']*)'/);
    if (writerMatch) current.writer = normalizeText(writerMatch[1]);

    const catMatch = line.match(/blog_category'\s*=>\s*'([^']*)'/);
    if (catMatch) current.category = normalizeText(catMatch[1]);

    const imgMatch = line.match(/blog_post_image_src'\s*=>\s*'([^']*)'/);
    if (imgMatch) current.imageSrc = normalizeText(imgMatch[1]);

    const imgAltMatch = line.match(/blog_post_image_alt'\s*=>\s*'([^']*)'/);
    if (imgAltMatch) current.imageAlt = normalizeText(imgAltMatch[1]);

    const minTitleMatch = line.match(/blog_content_min_title'\s*=>\s*'([^']*)'/);
    if (minTitleMatch) current.minTitle = normalizeText(minTitleMatch[1]);

    const briefMatch = line.match(/blog_content_brief'\s*=>\s*'([^']*)'/);
    if (briefMatch) current.brief = normalizeText(briefMatch[1]);

    const keywordsMatch = line.match(/blog_keywords'\s*=>\s*'([^']*)'/);
    if (keywordsMatch) current.keywords = normalizeText(keywordsMatch[1]);

    if (line.match(/text_content'\s*=>\s*\[/)) {
      inText = true;
      return;
    }

    if (inText && line.trim().startsWith(']')) {
      inText = false;
      return;
    }

    if (inText) {
      const paraMatch = line.match(/'par-[0-9]+'\s*=>\s*'(.+)'/);
      if (paraMatch) {
        const paragraph = normalizeText(paraMatch[1].replace(/'/g, "'"));
        if (paragraph) current.paragraphs.push(paragraph);
      }
    }
  });

  return blogs;
}

function parseBlogViews(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return {};
  }
}

function parseQuotes(filePath) {
  const lines = safeRead(filePath).split(/\r?\n/);
  const quotes = [];
  let inQuotes = false;

  lines.forEach((line) => {
    if (line.includes('$quotes') && line.includes('[')) {
      inQuotes = true;
      return;
    }

    if (inQuotes && line.trim().startsWith('];')) {
      inQuotes = false;
      return;
    }

    if (!inQuotes) return;

    const match = line.match(/\s*"([^"]+)"/);
    if (match) {
      const quote = normalizeText(match[1]);
      if (quote) quotes.push(quote);
    }
  });

  return quotes;
}

function parseSiteData(filePath) {
  const lines = safeRead(filePath).split(/\r?\n/);
  const sections = {};
  let currentSection = null;

  lines.forEach((line) => {
    const sectionMatch = line.match(/^\s*'([a-z0-9-]+)'\s*=>\s*\[/i);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      if (!sections[currentSection]) sections[currentSection] = [];
      return;
    }

    if (!currentSection) return;

    const paragraphMatch = line.match(/'par-[0-9]+'\s*=>\s*'(.+)'/);
    if (paragraphMatch) {
      const paragraph = normalizeText(paragraphMatch[1].replace(/'/g, "'"));
      if (paragraph) sections[currentSection].push(paragraph);
    }
  });

  return sections;
}

function parseTeamData(filePath) {
  const lines = safeRead(filePath).split(/\r?\n/);
  const members = [];
  let currentMember = null;
  let currentSection = null;
  let currentGroup = null;
  let inBlockComment = false;

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (inBlockComment) {
      if (trimmed.includes('*/')) {
        inBlockComment = false;
      }
      return;
    }

    if (trimmed.startsWith('//')) return;

    if (trimmed.includes('/*')) {
      if (!trimmed.includes('*/')) {
        inBlockComment = true;
      }
      return;
    }

    if (trimmed.startsWith('$about_team')) {
      currentGroup = 'team';
      currentMember = null;
      currentSection = null;
      return;
    }

    if (trimmed.startsWith('$contributors')) {
      currentGroup = 'contributors';
      currentMember = null;
      currentSection = null;
      return;
    }

    if (trimmed.startsWith('$donators')) {
      currentGroup = 'donators';
      currentMember = null;
      currentSection = null;
      return;
    }

    if (trimmed.startsWith('];')) {
      currentGroup = null;
      currentMember = null;
      currentSection = null;
      return;
    }

    if (!currentGroup) return;

    const sectionMatch = line.match(/^\s*'([a-z0-9-]+)'\s*=>\s*\[/i);
    if (sectionMatch) {
      const sectionKey = sectionMatch[1];
      if (['info', 'about', 'contact'].includes(sectionKey)) {
        currentSection = sectionKey;
        return;
      }

      currentMember = { key: sectionKey, group: currentGroup, info: {}, about: [], contact: {} };
      currentSection = null;
      members.push(currentMember);
      return;
    }

    if (!currentMember) return;

    if (currentSection === 'info') {
      const infoMatch = line.match(/'([a-z0-9-]+)'\s*=>\s*'([^']*)'/i);
      if (infoMatch) {
        currentMember.info[infoMatch[1]] = normalizeText(infoMatch[2]);
      }
    }

    if (currentSection === 'about') {
      const aboutMatch = line.match(/'par-[0-9]+'\s*=>\s*'(.+)'/);
      if (aboutMatch) {
        currentMember.about.push(normalizeText(aboutMatch[1].replace(/'/g, "'")));
      }
    }

    if (currentSection === 'contact') {
      const contactMatch = line.match(/'([a-z0-9-]+)'\s*=>\s*'([^']*)'/i);
      if (contactMatch) {
        currentMember.contact[contactMatch[1]] = normalizeText(contactMatch[2]);
      }
    }
  });

  return members.filter((member) => member.info.name);
}

function parseColleges(filePath) {
  const lines = safeRead(filePath).split(/\r?\n/);
  const colleges = [];
  let current = null;
  let inText = false;

  lines.forEach((line) => {
    const nameMatch = line.match(/^\s*'([^']+)'\s*=>\s*\[/);
    if (nameMatch) {
      current = {
        name: normalizeText(nameMatch[1]),
        textContent: []
      };
      colleges.push(current);
      inText = false;
      return;
    }

    if (!current) return;

    const aliasMatch = line.match(/college_alias'\s*=>\s*'([^']*)'/);
    if (aliasMatch) current.alias = normalizeText(aliasMatch[1]);

    const mottoMatch = line.match(/college_motto'\s*=>\s*'([^']*)'/);
    if (mottoMatch) current.motto = normalizeText(mottoMatch[1]);

    const estMatch = line.match(/est_date'\s*=>\s*'([^']*)'/);
    if (estMatch) current.estDate = normalizeText(estMatch[1]);

    const imgMatch = line.match(/college_post_image_src'\s*=>\s*'([^']*)'/);
    if (imgMatch) current.imageSrc = normalizeText(imgMatch[1]);

    const imgAltMatch = line.match(/college_post_image_alt'\s*=>\s*'([^']*)'/);
    if (imgAltMatch) current.imageAlt = normalizeText(imgAltMatch[1]);

    const briefMatch = line.match(/college_content_brief'\s*=>\s*"([^"]*)"/);
    if (briefMatch) current.brief = normalizeText(briefMatch[1]);

    const updatedMatch = line.match(/last_updated'\s*=>\s*'([^']*)'/);
    if (updatedMatch) current.lastUpdated = normalizeText(updatedMatch[1]);

    if (line.match(/text_content'\s*=>\s*\[/)) {
      inText = true;
      return;
    }

    if (inText && line.trim().startsWith(']')) {
      inText = false;
      return;
    }

    if (inText) {
      const paragraphMatch = line.match(/'par-[0-9]+'\s*=>\s*'(.+)'/);
      if (paragraphMatch) {
        current.textContent.push(normalizeText(paragraphMatch[1].replace(/'/g, "'")));
      }
    }
  });

  return colleges;
}

function parseCadl(filePath) {
  const lines = safeRead(filePath).split(/\r?\n/);
  const units = [];
  let current = null;

  lines.forEach((line) => {
    const trimmed = normalizeText(line);
    const unitMatch = trimmed.match(/^Unit\s+([A-Za-z0-9]+):\s*(.+)$/i);
    if (unitMatch) {
      if (current) units.push(current);
      current = {
        unitLabel: unitMatch[1],
        title: normalizeText(unitMatch[2]),
        content: []
      };
      return;
    }

    if (!current) return;

    if (trimmed) {
      current.content.push(trimmed);
    }
  });

  if (current) units.push(current);
  return units;
}

function readPhpQuotedValue(rawValue, quoteChar) {
  let value = '';
  let escaped = false;

  for (let index = 0; index < rawValue.length; index += 1) {
    const char = rawValue[index];
    if (escaped) {
      value += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === quoteChar) {
      return {
        value,
        closed: true
      };
    }

    value += char;
  }

  return {
    value,
    closed: false
  };
}

function createLessonDocument(lesson) {
  if (!lesson || !lesson.mainTopic || !Array.isArray(lesson.chunks) || lesson.chunks.length === 0) {
    return null;
  }

  const chunks = {};

  lesson.chunks.forEach((chunk, chunkIndex) => {
    const chunkId = chunk.id || `chunk_${chunkIndex}`;
    const chunkContent = {};

    (chunk.paragraphs || []).forEach((paragraph, paragraphIndex) => {
      const paragraphId = paragraph.id || `par_${paragraphIndex}`;
      chunkContent[paragraphId] = {
        body_html: normalizeRichText(paragraph.body_html || paragraph.bodyHtml || ''),
        illustration: createIllustrationSlot(paragraph.illustration || {})
      };
    });

    chunks[chunkId] = {
      id: chunkId,
      chunk_head: normalizeText(chunk.heading || `Chunk ${chunkIndex + 1}`),
      chunk_content: chunkContent
    };
  });

  return {
    schema_version: 'lesson_document.v1',
    source: 'docs/lesson-ui-schema.md',
    lesson_number: lesson.order,
    main_topic: normalizeText(lesson.mainTopic),
    lesson_details: {
      main_topic: normalizeText(lesson.mainTopic)
    },
    chunks
  };
}

function summarizeLessonDocument(lessonDocument) {
  if (!lessonDocument || typeof lessonDocument !== 'object') return '';
  const chunks = Object.values(lessonDocument.chunks || {});

  for (const chunk of chunks) {
    const paragraphs = Object.values(chunk.chunk_content || {});
    for (const paragraph of paragraphs) {
      const summary = stripHtmlTags(paragraph?.body_html || '');
      if (summary) {
        return summary;
      }
    }
  }

  return '';
}

function parseLessonSchemaDoc(filePath) {
  const source = safeRead(filePath);
  const lessonRootIndex = source.indexOf('$lesson_chunks');
  if (lessonRootIndex === -1) return [];

  const lessonSource = source.slice(lessonRootIndex);
  const lessonStarts = Array.from(lessonSource.matchAll(/^\s*(\d+)\s*=>\s*\[/gm));

  return lessonStarts.map((lessonMatch, lessonIndex) => {
    const lessonBlockStart = lessonMatch.index;
    const lessonBlockEnd = lessonIndex + 1 < lessonStarts.length
      ? lessonStarts[lessonIndex + 1].index
      : lessonSource.length;
    const lessonBlock = lessonSource.slice(lessonBlockStart, lessonBlockEnd);
    const mainTopicMatch = lessonBlock.match(/"main_topic"\s*=>\s*"([^"]*)"/);
    const chunkStarts = Array.from(lessonBlock.matchAll(/^\s*"?(chunk_\d+)"?\s*=>\s*\[/gm));

    const chunks = chunkStarts.map((chunkMatch, chunkIndex) => {
      const chunkBlockStart = chunkMatch.index;
      const chunkBlockEnd = chunkIndex + 1 < chunkStarts.length
        ? chunkStarts[chunkIndex + 1].index
        : lessonBlock.length;
      const chunkBlock = lessonBlock.slice(chunkBlockStart, chunkBlockEnd);
      const chunkHeadMatch = chunkBlock.match(/"chunk_head"\s*=>\s*"([^"]*)"/);
      const chunkContentMatch = chunkBlock.match(/"chunk_content"\s*=>\s*\[/);

      if (!chunkContentMatch) {
        return null;
      }

      const chunkContentSource = chunkBlock.slice(chunkContentMatch.index + chunkContentMatch[0].length);
      const paragraphRegex = /["'](par_\d+)["']\s*=>\s*(['"])/g;
      const paragraphs = [];
      let paragraphMatch = paragraphRegex.exec(chunkContentSource);

      while (paragraphMatch) {
        const paragraphId = paragraphMatch[1];
        const quoteChar = paragraphMatch[2];
        const valueStart = paragraphMatch.index + paragraphMatch[0].length;
        const parsed = readPhpQuotedValue(chunkContentSource.slice(valueStart), quoteChar);
        const consumedLength = parsed.value.length + (parsed.closed ? 1 : 0);

        paragraphs.push({
          id: paragraphId,
          body_html: normalizeRichText(parsed.value),
          illustration: createIllustrationSlot()
        });

        paragraphRegex.lastIndex = valueStart + consumedLength;
        paragraphMatch = paragraphRegex.exec(chunkContentSource);
      }

      return {
        id: chunkMatch[1],
        heading: normalizeText(chunkHeadMatch ? chunkHeadMatch[1] : `Chunk ${chunkIndex + 1}`),
        paragraphs: paragraphs.filter((paragraph) => paragraph.body_html)
      };
    }).filter((chunk) => chunk && chunk.paragraphs.length > 0);

    return {
      order: Number(lessonMatch[1]),
      mainTopic: normalizeText(mainTopicMatch ? mainTopicMatch[1] : ''),
      chunks
    };
  }).filter((lesson) => lesson.mainTopic && lesson.chunks.length > 0);
}

function walkFiles(dirPath, fileList = []) {
  if (!fs.existsSync(dirPath)) return fileList;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  entries.forEach((entry) => {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, fileList);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
      fileList.push(fullPath);
    }
  });
  return fileList;
}

function walkAllFiles(dirPath, fileList = []) {
  if (!fs.existsSync(dirPath)) return fileList;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  entries.forEach((entry) => {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkAllFiles(fullPath, fileList);
    } else if (entry.isFile()) {
      fileList.push(fullPath);
    }
  });
  return fileList;
}

function copyIfMissing(sourcePath, destPath) {
  if (fs.existsSync(destPath)) return;
  const destDir = path.dirname(destPath);
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(sourcePath, destPath);
}

function appendPathSuffixBeforeExtension(relativePath, suffix) {
  return relativePath.replace(/(\.[^/.]+)?$/, `${suffix}$1`);
}

async function seed() {
  const programsInfoPath = path.join(LEGACY_ROOT, 'assets', 'php', 'programs-info.php');
  const coursesDataPath = path.join(LEGACY_ROOT, 'assets', 'php', 'courses-data.php');
  const courseDetailsPath = path.join(LEGACY_ROOT, 'assets', 'php', 'course-details.php');
  const filesDirPath = path.join(LEGACY_ROOT, 'assets', 'php', 'files-dir.php');
  const indCoursesPriPath = path.join(LEGACY_ROOT, 'assets', 'php', 'ind-courses-pri.php');
  const indCoursesJhsPath = path.join(LEGACY_ROOT, 'assets', 'php', 'ind-courses-jhs.php');
  const indCoursesEcePath = path.join(LEGACY_ROOT, 'assets', 'php', 'ind-courses-ece.php');
  const blogsPath = path.join(LEGACY_ROOT, 'assets', 'php', 'blogs-data.php');
  const blogViewsPath = path.join(LEGACY_ROOT, 'resources', 'blog-views.json');
  const quotesPath = path.join(LEGACY_ROOT, 'assets', 'php', 'quotes.php');
  const siteDataPath = path.join(LEGACY_ROOT, 'assets', 'php', 'site-data.php');
  const teamDataPath = path.join(LEGACY_ROOT, 'assets', 'php', 'team-data.php');
  const collegesPath = path.join(LEGACY_ROOT, 'assets', 'php', 'colleges-data.php');
  const cadlPath = path.join(LEGACY_ROOT, 'resources', 'learn', 'cadl.txt');

  const programs = parseProgramsInfo(programsInfoPath);
  const courses = parseCoursesData(coursesDataPath);
  const courseDetails = parseCourseDetails(courseDetailsPath);
  const fileDirMap = parseFilesDir(filesDirPath);
  const offerings = [
    ...parseIndCourses(indCoursesPriPath),
    ...parseIndCourses(indCoursesJhsPath),
    ...parseIndCourses(indCoursesEcePath)
  ];
  const blogs = parseBlogs(blogsPath);
  const blogViews = parseBlogViews(blogViewsPath);
  const quotes = parseQuotes(quotesPath);
  const siteSections = parseSiteData(siteDataPath);
  const teamMembers = parseTeamData(teamDataPath);
  const colleges = parseColleges(collegesPath);
  const cadlUnits = parseCadl(cadlPath);
  const lessonSchemaLessons = parseLessonSchemaDoc(LESSON_SCHEMA_DOC_PATH);

  const coursesByKey = new Map();
  courses.forEach((course) => {
    const details = courseDetails[course.key] || {};
    coursesByKey.set(course.key, {
      ...course,
      title: details.name || course.title,
      department: details.department || undefined,
      metadata: {
        takenBy: course.takenBy,
        category: details.category || undefined,
        organizedBy: details.organizedBy || undefined,
        lastUpdated: details.lastUpdated || undefined,
        image: details.image || undefined
      }
    });
  });

  const dirToCourseKey = {};
  Object.keys(fileDirMap).forEach((key) => {
    dirToCourseKey[fileDirMap[key]] = key;
  });

  const premiumRoot = path.join(LEGACY_ROOT, 'files');
  const freeRoot = path.join(LEGACY_ROOT, 'files', 'watermarked');

  const premiumFiles = walkFiles(premiumRoot).filter((file) => !file.includes(`${path.sep}watermarked${path.sep}`));
  const freeFiles = walkFiles(freeRoot);
  const freeRelativePaths = new Set(
    freeFiles.map((filePath) =>
      path.relative(freeRoot, filePath).replace(/\\/g, '/').replace(/^watermarked\//, '')
    )
  );

  const resourceFiles = [];

  function mapResourceFiles(fileList, isPremium) {
    fileList.forEach((filePath) => {
      const relative = path.relative(isPremium ? premiumRoot : freeRoot, filePath).replace(/\\/g, '/');
      const cleanRelative = relative.replace(/^watermarked\//, '');
      const isOtherFiles = cleanRelative.startsWith('other-files/');
      const dirRel = path.dirname(cleanRelative).replace(/\\/g, '/');
      const fileName = path.basename(filePath);
      const stats = fs.statSync(filePath);

      const levelMatch = cleanRelative.match(/^(\d{3})\//);
      const semesterMatch = cleanRelative.match(/sem-(\d)/i);
      const yearMatch = fileName.match(/\b(19|20)\d{2}\b/);

      const courseKey = dirToCourseKey[dirRel];
      const courseData = courseKey ? coursesByKey.get(courseKey) : null;

      const hasFreeCollision = isPremium && freeRelativePaths.has(cleanRelative);
      const destRel = hasFreeCollision
        ? appendPathSuffixBeforeExtension(`resources/${cleanRelative}`, '__premium')
        : `resources/${cleanRelative}`;
      const destPath = path.join(UPLOADS_ROOT, destRel);
      const fileUrl = `/uploads/${destRel.replace(/\\/g, '/')}`;

      resourceFiles.push({
        title: extractTitleFromFileName(fileName),
        description: normalizeText(fileName),
        file_name: fileName,
        file_url: fileUrl,
        file_path: destRel.replace(/\\/g, '/'),
        file_type: 'application/pdf',
        file_size: stats.size,
        course: courseData ? courseData.title : undefined,
        level: levelMatch ? levelMatch[1] : undefined,
        semester: semesterMatch ? semesterMatch[1] : undefined,
        year: yearMatch ? yearMatch[0] : undefined,
        category: classifyResourceCategory(fileName, destRel),
        is_premium: isOtherFiles ? false : isPremium,
        downloads: 0,
        views: 0,
        legacy_dir: dirRel
      });

      copyIfMissing(filePath, destPath);
    });
  }

  mapResourceFiles(freeFiles, false);
  mapResourceFiles(premiumFiles, true);

  const blogImageDir = path.join(LEGACY_ROOT, 'assets', 'images', 'blogs');
  const teamImageDir = path.join(LEGACY_ROOT, 'assets', 'images', 'team');
  const collegeImageDir = path.join(LEGACY_ROOT, 'assets', 'images', 'colleges');

  function copyDirAssets(sourceDir, destSubdir) {
    if (!fs.existsSync(sourceDir)) return;
    const files = walkAllFiles(sourceDir);
    files.forEach((filePath) => {
      const rel = path.relative(sourceDir, filePath).replace(/\\/g, '/');
      const destRel = `assets/${destSubdir}/${rel}`;
      const dest = path.join(UPLOADS_ROOT, destRel);
      copyIfMissing(filePath, dest);
    });
  }

  copyDirAssets(blogImageDir, 'blogs');
  copyDirAssets(teamImageDir, 'team');
  copyDirAssets(collegeImageDir, 'colleges');

  const inventory = {
    generated_at: new Date().toISOString(),
    counts: {
      programs: programs.length,
      courses: coursesByKey.size,
      course_offerings: offerings.length,
      resource_files: resourceFiles.length,
      blogs: blogs.length,
      quotes: quotes.length,
      site_sections: Object.keys(siteSections).length,
      team_members: teamMembers.length,
      colleges: colleges.length,
      cadl_units: cadlUnits.length,
      lesson_schema_lessons: lessonSchemaLessons.length
    },
    programs,
    courses: Array.from(coursesByKey.values()),
    course_offerings: offerings,
    resource_files: resourceFiles,
    blogs,
    quotes,
    site_sections: siteSections,
    team_members: teamMembers,
    colleges,
    cadl_units: cadlUnits,
    lesson_schema_lessons: lessonSchemaLessons
  };

  fs.writeFileSync(INVENTORY_PATH, JSON.stringify(inventory, null, 2));

  await connectAndSync();

  const [systemUser] = await User.findOrCreate({
    where: { email: 'system@sharether.com' },
    defaults: {
      full_name: 'Sharether System',
      password_hash: `seed-${Date.now()}`,
      role: 'admin'
    }
  });

  const programKeys = new Set();
  for (const program of programs) {
    if (programKeys.has(program.key)) continue;
    programKeys.add(program.key);
    await Program.findOrCreate({
      where: { key: program.key },
      defaults: {
        name: program.name,
        category: program.category,
        metadata: {}
      }
    });
  }

  const courseKeys = new Set();
  for (const course of coursesByKey.values()) {
    if (courseKeys.has(course.key)) continue;
    courseKeys.add(course.key);
    await Course.findOrCreate({
      where: { key: course.key },
      defaults: {
        title: course.title,
        code: course.code,
        credits: course.credits,
        department: course.department || null,
        metadata: course.metadata || {}
      }
    });
  }

  const programRows = await Program.findAll();
  const courseRows = await Course.findAll();
  const programByKey = new Map(programRows.map((p) => [p.key, p]));
  const courseByKey = new Map(courseRows.map((c) => [c.key, c]));

  const existingOfferings = await CourseOffering.findAll({
    attributes: ['program_id', 'course_id', 'level', 'semester']
  });
  const offeringKeys = new Set(existingOfferings.map((item) => `${item.program_id}:${item.course_id}:${item.level}:${item.semester}`));

  const offeringRows = [];
  offerings.forEach((offering) => {
    const program = programByKey.get(offering.programKey);
    const course = courseByKey.get(offering.courseKey);
    if (!program || !course) return;
    const key = `${program.id}:${course.id}:${offering.level}:${offering.semester}`;
    if (offeringKeys.has(key)) return;

    const filesPath = fileDirMap[offering.dirVar] || fileDirMap[offering.courseKey] || null;

    offeringRows.push({
      program_id: program.id,
      course_id: course.id,
      level: offering.level,
      semester: offering.semester,
      files_path: filesPath,
      metadata: {
        program_name: offering.programName || program.name,
        programme_group: offering.programmeGroup || null
      }
    });
  });

  if (offeringRows.length) {
    await CourseOffering.bulkCreate(offeringRows, { returning: false });
  }

  for (const college of colleges) {
    const imageUrl = college.imageSrc ? `/uploads/assets/colleges/${college.imageSrc}` : null;
    await Institution.findOrCreate({
      where: { name: college.name },
      defaults: {
        metadata: {
          alias: college.alias || null,
          motto: college.motto || null,
          est_date: college.estDate || null,
          brief: college.brief || null,
          image_url: imageUrl,
          image_alt: college.imageAlt || null,
          last_updated: college.lastUpdated || null,
          text_content: college.textContent || []
        }
      }
    });
  }

  await ensureAcademicCatalogInstitutions();

  const existingContent = await Content.findAll({ attributes: ['id', 'title', 'type'] });
  const contentKeys = new Set(existingContent.map((item) => `${item.type}::${item.title}`));

  const contentStatsToCreate = [];
  const contentMetaToCreate = [];
  const contentToCreate = [];

  blogs.forEach((blog) => {
    const slug = slugify(blog.title);
    const key = `blog::${blog.title}`;
    if (contentKeys.has(key)) return;

    const keywords = blog.keywords ? blog.keywords.split(',').map((word) => normalizeText(word)).filter(Boolean) : [];
    const thumbnailUrl = blog.imageSrc ? `/uploads/assets/blogs/${blog.imageSrc}` : null;

    contentToCreate.push({
      title: blog.title,
      description: blog.brief || blog.paragraphs[0] || '',
      type: 'blog',
      creator_id: systemUser.id,
      status: 'published',
      thumbnail_url: thumbnailUrl,
      tags: keywords,
      metadata: {
        slug,
        category: blog.category || null,
        read_time: blog.readTime || null,
        writer: blog.writer || null,
        min_title: blog.minTitle || null,
        paragraphs: blog.paragraphs || [],
        image_alt: blog.imageAlt || null
      },
      published_at: blog.publishedAt ? new Date(blog.publishedAt) : null
    });
  });

  quotes.forEach((quote, index) => {
    const title = `Quote ${index + 1}`;
    const key = `quote::${title}`;
    if (contentKeys.has(key)) return;

    contentToCreate.push({
      title,
      description: quote,
      type: 'quote',
      creator_id: systemUser.id,
      status: 'published',
      tags: ['quote'],
      metadata: { source: 'sharether_onit' },
      published_at: new Date()
    });
  });

  Object.keys(siteSections).forEach((sectionKey) => {
    const title = `Sharether ${sectionKey.replace(/-/g, ' ')}`.replace(/\b\w/g, (m) => m.toUpperCase());
    const key = `site_info::${title}`;
    const legacyKey = `text_lesson::${title}`;
    if (contentKeys.has(key) || contentKeys.has(legacyKey)) return;

    const paragraphs = siteSections[sectionKey] || [];
    contentToCreate.push({
      title,
      description: paragraphs[0] || '',
      type: 'site_info',
      creator_id: systemUser.id,
      status: 'published',
      tags: ['about', sectionKey],
      metadata: { section: sectionKey, paragraphs },
      published_at: new Date()
    });
  });

  teamMembers.forEach((member) => {
    const title = member.info.name;
    const key = `team_profile::${title}`;
    const legacyKey = `text_lesson::${title}`;
    if (contentKeys.has(key) || contentKeys.has(legacyKey)) return;

    const imageUrl = member.info['image-dir'] ? `/uploads/assets/team/${member.info['image-dir']}` : null;
    const groupTag = member.group || 'team';
    const tags = Array.from(new Set(['team', groupTag, 'profile']));

    contentToCreate.push({
      title,
      description: member.about[0] || '',
      type: 'team_profile',
      creator_id: systemUser.id,
      status: 'published',
      tags,
      thumbnail_url: imageUrl,
      metadata: {
        aka: member.info.aka || null,
        role: member.info.role || null,
        group: member.group || null,
        about: member.about,
        contact: member.contact || {}
      },
      published_at: new Date()
    });
  });

  cadlUnits.forEach((unit) => {
    const title = `CADL Unit ${unit.unitLabel}: ${unit.title}`;
    const key = `text_lesson::${title}`;
    if (contentKeys.has(key)) return;

    contentToCreate.push({
      title,
      description: unit.content[0] || '',
      type: 'text_lesson',
      creator_id: systemUser.id,
      status: 'published',
      tags: ['cadl', 'lesson'],
      metadata: {
        unit_label: unit.unitLabel,
        unit_title: unit.title,
        paragraphs: unit.content
      },
      published_at: new Date()
    });
  });

  lessonSchemaLessons.forEach((lesson) => {
    const lessonDocument = createLessonDocument(lesson);
    if (!lessonDocument) return;

    const title = lesson.mainTopic;
    const key = `text_lesson::${title}`;
    if (contentKeys.has(key)) return;

    const description = summarizeLessonDocument(lessonDocument);
    const slug = slugify(`lesson-${lesson.order}-${title}`);
    const chunkCount = Object.keys(lessonDocument.chunks || {}).length;
    const wordCount = stripHtmlTags(
      Object.values(lessonDocument.chunks || {})
        .flatMap((chunk) => Object.values(chunk.chunk_content || {}))
        .map((paragraph) => paragraph?.body_html || '')
        .join(' ')
    )
      .split(/\s+/)
      .filter(Boolean)
      .length;

    contentToCreate.push({
      title,
      description,
      type: 'text_lesson',
      creator_id: systemUser.id,
      status: 'published',
      tags: ['lesson', 'lesson-schema', 'seeded-sample'],
      word_count: wordCount,
      metadata: {
        slug,
        category: 'lesson_schema_sample',
        topic: title,
        lesson_number: lesson.order,
        sequence: lesson.order,
        chunk_count: chunkCount,
        source: 'lesson_ui_schema_doc',
        summary: description,
        lesson_document: lessonDocument
      },
      published_at: new Date()
    });
  });

  if (contentToCreate.length) {
    const created = await Content.bulkCreate(contentToCreate, { returning: true });
    created.forEach((content) => {
      const slug = content.metadata?.slug;
      contentMetaToCreate.push({
        content_id: content.id,
        course: content.metadata?.course || null,
        level: content.metadata?.level || null,
        subject: content.metadata?.category || null,
        topic: content.metadata?.topic || content.metadata?.min_title || null,
        metadata: content.metadata || {}
      });

      if (content.type === 'blog') {
        const viewKey = slug || slugify(content.title);
        const viewRecord = blogViews[viewKey];
        const totalViews = viewRecord && viewRecord.total ? viewRecord.total : 0;
        contentStatsToCreate.push({
          content_id: content.id,
          total_views: totalViews,
          last_updated: new Date()
        });
      }
    });
  }

  if (contentMetaToCreate.length) {
    await ContentMetadata.bulkCreate(contentMetaToCreate, { returning: false });
  }

  if (contentStatsToCreate.length) {
    await ContentStats.bulkCreate(contentStatsToCreate, { returning: false });
  }

  const existingResourcePaths = new Set(
    (await ResourceFile.findAll({ attributes: ['file_path'] }))
      .map((item) => item.file_path)
      .filter(Boolean)
  );

  const newResourceRows = resourceFiles
    .filter((file) => !existingResourcePaths.has(file.file_path))
    .map((file) => ({
      title: file.title,
      description: file.description,
      file_name: file.file_name,
      file_url: file.file_url,
      file_path: file.file_path,
      file_type: file.file_type,
      file_size: file.file_size,
      course: file.course || null,
      level: file.level || null,
      semester: file.semester || null,
      year: file.year || null,
      category: file.category || null,
      is_premium: file.is_premium,
      downloads: file.downloads,
      views: file.views
    }));

  const chunkSize = 500;
  for (let i = 0; i < newResourceRows.length; i += chunkSize) {
    const chunk = newResourceRows.slice(i, i + chunkSize);
    if (chunk.length) {
      await ResourceFile.bulkCreate(chunk, { returning: false });
    }
  }

  console.log('Seed completed. Inventory saved to:', INVENTORY_PATH);
  await sequelize.close();
}

if (require.main === module) {
  seed().catch((err) => {
    console.error('Seed failed:', err);
    sequelize.close();
    process.exitCode = 1;
  });
}

module.exports = {
  seed
};


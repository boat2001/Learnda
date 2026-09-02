const path = require('path');

function normalizeText(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function normalizeFileName(fileName) {
  const normalized = normalizeText(fileName).toLowerCase();
  return normalized
    .replace(/\s*-\s*sharether\.com/gi, '')
    .replace(/\.pdf$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function extractTitleFromFileName(fileName) {
  const normalized = normalizeText(fileName);
  if (!normalized) return 'Untitled file';
  return normalized
    .replace(/\s*-\s*Sharether\.com/gi, '')
    .replace(/\.pdf$/i, '')
    .trim();
}

function detectCategoryFromName(fileName) {
  const name = normalizeText(fileName);

  if (/Internal Quiz/i.test(name)) return 'quiz_internal';
  if (/(External Quiz|Zonal(?:\s+Based)? Quiz)/i.test(name)) return 'quiz_external';

  if (
    /(Resit Exams?|End(?:\s+of)?\s+Sem(?:ester)?|End-of-Sem|Mid\s*-?\s*Sem(?:ester)?|Mock Exams?|Exams?)/i.test(name) &&
    !/(Sample Exams?|Example)/i.test(name)
  ) {
    return 'exam';
  }

  if (/Course Outline/i.test(name)) return 'course_outline';
  if (/(Course Notes?|Lecture Notes?|\bNotes\.pdf\b| - Notes\.pdf)/i.test(name)) return 'course_notes';

  if (
    /(Sample Questions?|Sample Quiz|Obj Questions?|Essay Questions?|Trial Questions?|Answered Questions?)/i.test(name)
  ) {
    return 'sample_questions';
  }

  if (/\bQuiz\b/i.test(name)) return 'quiz_internal';

  if (
    /(Curriculum(?!\s+Studies)|Framework|Guidelines?|Standard(?:s)?|Syllabus|NTS|GES)/i.test(name)
  ) {
    return 'curriculum_policy';
  }

  return 'other';
}

function detectCategoryFromPath(filePath) {
  const normalized = normalizeText(filePath).replace(/\\/g, '/').toLowerCase();
  if (!normalized) return null;

  if (normalized.includes('/other-files/ges/') || normalized.includes('/other-files/nts/')) {
    return 'curriculum_policy';
  }

  if (normalized.includes('/other-files/lesson-plans/')) {
    return 'course_outline';
  }

  if (normalized.includes('/other-files/resource-packs/')) {
    return 'course_notes';
  }

  return null;
}

function classifyResourceCategory(fileName, filePath = '') {
  const fromName = detectCategoryFromName(fileName);
  if (fromName !== 'other') return fromName;

  const fromPath = detectCategoryFromPath(filePath);
  if (fromPath) return fromPath;

  return 'other';
}

function deriveYear(fileName, existingYear = null) {
  if (existingYear) return String(existingYear);
  const match = normalizeText(fileName).match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : null;
}

function deriveLevelSemester(filePath, existingLevel = null, existingSemester = null) {
  const normalized = normalizeText(filePath).replace(/\\/g, '/');
  const levelMatch = normalized.match(/(?:^|\/)(100|200|300|400)(?:\/|$)/);
  const semesterMatch = normalized.match(/sem-(1|2)/i);

  return {
    level: existingLevel || (levelMatch ? levelMatch[1] : null),
    semester: existingSemester || (semesterMatch ? semesterMatch[1] : null)
  };
}

function buildResourceDedupeKey(resource) {
  const parts = [
    normalizeFileName(resource.file_name || resource.title || ''),
    normalizeText(resource.course || '').toLowerCase(),
    normalizeText(resource.level || '').toLowerCase(),
    normalizeText(resource.semester || '').toLowerCase(),
    normalizeText(resource.year || '').toLowerCase(),
    normalizeText(resource.category || '').toLowerCase(),
    resource.is_premium ? 'premium' : 'free'
  ];

  return parts.join('::');
}

function buildResourceDisplayKey(resource) {
  const parts = [
    normalizeFileName(resource.file_name || resource.title || ''),
    normalizeText(resource.course || '').toLowerCase(),
    normalizeText(resource.level || '').toLowerCase(),
    normalizeText(resource.semester || '').toLowerCase(),
    normalizeText(resource.year || '').toLowerCase(),
    normalizeText(resource.category || '').toLowerCase()
  ];

  return parts.join('::');
}

function pickBestResourceCandidate(items, preferPremium = false) {
  if (!items.length) return null;

  const score = (item) => {
    let value = 0;
    const fileName = normalizeText(item.file_name || '');

    if (preferPremium && item.is_premium) value += 40;
    if (!preferPremium && !item.is_premium) value += 40;
    if (/ - Sharether\.com/i.test(fileName)) value += 10;
    value += Math.min(item.downloads || 0, 1000) / 100;
    value += Math.min(item.views || 0, 1000) / 200;
    if (item.created_at) value += new Date(item.created_at).getTime() / 1e15;
    return value;
  };

  return [...items].sort((a, b) => score(b) - score(a))[0];
}

function resolveResourceDiskPath(filePath, uploadDir) {
  const normalized = normalizeText(filePath);
  if (!normalized) return null;

  const uploadRoot = path.resolve(uploadDir);
  if (path.isAbsolute(normalized)) {
    const absolutePath = path.resolve(normalized);
    return absolutePath === uploadRoot || absolutePath.startsWith(`${uploadRoot}${path.sep}`)
      ? absolutePath
      : null;
  }

  let relative = normalized.replace(/\\/g, '/').replace(/^\/+/, '');
  if (relative.toLowerCase().startsWith('uploads/')) {
    relative = relative.slice('uploads/'.length);
  }

  const resolvedPath = path.resolve(uploadRoot, relative);
  return resolvedPath === uploadRoot || resolvedPath.startsWith(`${uploadRoot}${path.sep}`)
    ? resolvedPath
    : null;
}

module.exports = {
  normalizeFileName,
  extractTitleFromFileName,
  classifyResourceCategory,
  deriveYear,
  deriveLevelSemester,
  buildResourceDedupeKey,
  buildResourceDisplayKey,
  pickBestResourceCandidate,
  resolveResourceDiskPath
};

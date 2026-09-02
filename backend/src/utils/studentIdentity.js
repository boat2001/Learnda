const PROGRAM_CATEGORY_CODE_MAP = Object.freeze({
  'Early Childhood Education': 'ECE',
  'Primary Education': 'PRI',
  'JHS Education': 'JHS'
});

const PROGRAM_CATEGORY_ALIASES = Object.freeze({
  'EARLY CHILDHOOD EDUCATION': 'Early Childhood Education',
  'EARLY CHILDHOOD': 'Early Childhood Education',
  ECE: 'Early Childhood Education',
  'PRIMARY EDUCATION': 'Primary Education',
  PRIMARY: 'Primary Education',
  PRI: 'Primary Education',
  'JHS EDUCATION': 'JHS Education',
  'JUNIOR HIGH SCHOOL EDUCATION': 'JHS Education',
  JHS: 'JHS Education'
});

const COLLEGE_CODE_STOP_WORDS = new Set([
  'OF',
  'THE',
  'AND',
  'FOR',
  'IN',
  'AT',
  'ON',
  'A',
  'AN',
  'COLLEGE',
  'EDUCATION'
]);

const INDEX_NUMBER_REGEX = /^([A-Z]{2}CE)\/([A-Z]{3})\/(\d{2})\/(\d{4,6})$/;

const toAliasKey = (value) => String(value || '')
  .trim()
  .toUpperCase()
  .replace(/\s+/g, ' ');

const normalizeProgramCategory = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const aliasResolved = PROGRAM_CATEGORY_ALIASES[toAliasKey(raw)] || raw;
  return Object.prototype.hasOwnProperty.call(PROGRAM_CATEGORY_CODE_MAP, aliasResolved)
    ? aliasResolved
    : null;
};

const getProgramCategoryCode = (programCategory) => (
  PROGRAM_CATEGORY_CODE_MAP[programCategory] || null
);

const normalizeCollegeNameForCodeCheck = (institutionName) => (
  String(institutionName || '')
    .trim()
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean)
    .filter((token) => !COLLEGE_CODE_STOP_WORDS.has(token))
    .join('')
    .replace(/[^A-Z]/g, '')
);

const prefixLettersExistInCollegeName = (prefix, institutionName) => {
  const normalizedName = normalizeCollegeNameForCodeCheck(institutionName);
  if (!normalizedName || !prefix || prefix.length !== 2) return true;

  const availableLetters = {};
  for (const char of normalizedName) {
    availableLetters[char] = (availableLetters[char] || 0) + 1;
  }

  for (const char of prefix) {
    if (!availableLetters[char]) {
      return false;
    }
    availableLetters[char] -= 1;
  }

  return true;
};

const validateStudentIndexNumber = ({
  indexNumber,
  programCategory,
  institutionRecord,
  institutionName,
  currentYear = new Date().getFullYear()
}) => {
  const normalizedIndexNumber = String(indexNumber || '').trim().toUpperCase();
  if (!normalizedIndexNumber) {
    return { valid: false, error: 'Index number is required' };
  }

  const match = normalizedIndexNumber.match(INDEX_NUMBER_REGEX);
  if (!match) {
    return {
      valid: false,
      error: 'Index number college code must be 4 letters ending with CE'
    };
  }

  const normalizedProgramCategory = normalizeProgramCategory(programCategory);
  if (!normalizedProgramCategory) {
    return {
      valid: false,
      error: 'Program category must be one of: Early Childhood Education, Primary Education, JHS Education'
    };
  }

  const expectedProgramCode = getProgramCategoryCode(normalizedProgramCategory);

  const programCode = match[2];
  const admittedYear = 2000 + Number.parseInt(match[3], 10);

  if (programCode !== expectedProgramCode) {
    return {
      valid: false,
      error: `Index number program code must match selected program category (${expectedProgramCode})`
    };
  }

  if (admittedYear > currentYear) {
    return {
      valid: false,
      error: 'Index number admission year cannot be in the future'
    };
  }

  return {
    valid: true,
    normalizedIndexNumber,
    normalizedProgramCategory,
    expectedProgramCode,
    admittedYear
  };
};

module.exports = {
  PROGRAM_CATEGORY_CODE_MAP,
  normalizeProgramCategory,
  getProgramCategoryCode,
  validateStudentIndexNumber
};

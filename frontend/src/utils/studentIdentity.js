export const PROGRAM_CATEGORY_CODE_MAP = Object.freeze({
  'Early Childhood Education': 'ECE',
  'Primary Education': 'PRI',
  'JHS Education': 'JHS',
});

const normalizeCode = (value) => String(value || '')
  .trim()
  .toUpperCase()
  .replace(/[^A-Z0-9]/g, '');

export const deriveCollegeCode = (college) => {
  if (!college) return null;
  const explicitCode = normalizeCode(college.college_code || college.collegeCode || '');
  if (explicitCode.length >= 4 && explicitCode.endsWith('CE')) {
    return explicitCode;
  }
  return null;
};

export const getProgramCategoryCode = (programCategory) => (
  PROGRAM_CATEGORY_CODE_MAP[programCategory] || null
);

export const buildIndexNumberExample = ({ collegeCode, programCode }) => (
  `${collegeCode || 'XXCE'}/${programCode || 'PRI'}/21/0048`
);

export const formatIndexNumberInput = (value, { showTrailingSeparator = true } = {}) => {
  const raw = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 15);

  const groups = [
    raw.slice(0, 4),
    raw.slice(4, 7),
    raw.slice(7, 9),
    raw.slice(9),
  ].filter(Boolean);

  const formatted = groups.join('/');
  if (showTrailingSeparator && [4, 7, 9].includes(raw.length)) {
    return `${formatted}/`;
  }
  return formatted;
};

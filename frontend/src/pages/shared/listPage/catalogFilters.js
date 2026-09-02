export const CORE_LEVEL_OPTIONS = Object.freeze(['100', '200', '300', '400']);

export const PROGRAMME_CATEGORY_OPTIONS = Object.freeze([
  { value: 'ECE', label: 'ECE' },
  { value: 'Primary', label: 'Primary' },
  { value: 'JHS', label: 'JHS' },
]);

const PROGRAMME_CATEGORY_MAP = Object.freeze({
  ECE: 'ECE',
  'EARLY CHILDHOOD EDUCATION': 'ECE',
  PRIMARY: 'Primary',
  'PRIMARY EDUCATION': 'Primary',
  JHS: 'JHS',
  'JHS EDUCATION': 'JHS',
  'JUNIOR HIGH SCHOOL EDUCATION': 'JHS',
});

export const normalizeProgrammeCategory = (value = '') => (
  PROGRAMME_CATEGORY_MAP[String(value || '').trim().toUpperCase()] || ''
);

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
};

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const normalizeFilterValue = (value) => {
  const text = String(value || '').trim();
  const digits = text.match(/\d+/)?.[0];
  return digits || text;
};

export const getCatalogOfferingFilters = (course = {}) => (
  toArray(course.offering_filters || course.offerings)
    .map((offering) => {
      const program = offering?.program || {};
      return {
        program: String(
          offering?.program_name ||
            program?.name ||
            offering?.programName ||
            offering?.program ||
            ''
        ).trim(),
        category: normalizeProgrammeCategory(
          offering?.program_category ||
            program?.category ||
            offering?.programCategory ||
            offering?.category
        ),
        level: normalizeFilterValue(offering?.level),
        semester: normalizeFilterValue(offering?.semester),
      };
    })
    .filter((offering) => offering.program || offering.category || offering.level || offering.semester)
);

export const catalogOfferingMatchesFilters = (offering = {}, filters = {}) => {
  if (filters.program && filters.program !== 'all') {
    if (normalizeText(offering.program) !== normalizeText(filters.program)) return false;
  }

  if (filters.programCategory && filters.programCategory !== 'all') {
    if (normalizeText(offering.category) !== normalizeText(filters.programCategory)) return false;
  }

  if (filters.level && filters.level !== 'all') {
    if (normalizeFilterValue(offering.level) !== normalizeFilterValue(filters.level)) return false;
  }

  if (filters.semester && filters.semester !== 'all') {
    if (normalizeFilterValue(offering.semester) !== normalizeFilterValue(filters.semester)) return false;
  }

  return true;
};

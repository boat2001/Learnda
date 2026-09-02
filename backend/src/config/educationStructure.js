// src/config/educationStructure.js
//
// Canonical Ghanaian K-12 education structure for Learnda.
// This module is the single source of truth for level groups, class levels,
// learning types, and progression/access rules. See learnda-dev-guide.md §2, §3, §6, §7.
//
// LOCKED RULES (dev guide §1):
//   - Primary classes are Basic 1-6 (B1-B6). "P1"-"P6" must never appear.
//   - No tertiary concepts (courses, semesters, lecturers).
//   - Learners cannot change class level manually; progression is by academic year.
//   - Content is class-scoped: a learner never sees content above their class.

const EDUCATION_STRUCTURE_VERSION = '2026-09-02-k12-v1';

// ── Level groups (§2.1) ───────────────────────────────────────────────────────

const LEVEL_GROUPS = Object.freeze({
  KINDERGARTEN: 'KINDERGARTEN',
  PRIMARY: 'PRIMARY',
  JHS: 'JHS',
  SHS: 'SHS',
});

const LEVEL_GROUP_VALUES = Object.freeze(Object.values(LEVEL_GROUPS));

const LEVEL_GROUP_LABELS = Object.freeze({
  KINDERGARTEN: 'Kindergarten',
  PRIMARY: 'Primary',
  JHS: 'Junior High School',
  SHS: 'Senior High School',
});

// ── Learning types (§3.1) ─────────────────────────────────────────────────────
// Kindergarten teaches Learning Areas; every other level group teaches Subjects.

const LEARNING_TYPES = Object.freeze({
  LEARNING_AREA: 'LEARNING_AREA',
  SUBJECT: 'SUBJECT',
});

const LEVEL_GROUP_LEARNING_TYPE = Object.freeze({
  KINDERGARTEN: LEARNING_TYPES.LEARNING_AREA,
  PRIMARY: LEARNING_TYPES.SUBJECT,
  JHS: LEARNING_TYPES.SUBJECT,
  SHS: LEARNING_TYPES.SUBJECT,
});

// ── Class levels (§2.2), in mandatory UI order (§2.3) ─────────────────────────
// `ordinal` is the real-world progression index and the ONLY thing access
// checks compare. Never reorder this array: ordinals are derived from it and
// are persisted against content rows.

const CLASS_LEVELS = Object.freeze([
  { code: 'KG1', label: 'KG 1', shortLabel: 'KG 1', levelGroup: LEVEL_GROUPS.KINDERGARTEN },
  { code: 'KG2', label: 'KG 2', shortLabel: 'KG 2', levelGroup: LEVEL_GROUPS.KINDERGARTEN },
  { code: 'B1', label: 'Basic 1', shortLabel: 'B1', levelGroup: LEVEL_GROUPS.PRIMARY },
  { code: 'B2', label: 'Basic 2', shortLabel: 'B2', levelGroup: LEVEL_GROUPS.PRIMARY },
  { code: 'B3', label: 'Basic 3', shortLabel: 'B3', levelGroup: LEVEL_GROUPS.PRIMARY },
  { code: 'B4', label: 'Basic 4', shortLabel: 'B4', levelGroup: LEVEL_GROUPS.PRIMARY },
  { code: 'B5', label: 'Basic 5', shortLabel: 'B5', levelGroup: LEVEL_GROUPS.PRIMARY },
  { code: 'B6', label: 'Basic 6', shortLabel: 'B6', levelGroup: LEVEL_GROUPS.PRIMARY },
  { code: 'JHS1', label: 'JHS 1', shortLabel: 'JHS 1', levelGroup: LEVEL_GROUPS.JHS },
  { code: 'JHS2', label: 'JHS 2', shortLabel: 'JHS 2', levelGroup: LEVEL_GROUPS.JHS },
  { code: 'JHS3', label: 'JHS 3', shortLabel: 'JHS 3', levelGroup: LEVEL_GROUPS.JHS },
  { code: 'SHS1', label: 'SHS 1', shortLabel: 'SHS 1', levelGroup: LEVEL_GROUPS.SHS },
  { code: 'SHS2', label: 'SHS 2', shortLabel: 'SHS 2', levelGroup: LEVEL_GROUPS.SHS },
  { code: 'SHS3', label: 'SHS 3', shortLabel: 'SHS 3', levelGroup: LEVEL_GROUPS.SHS },
].map((level, index) => Object.freeze({ ...level, ordinal: index })));

const CLASS_LEVEL_CODES = Object.freeze(CLASS_LEVELS.map((l) => l.code));

const CLASS_LEVEL_BY_CODE = Object.freeze(
  CLASS_LEVELS.reduce((acc, level) => { acc[level.code] = level; return acc; }, {})
);

const CLASS_LEVELS_BY_GROUP = Object.freeze(
  LEVEL_GROUP_VALUES.reduce((acc, group) => {
    acc[group] = Object.freeze(CLASS_LEVELS.filter((l) => l.levelGroup === group));
    return acc;
  }, {})
);

// ── Lookups and validation ────────────────────────────────────────────────────

/** Normalizes user input to a canonical class-level code, or null. */
const normalizeClassLevelCode = (value) => {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase().replace(/[\s_-]/g, '');
  return CLASS_LEVEL_BY_CODE[code] ? code : null;
};

const isValidClassLevel = (code) => normalizeClassLevelCode(code) !== null;

const getClassLevel = (code) => CLASS_LEVEL_BY_CODE[normalizeClassLevelCode(code)] || null;

const getLevelGroup = (code) => {
  const level = getClassLevel(code);
  return level ? level.levelGroup : null;
};

const getOrdinal = (code) => {
  const level = getClassLevel(code);
  return level ? level.ordinal : null;
};

/** Learning type taught at a class level: KG -> LEARNING_AREA, else SUBJECT. */
const getLearningType = (code) => {
  const group = getLevelGroup(code);
  return group ? LEVEL_GROUP_LEARNING_TYPE[group] : null;
};

/**
 * Guards dev guide §1 rule 1: "P1"-"P6" are banned. Ghanaian primary classes
 * are Basic 1-6. Callers should reject rather than silently translate, so bad
 * data surfaces at the boundary instead of spreading.
 */
const BANNED_CLASS_CODE_PATTERN = /^P[1-6]$/i;
const isBannedClassCode = (value) =>
  typeof value === 'string' && BANNED_CLASS_CODE_PATTERN.test(value.trim());

// ── Progression (§6.4) ────────────────────────────────────────────────────────
// Promotion is a single step along CLASS_LEVELS, so KG2 -> B1, B6 -> JHS1 and
// JHS3 -> SHS1 fall out naturally. SHS3 is terminal.

const getNextClassLevel = (code) => {
  const level = getClassLevel(code);
  if (!level) return null;
  const next = CLASS_LEVELS[level.ordinal + 1];
  return next ? next.code : null;
};

const getPreviousClassLevel = (code) => {
  const level = getClassLevel(code);
  if (!level || level.ordinal === 0) return null;
  return CLASS_LEVELS[level.ordinal - 1].code;
};

const isTerminalClassLevel = (code) => getNextClassLevel(code) === null;

// ── Access rules (§5, §6.3) ───────────────────────────────────────────────────

const ACCESS_MODES = Object.freeze({
  CURRENT: 'CURRENT',     // the learner's own class: full access
  REVISION: 'REVISION',   // a past class: revision only
  LOCKED: 'LOCKED',       // a future class: not available until promoted
});

/**
 * Resolves how a learner in `learnerClassCode` may access content tagged
 * `contentClassCode`. Unknown codes resolve to LOCKED: the safe default is
 * always to withhold, never to expose content above a learner's class.
 */
const getAccessMode = (learnerClassCode, contentClassCode) => {
  const learner = getOrdinal(learnerClassCode);
  const content = getOrdinal(contentClassCode);
  if (learner === null || content === null) return ACCESS_MODES.LOCKED;
  if (content === learner) return ACCESS_MODES.CURRENT;
  if (content < learner) return ACCESS_MODES.REVISION;
  return ACCESS_MODES.LOCKED;
};

const canAccessClassLevel = (learnerClassCode, contentClassCode) =>
  getAccessMode(learnerClassCode, contentClassCode) !== ACCESS_MODES.LOCKED;

/** Class levels a learner may open: their own class and everything below it. */
const getAccessibleClassLevels = (learnerClassCode) => {
  const learner = getOrdinal(learnerClassCode);
  if (learner === null) return [];
  return CLASS_LEVELS.filter((l) => l.ordinal <= learner).map((l) => l.code);
};

/** Class levels still locked for a learner, for the "available next year" UI. */
const getLockedClassLevels = (learnerClassCode) => {
  const learner = getOrdinal(learnerClassCode);
  if (learner === null) return CLASS_LEVEL_CODES.slice();
  return CLASS_LEVELS.filter((l) => l.ordinal > learner).map((l) => l.code);
};

// ── Learning unit taxonomy (§4.4 developer model) ─────────────────────────────

const LEARNING_UNIT_CATEGORIES = Object.freeze({
  CORE: 'CORE',
  ELECTIVE: 'ELECTIVE',
  INTERVENTION: 'INTERVENTION',
  PATHWAY_CORE: 'PATHWAY_CORE',
  ADDITIONAL: 'ADDITIONAL',
});

const PATHWAY_RULE_GROUPS = Object.freeze({
  CORE: 'CORE',
  PATHWAY_ELECTIVE: 'PATHWAY_ELECTIVE',
  ADDITIONAL_ELECTIVE: 'ADDITIONAL_ELECTIVE',
  SCIENCE_ELECTIVE: 'SCIENCE_ELECTIVE',
  HUMANITIES_ELECTIVE: 'HUMANITIES_ELECTIVE',
});

// ── Academic profile (§6.2) ───────────────────────────────────────────────────

const ACADEMIC_TERMS = Object.freeze(['Term 1', 'Term 2', 'Term 3']);

const ACADEMIC_PROFILE_STATUSES = Object.freeze({
  ACTIVE: 'ACTIVE',
  PROMOTED: 'PROMOTED',
  REPEATED: 'REPEATED',
});

/** Academic year label, e.g. "2025/2026". Ghana's school year opens in September. */
const ACADEMIC_YEAR_START_MONTH = 8; // 0-indexed: September
const getAcademicYearLabel = (date = new Date()) => {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= ACADEMIC_YEAR_START_MONTH ? year : year - 1;
  return `${startYear}/${startYear + 1}`;
};

const isValidAcademicYear = (value) => typeof value === 'string' && /^\d{4}\/\d{4}$/.test(value.trim());

// ── Feature gating (§7) ───────────────────────────────────────────────────────
// 'off' = hidden entirely, 'limited' = reduced surface, 'on' = full.
// KG has no exams, quizzes, community or messaging (§4.1).

const FEATURE_ACCESS = Object.freeze({ OFF: 'off', LIMITED: 'limited', ON: 'on' });

const FEATURE_GATES = Object.freeze({
  exams: { KINDERGARTEN: 'off', PRIMARY: 'limited', JHS: 'on', SHS: 'on' },
  quizzes: { KINDERGARTEN: 'off', PRIMARY: 'on', JHS: 'on', SHS: 'on' },
  community: { KINDERGARTEN: 'off', PRIMARY: 'off', JHS: 'limited', SHS: 'limited' },
  messaging: { KINDERGARTEN: 'off', PRIMARY: 'off', JHS: 'off', SHS: 'limited' },
  audioLessons: { KINDERGARTEN: 'on', PRIMARY: 'on', JHS: 'on', SHS: 'on' },
  animations: { KINDERGARTEN: 'on', PRIMARY: 'on', JHS: 'on', SHS: 'on' },
  offlineAccess: { KINDERGARTEN: 'on', PRIMARY: 'on', JHS: 'on', SHS: 'on' },
});

const FEATURE_KEYS = Object.freeze(Object.keys(FEATURE_GATES));

/** Feature access for a level group. Unknown feature or group -> 'off'. */
const getFeatureAccess = (feature, levelGroup) => {
  const gate = FEATURE_GATES[feature];
  if (!gate) return FEATURE_ACCESS.OFF;
  return gate[levelGroup] || FEATURE_ACCESS.OFF;
};

/** Convenience: resolve a feature gate straight from a class-level code. */
const getFeatureAccessForClass = (feature, classLevelCode) =>
  getFeatureAccess(feature, getLevelGroup(classLevelCode));

const isFeatureEnabled = (feature, levelGroup) =>
  getFeatureAccess(feature, levelGroup) !== FEATURE_ACCESS.OFF;

module.exports = {
  EDUCATION_STRUCTURE_VERSION,

  LEVEL_GROUPS,
  LEVEL_GROUP_VALUES,
  LEVEL_GROUP_LABELS,

  LEARNING_TYPES,
  LEVEL_GROUP_LEARNING_TYPE,

  CLASS_LEVELS,
  CLASS_LEVEL_CODES,
  CLASS_LEVEL_BY_CODE,
  CLASS_LEVELS_BY_GROUP,

  normalizeClassLevelCode,
  isValidClassLevel,
  getClassLevel,
  getLevelGroup,
  getOrdinal,
  getLearningType,
  isBannedClassCode,

  getNextClassLevel,
  getPreviousClassLevel,
  isTerminalClassLevel,

  ACCESS_MODES,
  getAccessMode,
  canAccessClassLevel,
  getAccessibleClassLevels,
  getLockedClassLevels,

  LEARNING_UNIT_CATEGORIES,
  PATHWAY_RULE_GROUPS,

  ACADEMIC_TERMS,
  ACADEMIC_PROFILE_STATUSES,
  getAcademicYearLabel,
  isValidAcademicYear,

  FEATURE_ACCESS,
  FEATURE_GATES,
  FEATURE_KEYS,
  getFeatureAccess,
  getFeatureAccessForClass,
  isFeatureEnabled,
};

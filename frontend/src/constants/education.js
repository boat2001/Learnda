// Frontend mirror of backend/src/config/educationStructure.js.
//
// Kept as a separate module because frontend and backend are separate packages.
// The backend remains the authority: it decides what a learner may actually
// see, and this file only shapes presentation. If the two ever disagree, the
// API wins -- never widen access here to "fix" a mismatch.
//
// See learnda-dev-guide.md §2, §3, §7, §8.

export const LEVEL_GROUPS = Object.freeze({
  KINDERGARTEN: 'KINDERGARTEN',
  PRIMARY: 'PRIMARY',
  JHS: 'JHS',
  SHS: 'SHS',
});

export const LEVEL_GROUP_LABELS = Object.freeze({
  KINDERGARTEN: 'Kindergarten',
  PRIMARY: 'Primary',
  JHS: 'Junior High School',
  SHS: 'Senior High School',
});

export const LEARNING_TYPES = Object.freeze({
  LEARNING_AREA: 'LEARNING_AREA',
  SUBJECT: 'SUBJECT',
});

// §2.3 — the mandatory UI order. Never reorder.
export const CLASS_LEVELS = Object.freeze([
  { code: 'KG1', label: 'KG 1', levelGroup: 'KINDERGARTEN' },
  { code: 'KG2', label: 'KG 2', levelGroup: 'KINDERGARTEN' },
  { code: 'B1', label: 'Basic 1', levelGroup: 'PRIMARY' },
  { code: 'B2', label: 'Basic 2', levelGroup: 'PRIMARY' },
  { code: 'B3', label: 'Basic 3', levelGroup: 'PRIMARY' },
  { code: 'B4', label: 'Basic 4', levelGroup: 'PRIMARY' },
  { code: 'B5', label: 'Basic 5', levelGroup: 'PRIMARY' },
  { code: 'B6', label: 'Basic 6', levelGroup: 'PRIMARY' },
  { code: 'JHS1', label: 'JHS 1', levelGroup: 'JHS' },
  { code: 'JHS2', label: 'JHS 2', levelGroup: 'JHS' },
  { code: 'JHS3', label: 'JHS 3', levelGroup: 'JHS' },
  { code: 'SHS1', label: 'SHS 1', levelGroup: 'SHS' },
  { code: 'SHS2', label: 'SHS 2', levelGroup: 'SHS' },
  { code: 'SHS3', label: 'SHS 3', levelGroup: 'SHS' },
].map((level, index) => Object.freeze({ ...level, ordinal: index })));

export const CLASS_LEVEL_BY_CODE = Object.freeze(
  CLASS_LEVELS.reduce((acc, level) => { acc[level.code] = level; return acc; }, {})
);

export const CLASS_LEVELS_BY_GROUP = Object.freeze(
  Object.values(LEVEL_GROUPS).reduce((acc, group) => {
    acc[group] = CLASS_LEVELS.filter((l) => l.levelGroup === group);
    return acc;
  }, {})
);

export const getClassLevel = (code) => CLASS_LEVEL_BY_CODE[code] || null;
export const getClassLabel = (code) => CLASS_LEVEL_BY_CODE[code]?.label || '';
export const getLevelGroup = (code) => CLASS_LEVEL_BY_CODE[code]?.levelGroup || null;

export const ACCESS_MODES = Object.freeze({
  CURRENT: 'CURRENT',
  REVISION: 'REVISION',
  LOCKED: 'LOCKED',
});

// §9 — what a level group calls the things it teaches. KG has Learning Areas;
// everyone else has Subjects. "Courses" appears nowhere in Learnda.
export const getUnitNoun = (levelGroup) => (
  levelGroup === LEVEL_GROUPS.KINDERGARTEN
    ? { singular: 'Learning Area', plural: 'Learning Areas' }
    : { singular: 'Subject', plural: 'Subjects' }
);

// §7 feature gating. 'off' hides a feature entirely; 'limited' shows a reduced
// surface; 'on' is full. KG has no exams, quizzes, community or messaging.
export const FEATURE_GATES = Object.freeze({
  exams: { KINDERGARTEN: 'off', PRIMARY: 'limited', JHS: 'on', SHS: 'on' },
  quizzes: { KINDERGARTEN: 'off', PRIMARY: 'on', JHS: 'on', SHS: 'on' },
  community: { KINDERGARTEN: 'off', PRIMARY: 'off', JHS: 'limited', SHS: 'limited' },
  messaging: { KINDERGARTEN: 'off', PRIMARY: 'off', JHS: 'off', SHS: 'limited' },
  studyGroups: { KINDERGARTEN: 'off', PRIMARY: 'off', JHS: 'limited', SHS: 'limited' },
  audioLessons: { KINDERGARTEN: 'on', PRIMARY: 'on', JHS: 'on', SHS: 'on' },
  animations: { KINDERGARTEN: 'on', PRIMARY: 'on', JHS: 'on', SHS: 'on' },
  offlineAccess: { KINDERGARTEN: 'on', PRIMARY: 'on', JHS: 'on', SHS: 'on' },
});

/** Unknown feature or level group resolves to 'off' -- hide, never reveal. */
export const getFeatureAccess = (feature, levelGroup) =>
  FEATURE_GATES[feature]?.[levelGroup] || 'off';

export const isFeatureEnabled = (feature, levelGroup) =>
  getFeatureAccess(feature, levelGroup) !== 'off';

export const getFeatureAccessForClass = (feature, classLevelCode) =>
  getFeatureAccess(feature, getLevelGroup(classLevelCode));

// §8 — the presentation mode each level group gets. Components read `mode` and
// the `data-level-group` attribute rather than testing for a class code, so a
// new class level never needs a UI change.
export const PRESENTATION = Object.freeze({
  KINDERGARTEN: {
    mode: 'playful',
    // §8: big icons, tap-to-listen, no text walls, game-like flow.
    bigIcons: true,
    audioFirst: true,
    textDensity: 'minimal',
    showReadingTime: false,
    showProgressPercent: false,
    cardsPerRow: 2,
    tone: 'Tap a picture to start',
  },
  PRIMARY: {
    mode: 'visual',
    // §8: simple language, visual learning, gentle assessments.
    bigIcons: true,
    audioFirst: true,
    textDensity: 'light',
    showReadingTime: false,
    showProgressPercent: true,
    cardsPerRow: 2,
    tone: 'Pick a subject to learn',
  },
  JHS: {
    mode: 'structured',
    // §8: structured lessons, exam prep, practice-heavy.
    bigIcons: false,
    audioFirst: false,
    textDensity: 'full',
    showReadingTime: true,
    showProgressPercent: true,
    cardsPerRow: 3,
    tone: 'Your subjects this term',
  },
  SHS: {
    mode: 'structured',
    bigIcons: false,
    audioFirst: false,
    textDensity: 'full',
    showReadingTime: true,
    showProgressPercent: true,
    cardsPerRow: 3,
    tone: 'Your subjects this term',
  },
});

export const getPresentation = (levelGroup) =>
  PRESENTATION[levelGroup] || PRESENTATION.JHS;

export const getPresentationForClass = (classLevelCode) =>
  getPresentation(getLevelGroup(classLevelCode));

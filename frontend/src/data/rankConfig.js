// Progress vocabulary for K-12 learners.
//
// These are display labels only — the database still stores `xp`, `level` and
// `streak`. Renaming here changes what a child reads without a migration.
//
// The names deliberately avoid gaming language ("Grandmaster", "Legend") and
// competitive framing. They read as stages of a learner growing through school,
// which is the same arc the app itself models (§0), and they have to make sense
// to both a KG 1 child and an SHS 3 student.

export const RANK_NAMES = [
  '', 'Beginner', 'Learner', 'Reader', 'Thinker',
  'Explorer', 'Problem Solver', 'Achiever', 'Scholar', 'Star Learner', 'Master Learner',
];

// Drawn from the logo palette so progress reads as part of the brand, warming
// from blue through green and amber to orange as a learner advances.
export const RANK_COLORS = [
  '', '#94a3b8', '#6398e6', '#3e7fdd', '#2b62c4',
  '#234f9e', '#73a24b', '#5b8439', '#fab82c', '#fb6334', '#1f3049',
];

export const XP_THRESHOLDS = [0, 100, 250, 500, 1000, 2000, 3500, 5500, 8000, 11000, 15000];

// User-facing names for the three progress mechanics. Every label a learner
// sees should come from here rather than being written inline, so the whole
// vocabulary can be changed in one place.
export const PROGRESS_TERMS = Object.freeze({
  // "XP" is gaming shorthand; young learners and parents read points.
  xp: { singular: 'Learning Point', plural: 'Learning Points', short: 'points' },
  // "Level" collides with the class level a learner is in (§2.2), which would
  // be genuinely confusing. Progress stages are called Stages.
  level: { singular: 'Stage', plural: 'Stages' },
  // Streaks stay, framed as days of learning rather than a score to protect.
  streak: { singular: 'day streak', plural: 'day streaks', verb: 'learning days in a row' },
  badge: { singular: 'Award', plural: 'Awards' },
});

export const getRankName = (level) => RANK_NAMES[level] || RANK_NAMES[1];
export const getRankColor = (level) => RANK_COLORS[level] || RANK_COLORS[1];

/** e.g. "Stage 4 · Thinker" */
export const getStageLabel = (level) =>
  `${PROGRESS_TERMS.level.singular} ${level} · ${getRankName(level)}`;

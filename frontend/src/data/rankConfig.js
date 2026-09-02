export const RANK_NAMES = [
  '', 'Newcomer', 'Learner', 'Explorer', 'Scholar',
  'Achiever', 'Expert', 'Master', 'Champion', 'Legend', 'Grandmaster',
];

export const RANK_COLORS = [
  '', '#94a3b8', '#6366f1', '#8b5cf6', '#0891b2',
  '#0d9488', '#16a34a', '#d97706', '#dc2626', '#be185d', '#7c3aed',
];

export const XP_THRESHOLDS = [0, 100, 250, 500, 1000, 2000, 3500, 5500, 8000, 11000, 15000];

export const getRankName = (level) => RANK_NAMES[level] || RANK_NAMES[1];
export const getRankColor = (level) => RANK_COLORS[level] || RANK_COLORS[1];

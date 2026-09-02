const SEMESTERS = new Set(['1', '2']);
const LEVEL_STEP = 100;
const TERM_MONTHS = 6;

const parseLevel = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'graduate') return 'graduate';

  const digits = normalized.replace(/[^\d]/g, '');
  if (!digits) return null;
  const level = Number.parseInt(digits, 10);
  if (!Number.isFinite(level) || level < 100 || level > 1000) return null;
  return level;
};

const normalizeLevel = (value) => {
  const parsed = parseLevel(value);
  if (parsed === null) return null;
  if (parsed === 'graduate') return 'graduate';
  return String(parsed);
};

const normalizeSemester = (value) => {
  const normalized = String(value || '').trim();
  if (!SEMESTERS.has(normalized)) return null;
  return normalized;
};

const addMonths = (date, months) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
};

const diffMonths = (fromDate, toDate) => {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  const years = to.getFullYear() - from.getFullYear();
  const months = to.getMonth() - from.getMonth();
  return years * 12 + months;
};

const maybeAdvanceAcademicProgress = (user, now = new Date()) => {
  if (!user || user.role !== 'student') {
    return null;
  }

  const normalizedLevel = normalizeLevel(user.level);
  const normalizedSemester = normalizeSemester(user.semester) || '1';
  if (!normalizedLevel || normalizedLevel === 'graduate') {
    return null;
  }

  const baselineDate =
    user.academic_last_progressed_at ||
    user.updated_at ||
    user.created_at ||
    now;
  const elapsedMonths = diffMonths(baselineDate, now);
  const termSteps = Math.min(Math.floor(elapsedMonths / TERM_MONTHS), 1);

  if (termSteps <= 0) {
    return null;
  }

  let level = Number.parseInt(normalizedLevel, 10);
  let semester = normalizedSemester;

  for (let i = 0; i < termSteps; i += 1) {
    if (semester === '1') {
      semester = '2';
    } else {
      semester = '1';
      level += LEVEL_STEP;
    }
  }

  return {
    level: String(level),
    semester,
    academic_last_progressed_at: addMonths(baselineDate, termSteps * TERM_MONTHS)
  };
};

module.exports = {
  normalizeLevel,
  normalizeSemester,
  maybeAdvanceAcademicProgress
};

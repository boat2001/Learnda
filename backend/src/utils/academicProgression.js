// Academic progression for Learnda. See learnda-dev-guide.md §6.4, §6.5.
//
// The rule that matters (§6.1): learners advance only when the academic YEAR
// advances -- never by choice, never mid-year, never by finishing content.
// Ghana's school year opens in September, so a learner sits in one class from
// September to August and moves up at the turn.
//
// This module only ever proposes a promotion; it never demotes, never skips a
// class, and never acts on a profile with auto_progression disabled. Manual
// overrides are a separate, audited path (§6.5) -- see applyManualOverride.
const {
  getNextClassLevel,
  getLevelGroup,
  isValidClassLevel,
  isTerminalClassLevel,
  getAcademicYearLabel,
  isValidAcademicYear,
  ACADEMIC_PROFILE_STATUSES,
  ACADEMIC_TERMS,
} = require('../config/educationStructure');

/** Ordering key for an academic year label, so "2025/2026" < "2026/2027". */
const academicYearStart = (label) => {
  if (!isValidAcademicYear(label)) return null;
  return Number.parseInt(String(label).slice(0, 4), 10);
};

/** How many academic years separate two labels. Negative if `to` precedes `from`. */
const academicYearsBetween = (from, to) => {
  const a = academicYearStart(from);
  const b = academicYearStart(to);
  if (a === null || b === null) return 0;
  return b - a;
};

/**
 * Decides whether a learner's academic profile should move to the next class.
 *
 * Returns null when nothing should change -- the common case. Returns a patch
 * when the academic year has turned since the profile was last set AND the
 * profile opts into automatic progression.
 *
 * Deliberately caps advancement at a single class per call: if a profile has
 * been dormant for three years, the learner did not silently attend three
 * grades. A multi-year gap is surfaced for review rather than auto-applied.
 */
const maybeAdvanceAcademicProgress = (profile, now = new Date()) => {
  if (!profile) return null;

  const classLevel = profile.class_level;
  if (!isValidClassLevel(classLevel)) return null;

  // §6.4: a learner cannot be promoted past the end of SHS.
  if (isTerminalClassLevel(classLevel)) return null;

  // Respect an explicitly disabled auto-progression (repeaters, manual review).
  if (profile.auto_progression === false) return null;

  // A learner marked REPEATED stays put until an admin or parent clears it (§6.5).
  if (profile.status === ACADEMIC_PROFILE_STATUSES.REPEATED) return null;

  const currentYear = getAcademicYearLabel(now);
  const profileYear = profile.academic_year;
  if (!isValidAcademicYear(profileYear)) return null;

  const yearsElapsed = academicYearsBetween(profileYear, currentYear);

  // Same academic year, or a clock that has somehow gone backwards: no change.
  if (yearsElapsed <= 0) return null;

  const nextClass = getNextClassLevel(classLevel);
  if (!nextClass) return null;

  return {
    class_level: nextClass,
    level_group: getLevelGroup(nextClass),
    academic_year: currentYear,
    term: ACADEMIC_TERMS[0],
    status: ACADEMIC_PROFILE_STATUSES.ACTIVE,
    promoted_at: now,
    // Flagged when more than one year passed, so the gap can be reviewed
    // rather than silently collapsed into a single promotion.
    needs_review: yearsElapsed > 1,
    years_elapsed: yearsElapsed,
  };
};

/**
 * Builds an audited manual override (§6.5). Only admin, parent and school
 * accounts may call this, and every override records who did it and why.
 * Returns null if the actor is not permitted or the target class is invalid.
 */
const OVERRIDE_ROLES = new Set(['admin', 'parent', 'school']);

const buildManualOverride = ({ actorRole, actorUserId, toClassLevel, reason, now = new Date() }) => {
  if (!OVERRIDE_ROLES.has(String(actorRole || '').toLowerCase())) return null;
  if (!isValidClassLevel(toClassLevel)) return null;
  if (!String(reason || '').trim()) return null;

  return {
    patch: {
      class_level: toClassLevel,
      level_group: getLevelGroup(toClassLevel),
      academic_year: getAcademicYearLabel(now),
      status: ACADEMIC_PROFILE_STATUSES.ACTIVE,
      promoted_at: now,
    },
    audit: {
      action: 'academic_profile.manual_override',
      actor_user_id: actorUserId || null,
      actor_role: String(actorRole).toLowerCase(),
      to_class_level: toClassLevel,
      reason: String(reason).trim(),
      occurred_at: now,
    },
  };
};

module.exports = {
  academicYearStart,
  academicYearsBetween,
  maybeAdvanceAcademicProgress,
  buildManualOverride,
  OVERRIDE_ROLES,
};

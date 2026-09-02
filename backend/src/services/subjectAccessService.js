// services/subjectAccessService.js
//
// Decides which learning units (KG Learning Areas, or Primary/JHS/SHS Subjects)
// a learner may see, and how they may access content at a given class level.
// See learnda-dev-guide.md §4.4, §5, §6.3.
//
// The rule this file exists to enforce: a learner never sees anything above
// their own class, and an SHS learner sees only what their class + pathway +
// school availability allow. Every ambiguous case resolves to "hide".
const { Op } = require('sequelize');
const {
  LEVEL_GROUPS,
  ACCESS_MODES,
  PATHWAY_RULE_GROUPS,
  getAccessMode,
  getAccessibleClassLevels,
  getLockedClassLevels,
  getClassLevel,
  getLevelGroup,
  getOrdinal,
  isValidClassLevel,
} = require('../config/educationStructure');

/**
 * Normalizes whatever the caller has (a user, an AcademicProfile row, a plain
 * object) into the placement facts this service needs. Returns null when the
 * learner has no usable placement -- callers must then show nothing.
 */
const resolvePlacement = (source) => {
  if (!source) return null;

  const raw = source.academic_profile || source.academicProfile || source;
  const profile = typeof raw?.get === 'function' ? raw.get({ plain: true }) : raw;
  if (!profile) return null;

  const classLevel = profile.class_level || null;
  if (!isValidClassLevel(classLevel)) return null;

  return {
    classLevel,
    levelGroup: getLevelGroup(classLevel),
    pathwayId: profile.pathway_id || null,
    isStemSchool: Boolean(profile.is_stem_school),
  };
};

/**
 * Which learning units are visible to a learner.
 *
 * KG / Primary / JHS: every active unit of the learner's level group whose
 * class band covers their class (§4.2 -- all Primary subjects are available to
 * all Primary learners; it is the CONTENT that is class-scoped, not the subject
 * list).
 *
 * SHS: only units reachable through the learner's pathway, and only those whose
 * pathway rule applies at their class year -- which is how Business shows
 * business_studies in SHS1 but business_management + accounting in SHS2-3 (§4.4.3).
 */
const getVisibleLearningUnits = async (models, placementSource) => {
  const placement = resolvePlacement(placementSource);
  if (!placement) {
    return { units: [], placement: null, reason: 'no_class_placement' };
  }

  const { LearningUnit, PathwaySubjectRule, LearningPathway } = models;
  const { classLevel, levelGroup, pathwayId, isStemSchool } = placement;
  const classOrdinal = getOrdinal(classLevel);

  // Below SHS the subject list is simply the level group's active units whose
  // band covers this class.
  if (levelGroup !== LEVEL_GROUPS.SHS) {
    const units = await LearningUnit.findAll({
      where: { level_group: levelGroup, is_active: true },
      order: [['sort_order', 'ASC'], ['name', 'ASC']],
    });
    return {
      units: units.filter((u) => u.isTaughtAt(classLevel)),
      placement,
      reason: null,
    };
  }

  // SHS without a pathway: show nothing rather than everything. §4.4 is
  // explicit that the app must not show every SHS subject to every learner.
  if (!pathwayId) {
    return { units: [], placement, reason: 'no_pathway_selected' };
  }

  const pathway = await LearningPathway.findByPk(pathwayId);
  if (!pathway || !pathway.is_active) {
    return { units: [], placement, reason: 'pathway_unavailable' };
  }

  // §4.4.9: the STEM pathway belongs to designated STEM schools only.
  if (pathway.is_stem_only && !isStemSchool) {
    return { units: [], placement, reason: 'stem_pathway_not_available' };
  }

  const rules = await PathwaySubjectRule.findAll({
    where: { pathway_id: pathwayId, is_active: true },
    include: [{ model: LearningUnit, as: 'learning_unit', required: true }],
    order: [['sort_order', 'ASC']],
  });

  const seen = new Set();
  const units = [];
  for (const rule of rules) {
    // Year-sensitive: skip rules whose band does not cover this class.
    if (!rule.appliesAt(classLevel)) continue;

    const unit = rule.learning_unit;
    if (!unit || !unit.is_active) continue;
    if (getOrdinal(unit.from_class) > classOrdinal) continue;
    if (seen.has(unit.id)) continue;

    seen.add(unit.id);
    units.push(Object.assign(unit, {
      rule_group: rule.rule_group,
      required: rule.required,
      min_select: rule.min_select,
      max_select: rule.max_select,
    }));
  }

  return { units, placement, reason: null };
};

/**
 * Groups SHS units by their rule group, with the selection bounds each group
 * carries, so the UI can render "choose 3 of these" without re-deriving it.
 */
const groupUnitsByRuleGroup = (units) => {
  const groups = {};
  for (const group of Object.values(PATHWAY_RULE_GROUPS)) groups[group] = [];

  units.forEach((unit) => {
    const key = unit.rule_group || PATHWAY_RULE_GROUPS.CORE;
    (groups[key] = groups[key] || []).push(unit);
  });

  return groups;
};

/**
 * The class levels a learner may browse, tagged with how (§6.3):
 *   CURRENT  -- their own class, full access
 *   REVISION -- a past class, revision only
 *   LOCKED   -- a future class, shown with "available next academic year"
 */
const getClassLevelAccessMap = (classLevel) => {
  if (!isValidClassLevel(classLevel)) return [];

  return [...getAccessibleClassLevels(classLevel), ...getLockedClassLevels(classLevel)]
    .map((code) => {
      const level = getClassLevel(code);
      const mode = getAccessMode(classLevel, code);
      return {
        code,
        label: level.label,
        level_group: level.levelGroup,
        ordinal: level.ordinal,
        access: mode,
        locked: mode === ACCESS_MODES.LOCKED,
        // Copy the §6.3 UI asks for on locked levels.
        note: mode === ACCESS_MODES.LOCKED ? 'Available next academic year' : null,
      };
    })
    .sort((a, b) => a.ordinal - b.ordinal);
};

/**
 * A Sequelize `where` fragment restricting content to what a learner may open.
 *
 * Pass this into every topic/lesson/practice query. Returning an impossible
 * condition for an unplaced learner is deliberate: a missing placement must
 * yield no rows, never all rows.
 */
const buildClassScopeWhere = (classLevel, { includeRevision = true } = {}) => {
  if (!isValidClassLevel(classLevel)) {
    return { class_level_code: { [Op.in]: [] } };
  }

  const allowed = includeRevision
    ? getAccessibleClassLevels(classLevel)
    : [classLevel];

  return { class_level_code: { [Op.in]: allowed } };
};

/** Whether a learner in `classLevel` may open content tagged `contentClassLevel`. */
const canOpenContent = (classLevel, contentClassLevel) =>
  getAccessMode(classLevel, contentClassLevel) !== ACCESS_MODES.LOCKED;

module.exports = {
  resolvePlacement,
  getVisibleLearningUnits,
  groupUnitsByRuleGroup,
  getClassLevelAccessMap,
  buildClassScopeWhere,
  canOpenContent,
};

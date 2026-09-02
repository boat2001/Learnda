// routes/subjects.js
//
// Replaces the tertiary /courses surface. A "subject" here is a LearningUnit:
// a Learning Area in KG, a Subject in Primary/JHS/SHS (§3.1).
//
// Every endpoint is scoped to the caller's class placement. There is no way to
// ask this API for content above your class -- the scope is derived from the
// learner's academic profile, never from a query parameter.
const router = require('express').Router();
const { authenticate, optionalAuth } = require('../middleware/auth');
const models = require('../models');
const {
  getVisibleLearningUnits,
  groupUnitsByRuleGroup,
  getClassLevelAccessMap,
  buildClassScopeWhere,
  canOpenContent,
} = require('../services/subjectAccessService');
const {
  LEVEL_GROUPS,
  LEVEL_GROUP_LABELS,
  ACCESS_MODES,
  getClassLevel,
  getLearningType,
  getAccessMode,
} = require('../config/educationStructure');

const { LearningUnit, LearningPathway, AcademicProfile, Lesson } = models;

/**
 * What a level group calls its teachable units, for UI copy (§9).
 * KG teaches Learning Areas; everyone else teaches Subjects.
 */
const unitNounFor = (levelGroup) => (
  levelGroup === LEVEL_GROUPS.KINDERGARTEN
    ? { singular: 'Learning Area', plural: 'Learning Areas' }
    : { singular: 'Subject', plural: 'Subjects' }
);

const serializeUnit = (unit, classLevel) => ({
  id: unit.id,
  slug: unit.slug,
  name: unit.name,
  learning_type: unit.learning_type,
  level_group: unit.level_group,
  category: unit.category,
  description: unit.description,
  icon: unit.icon,
  color: unit.color,
  from_class: unit.from_class,
  to_class: unit.to_class,
  // SHS pathway context, present only when the unit came through a pathway rule.
  rule_group: unit.rule_group || null,
  required: unit.required ?? null,
  min_select: unit.min_select ?? null,
  max_select: unit.max_select ?? null,
  class_level: classLevel,
});

/** Loads the caller's academic profile and attaches it, or returns null. */
const loadPlacement = async (req) => {
  if (!req.user?.id) return null;
  const profile = await AcademicProfile.findOne({ where: { user_id: req.user.id } });
  return profile || null;
};

/**
 * GET /subjects
 * The learner's subjects for their current class. Empty (with a reason) when
 * they have no class placement, or are SHS without a pathway.
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const profile = await loadPlacement(req);
    const { units, placement, reason } = await getVisibleLearningUnits(models, profile);

    if (!placement) {
      return res.json({
        success: true,
        data: {
          subjects: [],
          class_level: null,
          needs_class_placement: true,
          reason: reason || 'no_class_placement',
        },
      });
    }

    const level = getClassLevel(placement.classLevel);
    const noun = unitNounFor(placement.levelGroup);
    const serialized = units.map((u) => serializeUnit(u, placement.classLevel));

    return res.json({
      success: true,
      data: {
        subjects: serialized,
        // SHS selection groups ("choose 3 of these"); null below SHS.
        groups: placement.levelGroup === LEVEL_GROUPS.SHS
          ? groupUnitsByRuleGroup(units)
          : null,
        class_level: placement.classLevel,
        class_label: level.label,
        level_group: placement.levelGroup,
        level_group_label: LEVEL_GROUP_LABELS[placement.levelGroup],
        learning_type: getLearningType(placement.classLevel),
        unit_noun: noun,
        pathway_id: placement.pathwayId,
        needs_class_placement: false,
        needs_pathway: reason === 'no_pathway_selected',
        reason: reason || null,
      },
    });
  } catch (error) {
    console.error('GET /subjects error:', error);
    return res.status(500).json({ success: false, error: 'Failed to load subjects' });
  }
});

/**
 * GET /subjects/class-levels
 * The §6.3 ladder: which classes the learner can revise, which is current,
 * and which are locked until the next academic year.
 */
router.get('/class-levels', authenticate, async (req, res) => {
  try {
    const profile = await loadPlacement(req);
    if (!profile) {
      return res.json({ success: true, data: { class_levels: [], class_level: null } });
    }
    return res.json({
      success: true,
      data: {
        class_level: profile.class_level,
        class_levels: getClassLevelAccessMap(profile.class_level),
      },
    });
  } catch (error) {
    console.error('GET /subjects/class-levels error:', error);
    return res.status(500).json({ success: false, error: 'Failed to load class levels' });
  }
});

/**
 * GET /subjects/pathways
 * SHS learning areas a learner may choose during onboarding. STEM is filtered
 * out unless the learner is at a designated STEM school (§4.4.9).
 */
router.get('/pathways', optionalAuth, async (req, res) => {
  try {
    const isStemSchool = String(req.query.is_stem_school || '').toLowerCase() === 'true';
    const pathways = await LearningPathway.findAll({
      where: { is_active: true },
      order: [['sort_order', 'ASC'], ['name', 'ASC']],
    });

    return res.json({
      success: true,
      data: pathways
        .filter((p) => !p.is_stem_only || isStemSchool)
        .map((p) => ({
          id: p.id,
          slug: p.slug,
          name: p.name,
          description: p.description,
          is_stem_only: Boolean(p.is_stem_only),
        })),
    });
  } catch (error) {
    console.error('GET /subjects/pathways error:', error);
    return res.status(500).json({ success: false, error: 'Failed to load pathways' });
  }
});

/**
 * GET /subjects/:slug
 * One subject, plus the class levels of it the learner may open.
 * 404 rather than 403 when the subject is out of scope: a learner should not
 * be able to probe which subjects exist above their class.
 */
router.get('/:slug', authenticate, async (req, res) => {
  try {
    const profile = await loadPlacement(req);
    const { units, placement } = await getVisibleLearningUnits(models, profile);

    if (!placement) {
      return res.status(409).json({
        success: false,
        error: 'Set your class to see subjects.',
        needs_class_placement: true,
      });
    }

    const unit = units.find((u) => u.slug === req.params.slug);
    if (!unit) {
      return res.status(404).json({ success: false, error: 'Subject not found' });
    }

    return res.json({
      success: true,
      data: {
        subject: serializeUnit(unit, placement.classLevel),
        class_levels: getClassLevelAccessMap(placement.classLevel)
          .filter((l) => !l.locked && l.level_group === unit.level_group),
      },
    });
  } catch (error) {
    console.error('GET /subjects/:slug error:', error);
    return res.status(500).json({ success: false, error: 'Failed to load subject' });
  }
});

/**
 * GET /subjects/:slug/lessons?class_level=B2
 * Lessons for a subject, class-scoped (§5).
 *
 * `class_level` selects which class to revise; it can only narrow the scope,
 * never widen it -- an out-of-reach value is rejected rather than clamped, so
 * a broken client surfaces instead of silently showing the wrong year.
 */
router.get('/:slug/lessons', authenticate, async (req, res) => {
  try {
    const profile = await loadPlacement(req);
    const { units, placement } = await getVisibleLearningUnits(models, profile);

    if (!placement) {
      return res.status(409).json({
        success: false,
        error: 'Set your class to see lessons.',
        needs_class_placement: true,
      });
    }

    const unit = units.find((u) => u.slug === req.params.slug);
    if (!unit) {
      return res.status(404).json({ success: false, error: 'Subject not found' });
    }

    const requested = req.query.class_level || null;
    if (requested && !canOpenContent(placement.classLevel, requested)) {
      return res.status(403).json({
        success: false,
        error: 'That class is not open to you yet.',
        access: ACCESS_MODES.LOCKED,
      });
    }

    const scope = requested
      ? { class_level_code: requested }
      : buildClassScopeWhere(placement.classLevel);

    const lessons = await Lesson.findAll({
      where: {
        learning_unit_id: unit.id,
        status: 'published',
        ...scope,
      },
      order: [['class_level_code', 'ASC'], ['lesson_number', 'ASC']],
    });

    return res.json({
      success: true,
      data: {
        subject: serializeUnit(unit, placement.classLevel),
        lessons,
        class_level: requested || placement.classLevel,
        access: getAccessMode(placement.classLevel, requested || placement.classLevel),
      },
    });
  } catch (error) {
    console.error('GET /subjects/:slug/lessons error:', error);
    return res.status(500).json({ success: false, error: 'Failed to load lessons' });
  }
});

module.exports = router;

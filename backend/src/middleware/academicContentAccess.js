const db = require('../models');
const { findById } = require('../utils/contentLookup');
const { getAccessibleClassLevels } = require('../config/educationStructure');
const { getVisibleLearningUnits, canOpenContent } = require('../services/subjectAccessService');

const NON_ACADEMIC_SQL = "(ac.content_type = 'text_item' AND COALESCE(ac.subtype, '') NOT IN ('quiz', 'past_question'))";
const isAcademic = row => ['lesson', 'video_lesson'].includes(row.content_type)
  || ['quiz', 'past_question'].includes(row.subtype);

async function buildFeedScope(user) {
  if (user?.role === 'admin') return { where: '', replacements: {} };
  const profile = user?.id ? await db.AcademicProfile.findOne({ where: { user_id: user.id } }) : null;
  const { units, placement } = await getVisibleLearningUnits(db, profile);
  if (!placement || !units.length) return { where: `AND ${NON_ACADEMIC_SQL}`, replacements: {} };
  return {
    where: `AND (${NON_ACADEMIC_SQL} OR (
      COALESCE(ac.metadata->>'class_level_code', ac.level) IN (:_visibleClasses)
      AND (EXISTS (SELECT 1 FROM lessons l WHERE l.id = ac.id AND l.learning_unit_id IN (:_visibleUnits))
        OR ac.metadata->>'learning_unit_id' IN (:_visibleUnitStrings)
        OR ac.metadata->>'subject_slug' IN (:_visibleSlugs))
    ))`,
    replacements: { _visibleClasses: getAccessibleClassLevels(placement.classLevel), _visibleUnits: units.map(unit => unit.id), _visibleUnitStrings: units.map(unit => String(unit.id)), _visibleSlugs: units.map(unit => unit.slug) },
  };
}

async function academicContentAccess(req, res, next) {
  if (req.user?.role === 'admin') return next();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) return res.status(400).json({ success: false, error: 'Invalid content ID' });
  const row = await findById(db, req.params.id);
  if (!row || row.status !== 'published') return res.status(404).json({ success: false, error: 'Content not found' });
  req.contentRow = row;
  if (!isAcademic(row)) return next();
  if (!req.user?.id) return res.status(401).json({ success: false, error: 'Authentication required' });
  const profile = await db.AcademicProfile.findOne({ where: { user_id: req.user.id } });
  const { units, placement } = await getVisibleLearningUnits(db, profile);
  const lesson = row.content_type === 'lesson' ? await db.Lesson.findByPk(row.id) : null;
  const classLevel = lesson?.class_level_code || row.metadata?.class_level_code || row.level;
  const unitId = lesson?.learning_unit_id || row.metadata?.learning_unit_id;
  const unitAllowed = units.some(unit => unit.id === unitId || unit.slug === row.metadata?.subject_slug);
  if (!placement || !canOpenContent(placement.classLevel, classLevel) || !unitAllowed) return res.status(404).json({ success: false, error: 'Content not found' });
  return next();
}

module.exports = { academicContentAccess, buildFeedScope };

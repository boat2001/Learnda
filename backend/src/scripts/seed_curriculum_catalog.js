const { buildCurriculumCatalog } = require('./lib/curriculumCatalog');
const db = require('../models');

async function main() {
  const { units, pathways, rules } = buildCurriculumCatalog();
  console.log(`Catalog: ${units.length} learning units, ${pathways.length} pathways, ${rules.length} pathway rules.`);
  if (!process.argv.includes('--apply')) {
    console.log('Dry run. Add --apply to insert missing catalog records.');
    return;
  }
  await db.sequelize.transaction(async transaction => {
    await db.sequelize.query('SELECT pg_advisory_xact_lock(736104)', { transaction });
    const unitIds = new Map();
    const pathwayIds = new Map();
    const existingUnits = await db.LearningUnit.findAll({ transaction });
    existingUnits.forEach(record => unitIds.set(`${record.level_group}:${record.slug}`, record.id));
    const newUnits = await db.LearningUnit.bulkCreate(units.filter(unit => !unitIds.has(`${unit.level_group}:${unit.slug}`)), { transaction, validate: true });
    newUnits.forEach(record => unitIds.set(`${record.level_group}:${record.slug}`, record.id));
    const existingPathways = await db.LearningPathway.findAll({ transaction });
    existingPathways.forEach(record => pathwayIds.set(record.slug, record.id));
    const newPathways = await db.LearningPathway.bulkCreate(pathways.filter(item => !pathwayIds.has(item.slug)), { transaction, validate: true });
    newPathways.forEach(record => pathwayIds.set(record.slug, record.id));
    const ruleKey = rule => [rule.pathway_id, rule.learning_unit_id, rule.rule_group, rule.from_class, rule.to_class].join(':');
    const existingRules = new Set((await db.PathwaySubjectRule.findAll({ transaction })).map(ruleKey));
    const missingRules = rules.map(({ pathway_slug, subject_slug, ...rule }) => ({
      ...rule, pathway_id: pathwayIds.get(pathway_slug), learning_unit_id: unitIds.get(`SHS:${subject_slug}`),
    })).filter(rule => !existingRules.has(ruleKey(rule)));
    await db.PathwaySubjectRule.bulkCreate(missingRules, { transaction, validate: true });
  });
  console.log('Curriculum catalog initialized. Existing records and lesson content were preserved.');
}

main().catch(error => {
  console.error('Catalog initialization failed:', error.message);
  process.exitCode = 1;
}).finally(() => db.sequelize.close());

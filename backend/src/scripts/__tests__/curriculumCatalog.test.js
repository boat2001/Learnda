const { buildCurriculumCatalog } = require('../lib/curriculumCatalog');
const { getOrdinal } = require('../../config/educationStructure');
const catalog = buildCurriculumCatalog();

test('includes every level group and all nine SHS pathways', () => {
  expect(catalog.units.filter(unit => unit.level_group === 'KINDERGARTEN')).toHaveLength(7);
  expect(catalog.units.filter(unit => unit.level_group === 'PRIMARY')).toHaveLength(11);
  expect(catalog.units.filter(unit => unit.level_group === 'JHS')).toHaveLength(12);
  expect(catalog.pathways).toHaveLength(9);
  expect(catalog.pathways.filter(pathway => pathway.is_stem_only).map(pathway => pathway.slug)).toEqual(['stem']);
});

test('keeps subject bands ordered and pathway references valid', () => {
  const subjects = new Set(catalog.units.filter(unit => unit.level_group === 'SHS').map(unit => unit.slug));
  const pathways = new Set(catalog.pathways.map(pathway => pathway.slug));
  const unique = new Set();
  for (const rule of catalog.rules) {
    expect(subjects.has(rule.subject_slug)).toBe(true);
    expect(pathways.has(rule.pathway_slug)).toBe(true);
    expect(getOrdinal(rule.from_class)).toBeLessThanOrEqual(getOrdinal(rule.to_class));
    const key = `${rule.pathway_slug}:${rule.subject_slug}:${rule.rule_group}`;
    expect(unique.has(key)).toBe(false);
    unique.add(key);
  }
});

test('keeps Business subjects specific to their school years', () => {
  const rules = catalog.rules.filter(rule => rule.pathway_slug === 'business' && rule.rule_group === 'PATHWAY_ELECTIVE');
  expect(rules.find(rule => rule.subject_slug === 'business_studies')).toMatchObject({ from_class: 'SHS1', to_class: 'SHS1', required: true });
  for (const slug of ['business_management', 'accounting']) {
    expect(rules.find(rule => rule.subject_slug === slug)).toMatchObject({ from_class: 'SHS2', to_class: 'SHS3', required: true });
  }
});

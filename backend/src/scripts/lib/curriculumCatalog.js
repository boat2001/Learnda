const fs = require('fs');
const path = require('path');

const GUIDE = path.resolve(__dirname, '../../../../learnda-dev-guide.md');
const normalizeName = value => value.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();

function buildCurriculumCatalog(text = fs.readFileSync(GUIDE, 'utf8')) {
  const section = (start, end) => {
    const index = text.indexOf(start);
    if (index < 0) throw new Error(`Missing curriculum section: ${start}`);
    return text.slice(index + start.length, text.indexOf(end, index + start.length));
  };
  const subjects = source => [...source.matchAll(/^\|\s*`([a-z_]+)`\s*\|\s*([^|]+)\|/gm)]
    .map(([, slug, name]) => ({ slug, name: name.trim() }));
  const units = [];
  for (const [group, start, end, first, last] of [
    ['KINDERGARTEN', '### 4.1 ', '### 4.2 ', 'KG1', 'KG2'],
    ['PRIMARY', '### 4.2 ', '### 4.3 ', 'B1', 'B6'],
    ['JHS', '### 4.3 ', '### 4.4 ', 'JHS1', 'JHS3'],
    ['SHS', '#### Complete SHS Subject Catalogue', '#### SHS Developer Model', 'SHS1', 'SHS3'],
  ]) {
    subjects(section(start, end)).forEach((unit, index) => units.push({
      ...unit, level_group: group, from_class: first, to_class: last,
      learning_type: group === 'KINDERGARTEN' ? 'LEARNING_AREA' : 'SUBJECT',
      category: group !== 'SHS' || ['english', 'mathematics', 'social_studies', 'general_science', 'peh_core'].includes(unit.slug)
        ? 'CORE' : unit.slug.startsWith('intervention_') ? 'INTERVENTION' : 'ELECTIVE',
      sort_order: index, is_active: true,
    }));
  }
  const byName = new Map(units.filter(unit => unit.level_group === 'SHS').map(unit => [normalizeName(unit.name), unit.slug]));
  for (const [name, slug] of [['PEH Core', 'peh_core'], ['PEH Elective', 'peh_elective'], ['RME', 'rme'], ['Elective Mathematics', 'additional_mathematics']]) byName.set(normalizeName(name), slug);
  const pathways = [];
  const rules = [];
  const pathwaySections = [...text.matchAll(/^#### 4\.4\.([1-9]) ([^\n]+)\n([\s\S]*?)(?=^#### |$(?![\s\S]))/gm)];
  for (const [, number, heading, body] of pathwaySections) {
    const name = heading.startsWith('STEM') ? 'STEM' : heading === 'Art' ? 'Visual Arts' : heading.trim();
    const slug = normalizeName(name).replaceAll(' ', '_');
    pathways.push({ slug, name, level_group: 'SHS', is_stem_only: name === 'STEM', sort_order: Number(number), is_active: true });
    for (const [, category, names] of body.matchAll(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/gm)) {
      if (category === 'Category' || category.includes('---') || !category.includes('Electives') && category !== 'Core') continue;
      const ruleGroup = category === 'Core' ? 'CORE'
        : category.startsWith('Additional') ? 'ADDITIONAL_ELECTIVE'
        : category.startsWith('Humanities') ? 'HUMANITIES_ELECTIVE'
        : category.startsWith('Science') && slug !== 'science' ? 'SCIENCE_ELECTIVE' : 'PATHWAY_ELECTIVE';
      for (const subjectName of names.split(',').map(value => value.trim())) {
        const subject = byName.get(normalizeName(subjectName));
        if (!subject) throw new Error(`Unknown SHS subject: ${subjectName}`);
        const businessYearRule = slug === 'business' && ruleGroup === 'PATHWAY_ELECTIVE';
        rules.push({ pathway_slug: slug, subject_slug: subject, rule_group: ruleGroup,
          from_class: businessYearRule && subject !== 'business_studies' ? 'SHS2' : 'SHS1',
          to_class: businessYearRule && subject === 'business_studies' ? 'SHS1' : 'SHS3',
          required: category === 'Core' || businessYearRule && ['business_studies', 'business_management', 'accounting'].includes(subject),
          sort_order: rules.length, is_active: true,
        });
      }
    }
  }
  if (pathways.length !== 9 || units.length < 60) throw new Error('Incomplete curriculum catalog.');
  return { units, pathways, rules };
}

module.exports = { buildCurriculumCatalog };

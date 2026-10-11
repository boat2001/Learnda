const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const outlines = require('./topic-outline-data.cjs');
const { CLASS_LEVELS, ACADEMIC_TERMS } = require('../backend/src/config/educationStructure');

const root = path.resolve(__dirname, '..');
const guide = fs.readFileSync(path.join(root, 'learnda-dev-guide.md'), 'utf8');
const sections = {
  KINDERGARTEN: ['### 4.1 Kindergarten', '### 4.2 Primary'],
  PRIMARY: ['### 4.2 Primary', '### 4.3 JHS'],
  JHS: ['### 4.3 JHS', '### 4.4 SHS'],
  SHS: ['#### Complete SHS Subject Catalogue', '#### SHS Developer Model'],
};
const references = {
  KINDERGARTEN: ['https://www.nacca.gov.gh/wp-content/uploads/2019/06/KINDERGARTEN.pdf'],
  PRIMARY: ['https://nacca.gov.gh/learning-areas-subjects/new-standards-based-curriculum-2019/'],
  JHS: ['https://nacca.gov.gh/common-core-programme-ccp/'],
  SHS: ['https://nacca.gov.gh/secondary-education-curriculum/', 'https://nacca.gov.gh/subject-combination-guidelines-secondary-education/'],
};
const catalogue = {};
for (const [group, [start, end]] of Object.entries(sections)) {
  const startIndex = guide.indexOf(start);
  const endIndex = guide.indexOf(end, startIndex + start.length);
  assert(startIndex >= 0 && endIndex > startIndex, `Missing guide section: ${group}`);
  catalogue[group] = [...guide.slice(startIndex, endIndex).matchAll(/^\|\s*`([a-z_]+)`\s*\|\s*([^|]+)\|/gm)]
    .map((match) => ({ slug: match[1], name: match[2].trim() }));
  assert(catalogue[group].length > 0, `Empty catalogue: ${group}`);
  assert.deepEqual(Object.keys(outlines[group]).sort(), catalogue[group].map((subject) => subject.slug).sort(), `Subject coverage: ${group}`);
}

const applicableClasses = (group, slug) => CLASS_LEVELS.filter((level) => {
  if (level.levelGroup !== group) return false;
  if (group === 'SHS' && slug === 'business_studies') return level.code === 'SHS1';
  if (group === 'SHS' && ['business_management', 'accounting'].includes(slug)) return level.code !== 'SHS1';
  return true;
});

const offerings = [];
const ids = new Set();
for (const [group, subjects] of Object.entries(catalogue)) {
  for (const subject of subjects) {
    const levels = applicableClasses(group, subject.slug);
    const rows = outlines[group][subject.slug];
    assert.equal(rows.length, levels.length, `Class coverage: ${group}/${subject.slug}`);
    rows.forEach((row, index) => {
      const terms = row.split(';');
      assert.equal(terms.length, ACADEMIC_TERMS.length, `Term coverage: ${group}/${subject.slug}/${levels[index].code}`);
      terms.forEach((term, termIndex) => {
        const titles = term.split('|').map((title) => title.trim());
        assert(titles.length >= 2 && titles.every(Boolean), 'At least two nonempty topic blocks per term');
        assert.equal(new Set(titles).size, titles.length, 'No repeated title within an offering');
        offerings.push({
          level_group: group,
          class_level_code: levels[index].code,
          subject_slug: subject.slug,
          subject_name: subject.name,
          learning_unit_key: `${group}:${subject.slug}`,
          learning_type: group === 'KINDERGARTEN' ? 'LEARNING_AREA' : 'SUBJECT',
          term: ACADEMIC_TERMS[termIndex],
          sequence_status: 'proposed',
          source_references: references[group],
          topics: titles.map((title, topicIndex) => {
            const id = `${levels[index].code.toLowerCase()}_${subject.slug}_t${termIndex + 1}_${topicIndex + 1}`;
            assert(!ids.has(id), `Duplicate ID: ${id}`);
            ids.add(id);
            return {
              id,
              title,
              sort_order: topicIndex + 1,
              content_status: 'authored_draft',
              curriculum_alignment_status: 'not_verified',
              strand: null,
              sub_strand: null,
              content_standard_code: null,
              indicator_codes: [],
              learning_objectives: [],
              source_document_url: null,
              source_pages: [],
            };
          }),
        });
      });
    });
  }
}

const summary = Object.fromEntries(Object.keys(catalogue).map((group) => {
  const rows = offerings.filter((offering) => offering.level_group === group);
  return [group, { subjects: catalogue[group].length, class_subject_pairs: rows.length / 3, term_offerings: rows.length, topic_blocks: rows.reduce((sum, row) => sum + row.topics.length, 0) }];
}));
const output = {
  schema_version: 1,
  title: 'Learnda KG 1–SHS 3 proposed topic outline',
  authored_on: '2026-10-10',
  status: 'planning_draft',
  scope: 'Every subject in learnda-dev-guide.md, for each applicable class and all three terms.',
  limitations: [
    'Broad authored topic blocks, not an exhaustive or verified transcription of NaCCA standards.',
    'Year placement and term order are proposed and require curriculum and scheme-of-learning review.',
    'Reference links identify curriculum research starting points; they do not verify individual topics.',
    'Strands, standards, indicators, objectives and page references remain unfilled until checked against source documents.',
    'KG learning areas may overlap integrated themes; these are Learnda navigation categories.',
    'Primary Computing and French from B1 reflect Learnda product scope; official grade coverage requires verification.',
    'Ghanaian-language content requires a named language and its own orthography; Arabic and French require entry-level review.',
    'Intervention topics require diagnostic assessment and individual pacing.',
    'SHS subject access depends on pathway, school availability and combination rules. A topic entry does not grant access.',
    'SHS cohort curriculum versions, specialist options and prescribed literature texts require separate verification.',
  ],
  summary,
  offerings,
};
fs.writeFileSync(path.join(__dirname, 'topic-map.json'), `${JSON.stringify(output, null, 2)}\n`);
let markdown = '# Learnda proposed topic outline: KG 1–SHS 3\n\nAuthored 10 October 2026. **Planning draft: curriculum alignment and term sequencing are not verified.**\n\n';
markdown += 'This outline covers every subject in the Learnda development guide, for each applicable class and Term 1, Term 2 and Term 3. Each cell contains two ordered broad topic blocks. Expand these into specific topics, objectives, lessons and practice after source review. These blocks are not a complete list of official curriculum standards.\n\n';
markdown += '## Coverage\n\n| Level | Subjects | Class–subject pairs | Term offerings | Topic blocks |\n| --- | ---: | ---: | ---: | ---: |\n';
for (const [group, counts] of Object.entries(summary)) markdown += `| ${group} | ${counts.subjects} | ${counts.class_subject_pairs} | ${counts.term_offerings} | ${counts.topic_blocks} |\n`;
markdown += '\n## Review requirements\n\n' + output.limitations.map((item) => `- ${item}`).join('\n') + '\n\n';
markdown += 'Revision and assessment should be planned alongside each term rather than treated as substitute curriculum topics. KG delivery remains play-based and parent-guided, without quizzes or exams. Food, workshop, sport and science activities need age-appropriate supervision and lesson-level safety planning.\n\n';
markdown += '## Reference sources\n\nThe subject catalogue comes from [the Learnda development guide](../learnda-dev-guide.md). The following official sources are starting points for document-level verification:\n\n';
markdown += '- [NaCCA Kindergarten curriculum](https://www.nacca.gov.gh/wp-content/uploads/2019/06/KINDERGARTEN.pdf)\n- [NaCCA standards-based curriculum](https://nacca.gov.gh/learning-areas-subjects/new-standards-based-curriculum-2019/)\n- [NaCCA Common Core Programme](https://nacca.gov.gh/common-core-programme-ccp/)\n- [NaCCA secondary curriculum](https://nacca.gov.gh/secondary-education-curriculum/)\n- [NaCCA SHS subject-combination guidelines](https://nacca.gov.gh/subject-combination-guidelines-secondary-education/)\n\n';
for (const level of CLASS_LEVELS) {
  markdown += `## ${level.label}\n\n| ${level.levelGroup === 'KINDERGARTEN' ? 'Learning area' : 'Subject'} | Term 1 | Term 2 | Term 3 |\n| --- | --- | --- | --- |\n`;
  for (const subject of catalogue[level.levelGroup]) {
    const rows = offerings.filter((offering) => offering.class_level_code === level.code && offering.subject_slug === subject.slug);
    if (!rows.length) continue;
    assert.equal(rows.length, 3);
    markdown += `| ${subject.name} | ${rows.map((row) => row.topics.map((topic) => topic.title).join('; ')).join(' | ')} |\n`;
  }
  markdown += '\n';
}
markdown += '## Implementation and verification\n\nThe matching `topic-map.json` uses canonical class codes, level-qualified subject keys and stable draft topic IDs. It contains no database UUIDs and is not automatically published or seeded. `topic-outline-data.cjs` is the editable source; run `node curriculum/build-topic-map.cjs` from the project root to validate coverage and regenerate both outputs.\n\nFor each topic block, locate the official subject document and class section, record its strand and sub-strand, add exact content-standard and indicator codes with source pages, refine the title and write measurable objectives. Confirm school term order separately. Split broad blocks into teachable topics while retaining a parent-block reference. Review pathway rules, language variants, cohort versions and specialist options before learner publication.\n';
fs.writeFileSync(path.join(__dirname, 'topic-map.md'), markdown);
console.log(JSON.stringify({ summary, total_term_offerings: offerings.length, total_topic_blocks: ids.size, validation: 'Catalogue, applicable classes, three terms, nonempty topics and unique IDs passed.' }, null, 2));

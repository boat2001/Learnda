/* eslint-disable no-console */
/**
 * Fixes missing core course offerings for JHS programs.
 *
 * The ind-courses-jhs.php 'core' section defines courses shared by every
 * JHS programme. The original seed parser treated 'core' as a programme key
 * but no programme with that key exists in the DB, so those offerings were
 * silently dropped from every programme.
 *
 * This script is self-contained — no PHP files needed — so it can be run on
 * the Render server shell:
 *
 *   node src/scripts/seed_jhs_core_offerings.js
 *
 * It is idempotent: already-existing rows are skipped.
 */

const {
  connectAndSync,
  Program,
  Course,
  CourseOffering,
} = require('../models');

// Core courses shared across ALL JHS programmes (from ind-courses-jhs.php 'core' section).
// Format: { courseKey, level, semester }
const JHS_CORE_OFFERINGS = [
  // Level 100, Semester 1
  { courseKey: 'lang_ling',         level: '100', semester: '1' },
  { courseKey: 'chd_ado',           level: '100', semester: '1' },
  { courseKey: 'prin_edu',          level: '100', semester: '1' },
  { courseKey: 'com_lit',           level: '100', semester: '1' },
  { courseKey: 'info_lit',          level: '100', semester: '1' },
  { courseKey: 'field_exp',         level: '100', semester: '1' },
  // Level 100, Semester 2
  { courseKey: 'eng_stud_1',        level: '100', semester: '2' },
  { courseKey: 'hiv',               level: '100', semester: '2' },
  { courseKey: 'ghan_lang_cult_stud', level: '100', semester: '2' },
  { courseKey: 'field_exp_2',       level: '100', semester: '2' },
  // Level 200, Semester 1
  { courseKey: 'eng_stud_2',        level: '200', semester: '1' },
  { courseKey: 'gen_cur_stud',      level: '200', semester: '1' },
  { courseKey: 'health_safe',       level: '200', semester: '1' },
  { courseKey: 'field_exp_3',       level: '200', semester: '1' },
  // Level 200, Semester 2
  { courseKey: 'func_clause',       level: '200', semester: '2' },
  { courseKey: 'assess_basic',      level: '200', semester: '2' },
  { courseKey: 'educ_ind',          level: '200', semester: '2' },
  { courseKey: 'gen_prin_meth',     level: '200', semester: '2' },
  { courseKey: 'field_exp_4',       level: '200', semester: '2' },
  // Level 300, Semester 1
  { courseKey: 'intro_res',         level: '300', semester: '1' },
  { courseKey: 'use_ghan_lang',     level: '300', semester: '1' },
  { courseKey: 'field_exp_5',       level: '300', semester: '1' },
  // Level 300, Semester 2
  { courseKey: 'inserv_edu',        level: '300', semester: '2' },
  { courseKey: 'edu_stat',          level: '300', semester: '2' },
  { courseKey: 'intro_guide',       level: '300', semester: '2' },
  { courseKey: 'sch_man',           level: '300', semester: '2' },
  { courseKey: 'stud_lit',          level: '300', semester: '2' },
  { courseKey: 'micro_teach',       level: '300', semester: '2' },
  // Level 400, Semester 1
  { courseKey: 'macro_teach',       level: '400', semester: '1' },
  { courseKey: 'pro_work',          level: '400', semester: '1' },
  // Level 400, Semester 2
  { courseKey: 'his_dev_edu_jhs',   level: '400', semester: '2' },
  { courseKey: 'prof_prac_eth',     level: '400', semester: '2' },
  { courseKey: 'his_gha_anc',       level: '400', semester: '2' },
  { courseKey: 'ref_mac',           level: '400', semester: '2' },
];

async function run() {
  await connectAndSync();

  // All JHS programmes in the DB
  const jhsPrograms = await Program.findAll({ where: { category: 'JHS' } });
  console.log(`Found ${jhsPrograms.length} JHS programmes.`);

  if (!jhsPrograms.length) {
    console.log('No JHS programmes found — nothing to do.');
    process.exit(0);
  }

  // Build course lookup by key
  const allCourses = await Course.findAll({ attributes: ['id', 'key'] });
  const courseByKey = new Map(allCourses.map((c) => [c.key, c]));

  // Log any core course keys missing from the DB
  const missingCourseKeys = [...new Set(JHS_CORE_OFFERINGS.map((o) => o.courseKey))].filter(
    (k) => !courseByKey.has(k)
  );
  if (missingCourseKeys.length) {
    console.warn('Course keys not found in DB (will be skipped):', missingCourseKeys.join(', '));
  }

  // Load existing offerings to avoid duplicates
  const existing = await CourseOffering.findAll({
    attributes: ['program_id', 'course_id', 'level', 'semester'],
  });
  const existingKeys = new Set(
    existing.map((o) => `${o.program_id}:${o.course_id}:${o.level}:${o.semester}`)
  );

  const toInsert = [];

  for (const program of jhsPrograms) {
    for (const entry of JHS_CORE_OFFERINGS) {
      const course = courseByKey.get(entry.courseKey);
      if (!course) continue;

      const key = `${program.id}:${course.id}:${entry.level}:${entry.semester}`;
      if (existingKeys.has(key)) continue;

      toInsert.push({
        program_id: program.id,
        course_id: course.id,
        level: entry.level,
        semester: entry.semester,
        metadata: { programme_group: 'JHS Education', is_core: true },
      });
    }
  }

  if (!toInsert.length) {
    console.log('All core offerings already exist — nothing to insert.');
    process.exit(0);
  }

  console.log(`Inserting ${toInsert.length} missing core offering rows…`);
  await CourseOffering.bulkCreate(toInsert, { returning: false });
  console.log('Done. Core courses now linked to all JHS programmes.');
  process.exit(0);
}

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});

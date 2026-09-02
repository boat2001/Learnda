/* eslint-disable no-console */
/**
 * Seeds the new "Certificate in Education" (CIE) distance programme —
 * course codes EIN050-EIN060 — and ingests the note PDFs the user just
 * added under backend/uploads/resources/notes/ so the existing no-API
 * agent-packet pipeline (create_agent_import_packets.js) can find them.
 *
 * Why this script exists: create_agent_import_packets.js only reads notes
 * from the DB (EduvhibeNote / ResourceFile rows whose `course` field
 * contains the matching Course.title as a substring). These EIN courses
 * have no Course/CourseOffering rows yet, and their PDFs were never
 * ingested as ResourceFile rows, so the packet script would find nothing
 * for them even if run. This script creates both, idempotently.
 *
 * Run on a machine with DB access:
 *   cd backend
 *   node src/scripts/seed_ein_certificate_courses.js
 *
 * Then create packets for just these courses:
 *   node src/scripts/create_all_agent_packets.js --course="EIN"
 *
 * Source catalogue: backend/uploads/resources/notes/IOE_UCC_All_Courses.txt
 * (UCC IOE complete course catalogue, "Certificate in Education" section).
 */

const fs = require('fs');
const path = require('path');
const {
  connectAndSync,
  Program,
  Course,
  CourseOffering,
  ResourceFile,
  User,
} = require('../models');
const { uploadDir } = require('../config/upload');
const { classifyResourceCategory } = require('../utils/resourceClassifier');

const NOTES_DIR = path.join(uploadDir, 'resources', 'notes');

const MIME_BY_EXT = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

function getMimeType(fileName) {
  return MIME_BY_EXT[path.extname(fileName).toLowerCase()] || 'application/octet-stream';
}

// Certificate in Education (CIE) — Distance/Online, 1 year, prefix EIN.
// Titles taken verbatim from IOE_UCC_All_Courses.txt.
// `files` lists the best-available source PDF(s) under resources/notes/ for
// each course, relative to NOTES_DIR. The first file in the array is treated
// as the primary lesson source; any additional files become extra
// ResourceFile rows (e.g. course outlines, supplementary units).
const EIN_COURSES = [
  {
    code: 'EIN050',
    key: 'ein050_intro_foundations_education',
    title: 'Introduction to Foundations of Education',
    files: ['EIN 050 INTRODUCTION TO EDUCATIONAL FOUNDATIONS.pdf'],
  },
  {
    code: 'EIN051',
    key: 'ein051_english_language_studies',
    title: 'English Language Studies',
    files: ['EIN051SW - ENGLISH LANGUAGE STUDIES.pdf'],
  },
  {
    code: 'EIN052',
    key: 'ein052_intro_special_needs_education',
    title: 'Introduction to Special Needs Education',
    files: ['EIN 052SW - INTRODUCTION TO SPECIAL NEEDS IN EDUCATION.pdf'],
  },
  {
    code: 'EIN053',
    key: 'ein053_intro_curriculum_studies',
    title: 'Introduction to Curriculum Studies',
    // NOTE: source file is misnamed "EIN 060 ... CURRICULUM STUDIES.pdf" —
    // its content matches EIN053 in the catalogue, not EIN060.
    files: ['EIN 060 INTRODUCTION TO CURRICULUM STUDIES.pdf'],
  },
  {
    code: 'EIN054',
    key: 'ein054_intro_elementary_mathematics',
    title: 'Introduction to Elementary Mathematics',
    files: ['EIN 054 - INTRODUCTION TO ELEMENTARY MATHEMATICS.pdf'],
  },
  {
    code: 'EIN055',
    key: 'ein055_intro_assessment_in_schools',
    title: 'Introduction to Assessment in Schools',
    files: [
      'EIN 055 INTRODUCTION TO ASSESSMENT IN SCHOOLS.pdf',
      'EIN055 Introduction to Assessment In Schools 1.pdf',
    ],
  },
  {
    code: 'EIN056',
    key: 'ein056_general_science',
    title: 'General Science',
    files: ['EIN 056 - General Science.pdf'],
  },
  {
    code: 'EIN057',
    key: 'ein057_intro_ict_integration_teaching',
    title: 'Introduction to ICT Integration in Teaching',
    files: ['EIN 057 INTRODUCTION TO ICT INTEGRATION IN TEACHING.docx_.pdf'],
  },
  {
    code: 'EIN058',
    key: 'ein058_intro_professional_practice_ethics',
    title: 'Introduction to Professional Practice & Ethics',
    files: ['EIN058 Professional Practice and Ethics in Teaching .pdf'],
  },
  {
    code: 'EIN059',
    key: 'ein059_intro_inservice_education_training',
    title: 'Introduction to In-Service Education & Training',
    // NOTE: source file is filed under the EBS059SW code, not EIN059, but
    // its content matches the EIN059 catalogue entry.
    files: ['Units 1 - 3  EBS 059SW  Intro. to In-Service Education and Training.pdf'],
  },
  {
    code: 'EIN060',
    key: 'ein060_intro_methods_of_teaching',
    title: 'Introduction to Methods of Teaching',
    files: [
      'EIN 060 INTRODUCTION TO METHODS OF TEACHING.pdf',
      'EIN 060 -Intro to Methods of Teaching COURSE OUTLINE.pdf',
    ],
  },
];

const PROGRAM_KEY = 'certificate_in_education';
const PROGRAM_NAME = 'Certificate in Education';

async function getSeedUserId() {
  const user = await User.findOne({ order: [['created_at', 'ASC']] });
  return user?.id || null;
}

async function ensureProgram() {
  const [program] = await Program.findOrCreate({
    where: { key: PROGRAM_KEY },
    defaults: {
      name: PROGRAM_NAME,
      category: 'Certificate',
      description: 'UCC IOE Certificate in Education — Distance/Online, 1 year, prefix EIN.',
      metadata: { mode: 'Distance / Online', duration: '1 year' },
    },
  });
  return program;
}

async function ensureCourse(entry) {
  const [course, created] = await Course.findOrCreate({
    where: { key: entry.key },
    defaults: {
      title: entry.title,
      code: entry.code,
      department: PROGRAM_NAME,
    },
  });
  if (created) {
    console.log(`  + created Course ${entry.code} — ${entry.title}`);
  }
  return course;
}

async function ensureOffering(program, course) {
  const [, created] = await CourseOffering.findOrCreate({
    where: { program_id: program.id, course_id: course.id, level: '100', semester: null },
    defaults: {
      metadata: { programme_group: PROGRAM_NAME, is_core: true },
    },
  });
  if (created) {
    console.log(`  + linked offering for ${course.code}`);
  }
}

async function ensureResourceFile(entry, course, uploaderId, fileName, index) {
  const filePath = path.join(NOTES_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    console.warn(`  ! missing file on disk, skipping: ${fileName}`);
    return;
  }

  const stats = fs.statSync(filePath);
  const relativePath = path.relative(uploadDir, filePath).replace(/\\/g, '/');
  const category = classifyResourceCategory(fileName, filePath);

  const payload = {
    title: index === 0 ? entry.title : `${entry.title} — ${fileName.replace(/\.[^.]+$/, '')}`,
    description: `${entry.title} (${entry.code}) — Certificate in Education distance programme course material.`,
    file_name: fileName,
    file_url: `/uploads/${relativePath}`,
    file_path: filePath,
    file_type: getMimeType(fileName),
    file_size: stats.size,
    // Set to the EXACT Course.title so create_agent_import_packets.js's
    // `course ILIKE %course.title%` match succeeds.
    course: course.title,
    level: '100',
    semester: null,
    category: category === 'other' ? 'course_notes' : category,
    is_premium: false,
    uploader_id: uploaderId,
  };

  const [, created] = await ResourceFile.findOrCreate({
    where: { file_path: filePath },
    defaults: payload,
  });
  if (created) {
    console.log(`  + ingested ResourceFile: ${fileName}`);
  } else {
    console.log(`  = already ingested: ${fileName}`);
  }
}

async function run() {
  await connectAndSync();

  if (!fs.existsSync(NOTES_DIR)) {
    throw new Error(`Notes directory not found: ${NOTES_DIR}`);
  }

  const uploaderId = await getSeedUserId();
  const program = await ensureProgram();
  console.log(`Programme: ${program.name} (${program.id})`);

  for (const entry of EIN_COURSES) {
    console.log(`\n${entry.code} — ${entry.title}`);
    const course = await ensureCourse(entry);
    await ensureOffering(program, course);
    for (let i = 0; i < entry.files.length; i += 1) {
      await ensureResourceFile(entry, course, uploaderId, entry.files[i], i);
    }
  }

  console.log('\nDone. Run next:');
  console.log('  node src/scripts/create_all_agent_packets.js --course="EIN"');
  process.exit(0);
}

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});

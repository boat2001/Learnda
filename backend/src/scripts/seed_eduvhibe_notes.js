const fs = require('fs');
const path = require('path');
const { ResourceFile, User, sequelize } = require('../models');
const { uploadDir } = require('../config/upload');
const {
  extractTitleFromFileName,
  deriveLevelSemester,
} = require('../utils/resourceClassifier');

const NOTES_DIR = path.join(uploadDir, 'resources', 'eduvhibe-notes');
const EDUVHIBE_NOTE_CATEGORY = 'eduvhibe_note';

const MIME_BY_EXT = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function getMimeType(fileName) {
  return MIME_BY_EXT[path.extname(fileName).toLowerCase()] || 'application/octet-stream';
}

function getCourseLabel(fileName) {
  const title = extractTitleFromFileName(fileName);
  const code = title.match(/\b[A-Z]{2,4}\s*\d{3}[A-Z]{0,3}\b/i)?.[0];
  if (code) return code.toUpperCase().replace(/\s+/g, ' ');

  if (/curriculum/i.test(title)) return 'Curriculum Studies';
  if (/english|morphology|semantics|literature|drama|concord/i.test(title)) return 'English Studies';
  if (/biology|chemistry|physics|science/i.test(title)) return 'Science';
  if (/mathematics|calculus|trigonometry|geometry|statistics/i.test(title)) return 'Mathematics';
  if (/computer|database|information literacy|troubleshooting/i.test(title)) return 'ICT';
  if (/social|citizenship|sociology|population|ghana/i.test(title)) return 'Social Studies';
  if (/guidance|assessment|education|teaching|lesson|nts/i.test(title)) return 'Education';
  return 'Eduvhibe Notes';
}

function getDescription(fileName) {
  const title = extractTitleFromFileName(fileName);
  return `${title} from the original Eduvhibe course-material library, now available inside Learnda for study and revision.`;
}

async function getSeedUserId() {
  const user = await User.findOne({ order: [['created_at', 'ASC']] });
  return user?.id || null;
}

async function main() {
  if (!fs.existsSync(NOTES_DIR)) {
    throw new Error(`Eduvhibe notes directory not found: ${NOTES_DIR}`);
  }

  const uploaderId = await getSeedUserId();
  const files = fs.readdirSync(NOTES_DIR, { withFileTypes: true }).filter((entry) => entry.isFile());
  let created = 0;
  let updated = 0;

  for (const entry of files) {
    const filePath = path.join(NOTES_DIR, entry.name);
    const stats = fs.statSync(filePath);
    const relativePath = path.relative(uploadDir, filePath).replace(/\\/g, '/');
    const { level, semester } = deriveLevelSemester(filePath, null, null);

    const payload = {
      title: extractTitleFromFileName(entry.name),
      description: getDescription(entry.name),
      file_name: entry.name,
      file_url: `/uploads/${relativePath}`,
      file_path: filePath,
      file_type: getMimeType(entry.name),
      file_size: stats.size,
      course: getCourseLabel(entry.name),
      level: level || '100',
      semester: semester || '2',
      category: EDUVHIBE_NOTE_CATEGORY,
      is_premium: false,
      uploader_id: uploaderId,
    };

    const [record, wasCreated] = await ResourceFile.findOrCreate({
      where: {
        file_path: filePath,
        category: EDUVHIBE_NOTE_CATEGORY,
      },
      defaults: payload,
    });

    if (wasCreated) {
      created += 1;
    } else {
      await record.update(payload);
      updated += 1;
    }
  }

  console.log(`Seeded Eduvhibe notes: ${created} created, ${updated} updated.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });

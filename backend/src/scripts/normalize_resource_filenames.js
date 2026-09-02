#!/usr/bin/env node
/* eslint-disable no-console */
require('../config/loadEnv').loadEnv();

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { connectAndSync, sequelize, ResourceFile, EduvhibeNote } = require('../models');
const {
  classifyResourceCategory,
  deriveYear,
} = require('../utils/resourceClassifier');

const APPLY = process.argv.includes('--apply');
const SKIP_DB = process.argv.includes('--skip-db');
const TARGET_ARG = process.argv.find((arg) => arg.startsWith('--target='));
const TARGET = TARGET_ARG ? String(TARGET_ARG).split('=').slice(1).join('=').trim() : 'resources';
const ROOT = path.resolve(process.cwd());
const UPLOAD_DIR = path.resolve(ROOT, process.env.UPLOAD_DIR || 'uploads');
const TARGET_DIR = path.resolve(UPLOAD_DIR, TARGET || '.');
const REPORT_DIR = path.resolve(ROOT, 'tmp');
const QUARANTINE_DIR = path.resolve(
  ROOT,
  'uploads_filename_quarantine',
  new Date().toISOString().replace(/[:.]/g, '-')
);

const CATEGORY_LABELS = {
  course_notes: 'Course Notes',
  course_outline: 'Course Outline',
  quiz_external: 'External Quiz',
  quiz_internal: 'Internal Quiz',
  sample_questions: 'Sample Quiz',
  curriculum_policy: 'Course Outline',
  exam: 'End of Sem',
  other: 'Course Notes',
};

const ACRONYMS = new Set([
  'ICT', 'IT', 'AI', 'JHS', 'GES', 'NTS', 'UCC', 'UEW', 'UG', 'KNUST', 'EBS', 'EPS', 'RME', 'STS',
  'HIV', 'AIDS', 'PDF', 'DBMS', 'I', 'II', 'III', 'IV', 'V', 'VI',
]);

const usage = () => {
  console.log('Usage: node src/scripts/normalize_resource_filenames.js [--apply] [--skip-db] [--target=resources]');
  console.log('  default     dry-run: report filename fixes only');
  console.log('  --apply     rename files, quarantine same-content collisions, and update DB references');
  console.log('  --skip-db   do not connect to the DB or update ResourceFile/EduvhibeNote rows');
};

const toPosix = (value) => String(value || '').replace(/\\/g, '/');
const normalizeRel = (value) => toPosix(value).replace(/^\/+/, '').replace(/^uploads\//i, '');
const uploadUrlForRel = (relativePath) => `/uploads/${normalizeRel(relativePath)}`;

const isInside = (child, parent) => {
  const normalizedChild = path.resolve(child);
  const normalizedParent = path.resolve(parent);
  return normalizedChild === normalizedParent || normalizedChild.startsWith(`${normalizedParent}${path.sep}`);
};

const walkFiles = (dir) => {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
};

const hashFile = (absolutePath) => new Promise((resolve, reject) => {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(absolutePath);
  stream.on('error', reject);
  stream.on('data', (chunk) => hash.update(chunk));
  stream.on('end', () => resolve(hash.digest('hex')));
});

const titleCase = (value) => String(value || '')
  .toLowerCase()
  .replace(/\b[a-z0-9]+\b/g, (word) => {
    const upper = word.toUpperCase();
    if (ACRONYMS.has(upper)) return upper;
    if (/^ebs\d+$/i.test(word)) return upper;
    return word.charAt(0).toUpperCase() + word.slice(1);
  })
  .replace(/\bAnd\b/g, 'and')
  .replace(/\bOf\b/g, 'of')
  .replace(/\bThe\b/g, 'the')
  .replace(/\bIn\b/g, 'in')
  .replace(/\bTo\b/g, 'to')
  .replace(/\bFor\b/g, 'for')
  .replace(/\bWith\b/g, 'with')
  .replace(/\bA\b/g, 'a')
  .replace(/\bAn\b/g, 'an')
  .replace(/^(\w)/, (match) => match.toUpperCase());

const cleanSeparators = (value) => String(value || '')
  .replace(/_/g, ' ')
  .replace(/\s+/g, ' ')
  .replace(/\s*[-–—]\s*/g, ' - ')
  .replace(/\s*,\s*/g, ', ')
  .replace(/\s+\./g, '.')
  .replace(/\(\s+/g, '(')
  .replace(/\s+\)/g, ')')
  .trim();

const stripBrand = (value) => String(value || '')
  .replace(/(?:\s*[-–—]?\s*sharether\s*\.?\s*com\b)+/gi, '')
  .trim();

const countBrandMentions = (value) => {
  const matches = String(value || '').match(/sharether\s*\.?\s*com\b/gi);
  return matches ? matches.length : 0;
};

const hasSingleTrailingBrand = (fileName) => {
  const extension = path.extname(fileName);
  const base = fileName.slice(0, -extension.length);
  return countBrandMentions(base) === 1 && /\s-\sSharether\.com$/i.test(base);
};

const stripExtensionWords = (value) => String(value || '')
  .replace(/\b(pdf|docx?|pptx?|zip)\b\s*$/gi, '')
  .trim();

const getYears = (value, fallbackYear) => {
  const matches = String(value || '').match(/\b(?:19|20)\d{2}\b/g) || [];
  const years = Array.from(new Set(matches.concat(fallbackYear ? [String(fallbackYear)] : [])));
  return years.join(', ');
};

const detectSection = (value) => {
  const text = String(value || '');
  const match = text.match(/(?:sect(?:ion)?|sec)\s*[-:]?\s*([ab])\b/i);
  if (match) return `Sect ${match[1].toUpperCase()}`;
  if (/\bA\s*Section\b/i.test(text)) return 'Sect A';
  if (/\bB\s*Section\b/i.test(text)) return 'Sect B';
  return '';
};

const detectCategory = (fileName, filePath) => {
  const text = `${fileName} ${filePath}`;
  if (/(external\s+quiz|zonal(?:\s+based)?\s+quiz)/i.test(text)) return 'quiz_external';
  if (/(internal\s+quiz|class\s+quiz|\bquiz\b)/i.test(text)) return 'quiz_internal';
  if (/(sample\s+(?:quiz|questions?)|past\s+questions?|trial\s+questions?|likely\s+questions?|try\s+questions?|answered\s+questions?)/i.test(text)) {
    return 'sample_questions';
  }
  if (/(course\s+outline|outline|syllabus)/i.test(text)) return 'course_outline';
  if (/(course\s+notes?|lecture\s+notes?|study\s+guide|slidified\s+notes?|simplified|note\b|notes\b)/i.test(text)) {
    return 'course_notes';
  }
  if (/(end(?:\s+of)?\s+sem(?:ester)?|end-of-sem|resit|mock|exams?)/i.test(text)) return 'exam';
  return classifyResourceCategory(fileName, filePath);
};

const stripTypePhrases = (value) => String(value || '')
  .replace(/\b(?:19|20)\d{2}\b/g, '')
  .replace(/\b(?:sect(?:ion)?|sec)\s*[-:]?\s*[ab]\b/gi, '')
  .replace(/\b(?:external|internal|class|sample|zonal(?:\s+based)?)\s+quiz(?:zes)?\b/gi, '')
  .replace(/\b(?:trial|likely|try|answered|sample|objective|obj|essay|past|test)\s+questions?\b/gi, '')
  .replace(/\bend(?:\s+of)?\s+sem(?:ester)?\b/gi, '')
  .replace(/\bend-of-sem\b/gi, '')
  .replace(/\b(?:course|lecture)\s+notes?\b/gi, '')
  .replace(/\bnotes?\b/gi, '')
  .replace(/\bstudy\s+guide\b/gi, '')
  .replace(/\bslidified\s+notes?\b/gi, '')
  .replace(/\bcourse\s+outline\b/gi, '')
  .replace(/\boutline\b/gi, '')
  .replace(/\b(?:resit|mock|exam|exams)\b/gi, '')
  .replace(/\bquestions?\b/gi, '')
  .replace(/\banswers?\b/gi, '')
  .replace(/\bpdf\b/gi, '')
  .replace(/\s*[-–—]\s*$/g, '')
  .replace(/^\s*[-–—]\s*/g, '')
  .trim();

const inferCourseName = (fileName, relativePath) => {
  const withoutBrand = stripBrand(fileName.replace(path.extname(fileName), ''));
  const cleaned = cleanSeparators(stripExtensionWords(stripTypePhrases(withoutBrand))
    .replace(/\b(?:and|with|for)\b\s*$/i, '')
    .replace(/^\s*\b(?:and|with|for)\b/i, ''));
  if (cleaned && cleaned.length >= 4) return titleCase(cleaned);

  const parts = normalizeRel(relativePath).split('/');
  const courseSlug = parts.length >= 5 ? parts[4] : '';
  if (courseSlug) {
    return titleCase(courseSlug.replace(/-/g, ' '));
  }

  return titleCase(cleanSeparators(stripExtensionWords(stripBrand(withoutBrand)))) || 'Resource';
};

const buildNormalizedName = (absolutePath) => {
  const extension = path.extname(absolutePath);
  const fileName = path.basename(absolutePath);
  const relativePath = normalizeRel(path.relative(UPLOAD_DIR, absolutePath));
  const category = detectCategory(fileName, relativePath);
  const label = CATEGORY_LABELS[category] || CATEGORY_LABELS.other;
  const years = getYears(fileName, deriveYear(fileName));
  const section = label === 'End of Sem' ? detectSection(fileName) : '';
  const courseName = inferCourseName(fileName, relativePath);

  const parts = [courseName];
  parts.push(years ? `${years} ${label}` : label);
  if (section) parts.push(section);
  parts.push('Sharether.com');

  const normalizedBase = parts
    .filter(Boolean)
    .map(cleanSeparators)
    .join(' - ')
    .replace(/\s+/g, ' ')
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s*-\s*-\s*/g, ' - ')
    .trim();

  return `${normalizedBase}${extension.toLowerCase()}`;
};

const withSetSuffix = (fileName, setNumber) => {
  const extension = path.extname(fileName);
  const base = fileName.slice(0, -extension.length);
  const nextBase = /\s-\sSharether\.com$/i.test(base)
    ? base.replace(/\s-\sSharether\.com$/i, ` - Set ${setNumber} - Sharether.com`)
    : `${base} - Set ${setNumber}`;
  return `${nextBase}${extension}`;
};

const findAvailableTarget = (sourceAbs, normalizedName, reservedTargets) => {
  let setNumber = 2;
  let targetAbs = path.join(path.dirname(sourceAbs), normalizedName);
  let targetRel = normalizeRel(path.relative(UPLOAD_DIR, targetAbs));

  while (fs.existsSync(targetAbs) || reservedTargets.has(targetRel)) {
    const candidateName = withSetSuffix(normalizedName, setNumber);
    targetAbs = path.join(path.dirname(sourceAbs), candidateName);
    targetRel = normalizeRel(path.relative(UPLOAD_DIR, targetAbs));
    setNumber += 1;
  }

  return { targetAbs, targetRel };
};

const getPathVariants = (relativePath) => {
  const relative = normalizeRel(relativePath);
  const absolute = path.join(UPLOAD_DIR, relative);
  const basename = path.basename(relative);
  return {
    relative,
    absolute,
    basename,
    fileUrl: uploadUrlForRel(relative),
    flatFileUrl: `/uploads/${basename}`,
  };
};

const updateDbReferences = async (fromRel, toRel) => {
  const from = getPathVariants(fromRel);
  const to = getPathVariants(toRel);
  const values = {
    file_name: to.basename,
    file_path: to.relative,
    file_url: to.fileUrl,
  };

  const where = {
    [Op.or]: [
      { file_path: from.relative },
      { file_path: from.absolute },
      { file_url: from.fileUrl },
      { file_url: from.flatFileUrl },
    ],
  };

  const [resourceFiles] = await ResourceFile.update(values, { where });
  let eduvhibeNotes = 0;
  if (EduvhibeNote) {
    const [count] = await EduvhibeNote.update(values, { where });
    eduvhibeNotes = count;
  }

  return { resourceFiles, eduvhibeNotes };
};

const moveToQuarantine = (sourceRel) => {
  const source = path.join(UPLOAD_DIR, normalizeRel(sourceRel));
  if (!isInside(source, UPLOAD_DIR)) {
    throw new Error(`Refusing to move file outside upload dir: ${source}`);
  }
  const destination = path.join(QUARANTINE_DIR, normalizeRel(sourceRel));
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.renameSync(source, destination);
  return destination;
};

const run = async () => {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    usage();
    return;
  }

  if (!fs.existsSync(TARGET_DIR)) {
    throw new Error(`Target directory does not exist: ${TARGET_DIR}`);
  }
  if (!isInside(TARGET_DIR, UPLOAD_DIR)) {
    throw new Error(`Target must stay inside upload dir: ${TARGET_DIR}`);
  }

  if (!SKIP_DB) await connectAndSync();

  const files = walkFiles(TARGET_DIR);
  const planned = [];
  const collisionRenames = [];
  const quarantineCollisions = [];
  const reservedTargets = new Set();

  for (const absolutePath of files) {
    const currentName = path.basename(absolutePath);
    if (hasSingleTrailingBrand(currentName)) continue;

    const normalizedName = buildNormalizedName(absolutePath);
    if (currentName === normalizedName) continue;

    const fromRel = normalizeRel(path.relative(UPLOAD_DIR, absolutePath));
    const toAbs = path.join(path.dirname(absolutePath), normalizedName);
    const toRel = normalizeRel(path.relative(UPLOAD_DIR, toAbs));

    if (fs.existsSync(toAbs) && path.resolve(toAbs) !== path.resolve(absolutePath)) {
      const [sourceHash, targetHash] = await Promise.all([hashFile(absolutePath), hashFile(toAbs)]);
      if (sourceHash === targetHash) {
        quarantineCollisions.push({ from: fromRel, keep: toRel, reason: 'same_content_target_exists' });
        continue;
      }
      const available = findAvailableTarget(absolutePath, normalizedName, reservedTargets);
      collisionRenames.push({
        from: fromRel,
        wanted: toRel,
        to: available.targetRel,
        reason: 'different_content_target_exists',
      });
      reservedTargets.add(available.targetRel);
      planned.push({ from: fromRel, to: available.targetRel });
      continue;
    }

    if (reservedTargets.has(toRel)) {
      const available = findAvailableTarget(absolutePath, normalizedName, reservedTargets);
      collisionRenames.push({
        from: fromRel,
        wanted: toRel,
        to: available.targetRel,
        reason: 'planned_target_already_reserved',
      });
      reservedTargets.add(available.targetRel);
      planned.push({ from: fromRel, to: available.targetRel });
      continue;
    }

    reservedTargets.add(toRel);
    planned.push({ from: fromRel, to: toRel });
  }

  const report = {
    summary: {
      mode: APPLY ? 'apply' : 'dry-run',
      uploadDir: UPLOAD_DIR,
      targetDir: TARGET_DIR,
      filesScanned: files.length,
      renames: planned.length,
      sameContentCollisionsToQuarantine: quarantineCollisions.length,
      differentContentCollisionRenames: collisionRenames.length,
      quarantineDir: APPLY ? QUARANTINE_DIR : null,
    },
    renames: planned,
    differentContentCollisionRenames: collisionRenames,
    sameContentCollisions: quarantineCollisions,
  };

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const reportPath = path.join(
    REPORT_DIR,
    `resource-filename-normalize-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  );
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('Resource filename normalization summary');
  console.log(`Mode: ${report.summary.mode}`);
  console.log(`Files scanned: ${report.summary.filesScanned}`);
  console.log(`Renames: ${report.summary.renames}`);
  console.log(`Same-content collisions to quarantine: ${report.summary.sameContentCollisionsToQuarantine}`);
  console.log(`Different-content collision renames: ${report.summary.differentContentCollisionRenames}`);
  console.log(`Report: ${reportPath}`);

  if (!APPLY) {
    console.log('No files renamed. Re-run with --apply after reviewing the report.');
    if (!SKIP_DB) await sequelize.close();
    return;
  }

  const applied = [];
  for (const item of quarantineCollisions) {
    const dbUpdates = SKIP_DB ? null : await updateDbReferences(item.from, item.keep);
    const quarantinedTo = moveToQuarantine(item.from);
    applied.push({ ...item, quarantinedTo, dbUpdates });
  }

  for (const item of planned) {
    const fromAbs = path.join(UPLOAD_DIR, item.from);
    const toAbs = path.join(UPLOAD_DIR, item.to);
    fs.renameSync(fromAbs, toAbs);
    const dbUpdates = SKIP_DB ? null : await updateDbReferences(item.from, item.to);
    applied.push({ ...item, dbUpdates });
  }

  const applyReportPath = reportPath.replace('.json', '-applied.json');
  fs.writeFileSync(applyReportPath, JSON.stringify({ summary: report.summary, applied, collisionRenames }, null, 2));
  console.log(`Applied changes: ${applied.length}`);
  console.log(`Apply report: ${applyReportPath}`);
  if (!SKIP_DB) await sequelize.close();
};

if (require.main === module) {
  run().catch(async (error) => {
    console.error('Script failed:', error.message);
    try {
      if (!SKIP_DB) await sequelize.close();
    } catch {
      // ignore close errors
    }
    process.exitCode = 1;
  });
}

module.exports = { run, buildNormalizedName };

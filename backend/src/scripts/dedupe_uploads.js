#!/usr/bin/env node
/* eslint-disable no-console */
require('../config/loadEnv').loadEnv();

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { connectAndSync, sequelize, ResourceFile, EduvhibeNote } = require('../models');

const APPLY = process.argv.includes('--apply');
const SKIP_DB = process.argv.includes('--skip-db');
const TARGET_ARG = process.argv.find((arg) => arg.startsWith('--target='));
const TARGET = TARGET_ARG ? String(TARGET_ARG).split('=').slice(1).join('=').trim() : '';
const ROOT = path.resolve(process.cwd());
const UPLOAD_DIR = path.resolve(ROOT, process.env.UPLOAD_DIR || 'uploads');
const TARGET_DIR = path.resolve(UPLOAD_DIR, TARGET || '.');
const REPORT_DIR = path.resolve(ROOT, 'tmp');
const QUARANTINE_DIR = path.resolve(
  ROOT,
  'uploads_dedupe_quarantine',
  new Date().toISOString().replace(/[:.]/g, '-')
);

const HASH_ALGORITHM = 'sha256';

const usage = () => {
  console.log('Usage: node src/scripts/dedupe_uploads.js [--apply] [--skip-db] [--target=resources]');
  console.log('  default     dry-run: scan duplicates and write a JSON report');
  console.log('  --apply     move duplicate files into uploads_dedupe_quarantine and update DB references');
  console.log('  --skip-db   do not connect to the DB or update ResourceFile/EduvhibeNote rows');
  console.log('  --target    optional subdirectory under UPLOAD_DIR to scan, e.g. resources');
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
    if (entry.isDirectory()) {
      files.push(...walkFiles(full));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
};

const hashFile = (absolutePath) => new Promise((resolve, reject) => {
  const hash = crypto.createHash(HASH_ALGORITHM);
  const stream = fs.createReadStream(absolutePath);
  stream.on('error', reject);
  stream.on('data', (chunk) => hash.update(chunk));
  stream.on('end', () => resolve(hash.digest('hex')));
});

const getFileUrlBasename = (value) => {
  const raw = String(value || '').split('?')[0];
  return path.basename(raw);
};

const getPathVariants = (relativePath) => {
  const normalized = normalizeRel(relativePath);
  const absolute = path.join(UPLOAD_DIR, normalized);
  const basename = path.basename(normalized);
  return {
    relative: normalized,
    absolute,
    basename,
    fileUrl: uploadUrlForRel(normalized),
    flatFileUrl: `/uploads/${basename}`,
  };
};

const buildDbReferenceMap = async () => {
  const map = new Map();

  const addReference = (relativePath, type, id) => {
    if (!relativePath) return;
    const normalized = normalizeRel(relativePath);
    if (!map.has(normalized)) map.set(normalized, []);
    map.get(normalized).push({ type, id });
  };

  const addRows = (rows, type) => {
    rows.forEach((row) => {
      const current = row.toJSON ? row.toJSON() : row;
      const candidates = [
        current.file_path,
        current.file_url,
        getFileUrlBasename(current.file_url),
        current.file_name,
      ].filter(Boolean);

      candidates.forEach((candidate) => {
        const normalized = normalizeRel(candidate);
        const absolute = path.resolve(UPLOAD_DIR, normalized);
        if (isInside(absolute, UPLOAD_DIR) && fs.existsSync(absolute)) {
          addReference(normalized, type, current.id);
        }
      });
    });
  };

  const resourceRows = ResourceFile
    ? await ResourceFile.findAll({ attributes: ['id', 'file_name', 'file_url', 'file_path'] })
    : [];
  addRows(resourceRows, 'ResourceFile');

  const noteRows = EduvhibeNote
    ? await EduvhibeNote.findAll({ attributes: ['id', 'file_name', 'file_url', 'file_path'] })
    : [];
  addRows(noteRows, 'EduvhibeNote');

  return map;
};

const scoreCandidate = (file, dbReferenceMap) => {
  const rel = normalizeRel(file.relativePath);
  const refs = dbReferenceMap.get(rel) || [];
  let score = refs.length * 100;
  if (rel.startsWith('resources/')) score += 100;
  if (/^resources\/(?:notes\/sem-\d\/)?(?:100|200|300|400)\/sem-\d\//i.test(rel)) score += 700;
  if (/^resources\/(?:100|200|300|400)\//i.test(rel)) score += 400;
  if (/^resources\/eduvhibe-notes\//i.test(rel)) score -= 250;
  if (/^resources\/notes\/[^/]+$/i.test(rel)) score -= 150;
  if (!/copy|duplicate|\(\d+\)/i.test(path.basename(rel))) score += 80;
  score += Math.max(0, 200 - rel.length);
  return score;
};

const updateDbReferences = async (duplicateRel, keepRel) => {
  const duplicate = getPathVariants(duplicateRel);
  const keep = getPathVariants(keepRel);
  const summary = { resourceFiles: 0, eduvhibeNotes: 0 };

  const resourceWhere = {
    [Op.or]: [
      { file_path: duplicate.relative },
      { file_path: duplicate.absolute },
      { file_url: duplicate.fileUrl },
      { file_url: duplicate.flatFileUrl },
    ],
  };
  const [resourceCount] = await ResourceFile.update(
    { file_path: keep.relative, file_url: keep.fileUrl },
    { where: resourceWhere }
  );
  summary.resourceFiles = resourceCount;

  if (EduvhibeNote) {
    const noteWhere = {
      [Op.or]: [
        { file_path: duplicate.relative },
        { file_path: duplicate.absolute },
        { file_url: duplicate.fileUrl },
        { file_url: duplicate.flatFileUrl },
      ],
    };
    const [noteCount] = await EduvhibeNote.update(
      { file_path: keep.relative, file_url: keep.fileUrl },
      { where: noteWhere }
    );
    summary.eduvhibeNotes = noteCount;
  }

  return summary;
};

const moveToQuarantine = (duplicateRel) => {
  const source = path.join(UPLOAD_DIR, normalizeRel(duplicateRel));
  if (!isInside(source, UPLOAD_DIR)) {
    throw new Error(`Refusing to move file outside upload dir: ${source}`);
  }

  const destination = path.join(QUARANTINE_DIR, normalizeRel(duplicateRel));
  const destinationDir = path.dirname(destination);
  fs.mkdirSync(destinationDir, { recursive: true });
  fs.renameSync(source, destination);
  return destination;
};

const formatBytes = (num) => {
  const value = Number(num || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const run = async () => {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    usage();
    return;
  }

  if (!fs.existsSync(UPLOAD_DIR)) {
    throw new Error(`Upload directory does not exist: ${UPLOAD_DIR}`);
  }
  if (!isInside(TARGET_DIR, UPLOAD_DIR)) {
    throw new Error(`Target must stay inside upload dir: ${TARGET_DIR}`);
  }

  let dbReferenceMap = new Map();
  if (!SKIP_DB) {
    await connectAndSync();
    dbReferenceMap = await buildDbReferenceMap();
  }

  const files = walkFiles(TARGET_DIR)
    .filter((file) => !file.includes(`${path.sep}uploads_dedupe_quarantine${path.sep}`))
    .map((absolutePath) => {
      const stat = fs.statSync(absolutePath);
      return {
        absolutePath,
        relativePath: normalizeRel(path.relative(UPLOAD_DIR, absolutePath)),
        size: stat.size,
      };
    });

  const bySize = new Map();
  files.forEach((file) => {
    if (!bySize.has(file.size)) bySize.set(file.size, []);
    bySize.get(file.size).push(file);
  });

  const candidateFiles = Array.from(bySize.values()).filter((group) => group.length > 1).flat();
  const byHash = new Map();
  for (let index = 0; index < candidateFiles.length; index += 1) {
    const file = candidateFiles[index];
    const hash = await hashFile(file.absolutePath);
    if (!byHash.has(hash)) byHash.set(hash, []);
    byHash.get(hash).push({ ...file, hash });
    if ((index + 1) % 250 === 0) {
      console.log(`Hashed ${index + 1}/${candidateFiles.length} duplicate-size candidates...`);
    }
  }

  const duplicateGroups = Array.from(byHash.entries())
    .map(([hash, group]) => ({ hash, files: group }))
    .filter((group) => group.files.length > 1)
    .map((group) => {
      const sorted = [...group.files].sort((left, right) => {
        const scoreDelta = scoreCandidate(right, dbReferenceMap) - scoreCandidate(left, dbReferenceMap);
        if (scoreDelta !== 0) return scoreDelta;
        return left.relativePath.localeCompare(right.relativePath);
      });
      const keep = sorted[0];
      const duplicates = sorted.slice(1);
      return {
        hash: group.hash,
        size: keep.size,
        keep: keep.relativePath,
        duplicates: duplicates.map((file) => file.relativePath),
        bytesRecoverable: duplicates.reduce((total, file) => total + file.size, 0),
      };
    });

  const summary = {
    mode: APPLY ? 'apply' : 'dry-run',
    uploadDir: UPLOAD_DIR,
    targetDir: TARGET_DIR,
    scannedFiles: files.length,
    duplicateGroups: duplicateGroups.length,
    duplicateFiles: duplicateGroups.reduce((total, group) => total + group.duplicates.length, 0),
    bytesRecoverable: duplicateGroups.reduce((total, group) => total + group.bytesRecoverable, 0),
    quarantineDir: APPLY ? QUARANTINE_DIR : null,
  };

  const report = { summary, groups: duplicateGroups };
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const reportPath = path.join(
    REPORT_DIR,
    `uploads-dedupe-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  );
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('Uploads dedupe summary');
  console.log(`Mode: ${summary.mode}`);
  console.log(`Upload dir: ${summary.uploadDir}`);
  console.log(`Target dir: ${summary.targetDir}`);
  console.log(`Files scanned: ${summary.scannedFiles}`);
  console.log(`Duplicate groups: ${summary.duplicateGroups}`);
  console.log(`Duplicate files: ${summary.duplicateFiles}`);
  console.log(`Recoverable: ${summary.bytesRecoverable} (${formatBytes(summary.bytesRecoverable)})`);
  console.log(`Report: ${reportPath}`);

  if (!APPLY) {
    console.log('No files moved. Re-run with --apply after reviewing the report.');
    if (!SKIP_DB) await sequelize.close();
    return;
  }

  const applied = [];
  try {
    for (const group of duplicateGroups) {
      for (const duplicateRel of group.duplicates) {
        const dbUpdates = SKIP_DB ? null : await updateDbReferences(duplicateRel, group.keep);
        const quarantinedTo = moveToQuarantine(duplicateRel);
        applied.push({
          duplicate: duplicateRel,
          keep: group.keep,
          quarantinedTo,
          dbUpdates,
        });
      }
    }

    const applyReportPath = reportPath.replace('.json', '-applied.json');
    fs.writeFileSync(applyReportPath, JSON.stringify({ summary, applied }, null, 2));
    console.log(`Moved duplicate files to: ${QUARANTINE_DIR}`);
    console.log(`Apply report: ${applyReportPath}`);
  } catch (error) {
    console.error('Failed while applying duplicate cleanup:', error);
    console.error('Any completed DB updates point to retained files. Review quarantine/report before retrying.');
    throw error;
  } finally {
    if (!SKIP_DB) await sequelize.close();
  }
};

if (require.main === module) {
  run().catch((error) => {
    console.error('Script failed:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { run };

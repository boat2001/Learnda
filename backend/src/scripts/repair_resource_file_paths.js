/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { connectAndSync, sequelize, ResourceFile } = require('../models');

const isApplyMode = process.argv.includes('--apply');

const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');
const BACKEND_UPLOAD_ROOT = path.resolve(process.cwd(), 'backend', 'uploads');
const SEARCH_ROOTS = [UPLOAD_ROOT, BACKEND_UPLOAD_ROOT];

function safeStat(filePath) {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

function listFilesRecursively(rootDir) {
  const results = [];
  if (!safeStat(rootDir)?.isDirectory()) return results;

  const stack = [rootDir];
  while (stack.length) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      entries = [];
    }
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolute);
      } else if (entry.isFile()) {
        results.push(absolute);
      }
    }
  }

  return results;
}

function toLower(value) {
  return String(value || '').trim().toLowerCase();
}

function buildLookup(files) {
  const byBase = new Map();
  files.forEach((filePath) => {
    const base = toLower(path.basename(filePath));
    if (!base) return;
    if (!byBase.has(base)) byBase.set(base, []);
    byBase.get(base).push(filePath);
  });
  return byBase;
}

function resolveUploadUrl(filePath) {
  const normalized = path.resolve(filePath);
  if (normalized.startsWith(`${UPLOAD_ROOT}${path.sep}`) || normalized === UPLOAD_ROOT) {
    return `/uploads/${path.basename(normalized)}`;
  }
  if (normalized.startsWith(`${BACKEND_UPLOAD_ROOT}${path.sep}`) || normalized === BACKEND_UPLOAD_ROOT) {
    return `/uploads/${path.basename(normalized)}`;
  }
  return null;
}

function existsOnDisk(value) {
  if (!value) return false;
  const absolute = path.resolve(String(value));
  return Boolean(safeStat(absolute)?.isFile());
}

function pickBestCandidate(candidates = []) {
  if (!candidates.length) return null;
  // Prefer top-level uploads over nested folders to match app URL scheme.
  return [...candidates].sort((a, b) => {
    const aDepth = a.split(path.sep).length;
    const bDepth = b.split(path.sep).length;
    return aDepth - bDepth;
  })[0];
}

async function run() {
  await connectAndSync();

  const allDiskFiles = SEARCH_ROOTS.flatMap((root) => listFilesRecursively(root));
  const lookupByBase = buildLookup(allDiskFiles);
  const rows = await ResourceFile.findAll({ order: [['created_at', 'ASC']] });

  let scanned = 0;
  let alreadyValid = 0;
  let repaired = 0;
  let unresolved = 0;
  const updates = [];

  for (const row of rows) {
    scanned += 1;
    const current = row.toJSON();

    const currentPathValid = existsOnDisk(current.file_path);
    if (currentPathValid) {
      alreadyValid += 1;
      continue;
    }

    const keys = [
      path.basename(String(current.file_path || '')),
      path.basename(String(current.file_url || '').split('?')[0] || ''),
      path.basename(String(current.file_name || '')),
    ].map(toLower).filter(Boolean);

    let matchedPath = null;
    for (const key of keys) {
      const matches = lookupByBase.get(key) || [];
      matchedPath = pickBestCandidate(matches);
      if (matchedPath) break;
    }

    if (!matchedPath) {
      unresolved += 1;
      continue;
    }

    const nextFilePath = matchedPath;
    const nextFileUrl = resolveUploadUrl(matchedPath);
    if (!nextFileUrl) {
      unresolved += 1;
      continue;
    }

    updates.push({
      id: current.id,
      values: {
        file_path: nextFilePath,
        file_url: nextFileUrl,
      },
    });
    repaired += 1;
  }

  console.log('Resource file path repair summary');
  console.log('Mode:', isApplyMode ? 'APPLY' : 'DRY RUN');
  console.log('Rows scanned:', scanned);
  console.log('Already valid:', alreadyValid);
  console.log('Repairable:', repaired);
  console.log('Unresolved:', unresolved);

  if (!isApplyMode) {
    console.log('No DB changes applied. Re-run with --apply to persist.');
    await sequelize.close();
    return;
  }

  const tx = await sequelize.transaction();
  try {
    for (const item of updates) {
      await ResourceFile.update(item.values, {
        where: { id: item.id },
        transaction: tx,
      });
    }
    await tx.commit();
    console.log(`Applied ${updates.length} resource file path update(s).`);
  } catch (error) {
    await tx.rollback();
    console.error('Failed to apply resource file path repair:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error('Script failed:', error);
    process.exitCode = 1;
  });
}

module.exports = { run };

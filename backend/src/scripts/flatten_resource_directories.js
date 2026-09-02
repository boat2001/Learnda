require('../config/loadEnv').loadEnv();

const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { ResourceFile, sequelize } = require('../models');

const UPLOADS_ROOT = path.join(process.cwd(), 'uploads');
const FREE_PREFIX = 'resources/free/';
const PREMIUM_PREFIX = 'resources/premium/';

const normalizeSlashes = (value) => String(value || '').replace(/\\/g, '/');

const stripAccessPrefix = (relativePath) =>
  normalizeSlashes(relativePath).replace(/^resources\/(?:free|premium)\//, 'resources/');

const appendPathSuffixBeforeExtension = (relativePath, suffix) =>
  relativePath.replace(/(\.[^/.]+)?$/, `${suffix}$1`);

const toDiskPath = (relativePath) => {
  const normalized = normalizeSlashes(relativePath).replace(/^\/+/, '').replace(/^uploads\//, '');
  return path.join(UPLOADS_ROOT, normalized);
};

function walkFiles(targetPath) {
  if (!fs.existsSync(targetPath)) return [];

  const entries = fs.readdirSync(targetPath, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) return walkFiles(fullPath);
    return [fullPath];
  });
}

async function moveFileIfNeeded(sourcePath, targetPath) {
  if (normalizeSlashes(sourcePath) === normalizeSlashes(targetPath)) return;
  if (!fs.existsSync(sourcePath)) return;

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });

  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(sourcePath);
    return;
  }

  fs.renameSync(sourcePath, targetPath);
}

function pruneDirectoryIfEmpty(targetPath) {
  if (!fs.existsSync(targetPath)) return;

  const entries = fs.readdirSync(targetPath, { withFileTypes: true });
  entries.forEach((entry) => {
    if (!entry.isDirectory()) return;
    pruneDirectoryIfEmpty(path.join(targetPath, entry.name));
  });

  const remaining = fs.readdirSync(targetPath);
  if (remaining.length === 0) {
    fs.rmdirSync(targetPath);
  }
}

function getUniqueTargetPath(targetPath, suffix) {
  if (!fs.existsSync(targetPath)) return targetPath;

  let index = 1;
  let candidate = appendPathSuffixBeforeExtension(targetPath, suffix);
  while (fs.existsSync(candidate)) {
    index += 1;
    candidate = appendPathSuffixBeforeExtension(targetPath, `${suffix}_${index}`);
  }

  return candidate;
}

function collectOrphanMoves(bucketName) {
  const bucketRoot = path.join(UPLOADS_ROOT, 'resources', bucketName);
  return walkFiles(bucketRoot).map((sourcePath) => {
    const relativeWithinBucket = normalizeSlashes(path.relative(bucketRoot, sourcePath));
    const flattenedRelativePath = `resources/${relativeWithinBucket}`;
    const baseTargetPath = toDiskPath(flattenedRelativePath);
    const suffix = bucketName === 'premium' ? '__premium_orphan' : '__orphan';

    return {
      sourcePath,
      targetPath: getUniqueTargetPath(baseTargetPath, suffix),
    };
  });
}

async function run() {
  const where = {
    [Op.or]: [
      { file_path: { [Op.like]: `${FREE_PREFIX}%` } },
      { file_path: { [Op.like]: `${PREMIUM_PREFIX}%` } },
    ],
  };

  const rows = await ResourceFile.findAll({
    where,
    attributes: ['id', 'file_path', 'file_url', 'is_premium'],
    order: [['created_at', 'ASC']],
  });

  const groups = new Map();
  rows.forEach((row) => {
    const rowJson = row.toJSON();
    const basePath = stripAccessPrefix(rowJson.file_path);
    if (!groups.has(basePath)) groups.set(basePath, []);
    groups.get(basePath).push(rowJson);
  });

  const updates = rows.map((row) => {
    const current = row.toJSON();
    const basePath = stripAccessPrefix(current.file_path);
    const group = groups.get(basePath) || [];

    let nextRelativePath = basePath;
    if (group.length > 1 && current.is_premium && group.some((item) => !item.is_premium)) {
      const premiumIndex = group
        .filter((item) => item.is_premium)
        .findIndex((item) => item.id === current.id);
      const suffix = premiumIndex > 0 ? `__premium_${premiumIndex + 1}` : '__premium';
      nextRelativePath = appendPathSuffixBeforeExtension(basePath, suffix);
    }

    return {
      id: current.id,
      currentFilePath: normalizeSlashes(current.file_path),
      currentFileUrl: normalizeSlashes(current.file_url),
      nextRelativePath,
      nextFileUrl: `/uploads/${nextRelativePath}`,
    };
  });

  const tx = await sequelize.transaction();

  try {
    for (const update of updates) {
      await ResourceFile.update(
        {
          file_path: update.nextRelativePath,
          file_url: update.nextFileUrl,
        },
        {
          where: { id: update.id },
          transaction: tx,
        }
      );
    }

    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }

  for (const update of updates) {
    await moveFileIfNeeded(toDiskPath(update.currentFilePath), toDiskPath(update.nextRelativePath));
  }

  const orphanMoves = [
    ...collectOrphanMoves('free'),
    ...collectOrphanMoves('premium'),
  ];

  for (const orphanMove of orphanMoves) {
    await moveFileIfNeeded(orphanMove.sourcePath, orphanMove.targetPath);
  }

  pruneDirectoryIfEmpty(path.join(UPLOADS_ROOT, 'resources', 'free'));
  pruneDirectoryIfEmpty(path.join(UPLOADS_ROOT, 'resources', 'premium'));

  console.log(
    `Flattened ${updates.length} resource path records and moved ${orphanMoves.length} orphan files into uploads/resources`
  );
}

run()
  .catch(async (error) => {
    console.error('Failed to flatten resource directories:', error);
    try {
      await sequelize.close();
    } catch {
      // Ignore close errors while already handling the original failure.
    }
    process.exit(1);
  })
  .finally(async () => {
    try {
      await sequelize.close();
    } catch {
      // Ignore close errors during shutdown.
    }
  });

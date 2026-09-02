require('../config/loadEnv').loadEnv();

const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { ResourceFile, sequelize } = require('../models');

const UPLOADS_ROOT = path.join(process.cwd(), 'uploads');
const sourceRelativePrefix = 'resources/premium/other-files/';
const targetRelativePrefix = 'resources/other-files/';
const sourceDir = path.join(UPLOADS_ROOT, 'resources', 'premium', 'other-files');
const targetDir = path.join(UPLOADS_ROOT, 'resources', 'other-files');

const normalizeSlashes = (value) => String(value || '').replace(/\\/g, '/');

async function moveDirectoryContents(source, target) {
  if (!fs.existsSync(source)) return;

  fs.mkdirSync(target, { recursive: true });
  const entries = fs.readdirSync(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      await moveDirectoryContents(sourcePath, targetPath);
      const remaining = fs.existsSync(sourcePath) ? fs.readdirSync(sourcePath) : [];
      if (remaining.length === 0 && fs.existsSync(sourcePath)) {
        fs.rmdirSync(sourcePath);
      }
      continue;
    }

    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(sourcePath);
      continue;
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.renameSync(sourcePath, targetPath);
  }
}

async function run() {
  const tx = await sequelize.transaction();

  try {
    const files = await ResourceFile.findAll({
      where: {
        file_path: {
          [Op.like]: `%${sourceRelativePrefix}%`,
        },
      },
      transaction: tx,
    });

    console.log(`Found ${files.length} resource records under ${sourceRelativePrefix}`);

    for (const file of files) {
      const normalizedFilePath = normalizeSlashes(file.file_path);
      const normalizedFileUrl = normalizeSlashes(file.file_url);
      const nextRelativePath = normalizedFilePath.replace(sourceRelativePrefix, targetRelativePrefix);
      const nextFileUrl = normalizedFileUrl.replace(sourceRelativePrefix, targetRelativePrefix);

      await file.update(
        {
          file_path: nextRelativePath,
          file_url: nextFileUrl,
          is_premium: false,
        },
        { transaction: tx }
      );
    }

    await tx.commit();

    await moveDirectoryContents(sourceDir, targetDir);

    if (fs.existsSync(sourceDir)) {
      const remaining = fs.readdirSync(sourceDir);
      if (remaining.length === 0) {
        fs.rmdirSync(sourceDir);
      }
    }

    console.log(`Moved resource files from ${sourceDir} to ${targetDir}`);
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally {
    await sequelize.close();
  }
}

run().catch((error) => {
  console.error('Failed to move other-files resources:', error);
  process.exit(1);
});

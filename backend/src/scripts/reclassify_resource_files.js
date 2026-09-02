/* eslint-disable no-console */
const {
  connectAndSync,
  sequelize,
  ResourceFile
} = require('../models');
const {
  classifyResourceCategory,
  extractTitleFromFileName,
  deriveYear,
  deriveLevelSemester,
  buildResourceDedupeKey,
  pickBestResourceCandidate
} = require('../utils/resourceClassifier');

const isApplyMode = process.argv.includes('--apply');

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function shouldRetitle(record) {
  const title = (record.title || '').trim();
  if (!title) return true;
  if (/\.pdf$/i.test(title)) return true;
  if (/learnda\.com/i.test(title)) return true;
  if (title === record.file_name) return true;
  return false;
}

async function run() {
  await connectAndSync();

  const rows = await ResourceFile.findAll({
    order: [['created_at', 'ASC']]
  });

  const updates = [];
  const enrichedRows = [];

  rows.forEach((row) => {
    const current = row.toJSON();
    const next = {
      id: current.id,
      category: classifyResourceCategory(current.file_name, current.file_path),
      title: shouldRetitle(current) ? extractTitleFromFileName(current.file_name) : current.title,
      description: current.description || current.file_name || '',
      year: deriveYear(current.file_name, current.year)
    };

    const levelAndSemester = deriveLevelSemester(current.file_path, current.level, current.semester);
    next.level = levelAndSemester.level;
    next.semester = levelAndSemester.semester;

    const changed = {};
    ['category', 'title', 'description', 'year', 'level', 'semester'].forEach((field) => {
      const originalValue = current[field] === undefined ? null : current[field];
      const nextValue = next[field] === undefined ? null : next[field];
      if (originalValue !== nextValue) {
        changed[field] = nextValue;
      }
    });

    if (Object.keys(changed).length > 0) {
      updates.push({ id: current.id, values: changed });
    }

    enrichedRows.push({
      ...current,
      ...next
    });
  });

  const groups = new Map();
  enrichedRows.forEach((row) => {
    const key = buildResourceDedupeKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });

  const duplicateGroups = [];
  const deleteIds = [];
  groups.forEach((groupRows, key) => {
    if (groupRows.length < 2) return;
    const keep = pickBestResourceCandidate(groupRows, false);
    const toDelete = groupRows.filter((row) => row.id !== keep.id);
    if (toDelete.length) {
      duplicateGroups.push({
        key,
        keepId: keep.id,
        removeIds: toDelete.map((row) => row.id)
      });
      deleteIds.push(...toDelete.map((row) => row.id));
    }
  });

  console.log('Reclassification dry run summary');
  console.log('Mode:', isApplyMode ? 'APPLY' : 'DRY RUN');
  console.log('Rows scanned:', rows.length);
  console.log('Rows to update:', updates.length);
  console.log('Duplicate groups:', duplicateGroups.length);
  console.log('Rows to delete:', deleteIds.length);

  if (!isApplyMode) {
    console.log('No DB changes applied. Re-run with --apply to persist.');
    await sequelize.close();
    return;
  }

  const tx = await sequelize.transaction();
  try {
    for (const updateChunk of chunkArray(updates, 200)) {
      for (const item of updateChunk) {
        await ResourceFile.update(item.values, {
          where: { id: item.id },
          transaction: tx
        });
      }
    }

    for (const deleteChunk of chunkArray(deleteIds, 500)) {
      await ResourceFile.destroy({
        where: { id: deleteChunk },
        transaction: tx
      });
    }

    await tx.commit();
    console.log('Resource file cleanup applied successfully.');
  } catch (error) {
    await tx.rollback();
    console.error('Failed to apply resource cleanup:', error);
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

module.exports = {
  run
};

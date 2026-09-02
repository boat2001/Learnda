/* eslint-disable no-console */
const { QueryTypes } = require('sequelize');
const {
  connectAndSync,
  sequelize,
  Content
} = require('../models');

const isApplyMode = process.argv.includes('--apply');

const NEW_TYPES = ['site_info', 'team_profile'];
const TEAM_TAGS = new Set(['team', 'profile', 'contributors', 'donators']);

const quoteIdentifier = (value) => `"${String(value).replace(/"/g, '""')}"`;
const quoteLiteral = (value) => `'${String(value).replace(/'/g, "''")}'`;

async function ensureContentTypeEnumValues() {
  const enumInfo = await sequelize.query(
    `
      SELECT n.nspname AS schema_name, t.typname AS type_name
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_type t ON t.oid = a.atttypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE c.relname = 'content_items'
        AND a.attname = 'type'
        AND a.attnum > 0
      LIMIT 1
    `,
    { type: QueryTypes.SELECT }
  );

  const enumRow = enumInfo[0];
  if (!enumRow) {
    throw new Error('Unable to resolve enum type for content_items.type');
  }

  const labels = await sequelize.query(
    `
      SELECT e.enumlabel
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = :schemaName
        AND t.typname = :typeName
    `,
    {
      type: QueryTypes.SELECT,
      replacements: {
        schemaName: enumRow.schema_name,
        typeName: enumRow.type_name
      }
    }
  );

  const existing = new Set(labels.map((row) => row.enumlabel));
  for (const nextType of NEW_TYPES) {
    if (existing.has(nextType)) continue;
    await sequelize.query(
      `ALTER TYPE ${quoteIdentifier(enumRow.schema_name)}.${quoteIdentifier(enumRow.type_name)} ADD VALUE ${quoteLiteral(nextType)}`
    );
    console.log(`Added enum value: ${nextType}`);
  }
}

function hasTeamMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return false;
  return Boolean(
    metadata.role
      || metadata.group
      || metadata.aka
      || (Array.isArray(metadata.about) && metadata.about.length)
      || (metadata.contact && typeof metadata.contact === 'object')
  );
}

function hasSiteMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return false;
  return Boolean(metadata.section || (Array.isArray(metadata.paragraphs) && metadata.paragraphs.length));
}

function hasLearningMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return false;
  return Boolean(metadata.course || metadata.level || metadata.unit_label || metadata.unit_title);
}

function determineTargetType(row) {
  const metadata = row.metadata || {};
  if (hasLearningMetadata(metadata)) return null;

  const tags = Array.isArray(row.tags) ? row.tags.map((tag) => String(tag).toLowerCase()) : [];
  const hasAboutTag = tags.includes('about');
  const hasTeamTag = tags.some((tag) => TEAM_TAGS.has(tag));

  const isSiteInfo = hasSiteMetadata(metadata) || hasAboutTag;
  const isTeamProfile = hasTeamMetadata(metadata) || hasTeamTag;

  if (isSiteInfo && !isTeamProfile) return 'site_info';
  if (isTeamProfile && !isSiteInfo) return 'team_profile';
  if (isSiteInfo && isTeamProfile) {
    return hasSiteMetadata(metadata) ? 'site_info' : 'team_profile';
  }
  return null;
}

async function run() {
  await connectAndSync();
  await ensureContentTypeEnumValues();

  const rows = await Content.findAll({
    where: { type: 'text_lesson' },
    attributes: ['id', 'title', 'type', 'tags', 'metadata'],
    order: [['created_at', 'ASC']]
  });

  const updates = [];
  rows.forEach((row) => {
    const targetType = determineTargetType(row);
    if (!targetType || targetType === row.type) return;
    updates.push({
      id: row.id,
      title: row.title,
      from: row.type,
      to: targetType
    });
  });

  const siteInfoCount = updates.filter((item) => item.to === 'site_info').length;
  const teamProfileCount = updates.filter((item) => item.to === 'team_profile').length;

  console.log('Content type reclassification summary');
  console.log('Mode:', isApplyMode ? 'APPLY' : 'DRY RUN');
  console.log('Text lessons scanned:', rows.length);
  console.log('Rows to reclassify:', updates.length);
  console.log(' - site_info:', siteInfoCount);
  console.log(' - team_profile:', teamProfileCount);
  if (updates.length) {
    console.log('Sample rows:', updates.slice(0, 10).map((row) => `${row.title} (${row.from} -> ${row.to})`).join(' | '));
  }

  if (!isApplyMode) {
    console.log('No DB changes applied. Re-run with --apply to persist.');
    await sequelize.close();
    return;
  }

  const tx = await sequelize.transaction();
  try {
    for (const item of updates) {
      await Content.update(
        { type: item.to },
        { where: { id: item.id }, transaction: tx }
      );
    }
    await tx.commit();
    console.log('Content types reclassified successfully.');
  } catch (error) {
    await tx.rollback();
    console.error('Failed to reclassify content types:', error);
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

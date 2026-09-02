'use strict';
/**
 * Extract text from ResourceFile and EduvhibeNote rows into uploads/_generated-content/extracted-text.
 *
 * Usage:
 *   node src/scripts/extract_resource_text.js --dry-run
 *   node src/scripts/extract_resource_text.js --course="Child Development"
 *   node src/scripts/extract_resource_text.js --category=exam
 *   node src/scripts/extract_resource_text.js --limit=20
 *   node src/scripts/extract_resource_text.js --no-ocr
 */

const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const {
  BACKEND_ROOT,
  ensureDir,
  extractSourceText,
  upsertManifestEntry,
  outputTextPathForSource,
} = require('./import_pipeline/extraction');
const { safeText } = require('./import_pipeline/content_builders');

const OUT_ROOT = path.join(BACKEND_ROOT, 'uploads', '_generated-content', 'extracted-text');
const MANIFEST_PATH = path.join(OUT_ROOT, '_manifest.json');

function parseArgs(argv) {
  const args = {
    dryRun: false,
    limit: 0,
    course: '',
    category: '',
    source: 'all',
    ocr: true,
    force: false,
  };

  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--no-ocr') args.ocr = false;
    else if (arg === '--force') args.force = true;
    else {
      const limit = /^--limit=(\d+)$/.exec(arg);
      const course = /^--course=(.+)$/.exec(arg);
      const category = /^--category=(.+)$/.exec(arg);
      const source = /^--source=(resource_files|eduvhibe_notes|all)$/.exec(arg);
      if (limit) args.limit = Number.parseInt(limit[1], 10);
      if (course) args.course = course[1].trim();
      if (category) args.category = category[1].trim();
      if (source) args.source = source[1];
    }
  }

  return args;
}

function loadEnv() {
  for (const name of ['.env', '.env.development.local', '.env.local', '.env.development']) {
    const envPath = path.join(BACKEND_ROOT, name);
    if (fs.existsSync(envPath)) {
      require('dotenv').config({ path: envPath });
      return;
    }
  }
}

function manifestKey(sourceName, row) {
  return `${sourceName}:${safeText(row.id || row.file_path || row.file_url || row.file_name || row.title)}`;
}

async function collectSources(db, args) {
  const rows = [];
  const commonWhere = {};
  if (args.course) commonWhere.course = { [Op.iLike]: `%${args.course}%` };
  if (args.category) commonWhere.category = { [Op.iLike]: `%${args.category}%` };

  if (args.source === 'all' || args.source === 'resource_files') {
    const resourceRows = await db.ResourceFile.findAll({
      where: commonWhere,
      order: [['created_at', 'ASC']],
      limit: args.limit || undefined,
    });
    rows.push(...resourceRows.map((row) => ({ sourceName: 'resource_files', row })));
  }

  if (args.source === 'all' || args.source === 'eduvhibe_notes') {
    const noteWhere = {};
    if (args.course) noteWhere.course = { [Op.iLike]: `%${args.course}%` };
    const noteRows = await db.EduvhibeNote.findAll({
      where: noteWhere,
      order: [['created_at', 'ASC']],
      limit: args.limit || undefined,
    });
    rows.push(...noteRows.map((row) => ({ sourceName: 'eduvhibe_notes', row })));
  }

  return args.limit ? rows.slice(0, args.limit) : rows;
}

async function main() {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));
  ensureDir(OUT_ROOT);

  const db = require('../models');
  await db.sequelize.authenticate();

  const sources = await collectSources(db, args);
  const totals = { total: sources.length, extracted: 0, skipped: 0, errors: 0, dryRun: args.dryRun };

  for (const { sourceName, row } of sources) {
    const key = manifestKey(sourceName, row);
    const outPath = outputTextPathForSource(path.join(OUT_ROOT, sourceName), row, key.replace(/:/g, '_'));
    const { text, diagnostics } = await extractSourceText(row, { ocr: args.ocr });
    const entry = {
      ...diagnostics,
      sourceTable: sourceName,
      output: path.relative(BACKEND_ROOT, outPath).replace(/\\/g, '/'),
    };

    if (text) {
      totals.extracted += 1;
      if (args.dryRun) {
        console.log('[dry-run]', key, `${text.length} chars`, diagnostics.method || '');
      } else {
        ensureDir(path.dirname(outPath));
        fs.writeFileSync(outPath, text, 'utf8');
        upsertManifestEntry(MANIFEST_PATH, key, entry);
        console.log('[ok]', key, `${text.length} chars`, diagnostics.method || '');
      }
    } else {
      if (diagnostics.status === 'skipped_unsupported') totals.skipped += 1;
      else totals.errors += 1;
      if (!args.dryRun) upsertManifestEntry(MANIFEST_PATH, key, entry);
      console.warn('[warn]', key, diagnostics.error || diagnostics.status);
    }
  }

  console.log(JSON.stringify(totals, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      const db = require('../models');
      await db.sequelize.close();
    } catch (_) {
      // Ignore shutdown errors.
    }
  });

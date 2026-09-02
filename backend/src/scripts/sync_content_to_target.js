/* eslint-disable no-console */
/**
 * Sync learning CONTENT from DATABASE_URL to TARGET_DATABASE_URL — safely.
 *
 * This is the production-safe counterpart to copy_local_db_to_render.js. It
 * ONLY touches an explicit allowlist of content tables and NEVER deletes rows,
 * so live user data (accounts, subscriptions, payments, engagement/progress,
 * comments) is untouched. Rows are matched by primary key and upserted
 * (INSERT ... ON CONFLICT (id) DO UPDATE), which is additive and idempotent.
 *
 * Why this exists: the read paths render course lessons from the `all_content`
 * view, which unions the dedicated content tables. If those rows are missing or
 * stale on the target (or the view is stale), lessons don't show even though
 * courses do. This syncs the content and refreshes the view in one safe pass.
 *
 * Lesson→course linkage is by `course_id` UUID with no title fallback, so a
 * lesson only appears if its course_id equals the TARGET course's id. Course
 * ids can differ between databases, so we remap each lesson's course_id using a
 * source→target map keyed on the stable natural key `courses.key`.
 *
 * Default mode is a DRY RUN. Pass --apply to write.
 *
 * Usage (from backend/, with DATABASE_URL=local and TARGET_DATABASE_URL=live):
 *   node src/scripts/sync_content_to_target.js
 *   node src/scripts/sync_content_to_target.js --apply
 */
require('../config/loadEnv').loadEnv();
const { Client } = require('pg');
const { refreshAllContentView } = require('./lib/allContentView');

// Content tables to sync, in FK-safe order. `remapCourseId` marks tables whose
// course_id must be translated from source ids to target ids.
const CONTENT_TABLES = [
  { name: 'lessons', remapCourseId: true },
  { name: 'video_lessons', remapCourseId: true },
  { name: 'eduvhibe_videos', remapCourseId: false },
  { name: 'text_items', remapCourseId: false },
];

const INSERT_BATCH_SIZE = 100;
const shouldApply = process.argv.includes('--apply');

function shouldUseTargetSsl(connectionString) {
  const configured = String(process.env.TARGET_DATABASE_SSL || '').trim().toLowerCase();
  if (['0', 'false', 'off', 'no'].includes(configured)) return false;
  if (['1', 'true', 'on', 'yes'].includes(configured)) return true;
  try {
    const hostname = new URL(connectionString).hostname.toLowerCase();
    return !['localhost', '127.0.0.1', '::1'].includes(hostname);
  } catch (_error) {
    return true;
  }
}

async function tableExists(client, tableName) {
  const { rows } = await client.query(
    `SELECT to_regclass($1) AS oid`,
    [`public.${tableName}`]
  );
  return Boolean(rows[0].oid);
}

async function getColumnTypes(client, tableName) {
  const { rows } = await client.query(
    `SELECT column_name, data_type, udt_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [tableName]
  );
  return rows.map((row) => ({
    name: row.column_name,
    // jsonb columns must be JSON.stringify'd and cast, or node-postgres will
    // serialize a JS array as a Postgres array literal and corrupt them.
    isJsonb: row.data_type === 'jsonb' || row.data_type === 'json',
  }));
}

async function countRows(client, tableName) {
  const { rows } = await client.query(`SELECT COUNT(*)::int AS count FROM public."${tableName}"`);
  return rows[0].count;
}

async function fetchAll(client, tableName, columnNames) {
  const quoted = columnNames.map((column) => `"${column}"`).join(', ');
  const { rows } = await client.query(`SELECT ${quoted} FROM public."${tableName}"`);
  return rows;
}

/** Build a source course id → target course id map, matched on courses.key. */
async function buildCourseIdMap(source, target) {
  const [{ rows: sourceCourses }, { rows: targetCourses }] = await Promise.all([
    source.query(`SELECT id, key FROM public.courses WHERE key IS NOT NULL`),
    target.query(`SELECT id, key FROM public.courses WHERE key IS NOT NULL`),
  ]);
  const targetByKey = new Map(targetCourses.map((row) => [row.key, row.id]));
  const map = new Map();
  sourceCourses.forEach((row) => {
    const targetId = targetByKey.get(row.key);
    if (targetId) map.set(String(row.id), String(targetId));
  });
  return map;
}

function buildUpsertSql(tableName, columns) {
  const colList = columns.map((c) => `"${c.name}"`).join(', ');
  const updates = columns
    .filter((c) => c.name !== 'id')
    .map((c) => `"${c.name}" = EXCLUDED."${c.name}"`)
    .join(', ');
  return { colList, updates };
}

async function upsertBatch(target, tableName, columns, rows) {
  const { colList, updates } = buildUpsertSql(tableName, columns);
  const values = [];
  const tuples = rows.map((row) => {
    const placeholders = columns.map((col) => {
      const raw = row[col.name];
      if (col.isJsonb) {
        values.push(raw == null ? null : JSON.stringify(raw));
        return `$${values.length}::jsonb`;
      }
      values.push(raw === undefined ? null : raw);
      return `$${values.length}`;
    });
    return `(${placeholders.join(', ')})`;
  });
  await target.query(
    `INSERT INTO public."${tableName}" (${colList}) VALUES ${tuples.join(', ')}
     ON CONFLICT (id) DO UPDATE SET ${updates}`,
    values
  );
}

async function syncTable(source, target, tableSpec, courseIdMap) {
  const { name, remapCourseId } = tableSpec;

  const [sourceCols, targetCols] = await Promise.all([
    getColumnTypes(source, name),
    getColumnTypes(target, name),
  ]);
  const targetColNames = new Set(targetCols.map((c) => c.name));
  // Only sync columns present on BOTH databases; target types drive casting.
  const columns = targetCols.filter((c) => sourceCols.some((s) => s.name === c.name));
  const columnNames = columns.map((c) => c.name);

  const droppedFromSource = sourceCols
    .map((c) => c.name)
    .filter((n) => !targetColNames.has(n));
  if (droppedFromSource.length) {
    console.warn(`   [${name}] source columns not on target (skipped): ${droppedFromSource.join(', ')}`);
  }

  const rows = await fetchAll(source, name, columnNames);
  const hasCourseId = columnNames.includes('course_id');

  let remapped = 0;
  let unmapped = 0;
  if (remapCourseId && hasCourseId) {
    rows.forEach((row) => {
      if (!row.course_id) return;
      const targetId = courseIdMap.get(String(row.course_id));
      if (targetId) {
        if (targetId !== String(row.course_id)) remapped += 1;
        row.course_id = targetId;
      } else {
        unmapped += 1;
      }
    });
  }

  const summary = {
    table: name,
    sourceRows: rows.length,
    remapped,
    unmapped,
  };

  if (!shouldApply) return summary;

  for (let offset = 0; offset < rows.length; offset += INSERT_BATCH_SIZE) {
    const batch = rows.slice(offset, offset + INSERT_BATCH_SIZE);
    await upsertBatch(target, name, columns, batch);
  }
  return summary;
}

async function main() {
  if (!process.env.DATABASE_URL || !process.env.TARGET_DATABASE_URL) {
    throw new Error('DATABASE_URL (source) and TARGET_DATABASE_URL (target) are required.');
  }

  const source = new Client({ connectionString: process.env.DATABASE_URL });
  const target = new Client(
    shouldUseTargetSsl(process.env.TARGET_DATABASE_URL)
      ? { connectionString: process.env.TARGET_DATABASE_URL, ssl: { rejectUnauthorized: false } }
      : { connectionString: process.env.TARGET_DATABASE_URL }
  );

  await source.connect();
  await target.connect();

  try {
    console.log(`Mode: ${shouldApply ? 'APPLY (writing to target)' : 'dry-run (no changes)'}\n`);

    // Preflight: every content table plus courses must exist on the target.
    const required = [...CONTENT_TABLES.map((t) => t.name), 'courses'];
    const missing = [];
    for (const name of required) {
      if (!(await tableExists(target, name))) missing.push(name);
    }
    if (missing.length) {
      console.error(
        `✗ Target is missing required tables: ${missing.join(', ')}\n` +
        `  Run the dedicated-tables migration against the target first:\n` +
        `    DATABASE_URL=<target> node src/scripts/migrate_to_dedicated_tables.js`
      );
      process.exitCode = 1;
      return;
    }

    const courseIdMap = await buildCourseIdMap(source, target);
    console.log(`Course id map: ${courseIdMap.size} source courses matched to target by key\n`);

    // Before counts
    console.log('Target row counts BEFORE:');
    for (const { name } of CONTENT_TABLES) {
      console.log(`   ${name}: ${await countRows(target, name)}`);
    }
    console.log('');

    if (shouldApply) await target.query('BEGIN');

    const summaries = [];
    for (const spec of CONTENT_TABLES) {
      summaries.push(await syncTable(source, target, spec, courseIdMap));
    }

    if (shouldApply) {
      await refreshAllContentView(target);
      await target.query('COMMIT');
    }

    console.log('\nSummary:');
    summaries.forEach((s) => {
      const extras = [];
      if (s.remapped) extras.push(`${s.remapped} course_id remapped`);
      if (s.unmapped) extras.push(`${s.unmapped} UNLINKED (no target course)`);
      console.log(`   ${s.table}: ${s.sourceRows} source rows${extras.length ? ` — ${extras.join(', ')}` : ''}`);
    });

    const totalUnmapped = summaries.reduce((sum, s) => sum + s.unmapped, 0);
    if (totalUnmapped) {
      console.warn(
        `\n⚠️ ${totalUnmapped} lesson/video rows reference a course with no match on the target.\n` +
        `   Those rows will NOT appear under a course. Sync the course catalog first:\n` +
        `     npm run db:sync-course-catalog -- --apply`
      );
    }

    if (shouldApply) {
      console.log('\nTarget row counts AFTER:');
      for (const { name } of CONTENT_TABLES) {
        console.log(`   ${name}: ${await countRows(target, name)}`);
      }
      console.log('\n✓ Content sync committed and all_content view refreshed.');
    } else {
      console.log('\nDry-run complete — no target rows changed. Re-run with --apply to write.');
    }
  } catch (error) {
    if (shouldApply) {
      try { await target.query('ROLLBACK'); } catch (_e) { /* connection may be gone */ }
    }
    throw error;
  } finally {
    await source.end();
    await target.end();
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});

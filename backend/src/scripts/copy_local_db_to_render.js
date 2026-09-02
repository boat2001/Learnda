/* eslint-disable no-console */
require('../config/loadEnv').loadEnv();
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

const USE_VERCEL_TARGET = process.argv.includes('--vercel-target') ||
  String(process.env.COPY_TO_VERCEL_DATABASE || '').toLowerCase() === 'true';
const localEnvPath = path.resolve(__dirname, '../../.env.development.local');
const localEnv = USE_VERCEL_TARGET && fs.existsSync(localEnvPath)
  ? dotenv.parse(fs.readFileSync(localEnvPath))
  : {};
const sourceUrl = USE_VERCEL_TARGET ? localEnv.DATABASE_URL : process.env.DATABASE_URL;
const targetUrl = USE_VERCEL_TARGET ? process.env.DATABASE_URL : process.env.TARGET_DATABASE_URL;

if (!sourceUrl || !targetUrl) {
  throw new Error('DATABASE_URL and TARGET_DATABASE_URL are required.');
}

const SOURCE_ONLY_TABLES = new Set(['teacher_connections', 'user_academic_profiles']);
const INSERT_BATCH_SIZE = 250;
const CONFIRM_WIPE = process.argv.includes('--confirm-wipe');

// Tables that accumulate real production data (accounts, payments, progress).
// Truncating these on the target destroys anything created there since the
// last copy — the confirmation prompt calls them out explicitly.
const USER_DATA_TABLES = [
  'users', 'subscriptions', 'payments', 'content_engagements',
  'user_contacts', 'referrals', 'reward_ledgers', 'comments'
];
const deferredColumnsByTable = {
  users: ['primary_contact_id', 'referred_by_user_id', 'contributor_approved_by'],
  pls_items: ['parent_id']
};

async function getTables(client) {
  const { rows } = await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
  );
  return rows.map((row) => row.tablename);
}

async function getColumns(client, tableName) {
  const { rows } = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [tableName]
  );
  return rows.map((row) => row.column_name);
}

async function getJsonColumns(client, tableName) {
  const { rows } = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1
       AND data_type IN ('json', 'jsonb')`,
    [tableName]
  );
  return new Set(rows.map((row) => row.column_name));
}

async function getDependencies(client, tables) {
  const { rows } = await client.query(
    `SELECT tc.table_name, ccu.table_name AS foreign_table_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND tc.table_schema = 'public'`
  );

  const tableSet = new Set(tables);
  const dependencies = new Map(tables.map((table) => [table, new Set()]));
  rows.forEach(({ table_name: table, foreign_table_name: foreignTable }) => {
    if (!tableSet.has(table) || !tableSet.has(foreignTable) || table === foreignTable) return;
    if (table === 'users' && foreignTable === 'user_contacts') return;
    dependencies.get(table).add(foreignTable);
  });
  return dependencies;
}

async function getUserReferences(client, tables) {
  const { rows } = await client.query(
    `SELECT tc.table_name, kcu.column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON kcu.constraint_name = tc.constraint_name
      AND kcu.constraint_schema = tc.constraint_schema
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name = tc.constraint_name
      AND ccu.constraint_schema = tc.constraint_schema
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND tc.table_schema = 'public'
       AND ccu.table_name = 'users'`
  );

  const tableSet = new Set(tables);
  const references = new Map();
  rows.forEach(({ table_name: table, column_name: column }) => {
    if (!tableSet.has(table)) return;
    if (!references.has(table)) references.set(table, []);
    references.get(table).push(column);
  });
  return references;
}

function orderTables(dependencies) {
  const remaining = new Map(
    [...dependencies.entries()].map(([table, deps]) => [table, new Set(deps)])
  );
  const ordered = [];

  while (remaining.size) {
    const ready = [...remaining.entries()]
      .filter(([, deps]) => deps.size === 0)
      .map(([table]) => table)
      .sort();

    if (!ready.length) {
      throw new Error(`Unresolved dependency cycle: ${[...remaining.keys()].join(', ')}`);
    }

    ready.forEach((table) => {
      ordered.push(table);
      remaining.delete(table);
      remaining.forEach((deps) => deps.delete(table));
    });
  }

  return ordered;
}

async function fetchRows(client, tableName, columns) {
  const quotedColumns = columns.map((column) => `"${column}"`).join(', ');
  const { rows } = await client.query(`SELECT ${quotedColumns} FROM public."${tableName}"`);
  return rows;
}

async function insertRows(client, tableName, columns, rows, jsonColumns = new Set()) {
  if (!rows.length) return;
  const quotedColumns = columns.map((column) => `"${column}"`).join(', ');

  for (let offset = 0; offset < rows.length; offset += INSERT_BATCH_SIZE) {
    const batch = rows.slice(offset, offset + INSERT_BATCH_SIZE);
    const values = [];
    const placeholders = batch.map((row) => {
      const rowPlaceholders = columns.map((column) => {
        const value = row[column];
        const isJson = jsonColumns.has(column);
        values.push(isJson && value !== null ? JSON.stringify(value) : value);
        return `$${values.length}${isJson ? '::jsonb' : ''}`;
      });
      return `(${rowPlaceholders.join(', ')})`;
    });
    await client.query(
      `INSERT INTO public."${tableName}" (${quotedColumns}) VALUES ${placeholders.join(', ')}`,
      values
    );
  }
}

async function restoreDeferredReferences(source, target, tableName, columns, sourceUserIds) {
  const idRows = await fetchRows(source, tableName, ['id', ...columns]);
  for (const row of idRows) {
    const assignments = columns.map((column, index) => `"${column}" = $${index + 1}`);
    const values = columns.map((column) => {
      if (
        tableName === 'users' &&
        ['referred_by_user_id', 'contributor_approved_by'].includes(column) &&
        row[column] &&
        !sourceUserIds.has(String(row[column]))
      ) {
        return null;
      }
      return row[column];
    });
    values.push(row.id);
    await target.query(
      `UPDATE public."${tableName}" SET ${assignments.join(', ')} WHERE id = $${columns.length + 1}`,
      values
    );
  }
}

async function main() {
  const source = new Client({ connectionString: sourceUrl });
  const target = new Client({
    connectionString: targetUrl,
    ssl: { rejectUnauthorized: false }
  });

  await source.connect();
  await target.connect();

  try {
    const [sourceTables, targetTables] = await Promise.all([getTables(source), getTables(target)]);
    const targetTableSet = new Set(targetTables);
    const sharedTables = sourceTables.filter(
      (table) => targetTableSet.has(table) && !SOURCE_ONLY_TABLES.has(table)
    );

    const skippedSourceOnly = sourceTables.filter(
      (table) => !targetTableSet.has(table) && !SOURCE_ONLY_TABLES.has(table)
    );
    if (skippedSourceOnly.length) {
      console.warn(
        `⚠️ Tables that exist locally but NOT on the target (their data will NOT be copied):\n` +
        skippedSourceOnly.map((table) => `   - ${table}`).join('\n') +
        `\n   Run the relevant migration against the target first if these should exist there.`
      );
    }

    // Insert order must follow the constraints enforced by the target. A
    // freshly synced target can contain newer foreign keys than the source.
    const dependencies = await getDependencies(target, sharedTables);
    const orderedTables = orderTables(dependencies);
    const userReferences = await getUserReferences(target, sharedTables);
    const sourceUserIds = new Set(
      (await fetchRows(source, 'users', ['id'])).map((row) => String(row.id))
    );

    const userDataTables = USER_DATA_TABLES.filter((table) => targetTableSet.has(table));
    const countRows = await Promise.all(
      userDataTables.map(async (table) => {
        const { rows } = await target.query(`SELECT COUNT(*)::int AS count FROM public."${table}"`);
        return { table, count: rows[0].count };
      })
    );
    console.log('\nTarget user-data tables that will be WIPED and replaced with local data:');
    countRows.forEach(({ table, count }) => console.log(`   ${table}: ${count} rows on target`));

    if (!CONFIRM_WIPE) {
      console.log(
        '\nDry run only — no changes made. Any rows created on the target since the last copy\n' +
        '(real user sign-ups, payments, progress) will be PERMANENTLY LOST when you proceed.\n' +
        'Re-run with --confirm-wipe to execute.'
      );
      return;
    }

    await target.query('BEGIN');
    await target.query(
      `TRUNCATE TABLE ${sharedTables.map((table) => `public."${table}"`).join(', ')}
       RESTART IDENTITY CASCADE`
    );

    for (const table of orderedTables) {
      const [sourceColumns, targetColumns, targetJsonColumns] = await Promise.all([
        getColumns(source, table),
        getColumns(target, table),
        getJsonColumns(target, table)
      ]);
      const targetColumnSet = new Set(targetColumns);
      const columns = sourceColumns.filter((column) => targetColumnSet.has(column));
      let rows = await fetchRows(source, table, columns);
      const userColumns = userReferences.get(table) || [];
      if (table !== 'users' && userColumns.length) {
        const retainedRows = rows.filter((row) => !userColumns.some((column) => (
          row[column] && !sourceUserIds.has(String(row[column]))
        )));
        const removedRows = rows.length - retainedRows.length;
        rows = retainedRows;
        if (removedRows) {
          console.warn(`${table}: removed ${removedRows} record(s) belonging to deleted users`);
        }
      }
      const deferredColumns = deferredColumnsByTable[table] || [];
      const insertableRows = rows.map((row) => {
        if (!deferredColumns.length) return row;
        return {
          ...row,
          ...Object.fromEntries(deferredColumns.map((column) => [column, null]))
        };
      });
      await insertRows(target, table, columns, insertableRows, targetJsonColumns);
      console.log(`${table}: copied ${rows.length}`);
    }

    for (const [table, columns] of Object.entries(deferredColumnsByTable)) {
      await restoreDeferredReferences(source, target, table, columns, sourceUserIds);
      console.log(`${table}: restored deferred references`);
    }

    await target.query('COMMIT');
  } catch (error) {
    await target.query('ROLLBACK');
    throw error;
  } finally {
    await source.end();
    await target.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

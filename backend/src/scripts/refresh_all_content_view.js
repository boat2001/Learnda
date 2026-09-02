/* eslint-disable no-console */
/**
 * Refresh the all_content view to include metadata, lesson_document,
 * exercises, objectives, questions, and sections columns.
 *
 * Run from backend: node src/scripts/refresh_all_content_view.js
 */
const { Client } = require('pg');
require('../config/loadEnv').loadEnv();
const { refreshAllContentView } = require('./lib/allContentView');

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  // Remote databases (e.g. Render) require SSL; local Postgres does not.
  const isLocal = /localhost|127\.0\.0\.1/.test(databaseUrl);
  const client = new Client({
    connectionString: databaseUrl,
    ssl: isLocal ? undefined : { rejectUnauthorized: false }
  });
  await client.connect();

  try {
    await client.query('BEGIN');
    await refreshAllContentView(client);
    await client.query('COMMIT');
    console.log('✓ all_content view refreshed — now includes metadata, lesson_document, exercises, objectives');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('✗ Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();

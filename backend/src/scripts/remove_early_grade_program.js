/* eslint-disable no-console */
require('../config/loadEnv').loadEnv();
const { Client } = require('pg');

const ECE_PROGRAM_KEY = 'ece';
const LEGACY_CATEGORY = 'Early Grade Education';
const LEGACY_PROGRAM_KEY = 'early-grade-education-early-grade-education';
const LEGACY_PROGRAM_NAME = 'Early Grade Education';

const args = new Set(process.argv.slice(2));
const shouldApply = args.has('--apply');
const useTarget = args.has('--target');
const showHelp = args.has('--help') || args.has('-h');

if (showHelp) {
  console.log(`
Remove the legacy Early Grade Education program from DATABASE_URL.

Dry-run is the default. Apply mode remaps legacy users, profiles,
registration sessions, and offerings to the ece program before deleting
the Early Grade program row.

Usage:
  npm run db:remove-early-grade
  node src/scripts/remove_early_grade_program.js --apply
  node src/scripts/remove_early_grade_program.js --target --apply

Options:
  --apply     Write the cleanup.
  --target    Use TARGET_DATABASE_URL instead of DATABASE_URL.
`);
  process.exit(0);
}

const databaseUrl = useTarget ? process.env.TARGET_DATABASE_URL : process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(`${useTarget ? 'TARGET_DATABASE_URL' : 'DATABASE_URL'} is required.`);
}

const safeJson = (value) => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
);

const patchMetadata = (metadata = {}) => {
  const next = { ...safeJson(metadata) };
  if (next.program_name === LEGACY_PROGRAM_NAME) next.program_name = 'Early Childhood Education';
  if (next.program_category === LEGACY_CATEGORY) next.program_category = 'Early Childhood Education';
  return next;
};

const patchUserPreferences = (preferences = {}, eceId) => {
  const next = { ...safeJson(preferences) };
  const academicProfile = safeJson(next.academic_profile);
  if (!Object.keys(academicProfile).length) return next;

  next.academic_profile = {
    ...academicProfile,
    program_id: academicProfile.program_id ? eceId : academicProfile.program_id,
    ...(academicProfile.program_name === LEGACY_PROGRAM_NAME
      ? { program_name: 'Early Childhood Education' }
      : {}),
    ...(academicProfile.program_category === LEGACY_CATEGORY
      ? { program_category: 'Early Childhood Education' }
      : {})
  };
  return next;
};

function shouldUseSsl(connectionString) {
  const configured = String(
    useTarget ? process.env.TARGET_DATABASE_SSL : process.env.DATABASE_SSL
  ).trim().toLowerCase();
  if (['0', 'false', 'off', 'no'].includes(configured)) return false;
  if (['1', 'true', 'on', 'yes'].includes(configured)) return true;

  try {
    const hostname = new URL(connectionString).hostname.toLowerCase();
    return !['localhost', '127.0.0.1', '::1'].includes(hostname);
  } catch (_error) {
    return useTarget;
  }
}

async function getRows(client) {
  const { rows: programs } = await client.query(
    `SELECT id, key, name, category
     FROM public.programs
     WHERE key = $1 OR category = $2 OR name = $3
     ORDER BY key`,
    [LEGACY_PROGRAM_KEY, LEGACY_CATEGORY, LEGACY_PROGRAM_NAME]
  );
  const { rows: eceRows } = await client.query(
    `SELECT id, key, name, category
     FROM public.programs
     WHERE key = $1
     LIMIT 1`,
    [ECE_PROGRAM_KEY]
  );
  const legacyIds = programs.map((row) => row.id);

  if (!legacyIds.length) {
    return { programs, ece: eceRows[0] || null, users: [], profiles: [], sessions: [], offerings: [] };
  }

  const [users, profiles, sessions, offerings] = await Promise.all([
    client.query(
      `SELECT id, program_id, program, programme_category, preferences
       FROM public.users
       WHERE program_id = ANY($1::uuid[]) OR programme_category = $2`,
      [legacyIds, LEGACY_CATEGORY]
    ),
    client.query(
      `SELECT id, program_id, programme_category, metadata
       FROM public.academic_profiles
       WHERE program_id = ANY($1::uuid[]) OR programme_category = $2`,
      [legacyIds, LEGACY_CATEGORY]
    ),
    client.query(
      `SELECT id, program_id, programme_category, metadata
       FROM public.registration_sessions
       WHERE program_id = ANY($1::uuid[]) OR programme_category = $2`,
      [legacyIds, LEGACY_CATEGORY]
    ),
    client.query(
      `SELECT id, course_id, level, semester
       FROM public.course_offerings
       WHERE program_id = ANY($1::uuid[])`,
      [legacyIds]
    )
  ]);

  return {
    programs,
    ece: eceRows[0] || null,
    users: users.rows,
    profiles: profiles.rows,
    sessions: sessions.rows,
    offerings: offerings.rows
  };
}

function printPlan(rows) {
  console.log(`Mode: ${shouldApply ? 'apply' : 'dry-run'}`);
  console.log(`ECE target: ${rows.ece ? `${rows.ece.key} (${rows.ece.id})` : 'missing'}`);
  console.log(`Legacy programs to remove: ${rows.programs.length}`);
  rows.programs.forEach((row) => console.log(`  ${row.key} | ${row.category} | ${row.name}`));
  console.log(`Users to remap: ${rows.users.length}`);
  console.log(`Academic profiles to remap: ${rows.profiles.length}`);
  console.log(`Registration sessions to remap: ${rows.sessions.length}`);
  console.log(`Legacy offerings to move to ECE: ${rows.offerings.length}`);
}

async function updateUsers(client, rows, ece) {
  for (const row of rows) {
    await client.query(
      `UPDATE public.users
       SET program_id = $1,
           program = $2,
           programme_category = $3,
           preferences = $4::jsonb,
           updated_at = NOW()
       WHERE id = $5`,
      [
        ece.id,
        ece.name,
        'Early Childhood Education',
        JSON.stringify(patchUserPreferences(row.preferences, ece.id)),
        row.id
      ]
    );
  }
}

async function updateProfiles(client, rows, ece) {
  for (const row of rows) {
    await client.query(
      `UPDATE public.academic_profiles
       SET program_id = $1,
           programme_category = $2,
           metadata = $3::jsonb,
           updated_at = NOW()
       WHERE id = $4`,
      [ece.id, 'Early Childhood Education', JSON.stringify(patchMetadata(row.metadata)), row.id]
    );
  }
}

async function updateSessions(client, rows, ece) {
  for (const row of rows) {
    await client.query(
      `UPDATE public.registration_sessions
       SET program_id = $1,
           programme_category = $2,
           metadata = $3::jsonb,
           updated_at = NOW()
       WHERE id = $4`,
      [ece.id, 'Early Childhood Education', JSON.stringify(patchMetadata(row.metadata)), row.id]
    );
  }
}

async function moveOfferings(client, rows, ece) {
  for (const row of rows) {
    const duplicate = await client.query(
      `SELECT id
       FROM public.course_offerings
       WHERE program_id = $1
         AND course_id = $2
         AND level IS NOT DISTINCT FROM $3
         AND semester IS NOT DISTINCT FROM $4
       LIMIT 1`,
      [ece.id, row.course_id, row.level, row.semester]
    );

    if (duplicate.rows.length) {
      await client.query('DELETE FROM public.course_offerings WHERE id = $1', [row.id]);
      continue;
    }

    await client.query(
      'UPDATE public.course_offerings SET program_id = $1, updated_at = NOW() WHERE id = $2',
      [ece.id, row.id]
    );
  }
}

async function main() {
  const client = new Client(
    shouldUseSsl(databaseUrl)
      ? { connectionString: databaseUrl, ssl: { rejectUnauthorized: false } }
      : { connectionString: databaseUrl }
  );
  await client.connect();

  try {
    const rows = await getRows(client);
    printPlan(rows);

    if (!rows.programs.length) {
      console.log('No Early Grade program rows found.');
      return;
    }
    if (!rows.ece) {
      throw new Error(`Cannot remap Early Grade without the ${ECE_PROGRAM_KEY} program.`);
    }
    if (!shouldApply) {
      console.log('Dry-run complete. No rows were changed.');
      return;
    }

    await client.query('BEGIN');
    await updateUsers(client, rows.users, rows.ece);
    await updateProfiles(client, rows.profiles, rows.ece);
    await updateSessions(client, rows.sessions, rows.ece);
    await moveOfferings(client, rows.offerings, rows.ece);
    await client.query('DELETE FROM public.programs WHERE id = ANY($1::uuid[])', [
      rows.programs.map((row) => row.id)
    ]);
    await client.query('COMMIT');
    console.log('Early Grade cleanup committed.');
  } catch (error) {
    if (shouldApply) await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});

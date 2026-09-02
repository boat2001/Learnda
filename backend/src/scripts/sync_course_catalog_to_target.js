/* eslint-disable no-console */
require('../config/loadEnv').loadEnv();
const { Client } = require('pg');

const CATALOG_PROGRAM_CATEGORIES = ['ECE', 'Primary', 'JHS'];
const COURSE_COLUMNS = ['key', 'title', 'code', 'credits', 'department', 'metadata'];
const PROGRAM_COLUMNS = ['key', 'name', 'category', 'description', 'metadata'];
const OFFERING_COLUMNS = ['level', 'semester', 'files_path', 'metadata'];

const args = new Set(process.argv.slice(2));
const shouldApply = args.has('--apply');
const shouldDeleteMissingOfferings = args.has('--delete-missing-offerings');
const shouldSyncAllPrograms = args.has('--all-programs');
const showHelp = args.has('--help') || args.has('-h');

if (showHelp) {
  console.log(`
Sync course catalog rows from DATABASE_URL to TARGET_DATABASE_URL.

Default mode is a dry-run. The default program scope is ECE, Primary, and JHS.

Usage:
  npm run db:sync-course-catalog
  npm run db:sync-course-catalog -- --apply
  npm run db:sync-course-catalog -- --apply --delete-missing-offerings
  npm run db:sync-course-catalog -- --all-programs

Options:
  --apply                       Write program, course, and offering changes.
  --delete-missing-offerings    With --apply, remove target offerings in scope
                                that are absent from the source database.
  --all-programs                Sync every source program instead of only
                                ECE, Primary, and JHS program categories.
`);
  process.exit(0);
}

if (!process.env.DATABASE_URL || !process.env.TARGET_DATABASE_URL) {
  throw new Error('DATABASE_URL and TARGET_DATABASE_URL are required.');
}

const safeJson = (value) => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
);

const normalizedString = (value) => String(value ?? '');

const jsonString = (value) => JSON.stringify(safeJson(value));

const valuesEqual = (left, right, column) => (
  column === 'metadata'
    ? jsonString(left) === jsonString(right)
    : normalizedString(left) === normalizedString(right)
);

const listPreview = (label, rows, formatter) => {
  console.log(`${label}: ${rows.length}`);
  rows.slice(0, 15).forEach((row) => console.log(`  ${formatter(row)}`));
  if (rows.length > 15) console.log(`  ... ${rows.length - 15} more`);
};

const getChangedColumns = (source, target, columns) => (
  columns.filter((column) => !valuesEqual(source[column], target[column], column))
);

const getOfferingKey = ({ program_key: programKey, course_key: courseKey, level, semester }) => (
  [programKey, courseKey, normalizedString(level), normalizedString(semester)].join('::')
);

const getProgramKeyFilter = () => (
  shouldSyncAllPrograms
    ? { sql: '', values: [] }
    : {
        sql: 'WHERE category = ANY($1::text[])',
        values: [CATALOG_PROGRAM_CATEGORIES]
      }
);

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

async function fetchPrograms(client) {
  const filter = getProgramKeyFilter();
  const { rows } = await client.query(
    `SELECT id, ${PROGRAM_COLUMNS.join(', ')}
     FROM public.programs
     ${filter.sql}
     ORDER BY category, key`,
    filter.values
  );
  return rows;
}

async function fetchTargetPrograms(client, keys) {
  if (!keys.length) return [];
  const { rows } = await client.query(
    `SELECT id, ${PROGRAM_COLUMNS.join(', ')}
     FROM public.programs
     WHERE key = ANY($1::text[])`,
    [keys]
  );
  return rows;
}

async function fetchCourses(client, scopedProgramIds) {
  if (!scopedProgramIds.length) return [];
  const { rows } = await client.query(
    `SELECT DISTINCT c.id, ${COURSE_COLUMNS.map((column) => `c.${column}`).join(', ')}
     FROM public.courses c
     JOIN public.course_offerings co ON co.course_id = c.id
     WHERE co.program_id = ANY($1::uuid[])
     ORDER BY c.key`,
    [scopedProgramIds]
  );
  return rows;
}

async function fetchTargetCourses(client, keys) {
  if (!keys.length) return [];
  const { rows } = await client.query(
    `SELECT id, ${COURSE_COLUMNS.join(', ')}
     FROM public.courses
     WHERE key = ANY($1::text[])`,
    [keys]
  );
  return rows;
}

async function fetchOfferings(client, programKeys) {
  if (!programKeys.length) return [];
  const { rows } = await client.query(
    `SELECT
       co.id,
       p.key AS program_key,
       c.key AS course_key,
       ${OFFERING_COLUMNS.map((column) => `co.${column}`).join(', ')}
     FROM public.course_offerings co
     JOIN public.programs p ON p.id = co.program_id
     JOIN public.courses c ON c.id = co.course_id
     WHERE p.key = ANY($1::text[])
     ORDER BY p.key, co.level, co.semester, c.key`,
    [programKeys]
  );
  return rows;
}

async function insertProgram(target, row) {
  const { rows } = await target.query(
    `INSERT INTO public.programs (key, name, category, description, metadata, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, NOW(), NOW())
     RETURNING id, ${PROGRAM_COLUMNS.join(', ')}`,
    [row.key, row.name, row.category, row.description, jsonString(row.metadata)]
  );
  return rows[0];
}

async function updateProgram(target, targetRow, sourceRow, columns) {
  if (!columns.length) return targetRow;
  const values = columns.map((column) => (
    column === 'metadata' ? jsonString(sourceRow[column]) : sourceRow[column]
  ));
  values.push(targetRow.id);
  const assignments = columns.map((column, index) => (
    column === 'metadata'
      ? `${column} = $${index + 1}::jsonb`
      : `${column} = $${index + 1}`
  ));
  const { rows } = await target.query(
    `UPDATE public.programs
     SET ${assignments.join(', ')}, updated_at = NOW()
     WHERE id = $${values.length}
     RETURNING id, ${PROGRAM_COLUMNS.join(', ')}`,
    values
  );
  return rows[0];
}

async function insertCourse(target, row) {
  const { rows } = await target.query(
    `INSERT INTO public.courses (key, title, code, credits, department, metadata, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW(), NOW())
     RETURNING id, ${COURSE_COLUMNS.join(', ')}`,
    [row.key, row.title, row.code, row.credits, row.department, jsonString(row.metadata)]
  );
  return rows[0];
}

async function updateCourse(target, targetRow, sourceRow, columns) {
  if (!columns.length) return targetRow;
  const values = columns.map((column) => (
    column === 'metadata' ? jsonString(sourceRow[column]) : sourceRow[column]
  ));
  values.push(targetRow.id);
  const assignments = columns.map((column, index) => (
    column === 'metadata'
      ? `${column} = $${index + 1}::jsonb`
      : `${column} = $${index + 1}`
  ));
  const { rows } = await target.query(
    `UPDATE public.courses
     SET ${assignments.join(', ')}, updated_at = NOW()
     WHERE id = $${values.length}
     RETURNING id, ${COURSE_COLUMNS.join(', ')}`,
    values
  );
  return rows[0];
}

async function insertOffering(target, row, targetProgram, targetCourse) {
  const { rows } = await target.query(
    `INSERT INTO public.course_offerings (
       program_id, course_id, level, semester, files_path, metadata, created_at, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW(), NOW())
     RETURNING id`,
    [
      targetProgram.id,
      targetCourse.id,
      row.level,
      row.semester,
      row.files_path,
      jsonString(row.metadata)
    ]
  );
  return rows[0];
}

async function updateOffering(target, targetRow, sourceRow, columns) {
  if (!columns.length) return targetRow;
  const values = columns.map((column) => (
    column === 'metadata' ? jsonString(sourceRow[column]) : sourceRow[column]
  ));
  values.push(targetRow.id);
  const assignments = columns.map((column, index) => (
    column === 'metadata'
      ? `${column} = $${index + 1}::jsonb`
      : `${column} = $${index + 1}`
  ));
  const { rows } = await target.query(
    `UPDATE public.course_offerings
     SET ${assignments.join(', ')}, updated_at = NOW()
     WHERE id = $${values.length}
     RETURNING id`,
    values
  );
  return rows[0];
}

async function deleteOfferings(target, rows) {
  if (!rows.length) return;
  await target.query(
    'DELETE FROM public.course_offerings WHERE id = ANY($1::uuid[])',
    [rows.map((row) => row.id)]
  );
}

async function buildPlan(source, target) {
  const sourcePrograms = await fetchPrograms(source);
  const sourceProgramKeys = sourcePrograms.map((row) => row.key);
  const targetPrograms = await fetchTargetPrograms(target, sourceProgramKeys);
  const sourceCourses = await fetchCourses(source, sourcePrograms.map((row) => row.id));
  const targetCourses = await fetchTargetCourses(target, sourceCourses.map((row) => row.key));
  const [sourceOfferings, targetOfferings] = await Promise.all([
    fetchOfferings(source, sourceProgramKeys),
    fetchOfferings(target, sourceProgramKeys)
  ]);

  const targetProgramByKey = new Map(targetPrograms.map((row) => [row.key, row]));
  const targetCourseByKey = new Map(targetCourses.map((row) => [row.key, row]));
  const targetOfferingByKey = new Map(targetOfferings.map((row) => [getOfferingKey(row), row]));
  const sourceOfferingByKey = new Map(sourceOfferings.map((row) => [getOfferingKey(row), row]));

  const programsToCreate = [];
  const programsToUpdate = [];
  sourcePrograms.forEach((sourceRow) => {
    const targetRow = targetProgramByKey.get(sourceRow.key);
    if (!targetRow) {
      programsToCreate.push(sourceRow);
      return;
    }
    const columns = getChangedColumns(sourceRow, targetRow, PROGRAM_COLUMNS.filter((column) => column !== 'key'));
    if (columns.length) programsToUpdate.push({ sourceRow, targetRow, columns });
  });

  const coursesToCreate = [];
  const coursesToUpdate = [];
  sourceCourses.forEach((sourceRow) => {
    const targetRow = targetCourseByKey.get(sourceRow.key);
    if (!targetRow) {
      coursesToCreate.push(sourceRow);
      return;
    }
    const columns = getChangedColumns(sourceRow, targetRow, COURSE_COLUMNS.filter((column) => column !== 'key'));
    if (columns.length) coursesToUpdate.push({ sourceRow, targetRow, columns });
  });

  const offeringsToCreate = [];
  const offeringsToUpdate = [];
  sourceOfferings.forEach((sourceRow) => {
    const targetRow = targetOfferingByKey.get(getOfferingKey(sourceRow));
    if (!targetRow) {
      offeringsToCreate.push(sourceRow);
      return;
    }
    const columns = getChangedColumns(sourceRow, targetRow, OFFERING_COLUMNS);
    if (columns.length) offeringsToUpdate.push({ sourceRow, targetRow, columns });
  });

  const offeringsToDelete = targetOfferings.filter((targetRow) => (
    !sourceOfferingByKey.has(getOfferingKey(targetRow))
  ));

  return {
    sourcePrograms,
    sourceCourses,
    sourceOfferings,
    targetPrograms,
    targetCourses,
    targetOfferings,
    programsToCreate,
    programsToUpdate,
    coursesToCreate,
    coursesToUpdate,
    offeringsToCreate,
    offeringsToUpdate,
    offeringsToDelete
  };
}

function printPlan(plan) {
  console.log(`Mode: ${shouldApply ? 'apply' : 'dry-run'}`);
  console.log(`Program scope: ${shouldSyncAllPrograms ? 'all source programs' : CATALOG_PROGRAM_CATEGORIES.join(', ')}`);
  console.log(
    `Source rows: ${plan.sourcePrograms.length} programs, ${plan.sourceCourses.length} courses, ${plan.sourceOfferings.length} offerings`
  );
  console.log(
    `Target rows in scope: ${plan.targetPrograms.length} programs, ${plan.targetCourses.length} matching courses, ${plan.targetOfferings.length} offerings`
  );

  listPreview('Programs to create', plan.programsToCreate, (row) => `${row.key} | ${row.category} | ${row.name}`);
  listPreview('Programs to update', plan.programsToUpdate, ({ sourceRow, columns }) => `${sourceRow.key} | ${columns.join(', ')}`);
  listPreview('Courses to create', plan.coursesToCreate, (row) => `${row.key} | ${row.code || '-'} | ${row.title}`);
  listPreview('Courses to update', plan.coursesToUpdate, ({ sourceRow, columns }) => `${sourceRow.key} | ${sourceRow.code || '-'} | ${columns.join(', ')}`);
  listPreview(
    'Offerings to create',
    plan.offeringsToCreate,
    (row) => `${row.program_key} | ${row.course_key} | level ${row.level || '-'} | semester ${row.semester || '-'}`
  );
  listPreview(
    'Offerings to update',
    plan.offeringsToUpdate,
    ({ sourceRow, columns }) => `${sourceRow.program_key} | ${sourceRow.course_key} | ${columns.join(', ')}`
  );
  listPreview(
    'Offerings missing from source',
    plan.offeringsToDelete,
    (row) => `${row.program_key} | ${row.course_key} | level ${row.level || '-'} | semester ${row.semester || '-'}`
  );

  if (plan.offeringsToDelete.length && !shouldDeleteMissingOfferings) {
    console.log('Missing target offerings are only reported. Pass --delete-missing-offerings with --apply to remove them.');
  }
}

async function applyPlan(target, plan) {
  const targetProgramByKey = new Map(plan.targetPrograms.map((row) => [row.key, row]));
  const targetCourseByKey = new Map(plan.targetCourses.map((row) => [row.key, row]));

  for (const row of plan.programsToCreate) {
    targetProgramByKey.set(row.key, await insertProgram(target, row));
  }
  for (const row of plan.programsToUpdate) {
    targetProgramByKey.set(
      row.sourceRow.key,
      await updateProgram(target, row.targetRow, row.sourceRow, row.columns)
    );
  }

  for (const row of plan.coursesToCreate) {
    targetCourseByKey.set(row.key, await insertCourse(target, row));
  }
  for (const row of plan.coursesToUpdate) {
    targetCourseByKey.set(
      row.sourceRow.key,
      await updateCourse(target, row.targetRow, row.sourceRow, row.columns)
    );
  }

  for (const row of plan.offeringsToCreate) {
    const targetProgram = targetProgramByKey.get(row.program_key);
    const targetCourse = targetCourseByKey.get(row.course_key);
    if (!targetProgram || !targetCourse) {
      throw new Error(`Missing mapped target rows for offering ${getOfferingKey(row)}.`);
    }
    await insertOffering(target, row, targetProgram, targetCourse);
  }
  for (const row of plan.offeringsToUpdate) {
    await updateOffering(target, row.targetRow, row.sourceRow, row.columns);
  }
  if (shouldDeleteMissingOfferings) {
    await deleteOfferings(target, plan.offeringsToDelete);
  }
}

async function main() {
  const source = new Client({ connectionString: process.env.DATABASE_URL });
  const target = new Client(
    shouldUseTargetSsl(process.env.TARGET_DATABASE_URL)
      ? {
          connectionString: process.env.TARGET_DATABASE_URL,
          ssl: { rejectUnauthorized: false }
        }
      : { connectionString: process.env.TARGET_DATABASE_URL }
  );

  await source.connect();
  await target.connect();

  try {
    const plan = await buildPlan(source, target);
    printPlan(plan);

    if (!shouldApply) {
      console.log('Dry-run complete. No target rows were changed.');
      return;
    }

    await target.query('BEGIN');
    await applyPlan(target, plan);
    await target.query('COMMIT');
    console.log('Course catalog sync committed.');
  } catch (error) {
    if (shouldApply) await target.query('ROLLBACK');
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

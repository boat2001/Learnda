// The class-level ordering exists twice: in educationStructure.js (application
// access checks) and in the learning_units migration (database CHECK constraints).
// If those two ever disagree, the database would permit content the app treats as
// locked, or reject rows the app treats as valid. These tests parse the SQL and
// assert both copies still describe the same structure.
//
// They do not execute the SQL -- that needs a live Postgres.

const fs = require('fs');
const path = require('path');
const E = require('../educationStructure');

const SQL_PATH = path.join(__dirname, '../../../migrations/20260902_learning_units.sql');
const sql = fs.readFileSync(SQL_PATH, 'utf8');

/** Pulls the body of a `CREATE OR REPLACE FUNCTION <name>` block. */
const functionBody = (name) => {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION ${name}(`);
  if (start === -1) throw new Error(`function ${name} not found in migration`);
  const open = sql.indexOf('AS $$', start);
  const close = sql.indexOf('$$;', open);
  return sql.slice(open + 5, close);
};

describe('migration enums match the canonical structure', () => {
  const enumMembers = (typeName) => {
    const start = sql.indexOf(`CREATE TYPE ${typeName} AS ENUM`);
    if (start === -1) throw new Error(`type ${typeName} not found in migration`);
    const body = sql.slice(sql.indexOf('(', start) + 1, sql.indexOf(')', start));
    return body.split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
  };

  it('level_group enum matches LEVEL_GROUPS', () => {
    expect(enumMembers('enum_learning_units_level_group')).toEqual([...E.LEVEL_GROUP_VALUES]);
  });

  it('learning_type enum matches LEARNING_TYPES', () => {
    expect(enumMembers('enum_learning_units_learning_type')).toEqual(Object.values(E.LEARNING_TYPES));
  });

  it('category enum matches LEARNING_UNIT_CATEGORIES', () => {
    expect(enumMembers('enum_learning_units_category')).toEqual(Object.values(E.LEARNING_UNIT_CATEGORIES));
  });

  it.each(['enum_learning_units_from_class', 'enum_learning_units_to_class'])(
    '%s lists every class level in §2.3 progression order',
    (typeName) => {
      expect(enumMembers(typeName)).toEqual([...E.CLASS_LEVEL_CODES]);
    }
  );
});

describe('class_level_ordinal() agrees with getOrdinal()', () => {
  const body = functionBody('class_level_ordinal');
  const sqlOrdinals = Object.fromEntries(
    [...body.matchAll(/WHEN\s+'([A-Z0-9]+)'\s+THEN\s+(\d+)/g)].map(([, code, n]) => [code, Number(n)])
  );

  it('covers every class level exactly once', () => {
    expect(Object.keys(sqlOrdinals).sort()).toEqual([...E.CLASS_LEVEL_CODES].sort());
  });

  it.each(E.CLASS_LEVEL_CODES)('assigns %s the same ordinal as the JS config', (code) => {
    expect(sqlOrdinals[code]).toBe(E.getOrdinal(code));
  });
});

describe('class_level_group() agrees with getLevelGroup()', () => {
  const body = functionBody('class_level_group');
  const sqlGroups = {};
  for (const [, list, group] of body.matchAll(/WHEN\s+code\s+IN\s+\(([^)]*)\)\s+THEN\s+'([A-Z]+)'/g)) {
    list.split(',').map((s) => s.trim().replace(/'/g, '')).forEach((code) => { sqlGroups[code] = group; });
  }

  it('covers every class level exactly once', () => {
    expect(Object.keys(sqlGroups).sort()).toEqual([...E.CLASS_LEVEL_CODES].sort());
  });

  it.each(E.CLASS_LEVEL_CODES)('puts %s in the same level group as the JS config', (code) => {
    expect(sqlGroups[code]).toBe(E.getLevelGroup(code));
  });
});

describe('the migration keeps the guide\'s hard rules enforceable in SQL', () => {
  it('§1.1 never mentions a P1-P6 class code', () => {
    expect(sql).not.toMatch(/'P[1-6]'/);
  });

  it('constrains the class band to run forwards', () => {
    expect(sql).toContain('learning_units_band_ordered_check');
    expect(sql).toMatch(/class_level_ordinal\(from_class::TEXT\)\s*<=\s*class_level_ordinal\(to_class::TEXT\)/);
  });

  it('constrains the class band to stay inside its level group', () => {
    expect(sql).toContain('learning_units_band_in_group_check');
  });

  it('§3.1 constrains KG to LEARNING_AREA and everything else to SUBJECT', () => {
    expect(sql).toContain('learning_units_type_matches_group_check');
    expect(sql).toMatch(/level_group\s*=\s*'KINDERGARTEN'\s*AND\s*learning_type\s*=\s*'LEARNING_AREA'/);
    expect(sql).toMatch(/level_group\s*<>\s*'KINDERGARTEN'\s*AND\s*learning_type\s*=\s*'SUBJECT'/);
  });

  it('scopes the slug uniqueness to level group, not globally', () => {
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS learning_units_slug_level_group_uidx\s+ON learning_units \(slug, level_group\)/);
  });

  it('is re-runnable: every DDL statement guards against existing objects', () => {
    const creates = [...sql.matchAll(/^\s*CREATE (TABLE|(?:UNIQUE )?INDEX)([^;]*)/gm)];
    expect(creates.length).toBeGreaterThan(0);
    creates.forEach(([stmt]) => expect(stmt).toContain('IF NOT EXISTS'));
    [...sql.matchAll(/CREATE TYPE (\w+)/g)].forEach(([, typeName]) => {
      expect(sql).toContain(`WHERE typname = '${typeName}'`);
    });
  });
});

// Locks the §5 / §6.3 access rules. The invariant these protect: a learner can
// never reach content above their own class, and every ambiguous input resolves
// to "show nothing" rather than "show everything".
const { Op } = require('sequelize');
const S = require('../subjectAccessService');
const { CLASS_LEVEL_CODES, ACCESS_MODES, getOrdinal } = require('../../config/educationStructure');

describe('§5 buildClassScopeWhere', () => {
  it('includes the learner class and everything below it', () => {
    expect(S.buildClassScopeWhere('B2').class_level_code[Op.in]).toEqual(['KG1', 'KG2', 'B1', 'B2']);
  });

  it('can narrow to the current class only', () => {
    expect(S.buildClassScopeWhere('B2', { includeRevision: false }).class_level_code[Op.in]).toEqual(['B2']);
  });

  it('matches nothing for a learner with no placement', () => {
    // The important half: an unplaced learner must not fall through to "all rows".
    expect(S.buildClassScopeWhere(null).class_level_code[Op.in]).toEqual([]);
    expect(S.buildClassScopeWhere(undefined).class_level_code[Op.in]).toEqual([]);
    expect(S.buildClassScopeWhere('').class_level_code[Op.in]).toEqual([]);
  });

  it('matches nothing for a banned P1-P6 code', () => {
    expect(S.buildClassScopeWhere('P3').class_level_code[Op.in]).toEqual([]);
  });

  it('never includes a class above the learner, at any level', () => {
    CLASS_LEVEL_CODES.forEach((learner) => {
      const allowed = S.buildClassScopeWhere(learner).class_level_code[Op.in];
      allowed.forEach((code) => {
        expect(getOrdinal(code)).toBeLessThanOrEqual(getOrdinal(learner));
      });
    });
  });
});

describe('§6.3 getClassLevelAccessMap', () => {
  const map = S.getClassLevelAccessMap('B3');

  it('returns every class level, in progression order', () => {
    expect(map).toHaveLength(CLASS_LEVEL_CODES.length);
    expect(map.map((m) => m.code)).toEqual([...CLASS_LEVEL_CODES]);
  });

  it('marks the learner class CURRENT, past REVISION, future LOCKED', () => {
    expect(map.find((m) => m.code === 'B3').access).toBe(ACCESS_MODES.CURRENT);
    expect(map.find((m) => m.code === 'B1').access).toBe(ACCESS_MODES.REVISION);
    expect(map.find((m) => m.code === 'B4').access).toBe(ACCESS_MODES.LOCKED);
    expect(map.find((m) => m.code === 'SHS3').access).toBe(ACCESS_MODES.LOCKED);
  });

  it('carries the "available next academic year" note on locked levels only', () => {
    expect(map.find((m) => m.code === 'B4').note).toBe('Available next academic year');
    expect(map.find((m) => m.code === 'B1').note).toBeNull();
    expect(map.find((m) => m.code === 'B3').note).toBeNull();
  });

  it('returns nothing for an unplaced learner', () => {
    expect(S.getClassLevelAccessMap(null)).toEqual([]);
    expect(S.getClassLevelAccessMap('P5')).toEqual([]);
  });
});

describe('resolvePlacement', () => {
  it('reads a nested academic_profile, a bare profile, or a Sequelize instance', () => {
    expect(S.resolvePlacement({ academic_profile: { class_level: 'JHS2' } }).classLevel).toBe('JHS2');
    expect(S.resolvePlacement({ class_level: 'B5' }).classLevel).toBe('B5');
    expect(S.resolvePlacement({ get: () => ({ class_level: 'SHS1', pathway_id: 'p1' }) }).pathwayId).toBe('p1');
  });

  it('derives the level group from the class', () => {
    expect(S.resolvePlacement({ class_level: 'KG2' }).levelGroup).toBe('KINDERGARTEN');
    expect(S.resolvePlacement({ class_level: 'B4' }).levelGroup).toBe('PRIMARY');
    expect(S.resolvePlacement({ class_level: 'SHS3' }).levelGroup).toBe('SHS');
  });

  it('returns null rather than a partial placement', () => {
    expect(S.resolvePlacement(null)).toBeNull();
    expect(S.resolvePlacement({})).toBeNull();
    expect(S.resolvePlacement({ class_level: null })).toBeNull();
    expect(S.resolvePlacement({ class_level: 'P4' })).toBeNull();
  });
});

describe('canOpenContent', () => {
  it('allows own and past classes, denies future ones', () => {
    expect(S.canOpenContent('B3', 'B3')).toBe(true);
    expect(S.canOpenContent('B3', 'KG1')).toBe(true);
    expect(S.canOpenContent('B3', 'B4')).toBe(false);
    expect(S.canOpenContent('JHS1', 'JHS2')).toBe(false);
  });

  it('denies everything when either side is unknown', () => {
    expect(S.canOpenContent(null, 'B1')).toBe(false);
    expect(S.canOpenContent('B3', null)).toBe(false);
  });
});

describe('groupUnitsByRuleGroup', () => {
  it('buckets units by their pathway rule group', () => {
    const grouped = S.groupUnitsByRuleGroup([
      { slug: 'mathematics', rule_group: 'CORE' },
      { slug: 'english', rule_group: 'CORE' },
      { slug: 'biology', rule_group: 'SCIENCE_ELECTIVE' },
    ]);
    expect(grouped.CORE.map((u) => u.slug)).toEqual(['mathematics', 'english']);
    expect(grouped.SCIENCE_ELECTIVE.map((u) => u.slug)).toEqual(['biology']);
    expect(grouped.HUMANITIES_ELECTIVE).toEqual([]);
  });

  it('defaults an untagged unit to CORE rather than dropping it', () => {
    const grouped = S.groupUnitsByRuleGroup([{ slug: 'mathematics' }]);
    expect(grouped.CORE.map((u) => u.slug)).toEqual(['mathematics']);
  });
});

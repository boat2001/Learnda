// Locks the education structure to the rules in learnda-dev-guide.md.
// Every case here mirrors an example stated in the guide; if one of these
// fails, the app is violating the guide, not merely changing shape.

const E = require('../educationStructure');

describe('§2.3 class levels and UI order', () => {
  it('exposes the 14 class levels in the mandatory UI order', () => {
    expect(E.CLASS_LEVEL_CODES).toEqual([
      'KG1', 'KG2',
      'B1', 'B2', 'B3', 'B4', 'B5', 'B6',
      'JHS1', 'JHS2', 'JHS3',
      'SHS1', 'SHS2', 'SHS3',
    ]);
  });

  it('§1.1 uses Basic 1-6, never P1-P6', () => {
    expect(E.CLASS_LEVEL_CODES.filter((c) => /^P[1-6]$/i.test(c))).toEqual([]);
    ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'].forEach((code) => {
      expect(E.isBannedClassCode(code)).toBe(true);
      expect(E.isValidClassLevel(code)).toBe(false);
    });
  });

  it('normalizes loose user input to canonical codes', () => {
    expect(E.normalizeClassLevelCode('kg 1')).toBe('KG1');
    expect(E.normalizeClassLevelCode('shs-2')).toBe('SHS2');
    expect(E.normalizeClassLevelCode(' b3 ')).toBe('B3');
    expect(E.normalizeClassLevelCode('nonsense')).toBeNull();
    expect(E.normalizeClassLevelCode(null)).toBeNull();
  });
});

describe('§6.4 promotion follows the real school timeline', () => {
  it.each([
    ['KG1', 'KG2'],
    ['KG2', 'B1'],
    ['B3', 'B4'],
    ['B6', 'JHS1'],
    ['JHS3', 'SHS1'],
  ])('promotes %s to %s', (from, to) => {
    expect(E.getNextClassLevel(from)).toBe(to);
  });

  it('treats SHS3 as terminal', () => {
    expect(E.getNextClassLevel('SHS3')).toBeNull();
    expect(E.isTerminalClassLevel('SHS3')).toBe(true);
  });

  it('walks backwards for revision navigation', () => {
    expect(E.getPreviousClassLevel('B1')).toBe('KG2');
    expect(E.getPreviousClassLevel('KG1')).toBeNull();
  });
});

describe('§6.3 access rules for a Basic 3 learner', () => {
  it('grants KG1 through B3 and locks B4 upward', () => {
    expect(E.getAccessibleClassLevels('B3')).toEqual(['KG1', 'KG2', 'B1', 'B2', 'B3']);
    expect(E.getLockedClassLevels('B3')).toEqual([
      'B4', 'B5', 'B6', 'JHS1', 'JHS2', 'JHS3', 'SHS1', 'SHS2', 'SHS3',
    ]);
  });

  it('classifies own / past / future content', () => {
    expect(E.getAccessMode('B3', 'B3')).toBe(E.ACCESS_MODES.CURRENT);
    expect(E.getAccessMode('B3', 'B1')).toBe(E.ACCESS_MODES.REVISION);
    expect(E.getAccessMode('B3', 'B4')).toBe(E.ACCESS_MODES.LOCKED);
  });

  it('§4.3 keeps JHS1 out of JHS2 and JHS3 content', () => {
    expect(E.getAccessMode('JHS1', 'JHS1')).toBe(E.ACCESS_MODES.CURRENT);
    expect(E.getAccessMode('JHS1', 'JHS2')).toBe(E.ACCESS_MODES.LOCKED);
    expect(E.getAccessMode('JHS1', 'JHS3')).toBe(E.ACCESS_MODES.LOCKED);
  });

  it('locks unknown or missing codes rather than exposing content', () => {
    expect(E.getAccessMode('B3', 'ZZ9')).toBe(E.ACCESS_MODES.LOCKED);
    expect(E.getAccessMode('B3', null)).toBe(E.ACCESS_MODES.LOCKED);
    expect(E.getAccessMode(null, 'B1')).toBe(E.ACCESS_MODES.LOCKED);
    expect(E.getAccessMode(undefined, undefined)).toBe(E.ACCESS_MODES.LOCKED);
    expect(E.getAccessibleClassLevels('P3')).toEqual([]);
  });

  it('never reports a future class as accessible, at any level', () => {
    E.CLASS_LEVEL_CODES.forEach((learner) => {
      E.CLASS_LEVEL_CODES.forEach((content) => {
        const ahead = E.getOrdinal(content) > E.getOrdinal(learner);
        expect(E.canAccessClassLevel(learner, content)).toBe(!ahead);
      });
    });
  });
});

describe('§3.1 learning types', () => {
  it('teaches Learning Areas in KG and Subjects everywhere else', () => {
    expect(E.getLearningType('KG1')).toBe(E.LEARNING_TYPES.LEARNING_AREA);
    expect(E.getLearningType('KG2')).toBe(E.LEARNING_TYPES.LEARNING_AREA);
    ['B1', 'B6', 'JHS1', 'JHS3', 'SHS1', 'SHS3'].forEach((code) => {
      expect(E.getLearningType(code)).toBe(E.LEARNING_TYPES.SUBJECT);
    });
  });
});

describe('§7 feature gating by level', () => {
  it('§4.1 gives Kindergarten no exams, quizzes, community or messaging', () => {
    ['exams', 'quizzes', 'community', 'messaging'].forEach((feature) => {
      expect(E.getFeatureAccessForClass(feature, 'KG1')).toBe(E.FEATURE_ACCESS.OFF);
      expect(E.getFeatureAccessForClass(feature, 'KG2')).toBe(E.FEATURE_ACCESS.OFF);
    });
  });

  it('§4.1 keeps audio, animation and offline on for Kindergarten', () => {
    ['audioLessons', 'animations', 'offlineAccess'].forEach((feature) => {
      expect(E.getFeatureAccessForClass(feature, 'KG1')).toBe(E.FEATURE_ACCESS.ON);
    });
  });

  it('matches the §7 gating matrix', () => {
    expect(E.getFeatureAccessForClass('exams', 'B4')).toBe(E.FEATURE_ACCESS.LIMITED);
    expect(E.getFeatureAccessForClass('exams', 'JHS1')).toBe(E.FEATURE_ACCESS.ON);
    expect(E.getFeatureAccessForClass('quizzes', 'B1')).toBe(E.FEATURE_ACCESS.ON);
    expect(E.getFeatureAccessForClass('community', 'B6')).toBe(E.FEATURE_ACCESS.OFF);
    expect(E.getFeatureAccessForClass('community', 'JHS2')).toBe(E.FEATURE_ACCESS.LIMITED);
    expect(E.getFeatureAccessForClass('messaging', 'JHS3')).toBe(E.FEATURE_ACCESS.OFF);
    expect(E.getFeatureAccessForClass('messaging', 'SHS1')).toBe(E.FEATURE_ACCESS.LIMITED);
  });

  it('denies unknown features and unknown level groups', () => {
    expect(E.getFeatureAccess('teleportation', 'JHS')).toBe(E.FEATURE_ACCESS.OFF);
    expect(E.getFeatureAccess('exams', 'UNIVERSITY')).toBe(E.FEATURE_ACCESS.OFF);
    expect(E.getFeatureAccessForClass('exams', 'P3')).toBe(E.FEATURE_ACCESS.OFF);
  });
});

describe('§6.2 academic year', () => {
  it('runs September to August, Ghana school calendar', () => {
    expect(E.getAcademicYearLabel(new Date('2025-09-01'))).toBe('2025/2026');
    expect(E.getAcademicYearLabel(new Date('2025-12-31'))).toBe('2025/2026');
    expect(E.getAcademicYearLabel(new Date('2026-03-15'))).toBe('2025/2026');
    expect(E.getAcademicYearLabel(new Date('2026-08-31'))).toBe('2025/2026');
    expect(E.getAcademicYearLabel(new Date('2026-09-01'))).toBe('2026/2027');
  });

  it('validates the academic year format', () => {
    expect(E.isValidAcademicYear('2025/2026')).toBe(true);
    expect(E.isValidAcademicYear('2025-2026')).toBe(false);
    expect(E.isValidAcademicYear('')).toBe(false);
  });

  it('offers exactly three terms', () => {
    expect(E.ACADEMIC_TERMS).toEqual(['Term 1', 'Term 2', 'Term 3']);
  });
});

describe('structure integrity', () => {
  it('assigns contiguous ordinals matching array position', () => {
    E.CLASS_LEVELS.forEach((level, index) => expect(level.ordinal).toBe(index));
  });

  it('groups every class level under exactly one level group', () => {
    const grouped = E.LEVEL_GROUP_VALUES.flatMap((g) => E.CLASS_LEVELS_BY_GROUP[g].map((l) => l.code));
    expect(grouped.sort()).toEqual([...E.CLASS_LEVEL_CODES].sort());
  });

  it('keeps each level group contiguous in progression order', () => {
    E.LEVEL_GROUP_VALUES.forEach((group) => {
      const ordinals = E.CLASS_LEVELS_BY_GROUP[group].map((l) => l.ordinal);
      ordinals.forEach((o, i) => { if (i > 0) expect(o).toBe(ordinals[i - 1] + 1); });
    });
  });

  it('freezes the canonical tables against mutation', () => {
    expect(Object.isFrozen(E.CLASS_LEVELS)).toBe(true);
    expect(Object.isFrozen(E.LEVEL_GROUPS)).toBe(true);
    expect(Object.isFrozen(E.FEATURE_GATES)).toBe(true);
  });
});

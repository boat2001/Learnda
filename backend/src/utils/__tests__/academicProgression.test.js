// Locks §6.1/§6.4/§6.5: learners advance only when the academic year advances,
// one class at a time, and never by their own action.
const P = require('../academicProgression');

const profile = (overrides = {}) => ({
  class_level: 'B3',
  academic_year: '2025/2026',
  status: 'ACTIVE',
  auto_progression: true,
  ...overrides,
});

const MID_YEAR = new Date('2026-03-15');   // same academic year
const NEXT_YEAR = new Date('2026-09-15');  // year has turned

describe('§6.1 advancement is tied to the academic year', () => {
  it('does not promote mid-year', () => {
    expect(P.maybeAdvanceAcademicProgress(profile(), MID_YEAR)).toBeNull();
  });

  it('promotes once the academic year turns', () => {
    const r = P.maybeAdvanceAcademicProgress(profile(), NEXT_YEAR);
    expect(r.class_level).toBe('B4');
    expect(r.academic_year).toBe('2026/2027');
    expect(r.term).toBe('Term 1');
    expect(r.status).toBe('ACTIVE');
    expect(r.promoted_at).toEqual(NEXT_YEAR);
  });

  it('ignores a clock that appears to run backwards', () => {
    expect(P.maybeAdvanceAcademicProgress(profile({ academic_year: '2030/2031' }), NEXT_YEAR)).toBeNull();
  });
});

describe('§6.4 promotion follows the real timeline', () => {
  it.each([
    ['KG1', 'KG2'],
    ['KG2', 'B1'],
    ['B6', 'JHS1'],
    ['JHS3', 'SHS1'],
  ])('moves %s to %s, crossing level groups correctly', (from, to) => {
    expect(P.maybeAdvanceAcademicProgress(profile({ class_level: from }), NEXT_YEAR).class_level).toBe(to);
  });

  it('never promotes past SHS3', () => {
    expect(P.maybeAdvanceAcademicProgress(profile({ class_level: 'SHS3' }), NEXT_YEAR)).toBeNull();
  });

  it('respects a disabled auto_progression', () => {
    expect(P.maybeAdvanceAcademicProgress(profile({ auto_progression: false }), NEXT_YEAR)).toBeNull();
  });

  it('holds a REPEATED learner in place until cleared', () => {
    expect(P.maybeAdvanceAcademicProgress(profile({ status: 'REPEATED' }), NEXT_YEAR)).toBeNull();
  });

  it('ignores profiles with an unusable class or year', () => {
    expect(P.maybeAdvanceAcademicProgress(profile({ class_level: 'P3' }), NEXT_YEAR)).toBeNull();
    expect(P.maybeAdvanceAcademicProgress(profile({ academic_year: '2025-2026' }), NEXT_YEAR)).toBeNull();
    expect(P.maybeAdvanceAcademicProgress(null, NEXT_YEAR)).toBeNull();
  });
});

describe('multi-year gaps are capped, not collapsed', () => {
  it('advances exactly one class however long the gap', () => {
    // Profile sits in 2025/2026; Sept 2029 is academic year 2029/2030, so four
    // years have passed. A learner dormant four years did not attend four grades.
    const r = P.maybeAdvanceAcademicProgress(profile(), new Date('2029-09-15'));
    expect(r.class_level).toBe('B4');
    expect(r.needs_review).toBe(true);
    expect(r.years_elapsed).toBe(4);
  });

  it('does not flag an ordinary one-year advance', () => {
    expect(P.maybeAdvanceAcademicProgress(profile(), NEXT_YEAR).needs_review).toBe(false);
  });
});

describe('§6.5 manual overrides are role-gated and audited', () => {
  it('refuses a learner promoting themselves', () => {
    expect(P.buildManualOverride({
      actorRole: 'student', actorUserId: 'u1', toClassLevel: 'SHS3', reason: 'I am ready',
    })).toBeNull();
  });

  it.each(['admin', 'parent', 'school'])('allows a %s override', (role) => {
    const ov = P.buildManualOverride({
      actorRole: role, actorUserId: 'u1', toClassLevel: 'B6', reason: 'Repeated B5 at school',
    });
    expect(ov.patch.class_level).toBe('B6');
    expect(ov.patch.level_group).toBe('PRIMARY');
    expect(ov.audit.actor_role).toBe(role);
    expect(ov.audit.reason).toBe('Repeated B5 at school');
  });

  it('requires a reason, so every override is explainable', () => {
    expect(P.buildManualOverride({ actorRole: 'admin', actorUserId: 'u1', toClassLevel: 'B6', reason: '   ' })).toBeNull();
    expect(P.buildManualOverride({ actorRole: 'admin', actorUserId: 'u1', toClassLevel: 'B6' })).toBeNull();
  });

  it('rejects an invalid target class', () => {
    expect(P.buildManualOverride({ actorRole: 'admin', actorUserId: 'u1', toClassLevel: 'P6', reason: 'x' })).toBeNull();
  });
});

describe('academic year arithmetic', () => {
  it('orders and subtracts year labels', () => {
    expect(P.academicYearStart('2025/2026')).toBe(2025);
    expect(P.academicYearStart('nonsense')).toBeNull();
    expect(P.academicYearsBetween('2025/2026', '2027/2028')).toBe(2);
    expect(P.academicYearsBetween('2027/2028', '2025/2026')).toBe(-2);
  });
});

// The frontend keeps its own copy of the education structure (separate package,
// no shared build). Drift between the two is the dangerous kind of bug: the UI
// would offer a class or feature the API refuses, or hide one it allows.
//
// These tests parse the frontend module as text and assert it still describes
// the same structure as the backend authority.

const fs = require('fs');
const path = require('path');
const E = require('../educationStructure');

const MIRROR_PATH = path.join(__dirname, '../../../../frontend/src/constants/education.js');
const mirror = fs.readFileSync(MIRROR_PATH, 'utf8');

describe('frontend education mirror', () => {
  it('lists the same class levels, in the same §2.3 order', () => {
    const codes = [...mirror.matchAll(/\{ code: '([A-Z0-9]+)', label: '([^']+)', levelGroup: '([A-Z]+)' \}/g)]
      .map(([, code]) => code);
    expect(codes).toEqual([...E.CLASS_LEVEL_CODES]);
  });

  it('gives each class the same label and level group', () => {
    const rows = [...mirror.matchAll(/\{ code: '([A-Z0-9]+)', label: '([^']+)', levelGroup: '([A-Z]+)' \}/g)];
    rows.forEach(([, code, label, group]) => {
      const backend = E.getClassLevel(code);
      expect(backend).not.toBeNull();
      expect(label).toBe(backend.label);
      expect(group).toBe(backend.levelGroup);
    });
  });

  it('declares the same level groups', () => {
    const groups = [...mirror.matchAll(/^ {2}([A-Z]+): '([A-Z]+)',$/gm)]
      .filter(([, key, value]) => key === value)
      .map(([, key]) => key);
    expect(groups).toEqual(expect.arrayContaining([...E.LEVEL_GROUP_VALUES]));
  });

  it('applies the same §7 feature gates', () => {
    const block = mirror.slice(mirror.indexOf('export const FEATURE_GATES'), mirror.indexOf('/** Unknown feature'));
    const rows = [...block.matchAll(
      /(\w+):\s\{\sKINDERGARTEN:\s'(\w+)',\sPRIMARY:\s'(\w+)',\sJHS:\s'(\w+)',\sSHS:\s'(\w+)'\s\}/g
    )];
    expect(rows.length).toBeGreaterThan(0);

    rows.forEach(([, feature, kg, primary, jhs, shs]) => {
      // studyGroups is a frontend-only rollup of the community gate; the guide's
      // §7 matrix has no separate row for it.
      if (feature === 'studyGroups') {
        expect([kg, primary, jhs, shs]).toEqual(['off', 'off', 'limited', 'limited']);
        return;
      }
      expect(E.FEATURE_KEYS).toContain(feature);
      expect(kg).toBe(E.getFeatureAccess(feature, 'KINDERGARTEN'));
      expect(primary).toBe(E.getFeatureAccess(feature, 'PRIMARY'));
      expect(jhs).toBe(E.getFeatureAccess(feature, 'JHS'));
      expect(shs).toBe(E.getFeatureAccess(feature, 'SHS'));
    });
  });

  it('covers every backend feature key', () => {
    E.FEATURE_KEYS.forEach((key) => {
      expect(mirror).toContain(`${key}: {`);
    });
  });

  it('§1.1 never mentions a P1-P6 class code', () => {
    expect(mirror).not.toMatch(/code: 'P[1-6]'/);
  });

  it('§9 calls KG units Learning Areas and everything else Subjects', () => {
    expect(mirror).toContain("singular: 'Learning Area', plural: 'Learning Areas'");
    expect(mirror).toContain("singular: 'Subject', plural: 'Subjects'");
    // "Course" is a tertiary word and must not reappear as UI vocabulary.
    expect(mirror).not.toMatch(/plural: 'Courses'/);
  });

  it('gives every level group a §8 presentation mode', () => {
    E.LEVEL_GROUP_VALUES.forEach((group) => {
      expect(mirror).toMatch(new RegExp(`${group}: \\{\\s*\\n\\s*mode:`));
    });
  });
});

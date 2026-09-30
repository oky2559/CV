import { describe, expect, test } from 'vitest';
import raw from '../../src/data/cv.json';
import { buildCV, getCV, parseCV } from '../../src/lib/cv';

const clone = () => structuredClone(raw) as any;

describe('validation', () => {
  test('le cv.json fourni est accepté', () => {
    expect(() => parseCV(raw)).not.toThrow();
  });

  test('champ manquant : erreur lisible avec le chemin', () => {
    const bad = clone();
    delete bad.experiences[0].company;
    expect(() => parseCV(bad)).toThrow(/experiences\.0\.company/);
  });

  test('traduction manquante : le chemin indique la langue', () => {
    const bad = clone();
    delete bad.identity.title.en;
    expect(() => parseCV(bad)).toThrow(/identity\.title\.en/);
  });

  test('date mal formée refusée', () => {
    const bad = clone();
    bad.experiences[0].start = '03/2024';
    expect(() => parseCV(bad)).toThrow(/experiences\.0\.start/);
  });
});

describe('getCV', () => {
  test('bascule de langue', () => {
    expect(getCV('fr').identity.title).toBe(raw.identity.title.fr);
    expect(getCV('en').identity.title).toBe(raw.identity.title.en);
    expect(getCV('en').skills[0].category).toBe(raw.skills[0].category.en);
  });

  test('expériences triées de la plus récente à la plus ancienne', () => {
    const cv = clone();
    cv.experiences = [
      { ...cv.experiences[0], company: 'A', start: '2020-01', end: '2020-06' },
      { ...cv.experiences[0], company: 'B', start: '2023-01', end: '2023-06' },
      { ...cv.experiences[0], company: 'C', start: '2021-01', end: null },
    ];
    expect(buildCV(cv, 'fr').experiences.map((e) => e.company)).toEqual(['C', 'B', 'A']);
  });
});

describe('contenu à relire', () => {
  test('avertit (sans échouer) s\'il reste des TODO', () => {
    const todos: string[] = [];
    const walk = (v: unknown, path: string) => {
      if (typeof v === 'string') {
        if (v.startsWith('TODO:')) todos.push(path);
      } else if (v && typeof v === 'object') {
        for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k);
      }
    };
    walk(raw, '');
    if (todos.length) console.warn(`⚠ ${todos.length} champ(s) "TODO:" à relire dans cv.json :\n  - ${todos.join('\n  - ')}`);
    expect(Array.isArray(todos)).toBe(true);
  });
});

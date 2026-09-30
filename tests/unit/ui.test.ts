import { describe, expect, it } from 'vitest';
import { homePath, otherLang, t, ui } from '../../src/i18n/ui';

describe('libellés d\'interface', () => {
  it('ont les mêmes clés en FR et EN, toutes non vides', () => {
    expect(Object.keys(ui.en).sort()).toEqual(Object.keys(ui.fr).sort());
    for (const dict of Object.values(ui)) {
      for (const v of Object.values(dict)) expect(v.trim()).not.toBe('');
    }
  });

  it('résolvent chemins et langues', () => {
    expect(homePath('fr')).toBe('/');
    expect(homePath('en')).toBe('/en/');
    expect(otherLang('fr')).toBe('en');
    expect(otherLang('en')).toBe('fr');
    expect(t('en', 'skip')).toBe('Skip to content');
  });
});

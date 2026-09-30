import { describe, expect, it } from 'vitest';
import { formatMonth, formatPeriod, pad2 } from '../../src/lib/format';

describe('formatage des dates', () => {
  it('formate un mois dans chaque langue', () => {
    expect(formatMonth('2025-09', 'fr')).toMatch(/^sept\.? 2025$/);
    expect(formatMonth('2025-09', 'en')).toMatch(/^Sep\w* 2025$/);
    expect(formatMonth('2024-01', 'fr')).toMatch(/janv\.? 2024/);
  });

  it('affiche « en cours » quand la fin est nulle', () => {
    expect(formatPeriod('2025-09', null, 'fr', "aujourd'hui")).toMatch(/2025 — aujourd'hui$/);
    expect(formatPeriod('2024-01', '2024-09', 'en', 'present')).toMatch(/^Jan 2024 — Sep\w* 2024$/);
  });

  it('numérote sur deux chiffres', () => {
    expect(pad2(1)).toBe('01');
    expect(pad2(12)).toBe('12');
  });
});

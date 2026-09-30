import type { Lang } from '../i18n/ui';

const locales: Record<Lang, string> = { fr: 'fr-FR', en: 'en-US' };

/** « 2025-09 » → « sept. 2025 » (fr) / « Sep 2025 » (en). */
export function formatMonth(ym: string, lang: Lang): string {
  const [y, m] = ym.split('-').map(Number);
  return new Intl.DateTimeFormat(locales[lang], { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
}

/** Période lisible ; `end` à null = en cours. */
export function formatPeriod(start: string, end: string | null, lang: Lang, present: string): string {
  return `${formatMonth(start, lang)} — ${end ? formatMonth(end, lang) : present}`;
}

/** Numéro de section sur deux chiffres : 1 → « 01 ». */
export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

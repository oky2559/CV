import raw from '../data/cv.json';
import { cvSchema, type CVData, type Lang } from '../data/schema';

export type { Lang };

type Localized<T> = T extends { fr: string; en: string }
  ? string
  : T extends readonly (infer U)[]
    ? Localized<U>[]
    : T extends object
      ? { [K in keyof T]: Localized<T[K]> }
      : T;

export type CV = Localized<CVData>;

/** Valide le contenu ; l'erreur liste chaque chemin fautif. */
export function parseCV(input: unknown): CVData {
  const result = cvSchema.safeParse(input);
  if (!result.success) {
    const lines = result.error.issues.map(
      (i) => `  - ${i.path.join('.') || '(racine)'} : ${i.message}`,
    );
    throw new Error(`cv.json invalide :\n${lines.join('\n')}`);
  }
  return result.data;
}

function isText(v: unknown): v is { fr: string; en: string } {
  const o = v as Record<string, unknown>;
  return typeof v === 'object' && v !== null && typeof o.fr === 'string' && typeof o.en === 'string';
}

function localize(v: unknown, lang: Lang): unknown {
  if (isText(v)) return v[lang];
  if (Array.isArray(v)) return v.map((x) => localize(x, lang));
  if (typeof v === 'object' && v !== null) {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, localize(x, lang)]));
  }
  return v;
}

/** Plus récent d'abord ; un poste sans date de fin (en cours) passe en premier. */
function byRecency<T extends { start: string; end: string | null }>(items: T[]): T[] {
  const key = (x: T) => x.end ?? '9999-12';
  return [...items].sort((a, b) => key(b).localeCompare(key(a)) || b.start.localeCompare(a.start));
}

export function buildCV(input: unknown, lang: Lang): CV {
  const data = parseCV(input);
  const sorted = {
    ...data,
    experiences: byRecency(data.experiences),
    education: byRecency(data.education),
  };
  return localize(sorted, lang) as CV;
}

export function getCV(lang: Lang): CV {
  return buildCV(raw, lang);
}

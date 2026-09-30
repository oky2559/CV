/**
 * Stats GitHub live : appel de l'API publique (sans jeton), validation de la
 * forme des réponses, agrégation et cache `sessionStorage` d'une heure.
 *
 * Module pur : `fetch`, le stockage et l'horloge sont injectés, ce qui le rend
 * testable sans navigateur. `getGithubStats` ne lève jamais d'exception et
 * n'écrit rien dans la console : en cas d'échec (réseau, 403/429, JSON
 * inattendu, délai dépassé), elle renvoie `null` et l'interface masque le bloc.
 *
 * Validation écrite à la main (pas de zod côté client) pour garder le JS léger.
 */

export const API = 'https://api.github.com';
export const CACHE_TTL_MS = 60 * 60 * 1000;
export const TIMEOUT_MS = 5000;
const CACHE_VERSION = 1;

export interface GithubStats {
  /** Repos publics hors forks. */
  repos: number;
  /** Jusqu'à 3 langages, du plus au moins utilisé (en nombre de repos). */
  languages: string[];
  /** Date ISO du dernier push sur un repo hors fork. */
  lastPush: string;
  /** Somme des étoiles des repos hors forks. */
  stars: number;
}

/** Sous-ensemble de l'interface `Storage` utilisé ici. */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export interface Deps {
  fetch: (input: string, init?: RequestInit) => Promise<Response>;
  /** `null` si le stockage est indisponible : pas de cache, mais on affiche quand même. */
  storage: StorageLike | null;
  now: () => number;
  timeoutMs?: number;
}

interface ApiUser {
  login: string;
}

interface ApiRepo {
  fork: boolean;
  language: string | null;
  pushed_at: string | null;
  stargazers_count: number;
}

// ---------------------------------------------------------------------------
// Validation

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const isDate = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v));

function isUser(v: unknown): v is ApiUser {
  return isObject(v) && typeof v.login === 'string';
}

function isRepo(v: unknown): v is ApiRepo {
  return (
    isObject(v) &&
    typeof v.fork === 'boolean' &&
    (v.language === null || typeof v.language === 'string') &&
    (v.pushed_at === null || isDate(v.pushed_at)) &&
    isCount(v.stargazers_count)
  );
}

export function isStats(v: unknown): v is GithubStats {
  return (
    isObject(v) &&
    isCount(v.repos) &&
    v.repos > 0 &&
    Array.isArray(v.languages) &&
    v.languages.length <= 3 &&
    v.languages.every((l) => typeof l === 'string') &&
    isDate(v.lastPush) &&
    isCount(v.stars)
  );
}

// ---------------------------------------------------------------------------
// Agrégation

/**
 * Calcule les stats à partir de la liste des repos. `null` si aucun repo
 * public hors fork n'a jamais reçu de push (rien d'intéressant à montrer).
 */
export function aggregate(repos: readonly ApiRepo[]): GithubStats | null {
  const own = repos.filter((r) => !r.fork);
  const counts = new Map<string, number>();
  let lastPush: string | null = null;
  let stars = 0;
  for (const r of own) {
    if (r.language) counts.set(r.language, (counts.get(r.language) ?? 0) + 1);
    if (r.pushed_at && (!lastPush || Date.parse(r.pushed_at) > Date.parse(lastPush))) lastPush = r.pushed_at;
    stars += r.stargazers_count;
  }
  if (own.length === 0 || !lastPush) return null;
  const languages = [...counts]
    .sort(([a, na], [b, nb]) => nb - na || a.localeCompare(b))
    .slice(0, 3)
    .map(([name]) => name);
  return { repos: own.length, languages, lastPush: new Date(lastPush).toISOString(), stars };
}

// ---------------------------------------------------------------------------
// Cache

const cacheKey = (user: string) => `gh-stats:${user.toLowerCase()}`;

function readCache(user: string, deps: Deps): GithubStats | null {
  if (!deps.storage) return null;
  try {
    const raw = deps.storage.getItem(cacheKey(user));
    if (!raw) return null;
    const entry: unknown = JSON.parse(raw);
    if (!isObject(entry) || entry.v !== CACHE_VERSION || typeof entry.at !== 'number') return null;
    const age = deps.now() - entry.at;
    if (age < 0 || age >= CACHE_TTL_MS) return null;
    return isStats(entry.stats) ? entry.stats : null;
  } catch {
    return null; // stockage bloqué ou contenu corrompu : on refait l'appel
  }
}

function writeCache(user: string, stats: GithubStats, deps: Deps): void {
  if (!deps.storage) return;
  try {
    deps.storage.setItem(cacheKey(user), JSON.stringify({ v: CACHE_VERSION, at: deps.now(), stats }));
  } catch {
    /* quota dépassé, navigation privée… : le cache est une optimisation */
  }
}

// ---------------------------------------------------------------------------
// Appel réseau

async function getJson(url: string, deps: Deps, signal: AbortSignal): Promise<unknown> {
  const res = await deps.fetch(url, { signal, headers: { Accept: 'application/vnd.github+json' } });
  // 403/429 = limite d'API atteinte ; toute autre erreur HTTP est traitée pareil.
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Stats de `user` : depuis le cache s'il a moins d'une heure, sinon depuis
 * l'API (deux appels en parallèle, 5 s maximum au total). `null` en cas d'échec.
 */
export async function getGithubStats(user: string, deps: Deps): Promise<GithubStats | null> {
  const cached = readCache(user, deps);
  if (cached) return cached;

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('timeout'));
    }, deps.timeoutMs ?? TIMEOUT_MS);
  });

  try {
    const base = `${API}/users/${encodeURIComponent(user)}`;
    const [profile, repos] = await Promise.race([
      Promise.all([getJson(base, deps, controller.signal), getJson(`${base}/repos?per_page=100`, deps, controller.signal)]),
      timeout,
    ]);
    if (!isUser(profile) || profile.login.toLowerCase() !== user.toLowerCase()) return null;
    if (!Array.isArray(repos) || !repos.every(isRepo)) return null;
    const stats = aggregate(repos);
    if (stats) writeCache(user, stats, deps);
    return stats;
  } catch {
    controller.abort(); // annule l'autre requête si l'une a échoué
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Affichage

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 86400],
  ['month', 30 * 86400],
  ['week', 7 * 86400],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
];

/** « il y a 3 jours », « hier », « 2 weeks ago »… (jamais dans le futur). */
export function relativeTime(iso: string, now: number, lang: string): string {
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  const seconds = Math.max(0, (now - Date.parse(iso)) / 1000);
  for (const [unit, size] of UNITS) {
    if (seconds >= size) return rtf.format(-Math.floor(seconds / size), unit);
  }
  return rtf.format(0, 'second');
}

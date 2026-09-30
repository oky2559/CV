import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  aggregate,
  CACHE_TTL_MS,
  getGithubStats,
  relativeTime,
  type Deps,
  type GithubStats,
  type StorageLike,
} from '../../src/lib/github';

const USER = 'oky2559';
const NOW = Date.parse('2026-10-01T12:00:00Z');

const repo = (over: Partial<Record<string, unknown>> = {}) => ({
  name: 'r',
  fork: false,
  language: 'C',
  pushed_at: '2026-01-01T00:00:00Z',
  stargazers_count: 0,
  ...over,
});

const REPOS = [
  repo({ language: 'C', pushed_at: '2026-02-02T23:47:41Z', stargazers_count: 2 }),
  repo({ language: 'C', pushed_at: '2025-12-21T21:58:46Z' }),
  repo({ language: 'HTML', pushed_at: '2026-09-10T10:47:26Z', stargazers_count: 3 }),
  repo({ language: 'Nix', pushed_at: '2026-01-16T16:16:21Z' }),
  repo({ language: 'TypeScript', pushed_at: '2026-01-01T00:00:00Z' }),
  repo({ language: 'TypeScript', pushed_at: '2026-01-01T00:00:00Z' }),
  repo({ language: null, pushed_at: '2025-01-01T00:00:00Z' }),
  // Fork : ignoré partout (même s'il est plus récent et très étoilé).
  repo({ fork: true, language: 'Rust', pushed_at: '2026-09-30T00:00:00Z', stargazers_count: 100 }),
  repo({ fork: true, language: 'Rust' }),
  repo({ fork: true, language: 'Rust' }),
];

const EXPECTED: GithubStats = {
  repos: 7,
  languages: ['C', 'TypeScript', 'HTML'],
  lastPush: '2026-09-10T10:47:26.000Z',
  stars: 5,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** fetch simulé : répond selon l'URL. */
function fakeFetch(user: () => Response | Promise<Response>, repos: () => Response | Promise<Response>) {
  return vi.fn(async (url: string, _init?: RequestInit) => (url.endsWith('/repos?per_page=100') ? repos() : user()));
}

const okFetch = () =>
  fakeFetch(
    () => json({ login: USER, public_repos: 10 }),
    () => json(REPOS),
  );

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

function deps(over: Partial<Deps> = {}): Deps {
  return { fetch: okFetch(), storage: memoryStorage(), now: () => NOW, ...over };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('agrégation', () => {
  test('repos hors forks, top 3 langages par nombre de repos, dernier push, étoiles', () => {
    expect(aggregate(REPOS as never)).toEqual(EXPECTED);
  });

  test('égalité de langages départagée par ordre alphabétique', () => {
    const r = aggregate([repo({ language: 'Go' }), repo({ language: 'Ada' }), repo({ language: 'Zig' }), repo({ language: 'C' })] as never);
    expect(r?.languages).toEqual(['Ada', 'C', 'Go']);
  });

  test('aucun repo propre → null', () => {
    expect(aggregate([])).toBeNull();
    expect(aggregate([repo({ fork: true })] as never)).toBeNull();
  });
});

describe('getGithubStats', () => {
  test('appelle users/<user> et users/<user>/repos?per_page=100 puis agrège', async () => {
    const d = deps();
    await expect(getGithubStats(USER, d)).resolves.toEqual(EXPECTED);
    const urls = vi.mocked(d.fetch).mock.calls.map(([u]) => u);
    expect(urls.sort()).toEqual([
      'https://api.github.com/users/oky2559',
      'https://api.github.com/users/oky2559/repos?per_page=100',
    ]);
    // Aucun jeton envoyé.
    for (const [, init] of vi.mocked(d.fetch).mock.calls) {
      expect(JSON.stringify(init?.headers ?? {})).not.toMatch(/authorization/i);
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    }
  });

  test('le cache de moins d\'une heure est utilisé sans appel réseau', async () => {
    const storage = memoryStorage();
    let now = NOW;
    const first = deps({ storage, now: () => now });
    await getGithubStats(USER, first);
    expect(first.fetch).toHaveBeenCalledTimes(2);

    now = NOW + CACHE_TTL_MS - 1;
    const second = deps({ storage, now: () => now });
    await expect(getGithubStats(USER, second)).resolves.toEqual(EXPECTED);
    expect(second.fetch).not.toHaveBeenCalled();
  });

  test('le cache expire au bout d\'une heure', async () => {
    const storage = memoryStorage();
    await getGithubStats(USER, deps({ storage }));
    const later = deps({ storage, now: () => NOW + CACHE_TTL_MS });
    await getGithubStats(USER, later);
    expect(later.fetch).toHaveBeenCalledTimes(2);
  });

  test('un cache corrompu ou mal formé est ignoré', async () => {
    const storage = memoryStorage();
    storage.setItem('gh-stats:oky2559', '{pas du json');
    const d = deps({ storage });
    await expect(getGithubStats(USER, d)).resolves.toEqual(EXPECTED);
    storage.setItem('gh-stats:oky2559', JSON.stringify({ v: 1, at: NOW, stats: { repos: 'beaucoup' } }));
    const d2 = deps({ storage });
    await expect(getGithubStats(USER, d2)).resolves.toEqual(EXPECTED);
    expect(d2.fetch).toHaveBeenCalledTimes(2);
  });
});

describe('cas d\'échec → null, sans exception ni console', () => {
  const spies = () => ({
    error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
  });

  async function expectNull(d: Deps) {
    const s = spies();
    await expect(getGithubStats(USER, d)).resolves.toBeNull();
    expect(s.error).not.toHaveBeenCalled();
    expect(s.warn).not.toHaveBeenCalled();
    s.error.mockRestore();
    s.warn.mockRestore();
  }

  test('réseau coupé', async () => {
    await expectNull(deps({ fetch: vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))) }));
  });

  test.each([403, 429, 404, 500])('HTTP %i', async (status) => {
    await expectNull(deps({ fetch: fakeFetch(() => json({ message: 'API rate limit exceeded' }, status), () => json(REPOS)) }));
    await expectNull(deps({ fetch: fakeFetch(() => json({ login: USER }), () => json({ message: 'nope' }, status)) }));
  });

  test.each([
    ['profil sans login', { id: 1 }, REPOS],
    ['autre utilisateur', { login: 'quelqu-un' }, REPOS],
    ['repos pas un tableau', { login: USER }, { items: REPOS }],
    ['repo mal formé', { login: USER }, [repo({ stargazers_count: '3' })]],
    ['date invalide', { login: USER }, [repo({ pushed_at: 'hier' })]],
    ['aucun repo', { login: USER }, []],
  ])('JSON inattendu : %s', async (_, user, repos) => {
    await expectNull(deps({ fetch: fakeFetch(() => json(user), () => json(repos)) }));
  });

  test('corps non JSON', async () => {
    await expectNull(deps({ fetch: fakeFetch(() => new Response('<html>'), () => json(REPOS)) }));
  });

  test('délai de 5 s dépassé : requêtes annulées', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const hang = vi.fn((_url: string, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return new Promise<Response>(() => {});
    });
    const p = getGithubStats(USER, deps({ fetch: hang }));
    await vi.advanceTimersByTimeAsync(4999);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(p).resolves.toBeNull();
    expect(signal?.aborted).toBe(true);
  });

  test('sessionStorage indisponible : pas de cache, mais les stats sont renvoyées', async () => {
    await expect(getGithubStats(USER, deps({ storage: null }))).resolves.toEqual(EXPECTED);
    const throwing: StorageLike = {
      getItem: () => {
        throw new DOMException('denied', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('quota', 'QuotaExceededError');
      },
    };
    const s = spies();
    await expect(getGithubStats(USER, deps({ storage: throwing }))).resolves.toEqual(EXPECTED);
    expect(s.error).not.toHaveBeenCalled();
    s.error.mockRestore();
    s.warn.mockRestore();
  });
});

describe('date relative', () => {
  test('dans la langue courante', () => {
    expect(relativeTime('2026-09-30T12:00:00Z', NOW, 'fr')).toBe('hier');
    expect(relativeTime('2026-09-30T12:00:00Z', NOW, 'en')).toBe('yesterday');
    expect(relativeTime('2026-09-28T12:00:00Z', NOW, 'fr')).toBe('il y a 3 jours');
    expect(relativeTime('2026-09-10T10:47:26Z', NOW, 'en')).toBe('3 weeks ago');
    expect(relativeTime('2026-10-01T09:00:00Z', NOW, 'en')).toBe('3 hours ago');
    expect(relativeTime('2025-06-01T00:00:00Z', NOW, 'fr')).toBe("l’année dernière");
    expect(relativeTime('2026-10-01T11:59:30Z', NOW, 'en')).toBe('now');
    // Horloge du visiteur en retard : jamais de date dans le futur.
    expect(relativeTime('2026-10-02T00:00:00Z', NOW, 'en')).toBe('now');
  });
});

import { expect, GH_REPOS, test, type Page } from './fixtures';

const NOW = new Date('2026-10-01T12:00:00Z');
const block = (page: Page) => page.locator('[data-gh-stats]');

/**
 * Erreurs émises par la page. Chromium journalise lui-même « Failed to load
 * resource » pour toute réponse HTTP en erreur : ce message du navigateur ne
 * vient pas du site et ne peut pas être supprimé par du JS, il est ignoré.
 */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if ((m.type() === 'error' || m.type() === 'warning') && !m.text().startsWith('Failed to load resource')) {
      errors.push(m.text());
    }
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

test.describe('stats GitHub : données reçues', () => {
  for (const [path, lang, when] of [
    ['/', 'fr', 'il y a 3 semaines'],
    ['/en/', 'en', '3 weeks ago'],
  ] as const) {
    test(`${path} : bloc visible dans Compétences avec les données simulées`, async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto(path);
      const gh = page.locator('section#skills [data-gh-stats]');
      await gh.scrollIntoViewIfNeeded();
      await expect(gh).toBeVisible();
      await expect(gh).toHaveAttribute('data-lang', lang);

      const own = GH_REPOS.filter((r) => !r.fork);
      const repos = gh.locator('[data-gh-count="repos"]');
      await expect(repos.locator('[aria-hidden="true"]')).toHaveText(String(own.length));
      await expect(repos.locator('.visually-hidden')).toHaveText(String(own.length));
      await expect(gh.locator('[data-gh-count="stars"] [aria-hidden="true"]')).toHaveText('7');
      await expect(gh.locator('[data-gh-languages] li')).toHaveText(['TypeScript', 'C', 'Go']);
      await expect(gh.locator('time')).toHaveText(when);
      await expect(gh.locator('time')).toHaveAttribute('datetime', '2026-09-10T10:47:26.000Z');
      // Libellé accessible du bloc.
      await expect(page.getByRole('complementary', { name: lang === 'fr' ? 'En direct de GitHub' : 'Live from GitHub' })).toBeVisible();
      expect(errors).toEqual([]);
    });
  }

  test('le cache sessionStorage évite un second appel au rechargement', async ({ page }) => {
    const calls: string[] = [];
    page.on('request', (r) => r.url().startsWith('https://api.github.com/') && calls.push(r.url()));
    await page.goto('/');
    await expect(block(page)).toHaveAttribute('data-gh-state', 'ready');
    expect(calls).toHaveLength(2);
    await page.reload();
    await expect(block(page)).toHaveAttribute('data-gh-state', 'ready');
    expect(calls).toHaveLength(2);
  });

  test('sessionStorage inaccessible : bloc affiché quand même, sans erreur', async ({ page }) => {
    const errors = collectErrors(page);
    await page.addInitScript(() => {
      Object.defineProperty(window, 'sessionStorage', {
        get() {
          throw new DOMException('bloqué', 'SecurityError');
        },
      });
    });
    await page.goto('/');
    await expect(block(page)).toHaveAttribute('data-gh-state', 'ready');
    await block(page).scrollIntoViewIfNeeded();
    await expect(block(page)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test.describe('réduction des animations', () => {
    test.use({ reducedMotion: 'reduce' });
    test('les compteurs affichent directement la valeur finale', async ({ page }) => {
      await page.goto('/');
      await expect(block(page)).toHaveAttribute('data-gh-state', 'ready');
      await expect(block(page)).not.toHaveClass(/is-entering/);
      expect(await block(page).locator('[data-gh-count="repos"] [aria-hidden="true"]').textContent()).toBe('5');
    });
  });
});

test.describe('stats GitHub : échecs → bloc absent, aucune erreur', () => {
  const failures: [string, Parameters<Page['route']>[1]][] = [
    ['HTTP 403 (limite atteinte)', (r) => r.fulfill({ status: 403, json: { message: 'API rate limit exceeded' }, headers: { 'access-control-allow-origin': '*' } })],
    ['HTTP 429', (r) => r.fulfill({ status: 429, json: { message: 'Too Many Requests' }, headers: { 'access-control-allow-origin': '*' } })],
    ['réseau coupé', (r) => r.abort('internetdisconnected')],
    ['JSON inattendu', (r) => r.fulfill({ json: { surprise: true }, headers: { 'access-control-allow-origin': '*' } })],
  ];

  for (const [name, handler] of failures) {
    test(name, async ({ page }) => {
      const errors = collectErrors(page);
      await page.route('https://api.github.com/**', handler);
      await page.goto('/');
      await expect(block(page)).toHaveAttribute('data-gh-state', 'unavailable');
      await expect(block(page)).toBeHidden();
      expect(errors).toEqual([]);
    });
  }
});

test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('le bloc n\'apparaît pas', async ({ page }) => {
    await page.goto('/');
    await expect(block(page)).toHaveCount(1);
    await expect(block(page)).toBeHidden();
  });
});

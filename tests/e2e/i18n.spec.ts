import { expect, test } from '@playwright/test';

const pages = [
  { path: '/', lang: 'fr', other: '/en/' },
  { path: '/en/', lang: 'en', other: '/' },
] as const;

for (const { path, lang, other } of pages) {
  test(`${path} : lang="${lang}", hreflang et bascule`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('lang', lang);

    const alt = page.locator('link[rel="alternate"][hreflang]');
    await expect(alt).toHaveCount(3);
    await expect(page.locator('link[hreflang="fr"]')).toHaveAttribute('href', /\/$/);
    await expect(page.locator('link[hreflang="en"]')).toHaveAttribute('href', /\/en\/$/);
    await expect(page.locator('link[hreflang="x-default"]')).toHaveCount(1);
    await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);

    const sw = page.locator('[data-lang-switch]');
    await expect(sw).toHaveAttribute('href', other);
    await sw.click();
    await expect(page).toHaveURL(other);
    await expect(page.locator('html')).toHaveAttribute('lang', lang === 'fr' ? 'en' : 'fr');
  });
}

test('la bascule de langue garde l\'ancre courante', async ({ page }) => {
  await page.goto('/#contact');
  await page.locator('[data-lang-switch]').click();
  await expect(page).toHaveURL('/en/#contact');
});

test('la bascule fonctionne sans JavaScript', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4322/en/');
  await page.locator('[data-lang-switch]').click();
  await expect(page).toHaveURL('http://localhost:4322/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await ctx.close();
});

test('lien d\'évitement vers le contenu', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skip = page.locator('.skip-link');
  await expect(skip).toBeFocused();
  await expect(skip).toHaveAttribute('href', '#main');
});

test('page 404 bilingue', async ({ page }) => {
  const res = await page.goto('/cette-page-n-existe-pas');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page introuvable' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Back to home/ })).toHaveAttribute('href', '/en/');
});

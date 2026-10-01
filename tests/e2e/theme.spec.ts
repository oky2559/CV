import { expect, test } from './fixtures';

const bg = (page: import('@playwright/test').Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

const DARK = 'rgb(11, 11, 12)';
const LIGHT = 'rgb(244, 241, 234)';

test('le thème suit le réglage du système par défaut', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  expect(await bg(page)).toBe(LIGHT);
  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await bg(page)).toBe(DARK);
});

test('le bouton soleil/lune bascule le thème et le choix est retenu', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  const toggle = page.locator('[data-theme-toggle]');
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-label', 'Passer au thème clair');
  await toggle.click();
  expect(await bg(page)).toBe(LIGHT);
  await expect(toggle).toHaveAttribute('aria-label', 'Passer au thème sombre');

  // Retenu au rechargement et sur l'autre langue, sans flash : appliqué avant le premier rendu.
  await page.goto('/en/', { waitUntil: 'commit' });
  await page.waitForSelector('body');
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
  expect(await bg(page)).toBe(LIGHT);
  await expect(page.locator('[data-theme-toggle]')).toHaveAttribute('aria-label', 'Switch to dark theme');
});

test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('le bouton est masqué et le thème suit le système', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await expect(page.locator('[data-theme-toggle]')).toBeHidden();
    expect(await bg(page)).toBe(LIGHT);
  });
});

test('le haut de page tient sur un écran : nom, métier, accroche et bouton visibles', async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    for (const sel of ['[data-hero-name]', '.hero .title', '.hero .tagline', '.hero .cta']) {
      const box = await page.locator(sel).first().boundingBox();
      expect(box, sel).not.toBeNull();
      expect(box!.y + box!.height, `${sel} à ${viewport.width}×${viewport.height}`).toBeLessThanOrEqual(viewport.height);
    }
    // Pas « trop zoomé » : nom au plus ~1/9 de la hauteur d'écran, texte courant entre 16 et 17 px.
    const size = (sel: string) => page.locator(sel).first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(await size('[data-hero-name]')).toBeLessThanOrEqual(viewport.height / 9);
    expect(await size('section h2')).toBeLessThanOrEqual(viewport.height / 18);
    const body = await size('body');
    expect(body).toBeGreaterThanOrEqual(16);
    expect(body).toBeLessThanOrEqual(17);
  }
});

import { expect, test } from '@playwright/test';
import cv from '../../src/data/cv.json' with { type: 'json' };

for (const [path, lang] of [['/', 'fr'], ['/en/', 'en']] as const) {
  test(`titre sur ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveTitle(new RegExp(`^${cv.identity.name}`));
    await expect(page.locator('h1')).toHaveText(cv.identity.name);
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
  });
}

test('le titre du poste vient de cv.json', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(cv.identity.title.fr)).toBeVisible();
  await page.goto('/en/');
  await expect(page.getByText(cv.identity.title.en)).toBeVisible();
});

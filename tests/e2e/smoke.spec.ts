import { expect, test } from '@playwright/test';

for (const [path, lang] of [['/', 'fr'], ['/en/', 'en']] as const) {
  test(`titre sur ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveTitle('Victor Schmutz');
    await expect(page.locator('h1')).toHaveText('Victor Schmutz');
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
  });
}

test('le titre du poste vient de cv.json', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Développeur web full-stack')).toBeVisible();
  await page.goto('/en/');
  await expect(page.getByText('Full-stack web developer')).toBeVisible();
});

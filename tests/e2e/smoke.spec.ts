import { expect, test } from '@playwright/test';

for (const [path, lang] of [['/', 'fr'], ['/en/', 'en']] as const) {
  test(`titre sur ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveTitle('Victor Schmutz');
    await expect(page.locator('h1')).toHaveText('Victor Schmutz');
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
  });
}

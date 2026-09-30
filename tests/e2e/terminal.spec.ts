import { expect, test } from '@playwright/test';
import cv from '../../src/data/cv.json' with { type: 'json' };

const dialog = '[data-terminal]';
const output = '[data-terminal-output]';

test('` ouvre le terminal, whoami répond, Échap ferme', async ({ page }) => {
  await page.goto('/');
  const term = page.locator(dialog);
  await expect(term).toBeHidden();
  await expect(term).toHaveAttribute('role', 'dialog');

  await page.keyboard.press('`');
  await expect(term).toBeVisible();
  const input = page.locator('#terminal-input');
  await expect(input).toBeFocused();
  await expect(page.locator('html')).toHaveClass(/terminal-open/);

  await input.fill('whoami');
  await input.press('Enter');
  await expect(page.locator(output)).toContainText(cv.identity.name);
  await expect(page.locator(output)).toContainText(cv.identity.title.fr);

  await page.keyboard.press('Escape');
  await expect(term).toBeHidden();
  await expect(page.locator('html')).not.toHaveClass(/terminal-open/);
});

test('Ctrl+K ouvre ; commande inconnue, historique, Tab, focus piégé puis rendu', async ({ page }) => {
  await page.goto('/en/');
  const hint = page.locator('[data-terminal-open]');
  await hint.focus();
  await page.keyboard.press('Control+k');
  const input = page.locator('#terminal-input');
  await expect(input).toBeFocused();

  await input.fill('projetcs');
  await input.press('Enter');
  await expect(page.locator(output)).toContainText('command not found: projetcs');
  await expect(page.locator(output)).toContainText('Did you mean "projects"?');

  await input.fill('wh');
  await input.press('Tab');
  await expect(input).toHaveValue('whoami');
  await input.press('Enter');
  await input.press('ArrowUp');
  await expect(input).toHaveValue('whoami');
  await input.press('ArrowUp');
  await expect(input).toHaveValue('projetcs');
  await input.press('ArrowDown');
  await input.press('ArrowDown');
  await expect(input).toHaveValue('');

  // Saisie vide : Tab circule entre le champ et le bouton fermer, sans sortir.
  await input.press('Tab');
  await expect(page.locator('[data-terminal-close]')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(input).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('[data-terminal-close]')).toBeFocused();

  await input.fill('exit');
  await input.press('Enter');
  await expect(page.locator(dialog)).toBeHidden();
  await expect(hint).toBeFocused();
});

test('le raccourci est ignoré dans un champ et avec des modificateurs', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const i = document.createElement('input');
    i.id = 'tmp';
    document.body.prepend(i);
  });
  await page.locator('#tmp').focus();
  await page.keyboard.press('`');
  await page.keyboard.press('Control+k');
  await expect(page.locator('#tmp')).toHaveValue('`');
  await page.locator('#tmp').blur();
  await page.keyboard.press('Meta+`');
  await page.keyboard.press('Control+Shift+K');
  await expect(page.locator(dialog)).toBeHidden();
});

test('l’indice ouvre le terminal ; lang en bascule vers /en/', async ({ page }) => {
  await page.goto('/');
  const hint = page.locator('[data-terminal-open]');
  await expect(hint).toBeVisible();
  await hint.click();
  const input = page.locator('#terminal-input');
  await expect(input).toBeFocused();
  await input.fill('lang en');
  await input.press('Enter');
  await expect(page).toHaveURL(/\/en\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('sudo hire-victor affiche le mail ; clear efface', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('[data-terminal-open]').click();
  const input = page.locator('#terminal-input');
  await input.fill('sudo hire-victor');
  await input.press('Enter');
  await expect(page.locator(`${output} a[href="mailto:${cv.links.email}"]`)).toBeVisible();
  await input.fill('clear');
  await input.press('Enter');
  await expect(page.locator(`${output} .line`)).toHaveCount(0);
});

test('sans JavaScript, l’indice n’apparaît pas', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4322/');
  await expect(page.locator('[data-terminal-open]')).toBeHidden();
  await expect(page.locator(dialog)).toBeHidden();
  await ctx.close();
});

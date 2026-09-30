import { expect, test } from '@playwright/test';
import { PDFParse } from 'pdf-parse';
import cv from '../../src/data/cv.json' with { type: 'json' };

// La mise en page du PDF ne dépend pas du viewport : un seul projet suffit.
test.skip(({ isMobile }) => isMobile, 'PDF généré une seule fois (desktop)');

for (const [path, lang] of [['/', 'fr'], ['/en/', 'en']] as const) {
  test(`PDF ${lang} : 1 à 2 pages avec nom, titre et URL`, async ({ page }) => {
    await page.goto(path);
    await page.emulateMedia({ media: 'print' });
    const pdf = await page.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true });
    const parser = new PDFParse({ data: new Uint8Array(pdf) });
    const { total, text } = await parser.getText();
    expect(total).toBeGreaterThanOrEqual(1);
    expect(total).toBeLessThanOrEqual(2);
    expect(text).toContain(cv.identity.name);
    expect(text.toLowerCase()).toContain(cv.identity.title[lang].toLowerCase());
    expect(text).toContain(cv.links.email);
    expect(text).toContain(cv.links.github);
    expect(text).toContain(cv.links.linkedin);
  });

  test(`impression ${lang} : fond blanc, texte noir, éléments interactifs masqués`, async ({ page }) => {
    await page.goto(path);
    await page.emulateMedia({ media: 'print' });
    const body = page.locator('body');
    await expect(body).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(body).toHaveCSS('color', 'rgb(0, 0, 0)');
    await expect(page.locator('.site-nav')).toBeHidden();
    await expect(page.locator('[data-print-button]')).toBeHidden();
    await expect(page.locator('.skip-link')).toBeHidden();
    await expect(page.locator('[data-no-print]:visible')).toHaveCount(0);
  });
}

test('le bouton PDF appelle window.print()', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __prints: number }).__prints = 0;
    window.print = () => {
      (window as unknown as { __prints: number }).__prints++;
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Télécharger en PDF' }).click();
  expect(await page.evaluate(() => (window as unknown as { __prints: number }).__prints)).toBe(1);
  await page.goto('/en/');
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeVisible();
});

test('sans JavaScript, le bouton PDF reste masqué', async ({ browser, baseURL }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.locator('[data-print-button]')).toBeHidden();
  await ctx.close();
});

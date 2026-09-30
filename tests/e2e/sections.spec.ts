import { expect, test, type Page } from '@playwright/test';
import cv from '../../src/data/cv.json' with { type: 'json' };

const langs = [
  ['/', 'fr'],
  ['/en/', 'en'],
] as const;

/** Vérifie que chaque section existe et contient les données de cv.json. */
async function expectFullCV(page: Page, lang: 'fr' | 'en') {
  const main = page.locator('main#main');
  await expect(main.locator('h1')).toHaveText(cv.identity.name);
  await expect(main).toContainText(cv.identity.title[lang]);
  await expect(main).toContainText(cv.identity.tagline[lang]);

  const about = main.locator('section#about');
  await expect(about).toContainText(cv.bio[lang]);
  await expect(about).toContainText(cv.identity.location[lang]);

  const exp = main.locator('section#experience');
  for (const x of cv.experiences) {
    await expect(exp).toContainText(x.role[lang]);
    await expect(exp).toContainText(x.company);
    await expect(exp).toContainText(x.description[lang]);
    for (const tech of x.tech) await expect(exp).toContainText(tech);
  }
  for (const e of cv.education) {
    await expect(exp).toContainText(e.degree[lang]);
    await expect(exp).toContainText(e.school);
  }

  const projects = main.locator('section#projects');
  for (const p of cv.projects) {
    const card = projects.locator('.card', { hasText: p.title[lang] });
    await expect(card).toContainText(p.description[lang]);
    for (const s of p.stack) await expect(card).toContainText(s);
    if (p.github) await expect(card.locator(`a[href="${p.github}"]`)).toHaveCount(1);
  }

  const skills = main.locator('section#skills');
  for (const g of cv.skills) {
    await expect(skills).toContainText(g.category[lang]);
    for (const s of g.items) await expect(skills).toContainText(s);
  }
  for (const l of cv.languages) {
    await expect(skills).toContainText(l.name[lang]);
    await expect(skills).toContainText(l.level[lang]);
  }

  const contact = main.locator('section#contact');
  await expect(contact.locator(`a[href="mailto:${cv.links.email}"]`)).toHaveText(cv.links.email);
  await expect(contact.locator(`a[href="${cv.links.github}"]`)).toHaveCount(1);
  await expect(contact.locator(`a[href="${cv.links.linkedin}"]`)).toHaveCount(1);
}

for (const [path, lang] of langs) {
  test(`${path} : toutes les sections avec le contenu de cv.json`, async ({ page }) => {
    await page.goto(path);
    for (const id of ['about', 'experience', 'projects', 'skills', 'contact']) {
      await expect(page.locator(`main section#${id}`)).toBeVisible();
    }
    await expectFullCV(page, lang);
  });

  test(`${path} : lisible sans JavaScript`, async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(new URL(path, baseURL).href);
    await expectFullCV(page, lang);
    await expect(page.locator('section#contact')).toBeVisible();
    await ctx.close();
  });
}

for (const width of [360, 390]) {
  test(`pas de défilement horizontal à ${width} px`, async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ viewport: { width, height: 800 } });
    const page = await ctx.newPage();
    for (const [path] of langs) {
      await page.goto(new URL(path, baseURL).href);
      const { scroll, inner } = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        inner: window.innerWidth,
      }));
      expect(scroll, `${path} déborde`).toBe(inner);
    }
    await ctx.close();
  });
}

test('pas de défilement horizontal sur l\'appareil courant', async ({ page }) => {
  await page.goto('/');
  const [scroll, inner] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(scroll).toBe(inner);
});

test('photo si public/photo.jpg existe, sinon monogramme « VS »', async ({ page }) => {
  const hasPhoto = (await page.request.get('/photo.jpg')).ok();
  await page.goto('/');
  if (hasPhoto) {
    await expect(page.locator('#about img[src="/photo.jpg"]')).toBeVisible();
  } else {
    await expect(page.locator('#about [data-monogram]')).toHaveText('VS');
  }
});

for (const [path, lang] of langs) {
  test(`${path} : copier l'email au clavier annonce le succès`, async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(path);
    const btn = page.locator('[data-copy-email]');
    await expect(btn).toBeVisible();
    await btn.focus();
    await page.keyboard.press('Enter');
    const status = page.locator('[data-copy-status]');
    await expect(status).toHaveAttribute('aria-live', 'polite');
    await expect(status).toHaveText(lang === 'fr' ? /copié/ : /copied/);
    await expect(btn).toHaveClass(/is-copied/);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(cv.links.email);
  });
}

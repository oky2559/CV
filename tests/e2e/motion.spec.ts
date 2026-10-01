import { expect, test, type Page } from './fixtures';
import cv from '../../src/data/cv.json' with { type: 'json' };

const paths = ['/', '/en/'] as const;
const REVEALABLE = '[data-reveal], [data-hero-reveal]';

/** Opacité calculée de chaque élément animable + visibilité du nom. */
async function visibility(page: Page) {
  return page.evaluate((sel) => {
    const els = [...document.querySelectorAll(sel)];
    const h1 = document.querySelector('h1');
    return {
      count: els.length,
      hidden: els.filter((e) => getComputedStyle(e).opacity !== '1').length,
      name: h1 ? getComputedStyle(h1).visibility : 'missing',
    };
  }, REVEALABLE);
}

/** Descend progressivement jusqu'en bas de page. */
async function scrollToEnd(page: Page) {
  for (let i = 0; i < 40; i++) {
    const done = await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight * 0.6);
      return window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
    });
    await page.waitForTimeout(60);
    if (done) break;
  }
}

test.describe('animations actives', () => {
  for (const path of paths) {
    test(`${path} : aucune erreur console (chargement + scroll)`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('requestfailed', (r) => errors.push(`échec ${r.url()}`));
      page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
      await page.goto(path);
      await expect(page.locator('html')).toHaveAttribute('data-motion', 'ready');
      await scrollToEnd(page);
      await page.waitForTimeout(500);
      expect(errors).toEqual([]);
    });
  }

  test('le script démarre, révèle le nom puis tout le contenu au scroll', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');
    await expect(html).toHaveClass(/js-motion/);
    await expect(html).toHaveClass(/lenis/);
    await expect(html).toHaveAttribute('data-motion', 'ready');
    await expect(page.locator('h1')).toHaveText(cv.identity.name);
    await expect.poll(async () => (await visibility(page)).name).toBe('visible');
    // Le découpage lettre par lettre est retiré une fois l'animation finie.
    await expect(page.locator('h1 .char')).toHaveCount(0, { timeout: 5000 });

    await scrollToEnd(page);
    await expect.poll(async () => (await visibility(page)).hidden, { timeout: 5000 }).toBe(0);
    // La ligne de la timeline s'est dessinée.
    const draw = await page.locator('[data-timeline]').first().evaluate((el) => getComputedStyle(el).getPropertyValue('--draw'));
    expect(Number(draw)).toBeGreaterThan(0.9);
  });

  test('rapide : le haut de page est lisible en moins de 1 s, une section dès qu\'on y arrive', async ({ page }) => {
    // Sans attendre l'API GitHub : seul le rythme des animations est mesuré.
    await page.route('**/api.github.com/**', (r) => r.abort());
    const start = Date.now();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () => [...document.querySelectorAll('[data-hero-reveal]')].every((e) => getComputedStyle(e).opacity === '1'),
      null,
      { polling: 25, timeout: 5000 },
    );
    expect(Date.now() - start).toBeLessThan(1000);

    for (const id of ['experience', 'projects']) {
      await page.evaluate((id) => window.scrollTo(0, document.getElementById(id)!.offsetTop - 60), id);
      const t = Date.now();
      // Tout bloc présent à l'écran (même tout en bas) finit opaque, vite.
      await page.waitForFunction(
        (id) =>
          [...document.getElementById(id)!.querySelectorAll('[data-reveal]')]
            .filter((e) => {
              const r = e.getBoundingClientRect();
              return r.top < innerHeight && r.bottom > 0;
            })
            .every((e) => getComputedStyle(e).opacity === '1'),
        id,
        { polling: 25, timeout: 3000 },
      );
      expect(Date.now() - t, id).toBeLessThan(800);
    }
  });

  test('un lien d\'ancre fait défiler jusqu\'à la section et y met le focus', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'ready');
    await page.locator('.hero .cta').click();
    await expect(page).toHaveURL(/#contact$/);
    const contact = page.locator('section#contact');
    await expect(contact).toBeFocused();
    // Section atteinte : en haut de l'écran, ou page en butée (dernière section).
    await expect
      .poll(() => contact.evaluate((el) => el.getBoundingClientRect().top < window.innerHeight / 2), { timeout: 5000 })
      .toBe(true);
    // Le titre de la section cible s'est révélé.
    await expect
      .poll(() => contact.locator('[data-reveal]').first().evaluate((el) => getComputedStyle(el).opacity), { timeout: 5000 })
      .toBe('1');
  });

  test('le lien d\'évitement garde le focus clavier', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'ready');
    await page.keyboard.press('Tab');
    await expect(page.locator('.skip-link')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('main#main')).toBeFocused();
  });

  test('curseur personnalisé : souris uniquement', async ({ page }, info) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'ready');
    const touch = info.project.use.hasTouch ?? false;
    if (touch) {
      await expect(page.locator('.cursor')).toHaveCount(0);
      await expect(page.locator('[data-magnetic].is-magnetic')).toHaveCount(0);
    } else {
      await page.mouse.move(200, 200);
      await page.mouse.move(260, 240);
      await expect(page.locator('.cursor.is-visible')).toHaveCount(1);
      await expect(page.locator('.cursor')).toHaveAttribute('aria-hidden', 'true');
      // Le curseur système n'est jamais masqué.
      expect(await page.evaluate(() => getComputedStyle(document.body).cursor)).not.toBe('none');
    }
  });

  test('si le script plante, le contenu reste visible', async ({ page }) => {
    await page.addInitScript(() => {
      Element.prototype.getBoundingClientRect = () => {
        throw new Error('panne simulée');
      };
    });
    await page.goto('/');
    await expect(page.locator('html')).not.toHaveClass(/js-motion/, { timeout: 6000 });
    expect(await visibility(page)).toMatchObject({ hidden: 0, name: 'visible' });
  });

  test('si le script ne se charge pas, le contenu reste visible', async ({ page }) => {
    await page.route('**/*.js', (route) => route.abort());
    await page.goto('/');
    await expect(page.locator('html')).not.toHaveClass(/js-motion/);
    expect(await visibility(page)).toMatchObject({ hidden: 0, name: 'visible' });
  });
});

test.describe('réduction des animations', () => {
  test.use({ reducedMotion: 'reduce' });

  for (const path of paths) {
    test(`${path} : tout est visible immédiatement, sans Lenis ni curseur`, async ({ page }) => {
      await page.goto(path);
      const html = page.locator('html');
      await expect(html).not.toHaveClass(/js-motion/);
      await expect(html).not.toHaveClass(/lenis/);
      const v = await visibility(page);
      expect(v.count).toBeGreaterThan(10);
      expect(v).toMatchObject({ hidden: 0, name: 'visible' });
      await page.mouse.move(200, 200);
      await expect(page.locator('.cursor')).toHaveCount(0);
      await expect(page.locator('[data-parallax][style]')).toHaveCount(0);
    });
  }
});

test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  for (const path of paths) {
    test(`${path} : tout est visible`, async ({ page }) => {
      await page.goto(path);
      const v = await visibility(page);
      expect(v.count).toBeGreaterThan(10);
      expect(v).toMatchObject({ hidden: 0, name: 'visible' });
    });
  }
});

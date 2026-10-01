import AxeBuilder from '@axe-core/playwright';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { expect, test } from './fixtures';

const pages = ['/', '/en/'];

for (const path of pages) {
  for (const scheme of ['dark', 'light'] as const) {
    test(`accessibilité (axe) sur ${path}, thème ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const { violations } = await new AxeBuilder({ page }).analyze();
      const bad = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    });
  }
}

test('CLS < 0,1 au chargement de /', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as any[]) if (!e.hadRecentInput) (window as any).__cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as any).__cls)).toBeLessThan(0.1);
});

test('les polices critiques sont préchargées', async ({ page }) => {
  await page.goto('/');
  const hrefs = await page.locator('link[rel="preload"][as="font"][crossorigin]').evaluateAll((l) => l.map((e) => e.getAttribute('href')));
  expect(hrefs).toHaveLength(2);
  for (const h of hrefs) expect(h).toMatch(/\.woff2$/);
});

test('robots.txt, sitemap et og-image', async ({ request }) => {
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toMatch(/Sitemap: http\S+\/sitemap-index\.xml/);
  const index = await request.get('/sitemap-index.xml');
  expect(index.ok()).toBe(true);
  const sm = await (await request.get('/sitemap-0.xml')).text();
  expect(sm).toContain('/en/');
  expect(sm).not.toContain('404');
  const og = await request.get('/og-image.png');
  expect(og.headers()['content-type']).toContain('image/png');
});

test('images aux bonnes dimensions', async ({ page }) => {
  await page.goto('/');
  const bad = await page.locator('img').evaluateAll((imgs) =>
    imgs.filter((i) => !i.getAttribute('width') || !i.getAttribute('height')).map((i) => i.getAttribute('src')),
  );
  expect(bad).toEqual([]);
});

test('poids JS total < 150 Ko gzip', () => {
  const walk = (d: string): string[] =>
    readdirSync(d).flatMap((f) => {
      const p = join(d, f);
      return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : [];
    });
  const total = walk('dist').reduce((n, f) => n + gzipSync(readFileSync(f)).length, 0);
  console.log(`JS gzip total: ${(total / 1024).toFixed(1)} Ko`);
  expect(total).toBeLessThan(150 * 1024);
});

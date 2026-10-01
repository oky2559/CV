/**
 * Génère public/og-image.png (1200x630) depuis src/data/cv.json via Playwright.
 * Usage : node scripts/generate-og.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = new URL('../', import.meta.url);
const cv = JSON.parse(readFileSync(new URL('src/data/cv.json', root), 'utf8'));
const font = fileURLToPath(new URL('node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2', root));
const fontUrl = `data:font/woff2;base64,${readFileSync(font).toString('base64')}`;

const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:SG;src:url(${fontUrl}) format('woff2');font-weight:300 700}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background:#0B0B0C;color:#F2EFE8;font-family:SG,system-ui,sans-serif;
 display:flex;flex-direction:column;justify-content:center;padding:0 90px;position:relative;overflow:hidden}
body:before{content:"";position:absolute;left:0;top:0;bottom:0;width:14px;background:#C6FF3D}
h1{font-size:112px;font-weight:700;letter-spacing:-4px;line-height:1}
h1 span{color:#C6FF3D}
p{margin-top:32px;font-size:44px;color:#C6FF3D;font-weight:500}
small{position:absolute;left:90px;bottom:60px;font-size:28px;color:#F2EFE8;opacity:.6}
</style><h1>${cv.identity.name}<span>.</span></h1><p>${cv.identity.title.fr}</p><small>${cv.identity.title.en}</small>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: fileURLToPath(new URL('public/og-image.png', root)) });
await browser.close();
console.log('public/og-image.png généré');

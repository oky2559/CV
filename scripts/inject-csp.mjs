// Usage : node scripts/inject-csp.mjs <nginx.conf> <dist> <sortie>
// Remplace __SCRIPT_HASHES__ par les empreintes sha256 des scripts inline
// (hors JSON) trouvés dans le HTML construit, pour une CSP sans 'unsafe-inline'.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const [conf, dist, out] = process.argv.slice(2);

function* htmlFiles(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* htmlFiles(p);
    else if (p.endsWith('.html')) yield p;
  }
}

const hashes = new Set();
for (const f of htmlFiles(dist)) {
  const html = readFileSync(f, 'utf8');
  for (const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    const attrs = m[1];
    if (/\bsrc=/.test(attrs) || /type="application\/json"/.test(attrs)) continue;
    if (!m[2].trim()) continue;
    hashes.add(`'sha256-${createHash('sha256').update(m[2]).digest('base64')}'`);
  }
}

const text = readFileSync(conf, 'utf8').replaceAll('__SCRIPT_HASHES__', [...hashes].join(' '));
writeFileSync(out, text);
console.log(`${hashes.size} empreinte(s) de script inline injectée(s)`);

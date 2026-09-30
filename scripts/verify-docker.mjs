// Vérification de bout en bout : construit l'image, lance le conteneur,
// interroge le site, puis nettoie. Sans dépendance. Sortie 0 si tout passe, 1 sinon.
import { spawnSync } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';

const NAME = 'cv-verify';
const PORT = 8080;
let failed = false;
let started = false;

const ok = (msg) => console.log(`✔ ${msg}`);
const ko = (msg) => {
  failed = true;
  console.log(`✘ ${msg}`);
};
const docker = (args, opts = {}) => spawnSync('docker', args, { encoding: 'utf8', ...opts });

function get(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('timeout')));
  });
}

function portFree() {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.listen(PORT, () => s.close(() => resolve(true)));
  });
}

async function waitReady() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await get('/')).status === 200) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function cleanup() {
  if (!started) return;
  docker(['rm', '-f', NAME]);
  started = false;
}

async function main() {
  if (docker(['info']).status !== 0) {
    ko('Docker indisponible : lance Docker Desktop puis réessaie');
    return;
  }
  if (!(await portFree())) {
    ko(`le port ${PORT} est déjà utilisé : libère-le (docker compose down, ou arrête l'autre programme)`);
    return;
  }

  const build = docker(['build', '-t', 'cv:latest', '.'], { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 });
  if (build.status !== 0) {
    ko('image cv:latest non construite');
    console.log((build.stdout + build.stderr).split('\n').slice(-25).join('\n'));
    return;
  }
  ok('image cv:latest construite');

  docker(['rm', '-f', NAME]);
  const run = docker(['run', '-d', '--name', NAME, '-p', `${PORT}:80`, 'cv:latest']);
  if (run.status !== 0) {
    ko(`conteneur non lancé : ${run.stderr.trim()}`);
    return;
  }
  started = true;
  if (!(await waitReady())) {
    ko('le conteneur ne répond pas sur http://localhost:8080');
    return;
  }

  for (const [path, lang, label] of [['/', 'fr', 'GET /       '], ['/en/', 'en', 'GET /en/    ']]) {
    const r = await get(path);
    const body = r.body.toString('utf8');
    const line = `${label} → ${r.status}  contient "Victor Schmutz"  lang="${lang}"`;
    if (r.status === 200 && body.includes('Victor Schmutz') && body.includes(`<html lang="${lang}"`)) ok(line);
    else ko(line);
  }

  const nope = await get('/nope');
  const nopeLine = 'GET /nope    → 404  page 404 personnalisée';
  const nopeBody = nope.body.toString('utf8');
  if (nope.status === 404 && /<html/i.test(nopeBody) && !nopeBody.includes('<center>nginx')) ok(nopeLine);
  else ko(`GET /nope    → ${nope.status}  page 404 non personnalisée`);

  const h = (await get('/')).headers;
  const nope404 = nope.headers;
  const needed = ['content-security-policy', 'x-content-type-options'];
  const missing = needed.filter((n) => !h[n] || !nope404[n]);
  if (!missing.length) ok('en-têtes     → Content-Security-Policy, X-Content-Type-Options présents');
  else ko(`en-têtes     → manquants : ${missing.join(', ')}`);

  const gz = await get('/', { 'Accept-Encoding': 'gzip' });
  if (gz.headers['content-encoding'] === 'gzip') ok('gzip         → Content-Encoding: gzip sur /');
  else ko(`gzip         → Content-Encoding absent sur / (${gz.headers['content-encoding'] ?? 'aucun'})`);
}

let error;
try {
  await main();
} catch (e) {
  error = e;
  failed = true;
  console.log(`✘ erreur inattendue : ${e.message}`);
} finally {
  const wasStarted = started;
  cleanup();
  if (wasStarted) ok('conteneur arrêté');
}

if (failed) {
  console.log('ÉCHEC — voir les lignes ✘ ci-dessus');
  process.exit(1);
}
console.log('OK — le CV est prêt à être déployé');

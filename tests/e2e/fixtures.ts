/**
 * `test` commun à toute la suite e2e : chaque contexte de navigateur
 * intercepte les appels à api.github.com et répond avec des données simulées.
 * La suite reste ainsi déterministe et hors ligne. Un test peut remplacer ces
 * réponses avec `page.route` (prioritaire sur `context.route`).
 */
import { test as base, type Route } from '@playwright/test';

export { expect, type Page } from '@playwright/test';

export const GH_USER = 'oky2559';

export const GH_REPOS = [
  { name: 'alpha', fork: false, language: 'TypeScript', pushed_at: '2026-09-10T10:47:26Z', stargazers_count: 4 },
  { name: 'beta', fork: false, language: 'TypeScript', pushed_at: '2026-05-01T00:00:00Z', stargazers_count: 2 },
  { name: 'gamma', fork: false, language: 'C', pushed_at: '2026-01-16T16:16:21Z', stargazers_count: 0 },
  { name: 'delta', fork: false, language: 'Nix', pushed_at: '2025-12-21T21:58:46Z', stargazers_count: 1 },
  { name: 'epsilon', fork: false, language: 'Go', pushed_at: '2025-11-01T00:00:00Z', stargazers_count: 0 },
  { name: 'fork', fork: true, language: 'Rust', pushed_at: '2026-09-30T00:00:00Z', stargazers_count: 50 },
];

/** Répond comme l'API GitHub (en-têtes CORS compris). */
export function fulfillGithub(route: Route): Promise<void> {
  const url = new URL(route.request().url());
  const headers = { 'access-control-allow-origin': '*' };
  if (url.pathname === `/users/${GH_USER}`) return route.fulfill({ json: { login: GH_USER, public_repos: GH_REPOS.length }, headers });
  if (url.pathname === `/users/${GH_USER}/repos`) return route.fulfill({ json: GH_REPOS, headers });
  return route.fulfill({ status: 404, json: { message: 'Not Found' }, headers });
}

export const test = base.extend<{ githubMock: void }>({
  githubMock: [
    async ({ context }, use) => {
      await context.route('https://api.github.com/**', fulfillGithub);
      await use();
    },
    { auto: true },
  ],
});

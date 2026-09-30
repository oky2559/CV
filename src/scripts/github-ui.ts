/**
 * Remplit et affiche le bloc `GithubStats.astro` quand les stats arrivent.
 * En cas d'échec, le bloc reste `hidden` : rien n'est affiché, rien n'est
 * écrit dans la console.
 */
import { getGithubStats, relativeTime, type GithubStats, type StorageLike } from '../lib/github';

const COUNT_MS = 1200;

/**
 * `sessionStorage` peut être absent ou lever une exception rien qu'à l'accès
 * (cookies bloqués, certains modes privés). Dans ce cas : pas de cache, mais
 * les stats sont quand même demandées et affichées.
 */
function safeStorage(): StorageLike | null {
  try {
    const s = window.sessionStorage;
    const probe = '__gh_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Compteur : le nombre final est lu par les lecteurs d'écran (texte masqué
 * visuellement), la partie animée leur est cachée.
 */
function setCount(dd: HTMLElement, value: number, lang: string, animate: boolean): void {
  const fmt = new Intl.NumberFormat(lang);
  const visible = document.createElement('span');
  visible.setAttribute('aria-hidden', 'true');
  const spoken = document.createElement('span');
  spoken.className = 'visually-hidden';
  spoken.textContent = fmt.format(value);
  dd.replaceChildren(visible, spoken);

  if (!animate || value === 0) {
    visible.textContent = fmt.format(value);
    return;
  }
  visible.textContent = fmt.format(0);
  const start = () => {
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / COUNT_MS);
      const eased = 1 - (1 - p) ** 3;
      visible.textContent = fmt.format(Math.round(value * eased));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  // L'animation démarre quand le compteur entre à l'écran.
  if (!('IntersectionObserver' in window)) return start();
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      io.disconnect();
      start();
    }
  });
  io.observe(dd);
}

function render(root: HTMLElement, stats: GithubStats, lang: string): void {
  const animate = !reducedMotion();
  const count = (name: string) => root.querySelector<HTMLElement>(`[data-gh-count="${name}"]`);
  const row = (name: string) => root.querySelector<HTMLElement>(`[data-gh-row="${name}"]`);

  const repos = count('repos');
  if (repos) setCount(repos, stats.repos, lang, animate);

  // Les étoiles ne sont montrées que s'il y en a.
  const stars = count('stars');
  const starsRow = row('stars');
  if (stars && starsRow && stats.stars > 0) {
    setCount(stars, stats.stars, lang, animate);
    starsRow.hidden = false;
  }

  const list = root.querySelector<HTMLElement>('[data-gh-languages]');
  const langRow = row('languages');
  if (list && langRow) {
    list.replaceChildren(
      ...stats.languages.map((name) => {
        const li = document.createElement('li');
        li.textContent = name;
        return li;
      }),
    );
    langRow.hidden = stats.languages.length === 0;
  }

  const time = root.querySelector<HTMLTimeElement>('[data-gh-last-push]');
  if (time) {
    time.dateTime = stats.lastPush;
    time.textContent = relativeTime(stats.lastPush, Date.now(), lang);
    time.title = new Intl.DateTimeFormat(lang, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(stats.lastPush));
  }

  if (animate) {
    root.classList.add('is-entering');
    root.hidden = false;
    // Deux frames : l'état de départ est peint avant la transition.
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('is-entering')));
  } else {
    root.hidden = false;
  }
  root.dataset.ghState = 'ready';
}

async function init(): Promise<void> {
  const root = document.querySelector<HTMLElement>('[data-gh-stats]');
  const user = root?.dataset.user;
  if (!root || !user) return;
  const lang = root.dataset.lang ?? document.documentElement.lang;
  const stats = await getGithubStats(user, {
    fetch: (input, init) => window.fetch(input, init),
    storage: safeStorage(),
    now: Date.now,
  });
  if (stats) render(root, stats, lang);
  else root.dataset.ghState = 'unavailable';
}

init().catch(() => {
  /* jamais d'erreur visible : le bloc reste masqué */
});

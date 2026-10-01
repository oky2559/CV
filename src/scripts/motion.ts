/**
 * Animations et interactions : scroll fluide (Lenis), révélation du nom
 * (SplitText), apparitions au scroll (ScrollTrigger), ligne de la timeline,
 * parallaxe légère, boutons magnétiques et curseur personnalisé.
 *
 * Principes :
 * - le HTML est lisible sans ce script ; l'état « caché avant animation »
 *   n'existe que sous `html.js-motion`, classe posée ici au démarrage ;
 * - si quoi que ce soit échoue, on retire `js-motion` et on nettoie : le
 *   contenu redevient visible tel quel ;
 * - `prefers-reduced-motion: reduce` → rien n'est caché ni animé (pas de
 *   Lenis, pas de parallaxe, pas de curseur, pas d'effet magnétique).
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';

const root = document.documentElement;
const REVEAL = '[data-reveal]';
const HERO_REVEAL = '[data-hero-reveal]';
const HERO_NAME = '[data-hero-name]';

let lenis: Lenis | null = null;
let failed = false;

/** Filet de sécurité : tout redevient visible, sans animation. */
function fail(err: unknown): void {
  if (failed) return;
  failed = true;
  console.warn('[motion] désactivé :', err);
  root.classList.remove('js-motion');
  root.removeAttribute('data-motion');
  try {
    lenis?.destroy();
    ScrollTrigger.killAll();
    gsap.globalTimeline.clear();
    gsap.set(`${REVEAL}, ${HERO_REVEAL}, ${HERO_NAME}, [data-parallax], [data-timeline], [data-magnetic]`, {
      clearProps: 'all',
    });
    document.querySelector('.cursor')?.remove();
  } catch {
    /* le retrait de js-motion suffit à tout rendre visible */
  }
}

/** Montre immédiatement un élément révélable (focus clavier, impression…). */
function showNow(el: Element): void {
  gsap.killTweensOf(el);
  el.classList.add('is-revealed');
  gsap.set(el, { clearProps: 'all' });
}

function revealAll(): void {
  document.querySelectorAll(`${REVEAL}, ${HERO_REVEAL}`).forEach(showNow);
  gsap.set(HERO_NAME, { visibility: 'visible' });
}

// ---------------------------------------------------------------------------
// Scroll fluide + liens d'ancre

function initLenis(): Lenis {
  // lerp plus élevé que le défaut (0,1) : le défilement suit la molette sans traîner.
  const instance = new Lenis({ autoRaf: false, anchors: false, lerp: 0.2 });
  instance.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => instance.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  return instance;
}

/** Déplace le focus sur la cible d'une ancre, sans provoquer de saut. */
function focusTarget(target: HTMLElement): void {
  if (target === document.body) return;
  if (!target.matches('a[href], button, input, select, textarea, [tabindex]')) {
    target.setAttribute('tabindex', '-1');
    target.setAttribute('data-anchor-target', '');
  }
  target.focus({ preventScroll: true });
}

/**
 * Les liens `#section` (nav, lien d'évitement, CTA…) passent par Lenis pour
 * rester fluides, mettent à jour l'URL et déplacent le focus sur la cible.
 */
function bindAnchors(): void {
  document.addEventListener('click', (e) => {
    if (failed || !lenis) return; // comportement natif
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = (e.target as Element | null)?.closest?.('a[href*="#"]');
    if (!(link instanceof HTMLAnchorElement)) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname || url.hash.length < 2) return;
    const id = decodeURIComponent(url.hash.slice(1));
    const target = id === 'top' ? document.body : document.getElementById(id);
    if (!target) return;

    e.preventDefault();
    if (url.hash !== location.hash) history.pushState(null, '', url.hash);
    lenis.scrollTo(target === document.body ? 0 : target);
    focusTarget(target);
  });
}

// ---------------------------------------------------------------------------
// Révélations

function initHero(): void {
  const name = document.querySelector<HTMLElement>(HERO_NAME);
  const extras = gsap.utils.toArray<HTMLElement>(HERO_REVEAL);
  if (!name) {
    extras.forEach(showNow);
    return;
  }

  // On attend les polices (préchargées ; au plus 300 ms) pour découper avec les bonnes métriques.
  const fontsReady = Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 300))]);
  fontsReady
    .then(() => {
      if (failed) return;
      ScrollTrigger.refresh(); // les polices ont pu changer la mise en page
      const split = SplitText.create(name, { type: 'chars', mask: 'chars', charsClass: 'char' });
      gsap.set(name, { visibility: 'visible' });
      gsap
        .timeline({ defaults: { ease: 'expo.out' } })
        .from(split.chars, {
          yPercent: 115,
          duration: 0.6,
          stagger: 0.02,
          onComplete: () => split.revert(),
        })
        .to(
          extras,
          {
            // Fondu seul : le CTA ne bouge pas sous le pointeur pendant l'intro.
            opacity: 1,
            duration: 0.35,
            stagger: 0.05,
            onComplete: () => extras.forEach(showNow),
          },
          0.1,
        );
    })
    .catch(fail);
}

function initReveals(): void {
  const items = gsap.utils.toArray<HTMLElement>(REVEAL);
  if (!items.length) return;
  gsap.set(items, { y: 16, transition: 'none' });

  ScrollTrigger.batch(items, {
    // clamp() : les derniers éléments de la page se déclenchent aussi en butée de scroll.
    start: 'clamp(top bottom)',
    end: 'max',
    once: true,
    onEnter: (batch) => {
      // Déjà dépassés (arrivée via une ancre) : affichés sans attendre leur tour.
      const inView = batch.filter((el) => {
        if (el.getBoundingClientRect().bottom > 0) return true;
        showNow(el);
        return false;
      });
      if (!inView.length) return;
      gsap.to(inView, {
        opacity: 1,
        y: 0,
        duration: 0.4,
        ease: 'power2.out',
        overwrite: true,
        stagger: {
          each: 0.04,
          onComplete(this: gsap.core.Tween) {
            this.targets<Element>().forEach(showNow);
          },
        },
      });
    },
  });

  // Un élément atteint au clavier ne doit jamais rester invisible.
  document.addEventListener('focusin', (e) => {
    const el = (e.target as Element | null)?.closest?.(`${REVEAL}, ${HERO_REVEAL}`);
    if (el && !el.classList.contains('is-revealed')) showNow(el);
  });
  window.addEventListener('beforeprint', revealAll);
}

/** La ligne accent de la timeline se dessine au fil du scroll. */
function initTimelines(): void {
  for (const line of gsap.utils.toArray<HTMLElement>('[data-timeline]')) {
    gsap.fromTo(
      line,
      { '--draw': 0 },
      {
        '--draw': 1,
        ease: 'none',
        scrollTrigger: { trigger: line, start: 'top 75%', end: 'bottom 60%', scrub: 0.6 },
      },
    );
  }
}

/** Parallaxe légère : l'élément glisse de ±depth px pendant sa traversée. */
function initParallax(): void {
  for (const el of gsap.utils.toArray<HTMLElement>('[data-parallax]')) {
    const depth = Number(el.dataset.parallax) || 40;
    gsap.fromTo(
      el,
      { y: depth },
      {
        y: -depth,
        ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
      },
    );
  }
  // Le nom du hero s'éloigne un peu plus lentement que la page.
  const hero = document.querySelector<HTMLElement>(HERO_NAME);
  const section = hero?.closest('section');
  if (hero && section) {
    gsap.to(hero, {
      y: () => section.offsetHeight * 0.18,
      ease: 'none',
      scrollTrigger: { trigger: section, start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
    });
  }
}

// ---------------------------------------------------------------------------
// Souris uniquement

function initMagnetic(): void {
  for (const el of gsap.utils.toArray<HTMLElement>('[data-magnetic]')) {
    const strength = 0.3;
    const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });
    el.classList.add('is-magnetic');
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * strength);
      yTo((e.clientY - (r.top + r.height / 2)) * strength);
    });
    el.addEventListener('pointerleave', () => {
      xTo(0);
      yTo(0);
    });
  }
}

/**
 * Curseur personnalisé : un anneau qui suit la souris. Le curseur système
 * reste affiché (sélection de texte, champs…) ; l'anneau s'efface sur les
 * champs de saisie et grossit sur les éléments cliquables.
 */
function initCursor(): void {
  const cursor = document.createElement('div');
  cursor.className = 'cursor';
  cursor.setAttribute('aria-hidden', 'true');
  cursor.setAttribute('data-no-print', '');
  cursor.append(document.createElement('span'));
  document.body.append(cursor);

  const xTo = gsap.quickTo(cursor, 'x', { duration: 0.35, ease: 'power3.out' });
  const yTo = gsap.quickTo(cursor, 'y', { duration: 0.35, ease: 'power3.out' });
  let shown = false;

  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') {
        cursor.classList.remove('is-visible');
        return;
      }
      if (!shown) {
        gsap.set(cursor, { x: e.clientX, y: e.clientY });
        shown = true;
      }
      xTo(e.clientX);
      yTo(e.clientY);
      const t = e.target instanceof Element ? e.target : null;
      cursor.classList.add('is-visible');
      cursor.classList.toggle('is-link', !!t?.closest('a[href], button, [role="button"], label, summary'));
      cursor.classList.toggle('is-field', !!t?.closest('input, textarea, select, [contenteditable]'));
    },
    { passive: true },
  );
  document.addEventListener('mouseleave', () => cursor.classList.remove('is-visible'));
  window.addEventListener('blur', () => cursor.classList.remove('is-visible'));
}

// ---------------------------------------------------------------------------

function start(): void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (reduced) {
    // Rien à cacher ni à animer ; les ancres gardent le comportement natif.
    return;
  }

  root.classList.add('js-motion');
  try {
    gsap.registerPlugin(ScrollTrigger, SplitText);
    lenis = initLenis();
    bindAnchors();
    // Le terminal (ou toute autre modale) fige le scroll fluide tant qu'il est ouvert.
    document.addEventListener('cv:scroll-lock', (e) => {
      if ((e as CustomEvent<boolean>).detail) lenis?.stop();
      else lenis?.start();
    });
    initHero();
    initReveals();
    initTimelines();
    initParallax();
    if (finePointer) {
      initMagnetic();
      initCursor();
    }
    root.setAttribute('data-motion', 'ready');
  } catch (err) {
    fail(err);
    return;
  }

  // Filets de sécurité après le démarrage :
  // - une erreur non rattrapée venant de ce bundle (GSAP, Lenis…) coupe tout ;
  const bundle = import.meta.url;
  window.addEventListener('error', (e) => {
    if (e.filename === bundle) fail(e.error ?? e.message);
  });
  // - si le nom n'est toujours pas révélé après 4 s, on abandonne l'animation.
  window.setTimeout(() => {
    const name = document.querySelector(HERO_NAME);
    if (name && getComputedStyle(name).visibility === 'hidden') fail('révélation du nom trop lente');
  }, 4000);
}

try {
  start();
} catch (err) {
  fail(err);
}

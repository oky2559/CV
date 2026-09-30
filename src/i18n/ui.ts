export type Lang = 'fr' | 'en';

export const langs: readonly Lang[] = ['fr', 'en'];

/** Ancres des sections, dans l'ordre de la page. */
export const sections = ['about', 'experience', 'projects', 'skills', 'contact'] as const;
export type SectionId = (typeof sections)[number];

const fr = {
  skip: 'Aller au contenu',
  'nav.label': 'Navigation principale',
  'nav.home': 'Retour en haut',
  'nav.about': 'À propos',
  'nav.experience': 'Parcours',
  'nav.projects': 'Projets',
  'nav.skills': 'Compétences',
  'nav.contact': 'Contact',
  'lang.switch': 'Read in English',
  'lang.short': 'EN',
  'hero.eyebrow': 'CV · Portfolio',
  '404.title': 'Page introuvable',
  '404.text': "Cette page n'existe pas, ou plus. Le CV, lui, est toujours là.",
  '404.back': "Retour à l'accueil",
} as const;

type Dict = { [K in keyof typeof fr]: string };

const en: Dict = {
  skip: 'Skip to content',
  'nav.label': 'Main navigation',
  'nav.home': 'Back to top',
  'nav.about': 'About',
  'nav.experience': 'Experience',
  'nav.projects': 'Projects',
  'nav.skills': 'Skills',
  'nav.contact': 'Contact',
  'lang.switch': 'Lire en français',
  'lang.short': 'FR',
  'hero.eyebrow': 'Resume · Portfolio',
  '404.title': 'Page not found',
  '404.text': "This page doesn't exist, or not anymore. The resume still does.",
  '404.back': 'Back to home',
};

export const ui: Record<Lang, Dict> = { fr, en };

export type UIKey = keyof Dict;

export function t(lang: Lang, key: UIKey): string {
  return ui[lang][key];
}

export function otherLang(lang: Lang): Lang {
  return lang === 'fr' ? 'en' : 'fr';
}

/** Chemin de la page d'accueil d'une langue : `/` (fr) ou `/en/`. */
export function homePath(lang: Lang): string {
  return lang === 'fr' ? '/' : '/en/';
}

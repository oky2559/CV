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
  'hero.scroll': 'Défiler',
  'hero.cta': 'Me contacter',
  'hero.pdf': 'Télécharger en PDF',
  'about.title': 'À propos',
  'about.location': 'Basé à',
  'about.photo': 'Photo de',
  'experience.title': 'Parcours',
  'experience.work': 'Expériences',
  'experience.education': 'Formation',
  'experience.present': "aujourd'hui",
  'projects.title': 'Projets',
  'projects.code': 'Code',
  'projects.demo': 'Démo',
  'skills.title': 'Compétences',
  'skills.languages': 'Langues',
  'contact.title': 'Contact',
  'contact.lead': 'Un stage, une alternance, un poste ? Parlons-en.',
  'contact.email': 'Email',
  'contact.copy': "Copier l'email",
  'contact.copied': 'Email copié dans le presse-papiers',
  'contact.copyError': 'Copie impossible : sélectionnez l’adresse à la main',
  'contact.elsewhere': 'Ailleurs',
  'terminal.hint': 'psst… appuie sur',
  'terminal.hintTouch': 'psst… ouvre le terminal',
  'terminal.title': 'Terminal de Victor',
  'terminal.close': 'Fermer le terminal',
  'terminal.input': 'Commande',
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
  'hero.scroll': 'Scroll',
  'hero.cta': 'Get in touch',
  'hero.pdf': 'Download PDF',
  'about.title': 'About',
  'about.location': 'Based in',
  'about.photo': 'Photo of',
  'experience.title': 'Experience',
  'experience.work': 'Work',
  'experience.education': 'Education',
  'experience.present': 'present',
  'projects.title': 'Projects',
  'projects.code': 'Code',
  'projects.demo': 'Demo',
  'skills.title': 'Skills',
  'skills.languages': 'Languages',
  'contact.title': 'Contact',
  'contact.lead': "Internship, work-study or a full-time role? Let's talk.",
  'contact.email': 'Email',
  'contact.copy': 'Copy email',
  'contact.copied': 'Email copied to clipboard',
  'contact.copyError': 'Could not copy: please select the address manually',
  'contact.elsewhere': 'Elsewhere',
  'terminal.hint': 'psst… press',
  'terminal.hintTouch': 'psst… open the terminal',
  'terminal.title': "Victor's terminal",
  'terminal.close': 'Close the terminal',
  'terminal.input': 'Command',
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

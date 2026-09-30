/**
 * Logique pure du terminal caché : analyse de la ligne, commandes, suggestion,
 * autocomplétion et historique. Aucun accès au DOM ni à `window` : chaque
 * commande renvoie des lignes de texte et des « effets » que `terminal-ui.ts`
 * exécute (navigation, ouverture d'URL, effacement, fermeture, célébration).
 */
import type { CV } from './cv';
import { homePath, otherLang, type Lang } from '../i18n/ui';
import { formatPeriod } from './format';

export type LineKind = 'out' | 'muted' | 'accent' | 'error';

export interface Line {
  text: string;
  kind?: LineKind;
  /** Lien facultatif (http(s) ou mailto uniquement, vérifié à l'affichage). */
  href?: string;
}

export type Effect =
  | { type: 'navigate'; url: string }
  | { type: 'open-url'; url: string }
  | { type: 'clear' }
  | { type: 'close' }
  | { type: 'celebrate' };

export interface Result {
  lines: Line[];
  effects: Effect[];
}

export interface Context {
  cv: CV;
  lang: Lang;
}

export const COMMANDS = [
  'help',
  'whoami',
  'experience',
  'projects',
  'skills',
  'contact',
  'lang',
  'github',
  'clear',
  'exit',
  'sudo',
] as const;
export type Command = (typeof COMMANDS)[number];

/** Formes complètes proposées par l'autocomplétion. */
const COMPLETIONS = [
  'help',
  'whoami',
  'experience',
  'projects',
  'skills',
  'contact',
  'lang fr',
  'lang en',
  'github',
  'clear',
  'exit',
  'sudo hire-victor',
];

const text = {
  fr: {
    prompt: 'visiteur@victor:~$',
    welcome: 'Terminal de Victor. Tapez « help » pour la liste des commandes.',
    help: {
      help: 'affiche cette aide',
      whoami: 'qui est Victor ?',
      experience: 'parcours et formation',
      projects: 'projets',
      skills: 'compétences et langues',
      contact: 'email, GitHub, LinkedIn',
      lang: 'change de langue (lang fr | lang en)',
      github: 'ouvre le profil GitHub',
      clear: "efface l'écran",
      exit: 'ferme le terminal (ou Échap)',
      sudo: '…',
    } satisfies Record<Command, string>,
    helpTitle: 'Commandes disponibles :',
    notFound: (c: string) => `commande introuvable : ${c}`,
    didYouMean: (c: string) => `Vous vouliez dire « ${c} » ?`,
    tryHelp: 'Tapez « help » pour voir les commandes.',
    langUsage: 'usage : lang fr | lang en',
    langSame: 'Déjà en français.',
    langGo: 'Switching to English…',
    github: (u: string) => `Ouverture de ${u}…`,
    education: 'Formation',
    work: 'Expériences',
    present: "aujourd'hui",
    languages: 'Langues',
    sudoDenied: (u: string) => `${u} n'est pas dans le fichier sudoers. Cet incident sera signalé.`,
    sudoUsage: 'usage : sudo hire-victor',
    hired: [
      '[sudo] mot de passe pour visiteur : ********',
      'Accès accordé. Excellente décision.',
      'Victor est prêt à rejoindre votre équipe.',
    ],
    hiredMail: 'Écrivez-lui :',
    location: 'Basé à',
    bye: 'À bientôt.',
  },
  en: {
    prompt: 'guest@victor:~$',
    welcome: "Victor's terminal. Type \"help\" to list the commands.",
    help: {
      help: 'show this help',
      whoami: 'who is Victor?',
      experience: 'work and education',
      projects: 'projects',
      skills: 'skills and languages',
      contact: 'email, GitHub, LinkedIn',
      lang: 'switch language (lang fr | lang en)',
      github: 'open the GitHub profile',
      clear: 'clear the screen',
      exit: 'close the terminal (or Esc)',
      sudo: '…',
    } satisfies Record<Command, string>,
    helpTitle: 'Available commands:',
    notFound: (c: string) => `command not found: ${c}`,
    didYouMean: (c: string) => `Did you mean "${c}"?`,
    tryHelp: 'Type "help" to list the commands.',
    langUsage: 'usage: lang fr | lang en',
    langSame: 'Already in English.',
    langGo: 'Passage en français…',
    github: (u: string) => `Opening ${u}…`,
    education: 'Education',
    work: 'Work',
    present: 'present',
    languages: 'Languages',
    sudoDenied: (u: string) => `${u} is not in the sudoers file. This incident will be reported.`,
    sudoUsage: 'usage: sudo hire-victor',
    hired: [
      '[sudo] password for guest: ********',
      'Access granted. Excellent decision.',
      'Victor is ready to join your team.',
    ],
    hiredMail: 'Write to him:',
    location: 'Based in',
    bye: 'See you soon.',
  },
} as const;

export function strings(lang: Lang) {
  return text[lang];
}

/** Découpe une ligne en commande (minuscules) + arguments. */
export function parse(line: string): { cmd: string; args: string[] } {
  const [cmd = '', ...args] = line.trim().split(/\s+/).filter(Boolean);
  return { cmd: cmd.toLowerCase(), args };
}

/** Distance d'édition (Levenshtein). */
export function distance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** Commande la plus proche, ou null si rien de raisonnablement proche. */
export function suggest(input: string): Command | null {
  const word = input.toLowerCase();
  if (!word) return null;
  let best: Command | null = null;
  let bestD = Infinity;
  for (const c of COMMANDS) {
    const d = c.startsWith(word) ? 0 : distance(word, c);
    if (d < bestD) {
      best = c;
      bestD = d;
    }
  }
  const max = Math.max(2, Math.floor((best?.length ?? 0) / 3));
  return bestD <= max ? best : null;
}

/**
 * Autocomplétion `Tab` : `value` est la nouvelle saisie, `options` la liste
 * des possibilités à afficher quand la saisie reste ambiguë.
 */
export function complete(input: string): { value: string; options: string[] } {
  const typed = input.replace(/^\s+/, '').toLowerCase().replace(/\s+/g, ' ');
  if (!typed) return { value: input, options: [] };
  const matches = COMPLETIONS.filter((c) => c.startsWith(typed));
  if (matches.length === 0) return { value: input, options: [] };
  if (matches.length === 1) return { value: matches[0], options: [] };
  let prefix = matches[0];
  for (const m of matches) while (!m.startsWith(prefix)) prefix = prefix.slice(0, -1);
  return prefix.length > typed.length ? { value: prefix, options: [] } : { value: input, options: matches };
}

/** Historique des commandes, navigable avec ↑ / ↓. */
export class History {
  private entries: string[] = [];
  private index = 0;
  private draft = '';

  constructor(private readonly max = 50) {}

  get items(): readonly string[] {
    return this.entries;
  }

  push(line: string): void {
    const l = line.trim();
    if (l && this.entries[this.entries.length - 1] !== l) {
      this.entries.push(l);
      if (this.entries.length > this.max) this.entries.shift();
    }
    this.index = this.entries.length;
    this.draft = '';
  }

  /** ↑ : entrée précédente (la saisie en cours est gardée de côté). */
  prev(current: string): string {
    if (this.index === this.entries.length) this.draft = current;
    if (this.index > 0) this.index--;
    return this.entries[this.index] ?? current;
  }

  /** ↓ : entrée suivante, puis retour à la saisie en cours. */
  next(): string {
    if (this.index < this.entries.length) this.index++;
    return this.index === this.entries.length ? this.draft : this.entries[this.index];
  }
}

const out = (t: string, kind?: LineKind, href?: string): Line => ({ text: t, ...(kind && { kind }), ...(href && { href }) });
const ok = (lines: Line[], effects: Effect[] = []): Result => ({ lines, effects });

/** Exécute une ligne de commande. */
export function run(line: string, { cv, lang }: Context): Result {
  const s = strings(lang);
  const { cmd, args } = parse(line);
  const arg = args[0]?.toLowerCase();

  switch (cmd) {
    case '':
      return ok([]);

    case 'help': {
      const w = Math.max(...COMMANDS.map((c) => c.length));
      return ok([
        out(s.helpTitle, 'muted'),
        ...COMMANDS.filter((c) => c !== 'sudo').map((c) => out(`  ${c.padEnd(w)}  ${s.help[c]}`)),
      ]);
    }

    case 'whoami':
      return ok([
        out(cv.identity.name, 'accent'),
        out(cv.identity.title),
        out(cv.identity.tagline, 'muted'),
        out(`${s.location} ${cv.identity.location}`, 'muted'),
      ]);

    case 'experience':
      return ok([
        out(`# ${s.work}`, 'muted'),
        ...cv.experiences.map((x) =>
          out(`  ${formatPeriod(x.start, x.end, lang, s.present)}  ${x.role} @ ${x.company}`),
        ),
        out(`# ${s.education}`, 'muted'),
        ...cv.education.map((x) => out(`  ${formatPeriod(x.start, x.end, lang, s.present)}  ${x.degree} @ ${x.school}`)),
      ]);

    case 'projects':
      return ok(
        cv.projects.flatMap((p) => [
          out(p.title, 'accent'),
          out(`  ${p.description}`),
          ...(p.stack.length ? [out(`  [${p.stack.join(', ')}]`, 'muted')] : []),
          ...(p.github ? [out(`  ${p.github}`, 'muted', p.github)] : []),
          ...(p.demo ? [out(`  ${p.demo}`, 'muted', p.demo)] : []),
        ]),
      );

    case 'skills':
      return ok([
        ...cv.skills.map((g) => out(`${g.category} : ${g.items.join(', ')}`)),
        out(`${s.languages} : ${cv.languages.map((l) => `${l.name} (${l.level})`).join(', ')}`, 'muted'),
      ]);

    case 'contact':
      return ok([
        out(`email     ${cv.links.email}`, undefined, `mailto:${cv.links.email}`),
        out(`github    ${cv.links.github}`, undefined, cv.links.github),
        out(`linkedin  ${cv.links.linkedin}`, undefined, cv.links.linkedin),
      ]);

    case 'lang': {
      if (arg !== 'fr' && arg !== 'en') return ok([out(s.langUsage, 'error')]);
      if (arg === lang) return ok([out(s.langSame, 'muted')]);
      return ok([out(s.langGo, 'muted')], [{ type: 'navigate', url: homePath(otherLang(lang)) }]);
    }

    case 'github':
      return ok([out(s.github(cv.links.github), 'muted', cv.links.github)], [{ type: 'open-url', url: cv.links.github }]);

    case 'clear':
      return ok([], [{ type: 'clear' }]);

    case 'exit':
      return ok([out(s.bye, 'muted')], [{ type: 'close' }]);

    case 'sudo':
      if (arg === 'hire-victor') {
        return ok(
          [
            ...s.hired.map((l, i) => out(l, i === 0 ? 'muted' : 'accent')),
            out(`${s.hiredMail} ${cv.links.email}`, undefined, `mailto:${cv.links.email}`),
          ],
          [{ type: 'celebrate' }],
        );
      }
      return ok([out(args.length ? s.sudoDenied(s.prompt.split('@')[0]) : s.sudoUsage, 'error')]);

    default: {
      const hint = suggest(cmd);
      return ok([out(s.notFound(cmd), 'error'), out(hint ? s.didYouMean(hint) : s.tryHelp, 'muted')]);
    }
  }
}

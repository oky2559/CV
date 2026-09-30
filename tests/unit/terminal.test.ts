import { describe, expect, test } from 'vitest';
import { getCV } from '../../src/lib/cv';
import { COMMANDS, complete, History, parse, run, suggest, type Result } from '../../src/lib/terminal';

const fr = { cv: getCV('fr'), lang: 'fr' as const };
const en = { cv: getCV('en'), lang: 'en' as const };
const texts = (r: Result) => r.lines.map((l) => l.text).join('\n');

describe('analyse', () => {
  test('commande en minuscules + arguments, espaces ignorés', () => {
    expect(parse('  LANG   en  ')).toEqual({ cmd: 'lang', args: ['en'] });
    expect(parse('')).toEqual({ cmd: '', args: [] });
  });
  test('ligne vide : aucune sortie', () => {
    expect(run('   ', fr)).toEqual({ lines: [], effects: [] });
  });
});

describe('commandes', () => {
  test('help liste toutes les commandes publiques', () => {
    const out = texts(run('help', fr));
    for (const c of COMMANDS.filter((c) => c !== 'sudo')) expect(out).toContain(c);
    expect(out).toContain('Commandes disponibles');
    expect(texts(run('help', en))).toContain('Available commands');
  });

  test('whoami : nom, titre et accroche dans la langue courante', () => {
    const out = texts(run('whoami', fr));
    expect(out).toContain(fr.cv.identity.name);
    expect(out).toContain(fr.cv.identity.title);
    expect(texts(run('whoami', en))).toContain(en.cv.identity.title);
  });

  test('experience : postes et formations', () => {
    const out = texts(run('experience', fr));
    for (const x of fr.cv.experiences) expect(out).toContain(`${x.role} @ ${x.company}`);
    for (const x of fr.cv.education) expect(out).toContain(x.school);
    expect(out).toContain("aujourd'hui");
    expect(texts(run('experience', en))).toContain('present');
  });

  test('projects : titres, descriptions et liens', () => {
    const r = run('projects', en);
    for (const p of en.cv.projects) {
      expect(texts(r)).toContain(p.title);
      expect(texts(r)).toContain(p.description);
      if (p.github) expect(r.lines.some((l) => l.href === p.github)).toBe(true);
    }
  });

  test('skills : catégories, éléments et langues parlées', () => {
    const out = texts(run('skills', fr));
    for (const g of fr.cv.skills) expect(out).toContain(`${g.category} : ${g.items.join(', ')}`);
    for (const l of fr.cv.languages) expect(out).toContain(l.name);
  });

  test('contact : email, GitHub, LinkedIn avec liens', () => {
    const r = run('contact', fr);
    const hrefs = r.lines.map((l) => l.href);
    expect(hrefs).toEqual([`mailto:${fr.cv.links.email}`, fr.cv.links.github, fr.cv.links.linkedin]);
  });

  test('lang : bascule vers l’autre version, refuse le reste', () => {
    expect(run('lang en', fr).effects).toEqual([{ type: 'navigate', url: '/en/' }]);
    expect(run('lang fr', en).effects).toEqual([{ type: 'navigate', url: '/' }]);
    expect(run('lang fr', fr).effects).toEqual([]);
    expect(texts(run('lang fr', fr))).toContain('Déjà en français');
    const bad = run('lang de', fr);
    expect(bad.effects).toEqual([]);
    expect(bad.lines[0]).toMatchObject({ kind: 'error', text: expect.stringContaining('lang fr | lang en') });
    expect(run('lang', en).lines[0].kind).toBe('error');
  });

  test('github : ouvre le profil', () => {
    expect(run('github', fr).effects).toEqual([{ type: 'open-url', url: fr.cv.links.github }]);
  });

  test('clear et exit : effets sans sortie superflue', () => {
    expect(run('clear', fr)).toEqual({ lines: [], effects: [{ type: 'clear' }] });
    expect(run('exit', fr).effects).toEqual([{ type: 'close' }]);
  });

  test('sudo hire-victor : célébration + email', () => {
    const r = run('sudo hire-victor', en);
    expect(r.effects).toEqual([{ type: 'celebrate' }]);
    expect(texts(r)).toContain(en.cv.links.email);
    expect(r.lines.some((l) => l.href === `mailto:${en.cv.links.email}`)).toBe(true);
  });

  test('sudo autre chose : refusé', () => {
    const r = run('sudo rm -rf /', fr);
    expect(r.effects).toEqual([]);
    expect(r.lines[0].kind).toBe('error');
    expect(run('sudo', fr).lines[0].text).toContain('sudo hire-victor');
  });

  test('les sorties sont du texte brut (jamais interprété)', () => {
    const r = run('<img src=x onerror=alert(1)>', fr);
    expect(r.lines[0].text).toContain('<img');
    expect(r.effects).toEqual([]);
  });
});

describe('commande inconnue et suggestion', () => {
  test('message + suggestion la plus proche', () => {
    const r = run('whoamii', fr);
    expect(r.lines[0]).toMatchObject({ kind: 'error', text: 'commande introuvable : whoamii' });
    expect(r.lines[1].text).toContain('« whoami »');
    expect(texts(run('projetcs', en))).toContain('Did you mean "projects"?');
  });

  test('rien de proche : renvoie vers help', () => {
    const r = run('xyzzy', en);
    expect(r.lines[0].text).toBe('command not found: xyzzy');
    expect(r.lines[1].text).toContain('help');
  });

  test('suggest', () => {
    expect(suggest('hlep')).toBe('help');
    expect(suggest('skils')).toBe('skills');
    expect(suggest('exp')).toBe('experience');
    expect(suggest('gihtub')).toBe('github');
    expect(suggest('banana')).toBeNull();
    expect(suggest('')).toBeNull();
  });
});

describe('autocomplétion', () => {
  test('complète une commande unique', () => {
    expect(complete('wh')).toEqual({ value: 'whoami', options: [] });
    expect(complete('sudo h')).toEqual({ value: 'sudo hire-victor', options: [] });
    expect(complete('lang e')).toEqual({ value: 'lang en', options: [] });
  });
  test('préfixe commun puis liste des choix', () => {
    expect(complete('la')).toEqual({ value: 'lang ', options: [] });
    expect(complete('lang ')).toEqual({ value: 'lang ', options: ['lang fr', 'lang en'] });
    expect(complete('e')).toEqual({ value: 'ex', options: [] });
    expect(complete('ex').options).toEqual(['experience', 'exit']);
  });
  test('rien à compléter', () => {
    expect(complete('zz')).toEqual({ value: 'zz', options: [] });
    expect(complete('')).toEqual({ value: '', options: [] });
  });
});

describe('historique', () => {
  test('↑ remonte, ↓ redescend jusqu’à la saisie en cours', () => {
    const h = new History();
    h.push('help');
    h.push('whoami');
    expect(h.prev('ski')).toBe('whoami');
    expect(h.prev('')).toBe('help');
    expect(h.prev('')).toBe('help'); // butée haute
    expect(h.next()).toBe('whoami');
    expect(h.next()).toBe('ski'); // saisie en cours restituée
    expect(h.next()).toBe('ski');
  });
  test('ignore les lignes vides et les doublons consécutifs, borne la taille', () => {
    const h = new History(2);
    h.push('');
    h.push('help');
    h.push('help');
    h.push('clear');
    h.push('exit');
    expect(h.items).toEqual(['clear', 'exit']);
  });
  test('historique vide : ↑ garde la saisie', () => {
    const h = new History();
    expect(h.prev('abc')).toBe('abc');
    expect(h.next()).toBe('abc');
  });
});

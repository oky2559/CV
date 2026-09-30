/**
 * Branche la logique pure du terminal (`lib/terminal.ts`) sur le DOM du
 * composant `Terminal.astro`. Chargé à la demande, au premier appel de `open`.
 * Tout texte est inséré via `textContent` : aucune sortie n'est interprétée
 * comme du HTML.
 */
import type { CV } from '../lib/cv';
import type { Lang } from '../i18n/ui';
import { complete, History, run, strings, type Effect, type Line } from '../lib/terminal';

interface Ui {
  dialog: HTMLDialogElement;
  output: HTMLElement;
  form: HTMLFormElement;
  input: HTMLInputElement;
  cv: CV;
  lang: Lang;
  history: History;
  returnTo: HTMLElement | null;
  busy: boolean;
}

let ui: Ui | null = null;

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function safeHref(href: string): string | null {
  try {
    const u = new URL(href, location.href);
    return ['http:', 'https:', 'mailto:'].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}

function print(u: Ui, lines: Line[]): void {
  for (const line of lines) {
    const row = document.createElement('p');
    row.className = `line ${line.kind ?? 'out'}`;
    const href = line.href ? safeHref(line.href) : null;
    if (href) {
      const a = document.createElement('a');
      a.href = href;
      a.textContent = line.text;
      if (!href.startsWith('mailto:')) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }
      row.append(a);
    } else {
      row.textContent = line.text;
    }
    u.output.append(row);
  }
  u.output.scrollTop = u.output.scrollHeight;
}

function echo(u: Ui, command: string): void {
  const row = document.createElement('p');
  row.className = 'line cmd';
  const prompt = document.createElement('span');
  prompt.className = 'prompt';
  prompt.textContent = strings(u.lang).prompt;
  row.append(prompt, ` ${command}`);
  u.output.append(row);
}

/** Petite animation « installation » puis surbrillance ; instantané si réduction des animations. */
function celebrate(u: Ui, then: () => void): void {
  if (reducedMotion()) {
    then();
    return;
  }
  u.busy = true;
  const bar = document.createElement('p');
  bar.className = 'line accent';
  u.output.append(bar);
  const width = 20;
  let step = 0;
  const timer = window.setInterval(() => {
    step++;
    bar.textContent = `[${'#'.repeat(step)}${'.'.repeat(width - step)}] ${Math.round((step / width) * 100)}%`;
    u.output.scrollTop = u.output.scrollHeight;
    if (step >= width) {
      window.clearInterval(timer);
      u.dialog.classList.remove('is-celebrating');
      void u.dialog.offsetWidth; // relance l'animation CSS
      u.dialog.classList.add('is-celebrating');
      u.busy = false;
      then();
    }
  }, 50);
}

function apply(u: Ui, effects: Effect[]): void {
  for (const effect of effects) {
    switch (effect.type) {
      case 'clear':
        u.output.replaceChildren();
        break;
      case 'close':
        close();
        break;
      case 'navigate':
        location.assign(effect.url + location.hash);
        break;
      case 'open-url': {
        const href = safeHref(effect.url);
        if (href) window.open(href, '_blank', 'noopener,noreferrer');
        break;
      }
      case 'celebrate':
        break; // géré dans submit()
    }
  }
}

function submit(u: Ui): void {
  if (u.busy) return;
  const command = u.input.value;
  u.input.value = '';
  u.history.push(command);
  echo(u, command);
  const result = run(command, { cv: u.cv, lang: u.lang });
  const show = () => {
    print(u, result.lines);
    apply(u, result.effects);
  };
  if (result.effects.some((e) => e.type === 'celebrate')) celebrate(u, show);
  else show();
  u.output.scrollTop = u.output.scrollHeight;
}

/** Garde le focus dans la fenêtre : Tab complète dans le champ, sinon boucle. */
function onKeydown(u: Ui, e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault();
    close();
    return;
  }
  if (e.target === u.input) {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      u.input.value = u.history.prev(u.input.value);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      u.input.value = u.history.next();
      return;
    }
    if (e.key === 'Tab' && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey && u.input.value.trim()) {
      e.preventDefault();
      const { value, options } = complete(u.input.value);
      u.input.value = value;
      if (options.length) {
        echo(u, u.input.value);
        print(u, [{ text: options.join('   '), kind: 'muted' }]);
      }
      return;
    }
    if (e.key.toLowerCase() === 'l' && e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      u.output.replaceChildren();
      return;
    }
  }
  if (e.key === 'Tab') {
    const items = [...u.dialog.querySelectorAll<HTMLElement>('button, input, a[href]')].filter(
      (el) => !el.hasAttribute('disabled') && el.offsetParent !== null,
    );
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !u.dialog.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !u.dialog.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  }
}

function setup(): Ui | null {
  const dialog = document.querySelector<HTMLDialogElement>('[data-terminal]');
  const data = document.getElementById('terminal-data');
  const output = dialog?.querySelector<HTMLElement>('[data-terminal-output]');
  const form = dialog?.querySelector<HTMLFormElement>('[data-terminal-form]');
  const input = form?.querySelector<HTMLInputElement>('input');
  if (!dialog || !data || !output || !form || !input) return null;

  const u: Ui = {
    dialog,
    output,
    form,
    input,
    cv: JSON.parse(data.textContent ?? '{}') as CV,
    lang: (dialog.dataset.lang === 'en' ? 'en' : 'fr') as Lang,
    history: new History(),
    returnTo: null,
    busy: false,
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submit(u);
  });
  dialog.addEventListener('keydown', (e) => onKeydown(u, e));
  // Échap natif du <dialog> : on passe par close() pour tout remettre en ordre.
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  dialog.querySelector('[data-terminal-close]')?.addEventListener('click', () => close());
  // Un clic sur le fond (hors de la fenêtre) ferme ; un clic dans la fenêtre remet le focus au champ.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close();
    else if (!(e.target as Element).closest('a, button') && !getSelection()?.toString()) input.focus();
  });
  dialog.addEventListener('animationend', () => dialog.classList.remove('is-celebrating'));

  print(u, [{ text: strings(u.lang).welcome, kind: 'muted' }]);
  return u;
}

export function isOpen(): boolean {
  return !!ui?.dialog.open;
}

export function open(returnTo: Element | null): void {
  ui ??= setup();
  if (!ui || ui.dialog.open) return;
  ui.returnTo = returnTo instanceof HTMLElement ? returnTo : null;
  ui.dialog.showModal();
  document.documentElement.classList.add('terminal-open');
  document.dispatchEvent(new CustomEvent('cv:scroll-lock', { detail: true }));
  ui.input.focus();
}

export function close(): void {
  if (!ui?.dialog.open) return;
  ui.dialog.close();
  document.documentElement.classList.remove('terminal-open');
  document.dispatchEvent(new CustomEvent('cv:scroll-lock', { detail: false }));
  const target = ui.returnTo;
  ui.returnTo = null;
  if (target?.isConnected) target.focus({ preventScroll: true });
}

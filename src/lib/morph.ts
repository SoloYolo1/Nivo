// Account rows grow into the account's screen and shrink back into the row: the row becomes the
// summary card, its name becomes the title and its balance the big number (View Transitions).
// Phones whose WebView cannot do this simply slide, as before.
import { flushSync } from 'react-dom';
import { getState, setState } from '../state/store';

type VT = { finished: Promise<void> };
type DocVT = Document & { startViewTransition?: (cb: () => void) => VT };

let current: string | null = null;
/** The account whose row and screen are paired in a transition right now. */
export const morphId = (): string | null => current;

export function canMorph(): boolean {
  const d = document as DocVT;
  return typeof d.startViewTransition === 'function' && !matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const NAMES: Array<[string, string]> = [['', 'm-card'], ['.l b', 'm-name'], ['.r b', 'm-val']];

function name(row: Element | null, on: boolean): void {
  if (!row) return;
  for (const [sel, n] of NAMES) {
    const el = (sel ? row.querySelector(sel) : row) as HTMLElement | null;
    if (el) el.style.viewTransitionName = on ? n : '';
  }
}

function run(id: string, change: () => void): void {
  const d = document as DocVT;
  current = id;
  document.documentElement.classList.add('morphing');
  const t = d.startViewTransition!(() => { flushSync(change); });
  t.finished.finally(() => {
    current = null;
    document.documentElement.classList.remove('morphing');
    name(document.querySelector('[data-acc="' + id + '"]'), false);
  });
}

/** Open an account from its row. */
export function openAccount(id: string, row: HTMLElement | null): void {
  const go = () => { setState((s) => ({ stack: [...s.stack, { name: 'account', id }], dir: '', sheet: '' })); window.scrollTo(0, 0); };
  if (!canMorph() || !row) { setState((s) => ({ stack: [...s.stack, { name: 'account', id }], dir: 'r', sheet: '' })); window.scrollTo(0, 0); return; }
  name(row, true);
  run(id, go);
}

/** Going back from an account to the list it came from: shrink into its row. Returns false if not applicable. */
export function closeAccount(): boolean {
  const s = getState();
  const top = s.stack[s.stack.length - 1];
  if (!top || top.name !== 'account' || !canMorph()) return false;
  run(top.id, () => {
    setState((st) => ({ stack: st.stack.slice(0, -1), dir: '' }));
    window.scrollTo(0, 0);
    // the row it came from takes the names again
    name(document.querySelector('[data-acc="' + top.id + '"]'), true);
  });
  return true;
}

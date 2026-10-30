// Back that follows the finger. While a back gesture is in progress (Android 14's predictive back,
// or a sideways drag inside the app) the current screen slides with it and the screen you would go
// back to is drawn underneath. Letting go far enough goes back; anything else springs back.
import { getState, setState } from '../state/store';
import { haptic } from './native';
import { backHooks } from './back';

let active = false;
let last = 0;

const page = () => document.querySelector('.w.main') as HTMLElement | null;
const under = () => document.querySelector('.under') as HTMLElement | null;

/** Only going back from a screen to the one beneath it is previewed (not sheets, lock or tabs). */
export function canPreview(): boolean {
  const s = getState();
  if ([backHooks.lock, backHooks.onboarding].some((h) => h && h.can())) return false;
  return !s.splash && !s.onboarding && !s.sheet && s.stack.length > 0;
}

export const isDragging = (): boolean => active;

export function dragStart(): boolean {
  if (active || !canPreview()) return false;
  active = true; last = 0;
  setState({ peek: true });
  document.documentElement.classList.add('bk-drag');
  return true;
}

export function dragTo(p: number): void {
  if (!active) return;
  const k = Math.max(0, Math.min(1, p));
  last = k;
  const w = page(), u = under();
  if (w) { w.style.transition = 'none'; w.style.transform = 'translateX(' + (k * 100).toFixed(2) + 'vw)'; }
  if (u) { u.style.transition = 'none'; u.style.transform = 'translateX(' + (-24 + k * 24).toFixed(2) + 'vw)'; u.style.setProperty('--dim', String(0.32 * (1 - k))); }
}

function finish(cleanup: () => void, ms: number): void {
  window.setTimeout(() => {
    const w = page(), u = under();
    if (w) { w.style.transition = ''; w.style.transform = ''; }
    if (u) { u.style.transition = ''; u.style.transform = ''; }
    document.documentElement.classList.remove('bk-drag');
    cleanup();
  }, ms);
}

export function dragCancel(): void {
  if (!active) return;
  const w = page(), u = under();
  const ease = 'transform .3s cubic-bezier(.3,1,.4,1)';
  if (w) { w.style.transition = ease; w.style.transform = 'translateX(0)'; }
  if (u) { u.style.transition = ease + ',--dim .3s'; u.style.transform = 'translateX(-24vw)'; }
  finish(() => { active = false; setState({ peek: false }); }, 300);
}

/** Go back after a drag: the page finishes sliding out, then the screen beneath takes its place. */
export function dragCommit(): void {
  const pop = () => { setState((s) => ({ stack: s.stack.slice(0, -1), dir: '', peek: false })); window.scrollTo(0, 0); };
  if (!active) { pop(); return; }
  const w = page(), u = under();
  const ms = Math.round(120 + 160 * (1 - last));
  const ease = 'transform ' + ms + 'ms cubic-bezier(.2,.7,.3,1)';
  if (w) { w.style.transition = ease; w.style.transform = 'translateX(100vw)'; }
  if (u) { u.style.transition = ease; u.style.transform = 'translateX(0)'; u.style.setProperty('--dim', '0'); }
  haptic('select');
  finish(() => { active = false; pop(); }, ms);
}

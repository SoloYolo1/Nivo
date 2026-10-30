// One place that decides what "back" means, for the Android back button and the browser's.
// Order: the lock screen's own steps, the onboarding steps, an open sheet, the screen stack,
// then Home, and only from Home does the app go to the background.
import { closeSheet, getState, goTab, pop } from '../state/store';
import { call, haptic, isNative } from './native';

/** A screen with internal steps (lock, onboarding) registers a handler: `can` says whether a press would do
 *  something there, `go` does it. */
export interface BackHook { can: () => boolean; go: () => void }
export const backHooks: { lock: BackHook | null; onboarding: BackHook | null } = { lock: null, onboarding: null };

/** Handle one back press. Returns false when there was nothing left to go back to. */
export function goBack(): boolean {
  const s = getState();
  if (s.splash) return false;
  for (const h of [backHooks.lock, backHooks.onboarding]) if (h && h.can()) { h.go(); return true; }
  if (s.sheet) { closeSheet(); return true; }
  if (pop()) return true;
  if (s.tab !== 'home') { goTab('home'); return true; }
  return false;
}

/** Whether a back press would do something inside the app. */
export function canGoBack(): boolean {
  const s = getState();
  if (s.splash) return false;
  if ([backHooks.lock, backHooks.onboarding].some((h) => h && h.can())) return true;
  return !!s.sheet || s.stack.length > 0 || s.tab !== 'home';
}

/**
 * Android: the hardware back button and the back gesture. Installed once at start-up.
 * Nivo's MainActivity asks window.nivoBack() first and only sends the app to the background on 'exit',
 * so back works even without the App plugin. The App plugin's listener stays as a second route
 * (it is only called when the activity does not handle back itself).
 */
export function installNativeBack(): Promise<{ remove?: () => void } | null> {
  (window as Window & { nivoBack?: () => 'handled' | 'exit' }).nivoBack = () => {
    if (goBack()) { haptic('select'); return 'handled'; }
    return 'exit';
  };
  return call<{ remove?: () => void }>('App', 'addListener', 'backButton', () => {
    haptic('select');
    if (!goBack()) void call('App', 'minimizeApp');
  });
}

/**
 * Browser (the GitHub Pages site, or Nivo added to the home screen): keep one spare history entry
 * whenever back should stay inside the app, so the browser's back closes a sheet or returns to Home
 * instead of leaving the site. Not used inside the installed app, where the App plugin handles it.
 */
let ensureFn: (() => void) | null = null;
/** Screens with their own steps (lock, onboarding) call this after a step changes. */
export const refreshBackGuard = (): void => { if (ensureFn) ensureFn(); };

export function installWebBack(subscribe: (f: () => void) => () => void): () => void {
  if (isNative() || typeof history === 'undefined') return () => undefined;
  let guarded = false;
  const ensure = () => {
    if (!guarded && canGoBack()) { try { history.pushState({ nivo: 1 }, ''); guarded = true; } catch { /* ignore */ } }
  };
  ensureFn = ensure;
  const onPop = () => {
    guarded = false;
    if (goBack()) { haptic('select'); ensure(); }
  };
  try { history.replaceState({ nivo: 0 }, ''); } catch { /* ignore */ }
  addEventListener('popstate', onPop);
  const unsub = subscribe(ensure);
  return () => { removeEventListener('popstate', onPop); unsub(); ensureFn = null; };
}

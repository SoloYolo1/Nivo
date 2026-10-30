// Access to the native plugins of the installed Android app (Capacitor).
// In a browser none of these exist and every caller falls back gracefully.
//
// The app never bundles @capacitor/core. Inside the APK, Capacitor's own bridge script injects
// window.Capacitor with a legacy `Plugins` object for every plugin compiled into the app, plus a
// `PluginHeaders` list and `nativePromise`/`addListener` for talking to them directly. We use
// the Plugins object when it is there and fall back to the headers, so a plugin that is in the
// APK always works even if Capacitor stops filling in `Plugins` one day.

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyFn = (...args: any[]) => any;
export interface Plugin { [method: string]: AnyFn | undefined }

interface PluginHeader { name: string; methods: Array<{ name: string; rtype?: string }> }
interface Cap {
  Plugins?: Record<string, Plugin | undefined>;
  PluginHeaders?: PluginHeader[];
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  nativePromise?: (plugin: string, method: string, options?: unknown) => Promise<unknown>;
  addListener?: (plugin: string, event: string, cb: AnyFn) => { remove: () => Promise<void> | void };
}

declare global {
  interface Window { Capacitor?: Cap }
}

const cap = (): Cap | null => (typeof window !== 'undefined' && window.Capacitor) || null;

const fromHeader = (c: Cap, name: string): Plugin | null => {
  const h = c.PluginHeaders && c.PluginHeaders.find((x) => x.name === name);
  if (!h || !c.nativePromise) return null;
  const p: Plugin = {};
  h.methods.forEach((m) => { p[m.name] = (options?: unknown) => c.nativePromise!(name, m.name, options); });
  if (c.addListener) p.addListener = (event: string, cb: AnyFn) => c.addListener!(name, event, cb);
  return p;
};

const cache: Record<string, Plugin | null> = {};

/** A native plugin by name, or null when the app runs in a browser or the plugin is not in the APK. */
export const plugin = (name: string): Plugin | null => {
  const c = cap();
  if (!c) return null;
  const direct = c.Plugins && c.Plugins[name];
  if (direct) return direct;
  if (!(name in cache)) cache[name] = fromHeader(c, name);
  return cache[name];
};

export const plugins = (): Record<string, Plugin | undefined> | null => {
  const c = cap();
  return (c && c.Plugins) || null;
};

/** True inside the installed Android app. */
export const isNative = (): boolean => {
  const c = cap();
  if (!c) return false;
  if (typeof c.isNativePlatform === 'function') { try { return !!c.isNativePlatform(); } catch { /* fall through */ } }
  return !!(c.PluginHeaders && c.PluginHeaders.length);
};

/** Call a plugin method if it exists; resolves to null when it does not or when it fails. */
export async function call<T = unknown>(name: string, method: string, ...args: unknown[]): Promise<T | null> {
  const p = plugin(name);
  const f = p && p[method];
  if (!f) return null;
  try { return (await f.apply(p, args)) as T; } catch { return null; }
}

// ---------- haptics ----------
// One vocabulary for the whole app, so every tap feels the same:
//   'tap'      a light tick for buttons, rows, tabs and keypad keys
//   'select'   a softer tick for moving between screens or picking an option
//   'medium'   a firmer press for primary actions and the pull-to-refresh trigger
//   'success'  saved, unlocked, milestone
//   'error'    wrong PIN, a form that cannot be saved
// A number or a pattern still works (raw vibration), for the few places that want one.
export type Haptic = 'tap' | 'select' | 'medium' | 'success' | 'error' | number | number[];

const reduce = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
let lastAt = 0;
let selecting = false; // the Haptics plugin only ticks for selectionChanged() after one selectionStart()

export function haptic(kind: Haptic = 'tap'): void {
  if (reduce()) return;
  // two ticks within a few ms would feel like one long buzz (a button inside a tappable row)
  const now = Date.now();
  if (typeof kind === 'string' && kind !== 'success' && kind !== 'error' && now - lastAt < 40) return;
  lastAt = now;
  const h = plugin('Haptics');
  if (h) {
    try {
      if (kind === 'tap') { void h.impact?.({ style: 'LIGHT' }); return; }
      if (kind === 'select') { if (!selecting) { selecting = true; void h.selectionStart?.(); } void h.selectionChanged?.(); return; }
      if (kind === 'medium') { void h.impact?.({ style: 'MEDIUM' }); return; }
      if (kind === 'success') { void h.notification?.({ type: 'SUCCESS' }); return; }
      if (kind === 'error') { void h.notification?.({ type: 'ERROR' }); return; }
      void h.vibrate?.({ duration: Array.isArray(kind) ? kind.reduce((a, b) => a + b, 0) : kind });
      return;
    } catch { /* fall through to the web API */ }
  }
  const pattern = kind === 'tap' ? 8 : kind === 'select' ? 6 : kind === 'medium' ? 14 : kind === 'success' ? [10, 40, 16] : kind === 'error' ? [30, 40, 30] : kind;
  try { navigator.vibrate?.(pattern); } catch { /* not supported */ }
}

/** Resolve with the first success, or reject when all fail (like Promise.any, which older WebViews lack). */
export function firstOk<T>(ps: Array<Promise<T>>): Promise<T> {
  return new Promise((resolve, reject) => {
    let left = ps.length;
    if (!left) reject(new Error('none'));
    ps.forEach((p) => p.then(resolve, () => { if (--left === 0) reject(new Error('all failed')); }));
  });
}

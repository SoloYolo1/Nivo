// Access to the native plugins injected by the installed Android app (Capacitor).
// In a browser none of these exist and every caller falls back gracefully.

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyFn = (...args: any[]) => Promise<any>;
export interface Plugin { [method: string]: AnyFn | undefined }

declare global {
  interface Window { Capacitor?: { Plugins?: Record<string, Plugin | undefined>; isNativePlatform?: () => boolean } }
}

export const plugins = (): Record<string, Plugin | undefined> | null =>
  (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins) || null;

export const plugin = (name: string): Plugin | null => {
  const p = plugins();
  return (p && p[name]) || null;
};

export const isNative = (): boolean => !!plugins();

/** Call a plugin method if it exists; resolves to null when it does not or when it fails. */
export async function call<T = unknown>(name: string, method: string, ...args: unknown[]): Promise<T | null> {
  const p = plugin(name);
  const f = p && p[method];
  if (!f) return null;
  try { return (await f.apply(p, args)) as T; } catch { return null; }
}

/** Short vibration for taps. */
export function haptic(pattern: number | number[] = 8): void {
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

// Theme: light, dark or follow the phone. Also keeps the Android status bar in step.
import { useSyncExternalStore } from 'react';
import { call } from '../lib/native';
import type { Theme } from '../state/store';

const mq = () => (typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null);

export function isDark(theme: Theme): boolean {
  return theme === 'dark' || (theme === 'system' && !!mq()?.matches);
}

export function applyTheme(theme: Theme): void {
  const r = document.documentElement;
  if (theme === 'light' || theme === 'dark') r.dataset.theme = theme; else delete r.dataset.theme;
  const dark = isDark(theme);
  const bg = dark ? '#0f111d' : '#f3f4fa';
  const m = document.querySelector('meta[name=theme-color]');
  if (m) m.setAttribute('content', bg);
  // Behind the status and navigation bars (Android 15 draws apps edge to edge, so this is the app's own
  // window colour there), and dark or light icons on them. StatusBar is kept for older Android versions.
  void call('NivoNative', 'setSystemBars', { color: bg, dark });
  void call('StatusBar', 'setBackgroundColor', { color: bg });
  void call('StatusBar', 'setStyle', { style: dark ? 'DARK' : 'LIGHT' });
  notify();
}

// Components that draw charts need the actual up/down colours (SVG attributes cannot read some CSS vars on old WebViews).
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());
mq()?.addEventListener?.('change', () => notify());
const sub = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
const snap = () => {
  const t = document.documentElement.dataset.theme;
  return t ? t === 'dark' : !!mq()?.matches;
};
// The dark summary cards stay dark in both themes, so their charts always use the bright pair.
const HERO = { upHero: '#30d158', dnHero: '#ff6961' };
const DARK = { up: '#30d158', dn: '#ff6961', a: '#8f9cff', gold: '#e2bd72', org: '#ff9f0a', ...HERO }, LIGHT = { up: '#1f9d45', dn: '#e0342a', a: '#4a58d0', gold: '#b98a2e', org: '#e8780a', ...HERO };
export function useColors(): typeof DARK {
  const d = useSyncExternalStore(sub, snap, () => true);
  return d ? DARK : LIGHT;
}

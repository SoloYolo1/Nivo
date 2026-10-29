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
  const bg = dark ? '#141729' : '#f3f4fa';
  const m = document.querySelector('meta[name=theme-color]');
  if (m) m.setAttribute('content', bg);
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
const DARK = { up: '#4fd59c', dn: '#f2847b' }, LIGHT = { up: '#15966a', dn: '#d2493f' };
export function useColors(): { up: string; dn: string } {
  const d = useSyncExternalStore(sub, snap, () => true);
  return d ? DARK : LIGHT;
}

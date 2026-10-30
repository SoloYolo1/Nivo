// Theme: light, dark or follow the phone. Also keeps the Android status bar in step.
import { useSyncExternalStore } from 'react';
import { call } from '../lib/native';
import type { Theme } from '../state/store';
import { heroGradient, paletteOf, type Palette } from '../lib/palettes';

let current: Palette = paletteOf(null);
const rgb = (h: string) => { const n = parseInt(h.slice(1), 16); return ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255); };
const TOKENS = ['--bg', '--cd', '--cd2', '--cdg', '--bd', '--mu', '--mu2', '--a', '--a-soft', '--tr', '--thumb', '--nav', '--dock-bg', '--dock-edge', '--field-bd', '--hero-bg', '--hero-sh'];

/** Set the colour theme's tokens on the page (Midnight uses the stylesheet as it is). */
function paint(p: Palette, dark: boolean): void {
  const r = document.documentElement, st = r.style;
  TOKENS.forEach((t) => st.removeProperty(t));
  if (p.id === 'midnight') { delete r.dataset.palette; return; }
  r.dataset.palette = p.id;
  const set = (k: string, v: string) => st.setProperty(k, v);
  set('--hero-bg', heroGradient(p));
  if (dark) {
    const d = p.dark, a = rgb(d.a);
    set('--bg', d.bg); set('--cd', d.cd); set('--cd2', d.cd2); set('--cdg', 'linear-gradient(180deg,' + d.cd2 + ',' + d.cd + ')');
    set('--mu', d.mu); set('--mu2', d.mu2); set('--a', d.a); set('--a-soft', 'rgba(' + a + ',.14)'); set('--tr', 'rgba(' + a + ',.09)');
    set('--thumb', d.cd2); set('--nav', 'rgba(' + rgb(d.bg) + ',.8)'); set('--dock-bg', d.cd);
    set('--hero-sh', 'inset 0 1px 0 rgba(255,255,255,.13),0 20px 44px rgba(0,0,0,.45),0 2px 8px rgba(0,0,0,.3)');
  } else {
    const l = p.light, a = rgb(l.a);
    set('--bg', l.bg); set('--cd2', l.cd2); set('--cdg', 'linear-gradient(180deg,#ffffff,' + l.cd2 + ')');
    set('--bd', 'rgba(' + l.ink + ',.10)'); set('--mu', l.mu); set('--mu2', l.mu2); set('--a', l.a); set('--a-soft', 'rgba(' + a + ',.10)');
    set('--tr', 'rgba(' + l.ink + ',.07)'); set('--nav', 'rgba(' + rgb(l.bg) + ',.82)');
    set('--dock-bg', 'color-mix(in srgb,' + l.bg + ' 88%,rgb(' + l.ink + '))'); set('--dock-edge', 'rgba(' + l.ink + ',.14)'); set('--field-bd', 'rgba(' + l.ink + ',.13)');
    set('--hero-sh', 'inset 0 1px 0 rgba(255,255,255,.16),0 16px 36px rgba(' + rgb(p.hero[2]) + ',.32),0 2px 8px rgba(' + rgb(p.hero[3]) + ',.18)');
  }
}

/** Choose a colour theme and redraw with it. */
export function setPalette(id: string, theme: Theme): void { current = paletteOf(id); applyTheme(theme); }
export const currentPalette = (): Palette => current;

const mq = () => (typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null);

export function isDark(theme: Theme): boolean {
  return theme === 'dark' || (theme === 'system' && !!mq()?.matches);
}

export function applyTheme(theme: Theme): void {
  const r = document.documentElement;
  if (theme === 'light' || theme === 'dark') r.dataset.theme = theme; else delete r.dataset.theme;
  const dark = isDark(theme);
  r.dataset.mode = dark ? 'dark' : 'light';
  paint(current, dark);
  const bg = dark ? current.dark.bg : current.light.bg;
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
const HERO = { upHero: '#4cc38a', dnHero: '#ff6961' };
const DARK = { up: '#4cc38a', dn: '#ff6961', a: '#8f9cff', gold: '#e2bd72', org: '#ff9f0a', ...HERO }, LIGHT = { up: '#138a52', dn: '#e0342a', a: '#4a58d0', gold: '#b98a2e', org: '#e8780a', ...HERO };
export function useColors(): typeof DARK {
  const d = useSyncExternalStore(sub, snap, () => true);
  const pid = useSyncExternalStore(sub, () => current.id, () => current.id);
  const base = d ? DARK : LIGHT;
  return pid === 'midnight' ? base : { ...base, a: d ? current.dark.a : current.light.a };
}

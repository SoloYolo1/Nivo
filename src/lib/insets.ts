// Edge to edge on Android: the app draws under the status bar and the navigation bar, and Nivo's own
// native code (MainActivity) measures them and hands the sizes over here. They become CSS variables
// (--sat, --sar, --sab, --sal) that the styles use for the header, sheets, toasts and the dock.
// In a browser nothing calls this, and the styles fall back to env(safe-area-inset-*).
import { call, plugin } from './native';

type Fn = (top: number, right: number, bottom: number, left: number) => void;

const apply: Fn = (top, right, bottom, left) => {
  const r = document.documentElement.style;
  r.setProperty('--sat', Math.max(0, top) + 'px');
  r.setProperty('--sar', Math.max(0, right) + 'px');
  r.setProperty('--sab', Math.max(0, bottom) + 'px');
  r.setProperty('--sal', Math.max(0, left) + 'px');
  document.documentElement.dataset.edge = '1';
};

export function installInsets(): void {
  (window as Window & { nivoInsets?: Fn }).nivoInsets = apply;
  if (!plugin('NivoNative')) return;
  void call<{ top: number; right: number; bottom: number; left: number }>('NivoNative', 'insets').then((i) => {
    if (i) apply(Number(i.top) || 0, Number(i.right) || 0, Number(i.bottom) || 0, Number(i.left) || 0);
  });
}

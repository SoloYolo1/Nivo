// Toast and confetti, shared by every screen.
import { useEffect, useRef } from 'react';
import { Icon } from './Icon';
import { dismissToast, useStore } from '../state/store';
import { haptic } from '../lib/native';

export function ToastView() {
  const t = useStore((s) => s.toast);
  const last = useRef(t);
  if (t) last.current = t;
  const show = last.current;
  return (
    <div className={'toast' + (t ? ' on' : '') + (show && show.action ? ' act' : '')} role="status" aria-live="polite">
      {show && <>
        {show.icon && <span className="chk" style={{ display: 'grid' }}><Icon name={show.icon} size={16} /></span>}
        {show.text}
        {show.action && <button type="button" onClick={() => { const a = show.action; dismissToast(); a?.fn(); }}>{show.action.label}</button>}
        {show.action && t && <i key={show.id} className="toast-time" aria-hidden="true" />}
      </>}
    </div>
  );
}

export function Confetti() {
  const n = useStore((s) => s.confetti);
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!n || !ref.current) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = ref.current, x = c.getContext('2d');
    if (!x) return;
    c.hidden = false;
    const W = innerWidth, H = innerHeight, dpr = devicePixelRatio || 1;
    c.width = W * dpr; c.height = H * dpr; x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cols = ['#ffe7a3', '#d9a84e', '#8e9bff', '#5a68c4', '#ffffff'];
    const P = Array.from({ length: 110 }, (_, i) => ({ x: W / 2, y: H * 0.42, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 13 - 4, r: Math.random() * 5 + 3, c: cols[i % cols.length], a: Math.random() * 6, s: Math.random() * 0.3 - 0.15 }));
    const t0 = performance.now();
    haptic('success');
    let raf = 0;
    const f = (t: number) => {
      const k = (t - t0) / 1500;
      x.clearRect(0, 0, W, H);
      for (const p of P) {
        p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.vx *= 0.985; p.a += p.s;
        x.save(); x.globalAlpha = Math.max(0, 1 - k); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c; x.fillRect(-p.r, -p.r * 0.6, p.r * 2, p.r * 1.2); x.restore();
      }
      if (k < 1) raf = requestAnimationFrame(f); else { x.clearRect(0, 0, W, H); c.hidden = true; }
    };
    raf = requestAnimationFrame(f);
    return () => { cancelAnimationFrame(raf); c.hidden = true; };
  }, [n]);
  return <canvas id="cf" ref={ref} hidden />;
}

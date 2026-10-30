// Swipe actions on a row: drag it left for the action on the right (Update), right for the one on
// the left (Edit). Past the line the row ticks once and the action label fills; let go to do it.
// Vertical drags still scroll the page (touch-action: pan-y), and a swipe never counts as a tap.
import { useEffect, useRef, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { haptic } from '../lib/native';

export interface SwipeAction { label: string; icon: IconName; tone: 'gold' | 'indigo'; run: () => void }

const ARM = 76, MAX = 132;

export function SwipeRow({ children, left, right, hint = false }: {
  children: ReactNode;
  /** Revealed when the row is dragged to the right. */
  left?: SwipeAction;
  /** Revealed when the row is dragged to the left. */
  right?: SwipeAction;
  /** Nudge the row once so people learn it can be swiped. */
  hint?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const g = useRef<{ x0: number; y0: number; id: number; on: boolean; dx: number; armed: boolean } | null>(null);
  const swallow = useRef(false);

  useEffect(() => {
    if (!hint || !box.current) return;
    const el = box.current;
    const t = window.setTimeout(() => { el.classList.add('peek'); window.setTimeout(() => el.classList.remove('peek'), 1500); }, 650);
    return () => clearTimeout(t);
  }, [hint]);

  const set = (dx: number, animate: boolean) => {
    const el = inner.current, b = box.current;
    if (!el || !b) return;
    el.style.transition = animate ? 'transform .32s cubic-bezier(.3,1.3,.5,1)' : 'none';
    el.style.transform = dx ? 'translateX(' + dx + 'px)' : '';
    b.dataset.dir = dx > 0 ? 'l' : dx < 0 ? 'r' : '';
    b.style.setProperty('--k', String(Math.min(1, Math.abs(dx) / ARM)));
  };

  const down = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    g.current = { x0: e.clientX, y0: e.clientY, id: e.pointerId, on: false, dx: 0, armed: false };
  };
  const move = (e: React.PointerEvent) => {
    const s = g.current;
    if (!s || s.id !== e.pointerId) return;
    let dx = e.clientX - s.x0;
    const dy = e.clientY - s.y0;
    if (!s.on) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { g.current = null; return; }
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
      if ((dx > 0 && !left) || (dx < 0 && !right)) { g.current = null; return; }
      s.on = true;
      box.current?.classList.add('swiping');
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    if ((dx > 0 && !left) || (dx < 0 && !right)) dx = 0;
    // past the line the row follows more slowly, up to a limit
    const a = Math.abs(dx), eased = a <= ARM ? a : ARM + (a - ARM) * 0.4;
    s.dx = Math.sign(dx) * Math.min(MAX, eased);
    set(s.dx, false);
    const armed = a >= ARM;
    if (armed !== s.armed) { s.armed = armed; box.current?.classList.toggle('armed', armed); if (armed) haptic('select'); }
  };
  const up = (e: React.PointerEvent) => {
    const s = g.current;
    g.current = null;
    if (!s || !s.on) return;
    swallow.current = true;
    window.setTimeout(() => { swallow.current = false; }, 350);
    box.current?.classList.remove('swiping', 'armed');
    set(0, true);
    if (s.armed && e.type === 'pointerup') {
      const act = s.dx > 0 ? left : right;
      if (act) { haptic('medium'); window.setTimeout(act.run, 140); }
    }
  };

  return (
    <div className="sw-row" ref={box} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      onClickCapture={(e) => { if (swallow.current) { e.preventDefault(); e.stopPropagation(); } }}>
      {left && <span className={'sw-act l ' + left.tone} aria-hidden="true"><Icon name={left.icon} size={18} /><b>{left.label}</b></span>}
      {right && <span className={'sw-act r ' + right.tone} aria-hidden="true"><b>{right.label}</b><Icon name={right.icon} size={18} /></span>}
      <div className="sw-in" ref={inner}>{children}</div>
    </div>
  );
}

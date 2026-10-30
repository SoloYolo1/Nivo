import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

/** Bottom sheet. Drag it down (from the handle, the title, or the content once scrolled to the top) to close. */
export function Sheet({ open, onClose, title, children, id }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; id?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  // keep the content while the sheet slides away, then unmount it
  const [keep, setKeep] = useState(open);
  useEffect(() => {
    if (open) {
      setKeep(true); ref.current?.scrollTo(0, 0);
      const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
      addEventListener('keydown', onKey);
      return () => removeEventListener('keydown', onKey);
    }
    const t = setTimeout(() => setKeep(false), 380);
    return () => clearTimeout(t);
  }, [open, onClose]);
  // Drag down from the handle, the title, or anywhere once the content is scrolled to the top: the sheet
  // follows the finger (and the dimmed page brightens), a flick or a long pull closes it, otherwise it
  // springs back. Pulling up stretches a little and settles.
  useEffect(() => {
    const el = ref.current;
    if (!el || !open) return;
    const ov = () => document.querySelector('.ov') as HTMLElement | null;
    let y0 = 0, t0 = 0, dy = 0, on = false, maybe = false, lastY = 0, lastT = 0, v = 0;
    const set = (y: number) => {
      el.style.transform = 'translate(-50%,' + y.toFixed(1) + 'px)';
      const o = ov(); if (o) o.style.opacity = String(Math.max(0, 1 - Math.max(0, y) / (el.offsetHeight || 400)));
    };
    const down = (e: TouchEvent) => {
      const tg = e.target as HTMLElement;
      if (tg.closest('input,textarea,select,[type=range],.keypad,.pad')) { maybe = false; return; }
      const handle = !!tg.closest('.gr,.sh-h');
      maybe = handle || el.scrollTop <= 0;
      y0 = lastY = e.touches[0].clientY; t0 = lastT = Date.now(); dy = 0; v = 0; on = false;
    };
    const mv = (e: TouchEvent) => {
      if (!maybe) return;
      const y = e.touches[0].clientY, d = y - y0, now = Date.now();
      if (!on) {
        if (d > 6 && (el.scrollTop <= 0 || (e.target as HTMLElement).closest('.gr,.sh-h'))) { on = true; el.style.transition = 'none'; const o = ov(); if (o) o.style.transition = 'none'; }
        else if (d < -6) { maybe = false; return; }
        else return;
      }
      e.preventDefault();
      v = (y - lastY) / Math.max(1, now - lastT); lastY = y; lastT = now;
      dy = d >= 0 ? d : -Math.pow(-d, 0.7);
      set(dy);
    };
    const up = () => {
      if (!on) { maybe = false; return; }
      on = false; maybe = false;
      el.style.transition = 'transform .38s cubic-bezier(.3,1.25,.5,1)';
      const o = ov(); if (o) { o.style.transition = 'opacity .3s'; o.style.opacity = ''; }
      if (dy > Math.min(140, el.offsetHeight * 0.3) || (v > 0.6 && dy > 24)) { el.style.transition = 'transform .28s cubic-bezier(.3,.9,.4,1),visibility 0s linear .28s,box-shadow 0s linear .28s'; el.style.transform = ''; onClose(); }
      else el.style.transform = '';
      window.setTimeout(() => { el.style.transition = ''; if (o) o.style.transition = ''; }, 400);
      void t0;
    };
    el.addEventListener('touchstart', down, { passive: true });
    el.addEventListener('touchmove', mv, { passive: false });
    el.addEventListener('touchend', up, { passive: true });
    el.addEventListener('touchcancel', up, { passive: true });
    return () => { el.removeEventListener('touchstart', down); el.removeEventListener('touchmove', mv); el.removeEventListener('touchend', up); el.removeEventListener('touchcancel', up); };
  }, [open, onClose]);
  return (
    <div className={'sheet' + (open ? ' on' : '')} ref={ref} id={id} role="dialog" aria-modal="true" aria-hidden={!open} aria-label={typeof title === 'string' ? title : undefined}>
      <div className="gr" />
      <div className="sh-h"><span>{title}</span><button className="x" type="button" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button></div>
      {(open || keep) && children}
    </div>
  );
}

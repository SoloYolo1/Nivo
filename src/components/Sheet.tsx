import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

/** Bottom sheet with the 3.x look. Drag the handle or title down to close. */
export function Sheet({ open, onClose, title, children, id }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; id?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y0: number; dy: number } | null>(null);
  // keep the content while the sheet slides away, then unmount it
  const [keep, setKeep] = useState(open);
  useEffect(() => {
    if (open) { setKeep(true); ref.current?.scrollTo(0, 0); return undefined; }
    const t = setTimeout(() => setKeep(false), 380);
    return () => clearTimeout(t);
  }, [open]);
  const start = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    drag.current = { y0: e.touches[0].clientY, dy: 0 };
    if (ref.current) ref.current.style.transition = 'none';
  };
  const move = (e: React.TouchEvent) => {
    const d = drag.current;
    if (!d || !ref.current) return;
    d.dy = Math.max(0, e.touches[0].clientY - d.y0);
    ref.current.style.transform = 'translate(-50%,' + d.dy + 'px)';
  };
  const end = () => {
    const d = drag.current;
    if (!d || !ref.current) return;
    ref.current.style.transition = '';
    ref.current.style.transform = '';
    if (d.dy > 90) onClose();
    drag.current = null;
  };
  return (
    <div className={'sheet' + (open ? ' on' : '')} ref={ref} id={id} role="dialog" aria-modal="true" aria-hidden={!open} aria-label={typeof title === 'string' ? title : undefined}>
      <div className="gr" onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
      <div className="sh-h" onTouchStart={start} onTouchMove={move} onTouchEnd={end}><span>{title}</span><button className="x" type="button" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button></div>
      {(open || keep) && children}
    </div>
  );
}

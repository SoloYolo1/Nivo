// Small shared building blocks that keep the 3.x class names, so the original styles apply unchanged.
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export function H2({ icon, children, more }: { icon: IconName; children: ReactNode; more?: ReactNode }) {
  return (
    <h2><span className="hi"><Icon name={icon} size={14} /></span>{children}{more != null && <span className="more">{more}</span>}</h2>
  );
}

export function Card({ icon, title, more, children, className = '', id, onClick }: { icon?: IconName; title?: ReactNode; more?: ReactNode; children: ReactNode; className?: string; id?: string; onClick?: () => void }) {
  return (
    <section className={'cd ' + className} id={id} onClick={onClick}>
      {icon && <H2 icon={icon} more={more}>{title}</H2>}
      {children}
    </section>
  );
}

/** Segmented control with the sliding pill from 3.x. */
export function Seg<T extends string | number>({ items, value, onChange, style, label }: { items: Array<{ v: T; label: string }>; value: T; onChange: (v: T) => void; style?: React.CSSProperties; label: string }) {
  const i = Math.max(0, items.findIndex((x) => x.v === value));
  return (
    <div className="seg" role="tablist" aria-label={label} style={{ ['--n' as string]: items.length, ...style } as React.CSSProperties}>
      <i style={{ transform: 'translateX(' + i * 100 + '%)' }} />
      {items.map((x) => (
        <button key={String(x.v)} type="button" role="tab" aria-selected={x.v === value} className={x.v === value ? 'on' : ''} onClick={() => onChange(x.v)}>{x.label}</button>
      ))}
    </div>
  );
}

export function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" className={'sw' + (on ? ' on' : '')} role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)} />;
}

export function Spark({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const mn = Math.min(...values), mx = Math.max(...values), r = mx - mn || 1;
  const pts = values.map((y, i) => (i * 76 / (values.length - 1) + 2).toFixed(1) + ',' + (22 - (y - mn) / r * 20).toFixed(1)).join(' ');
  return (
    <svg viewBox="0 0 80 24" style={{ width: '100%', height: 24, marginTop: 8 }} aria-hidden="true">
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={pts} />
    </svg>
  );
}

/** Last value each counter showed, so a counter only animates when its number really changes. */
const shownValues = new Map<string, number>();

/** A number that eases from the value it last showed to the new one (big hero values). */
export function CountUp({ id, value, format }: { id: string; value: number; format: (v: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = shownValues.has(id) ? (shownValues.get(id) as number) : 0;
    const to = value;
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (from === to || reduce) { el.textContent = format(to); shownValues.set(id, to); return; }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 800), e = 1 - Math.pow(1 - k, 3);
      el.textContent = format(from + (to - from) * e);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    shownValues.set(id, to);
    return () => cancelAnimationFrame(raf);
  }, [id, value, format]);
  return <span ref={ref}>{format(shownValues.has(id) ? (shownValues.get(id) as number) : 0)}</span>;
}

export function Empty({ icon, title, text, action }: { icon: IconName; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty"><span className="tic inv"><Icon name={icon} size={22} /></span><b>{title}</b><p>{text}</p>{action}</div>
  );
}

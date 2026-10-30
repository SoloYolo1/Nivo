// Small SVG charts drawn to scale. Labels only name values the chart actually reaches.
import { useId, useRef, useState } from 'react';
import { haptic } from '../lib/native';
import { compact } from '../lib/format';

export interface Pt { label: string; value: number }

/** Line with an area fill, faint grid and a glowing last point, drawn like the 3.x portfolio chart.
 *  Drag across it to read any point; the readout stays inside the chart. */
export function LineChart({ points, color, height = 120, onDark = false, ariaLabel }: { points: Pt[]; color: string; height?: number; onDark?: boolean; ariaLabel: string }) {
  const gid = useId().replace(/:/g, '');
  const box = useRef<HTMLDivElement>(null);
  const [ix, setIx] = useState<number | null>(null);
  const lastIx = useRef(-1);
  if (points.length < 2) return null;
  const W = 300, L0 = 12, R0 = 288, top = 30, bottom = height - 22;
  const vs = points.map((p) => p.value), mn = Math.min(...vs), mx = Math.max(...vs), sp = mx - mn || Math.abs(mx) || 1;
  const X = (i: number) => L0 + (i * (R0 - L0)) / (points.length - 1);
  const Y = (v: number) => top + (1 - (v - mn) / sp) * (bottom - top);
  const ln = points.map((p, i) => X(i).toFixed(1) + ',' + Y(p.value).toFixed(1)).join(' ');
  const ink = onDark ? '#fff' : 'currentColor';
  const step = Math.max(1, Math.ceil(points.length / 4));
  const k = ix == null ? points.length - 1 : ix;
  const px = X(k), py = Y(points[k].value);
  const tip = compact(points[k].value);
  const txt = ix != null ? points[k].label + ' · ' + tip : tip;
  const tw = Math.max(52, txt.length * 6 + 18);
  const tx = Math.min(R0 - tw / 2, Math.max(L0 + tw / 2, px));
  const scrub = (e: React.PointerEvent) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const i = Math.round(f * (points.length - 1));
    if (i !== lastIx.current) { lastIx.current = i; haptic('select'); }
    setIx(i);
  };
  const off = () => { lastIx.current = -1; setIx(null); };
  return (
    <div className="lc" ref={box} onPointerMove={scrub} onPointerDown={scrub} onPointerLeave={off} onPointerUp={off} onPointerCancel={off}>
      <svg viewBox={'0 0 ' + W + ' ' + height} style={{ width: '100%', display: 'block' }} role="img" aria-label={ariaLabel}>
        <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".34" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        {[0, 1, 2].map((g) => <line key={g} x1={L0} x2={R0} y1={top + (g * (bottom - top)) / 2} y2={top + (g * (bottom - top)) / 2} stroke={ink} strokeOpacity=".08" strokeDasharray="3 4" />)}
        <polygon className="area" fill={'url(#' + gid + ')'} points={L0 + ',' + bottom + ' ' + ln + ' ' + R0 + ',' + bottom} />
        <polyline className="draw" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={ln} pathLength={1} />
        {ix != null && <line x1={px} x2={px} y1={top - 4} y2={bottom} stroke={ink} strokeOpacity=".25" />}
        <circle cx={px} cy={py} r="9" fill={color} opacity=".2" />
        <circle cx={px} cy={py} r="4.5" fill={color} stroke="#fff" strokeWidth="1.5" />
        <g className="tipg">
          <rect x={tx - tw / 2} y="1" width={tw} height="22" rx="8" style={onDark ? { fill: 'rgba(255,255,255,.12)', stroke: 'rgba(255,255,255,.14)' } : { fill: 'var(--cd)', stroke: 'var(--bd)' }} />
          <text x={tx} y="15.5" fontSize="10" fontWeight="700" textAnchor="middle" fill={onDark ? '#fff' : 'currentColor'}>{txt}</text>
        </g>
        {points.map((p, i) => (i % step === 0 || i === points.length - 1) && (i === points.length - 1 || points.length - 1 - i >= step / 2)
          ? <text key={i} x={X(i)} y={height - 6} fontSize="9" fill={ink} opacity=".55" textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}>{p.label}</text> : null)}
      </svg>
    </div>
  );
}

export interface Slice { label: string; value: number; color: string }

export function Donut({ slices, center }: { slices: Slice[]; center: string }) {
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0) || 1;
  const C = 2 * Math.PI * 44;
  let off = 0;
  return (
    <svg viewBox="0 0 120 120" role="img" aria-label={slices.map((s) => s.label + ' ' + Math.round((s.value / total) * 100) + ' percent').join(', ')}>
      <circle cx="60" cy="60" r="44" fill="none" stroke="var(--tr)" strokeWidth="18" />
      {slices.filter((s) => s.value > 0).map((s) => {
        const len = (s.value / total) * C;
        const el = <circle key={s.label} cx="60" cy="60" r="44" fill="none" stroke={s.color} strokeWidth="18" strokeDasharray={len.toFixed(2) + ' ' + C.toFixed(2)} strokeDashoffset={(-off).toFixed(2)} transform="rotate(-90 60 60)" />;
        off += len;
        return el;
      })}
      <text x="60" y="56" fontSize="10" textAnchor="middle" fontWeight="600" style={{ fill: 'var(--mu)' }}>Total</text>
      <text x="60" y="72" fontSize="13" textAnchor="middle" fontWeight="800" style={{ fill: 'var(--tx)' }}>{center}</text>
    </svg>
  );
}

export function Bars({ items, highlightLast = true, upColor, dnColor }: { items: Array<{ label: string; value: number }>; highlightLast?: boolean; upColor: string; dnColor: string }) {
  if (!items.length) return null;
  const pos = Math.max(0, ...items.map((x) => x.value)), neg = Math.max(0, ...items.map((x) => -x.value));
  const span = pos + neg || 1, area = 74, top = 18;
  const zero = top + (pos / span) * area;
  const w = 284 / items.length, bw = Math.min(30, w * 0.6);
  const H = top + area + 26;
  return (
    <svg viewBox={'0 0 300 ' + H} style={{ width: '100%', display: 'block' }} role="img" aria-label={items.map((x) => x.label + ' ' + Math.round(x.value)).join(', ')}>
      <line x1="8" x2="292" y1={zero} y2={zero} stroke="currentColor" strokeOpacity=".15" />
      {items.map((x, i) => {
        const h = Math.max(3, (Math.abs(x.value) / span) * area), cx = 8 + w * i + w / 2, y = x.value >= 0 ? zero - h : zero;
        const last = i === items.length - 1;
        return (
          <g key={x.label + i}>
            <rect className="gb" x={(cx - bw / 2).toFixed(1)} y={y.toFixed(1)} width={bw.toFixed(1)} height={h.toFixed(1)} rx="6" fill={x.value >= 0 ? upColor : dnColor} opacity={highlightLast && !last ? 0.5 : 1} style={{ transformBox: 'fill-box', transformOrigin: 'center ' + (x.value >= 0 ? 'bottom' : 'top'), animationDelay: Math.min(i * 60, 400) + 'ms' }} />
            <text x={cx.toFixed(1)} y={(x.value >= 0 ? y - 5 : y + h + 11).toFixed(1)} fontSize="9" fontWeight="700" textAnchor="middle" fill="currentColor" opacity=".8">{Math.abs(x.value) >= 1000 ? (x.value < 0 ? '−' : '') + Math.round(Math.abs(x.value) / 1000) + 'k' : Math.round(x.value)}</text>
            <text x={cx.toFixed(1)} y={H - 6} fontSize="9" textAnchor="middle" fill="currentColor" opacity=".55">{x.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

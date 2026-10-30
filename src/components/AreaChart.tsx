// One chart used everywhere a value moves over time (Home, the fund, accounts).
// Smooth line over a soft area, a glow under the line, a reveal from left to right, and drag-to-read.
// The reveal is a clip that grows, so it works on every Android WebView (no pathLength, no clipped CSS shadows).
import { useId, useRef, useState } from 'react';
import { haptic } from '../lib/native';

export interface ChartPt { date: string; label: string; value: number }

const W = 300;

/** Monotone cubic path through the points (no overshoot above or below the data). */
function smooth(p: Array<[number, number]>): string {
  const n = p.length;
  if (n < 2) return '';
  if (n === 2) return 'M' + p[0][0].toFixed(1) + ',' + p[0][1].toFixed(1) + 'L' + p[1][0].toFixed(1) + ',' + p[1][1].toFixed(1);
  const dx: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) { dx.push(p[i + 1][0] - p[i][0]); m.push((p[i + 1][1] - p[i][1]) / (dx[i] || 1)); }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]));
  t.push(m[n - 2]);
  let d = 'M' + p[0][0].toFixed(1) + ',' + p[0][1].toFixed(1);
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += 'C' + (p[i][0] + h).toFixed(1) + ',' + (p[i][1] + h * t[i]).toFixed(1) + ' ' + (p[i + 1][0] - h).toFixed(1) + ',' + (p[i + 1][1] - h * t[i + 1]).toFixed(1) + ' ' + p[i + 1][0].toFixed(1) + ',' + p[i + 1][1].toFixed(1);
  }
  return d;
}

export function AreaChart({
  points, color, height = 170, onDark = false, ariaLabel, tip, onScrub, replay = '', baseline, bleed = false,
}: {
  points: ChartPt[]; color: string; height?: number; onDark?: boolean; ariaLabel: string;
  /** Text for the bubble while dragging; when omitted no bubble is drawn. */
  tip?: (p: ChartPt) => string;
  onScrub?: (i: number | null) => void;
  /** Change this to replay the reveal (for example when the range changes). */
  replay?: string;
  /** Optional dashed reference line (for example your average cost) with a label. */
  baseline?: { value: number; label: string; color: string };
  /** Edge to edge inside a card: no side margins and no axis labels. */
  bleed?: boolean;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const box = useRef<HTMLDivElement>(null);
  const [ix, setIx] = useState<number | null>(null);
  const last = useRef(-1);
  const pts = points.length === 1 ? [points[0], { ...points[0] }] : points;
  if (pts.length < 2) return null;

  const L0 = bleed ? 0 : 10, R0 = bleed ? W - 16 : 290, top = bleed ? 34 : 38, bottom = bleed ? height - 8 : height - 26;
  const vals = pts.map((p) => p.value).concat(baseline ? [baseline.value] : []);
  let mn = Math.min(...vals), mx = Math.max(...vals);
  if (mx - mn < Math.abs(mx) * 0.002 || mx === mn) { const pad = Math.abs(mx) * 0.004 || 1; mn -= pad; mx += pad; }
  const X = (i: number) => L0 + (i * (R0 - L0)) / (pts.length - 1);
  const Y = (v: number) => top + (1 - (v - mn) / (mx - mn)) * (bottom - top);
  const P = pts.map((p, i) => [X(i), Y(p.value)] as [number, number]);
  const line = smooth(P);
  const area = line + 'L' + R0 + ',' + (bottom + 14) + 'L' + L0 + ',' + (bottom + 14) + 'Z';
  const ink = onDark ? '#ffffff' : 'currentColor';
  const k = ix == null ? pts.length - 1 : ix;
  const [px, py] = P[k];

  const scrub = (e: React.PointerEvent) => {
    const r = box.current?.getBoundingClientRect();
    if (!r || !r.width) return;
    const x = ((e.clientX - r.left) / r.width) * W;
    const i = Math.max(0, Math.min(pts.length - 1, Math.round(((x - L0) / (R0 - L0)) * (pts.length - 1))));
    if (i !== last.current) { last.current = i; haptic('select'); setIx(i); onScrub?.(i); }
  };
  const off = () => { if (last.current === -1) return; last.current = -1; setIx(null); onScrub?.(null); };

  const bubble = ix != null && tip ? tip(pts[ix]) : '';
  const bw = Math.max(64, bubble.length * 5.6 + 22);
  const bx = Math.min(W - 4 - bw / 2, Math.max(4 + bw / 2, px));
  const first = pts[0], lastP = pts[pts.length - 1];

  return (
    <div className={'ac' + (bleed ? ' bleed' : '')} ref={box} onPointerDown={scrub} onPointerMove={scrub} onPointerLeave={off} onPointerUp={off} onPointerCancel={off}>
      <svg viewBox={'0 0 ' + W + ' ' + height} role="img" aria-label={ariaLabel}>
        <defs>
          <linearGradient id={'f' + uid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity={onDark ? 0.42 : 0.3} />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
          <clipPath id={'c' + uid}><rect key={'r' + replay} className="ac-reveal" x="0" y="0" width={W} height={height} /></clipPath>
          <filter id={'g' + uid} filterUnits="userSpaceOnUse" x="-20" y="-20" width={W + 40} height={height + 40}><feGaussianBlur stdDeviation="5" /></filter>
        </defs>
        {[0, 1, 2].map((g) => { const y = top + (g * (bottom - top)) / 2; return <line key={g} x1={L0} x2={R0} y1={y} y2={y} stroke={ink} strokeOpacity=".07" strokeDasharray="2 5" strokeLinecap="round" />; })}
        {baseline && <g className="ac-base"><line x1={L0} x2={R0} y1={Y(baseline.value)} y2={Y(baseline.value)} stroke={baseline.color} strokeWidth="1.4" strokeDasharray="5 4" /><text x={L0} y={Y(baseline.value) - 6} fontSize="9.5" fontWeight="600" fill={baseline.color}>{baseline.label}</text></g>}
        <g clipPath={'url(#c' + uid + ')'}>
          <path d={area} fill={'url(#f' + uid + ')'} />
          <path d={line} fill="none" stroke={color} strokeWidth="7" strokeOpacity={onDark ? 0.34 : 0.22} filter={'url(#g' + uid + ')'} transform="translate(0 5)" />
          <path d={line} fill="none" stroke={color} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        {ix != null && <line x1={px} x2={px} y1={top - 10} y2={bottom + 6} stroke={ink} strokeOpacity=".28" strokeDasharray="3 3" />}
        <g key={'d' + replay} className={ix == null ? 'ac-end' : ''}>
          {ix == null && <circle className="ac-pulse" cx={px} cy={py} r="5" fill={color} />}
          <circle cx={px} cy={py} r="9.5" fill={color} opacity=".22" />
          <circle cx={px} cy={py} r="4.6" fill={color} stroke={onDark ? '#fff' : 'var(--cd)'} strokeWidth="2" />
        </g>
        {bubble && (
          <g className="ac-tip">
            <rect x={bx - bw / 2} y="2" width={bw} height="24" rx="12" style={onDark ? { fill: 'rgba(255,255,255,.16)' } : { fill: 'var(--cd)', stroke: 'var(--bd)' }} />
            <text x={bx} y="18" fontSize="10.5" fontWeight="700" textAnchor="middle" fill={onDark ? '#fff' : 'currentColor'}>{bubble}</text>
          </g>
        )}
        {!bleed && <text x={L0} y={height - 6} fontSize="9.5" fill={ink} opacity=".5">{first.label}</text>}
        {!bleed && <text x={R0} y={height - 6} fontSize="9.5" fill={ink} opacity=".5" textAnchor="end">{lastP.label}</text>}
      </svg>
    </div>
  );
}

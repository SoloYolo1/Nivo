// The portfolio card: value, range chart with drag-to-inspect, and the plain-words story. Same drawing as 3.x.
import { useCallback, useMemo, useRef, useState } from 'react';
import { HeroHead } from './Wordmark';
import { CountUp, Seg } from './ui';
import { RANGES, rangeRows, type Row } from '../lib/fund';
import { cl, dd, n0, pc } from '../lib/format';
import { haptic } from '../lib/native';
import { useColors } from './theme';
import type { Fund } from '../state/derived';

export function FundHero({ f, range, onRange, label = 'Meezan Balanced' }: { f: Fund; range: number; onRange: (d: number) => void; label?: string }) {
  const L = f.last as Row;
  const S = useMemo(() => rangeRows(f.rows, range), [f.rows, range]);
  const [ix, setIx] = useState<number | null>(null);
  const lastIx = useRef(-1);
  const box = useRef<HTMLDivElement>(null);
  const C = useColors();
  const fmt = useCallback((v: number) => n0(v), []);

  const rg = S.slice(1).reduce((a, x) => a + x.chg, 0);
  const base = S[0] ? S[0].val || 1 : 1;
  const color = rg >= 0 ? C.up : C.dn;
  const v = S.map((x) => x.val), mn = Math.min(...v), mx = Math.max(...v), sp = mx - mn || 1;
  const P = v.map((y, i) => [8 + i * (284 / (v.length - 1 || 1)), 44 + (1 - (y - mn) / sp) * 92] as [number, number]);
  const ln = P.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const lp = P[ix == null ? P.length - 1 : ix] || [0, 0];
  const word = (RANGES.find((r) => r.d === range) || RANGES[3]).word;
  const pv1 = f.prev;
  const vc = f.be ? (L.nav / f.be - 1) * 100 : 0;

  const scrub = (e: React.PointerEvent) => {
    const r = box.current?.getBoundingClientRect();
    if (!r || S.length < 2) return;
    const k = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const i = Math.round(k * (S.length - 1));
    if (i !== lastIx.current) { lastIx.current = i; haptic(4); }
    setIx(i);
  };
  const unscrub = () => { lastIx.current = -1; setIx(null); };
  const sx = ix != null ? S[ix] : null;
  const cx = ix != null ? Math.min(262, Math.max(38, lp[0])) : 0;

  return (
    <div className="cd hero">
      <HeroHead label={label} chip={'NAV ' + L.nav.toFixed(2) + ' · ' + dd(L.date)} />
      <div className="l">{sx ? dd(sx.date) + ' · NAV ' + sx.nav.toFixed(2) : 'Portfolio value'}</div>
      <div className="big"><span>PKR</span>{sx ? n0(sx.val) : <CountUp id="fund-hero" value={L.val} format={fmt} />}</div>
      {sx
        ? <span className={'dl ' + cl(sx.chg)}>{(sx.chg >= 0 ? '▲ ' : '▼ ') + 'Rs ' + n0(Math.abs(sx.chg)) + ' that day'}</span>
        : <span className={'dl ' + cl(rg)}>{(rg >= 0 ? '▲ ' : '▼ ') + 'Rs ' + n0(Math.abs(rg)) + ' (' + pc(rg / base * 100) + ') ' + word}</span>}
      <div className="story">
        {pv1 && <><b>{(L.chg >= 0 ? 'Up' : 'Down') + ' Rs ' + n0(Math.abs(L.chg))}</b>{' on ' + dd(L.date) + ' · '}</>}
        {vc >= 0 ? <><b>{vc.toFixed(1)}% above</b> your average cost.</> : <><b>{Math.abs(vc).toFixed(1)}% below</b> your average cost.</>}
      </div>
      <div className="hx">
        <div><small>Invested</small><b>Rs {(f.sent / 1e5).toFixed(2)} L</b></div>
        <div><small>Units</small><b>{L.u.toLocaleString('en-PK', { maximumFractionDigits: 0 })}</b></div>
        <div><small>Avg cost</small><b>{f.be.toFixed(2)}</b></div>
      </div>
      <Seg label="Chart range" items={RANGES.map((r) => ({ v: r.d, label: r.label }))} value={range} onChange={(d) => { unscrub(); onRange(d); }} />
      <div id="ch" ref={box} onPointerMove={scrub} onPointerDown={scrub} onPointerLeave={unscrub} onPointerUp={unscrub} onPointerCancel={unscrub}>
        <svg viewBox="0 0 300 170" role="img" aria-label={'Portfolio value ' + word}>
          <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".35" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
          {[0, 1, 2].map((i) => <line key={i} x1="8" x2="292" y1={22 + i * 56} y2={22 + i * 56} stroke="currentColor" strokeOpacity=".08" strokeDasharray="3 4" />)}
          <polygon fill="url(#g)" points={'8,150 ' + ln + ' 292,150'} />
          <polyline key={'l' + range} className="draw" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={ln} pathLength={1} />
          {ix != null && <line x1={lp[0]} x2={lp[0]} y1="10" y2="150" stroke="currentColor" strokeOpacity=".25" />}
          <circle cx={lp[0]} cy={lp[1]} r="9" fill={color} opacity=".2" />
          <circle cx={lp[0]} cy={lp[1]} r="4.5" fill={color} stroke="#fff" strokeWidth="1.5" />
          {sx && (
            <g>
              <rect x={cx - 38} y="2" width="76" height="31" rx="9" style={{ fill: 'var(--cd)', stroke: 'var(--bd)' }} />
              <text x={cx} y="15" fontSize="9" textAnchor="middle" style={{ fill: 'var(--mu)' }}>{dd(sx.date)}</text>
              <text x={cx} y="27" fontSize="11" fontWeight="700" textAnchor="middle" style={{ fill: 'var(--tx)' }}>{n0(sx.val)}</text>
            </g>
          )}
          {S[0] && <text x="8" y="164" fontSize="9" fill="currentColor" opacity=".55">{dd(S[0].date)}</text>}
          <text x="292" y="164" fontSize="9" fill="currentColor" opacity=".55" textAnchor="end">{dd(L.date)}</text>
        </svg>
      </div>
    </div>
  );
}

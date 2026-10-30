// The fund card: the nivo logo, your holding, how you stand on what you put in, and the chart edge to edge.
import { useCallback, useMemo, useState } from 'react';
import { Wordmark } from './Wordmark';
import { CountUp } from './ui';
import { AreaChart } from './AreaChart';
import { Icon } from './Icon';
import { RANGES, rangeRows, type Row } from '../lib/fund';
import { cl, dd, n0 } from '../lib/format';
import { useColors } from './theme';
import type { Fund } from '../state/derived';

export function FundHero({ f, range, onRange }: { f: Fund; range: number; onRange: (d: number) => void }) {
  const L = f.last as Row;
  const S = useMemo(() => rangeRows(f.rows, range), [f.rows, range]);
  const [ix, setIx] = useState<number | null>(null);
  const C = useColors();
  const fmt = useCallback((v: number) => n0(v), []);
  const rg = S.slice(1).reduce((a, x) => a + x.chg, 0);
  const word = (RANGES.find((r) => r.d === range) || RANGES[3]).word;
  const sx = ix != null ? S[ix] : null;
  const pts = useMemo(() => S.map((x) => ({ date: x.date, label: dd(x.date), value: x.val })), [S]);
  const net = L.val - f.sent;
  const pct = f.sent ? (net / f.sent) * 100 : 0;
  return (
    <div className="cd hero nw">
      <div className="hh">
        <Wordmark className="cw" />
        <div className="rp" role="tablist" aria-label="Chart range">
          {RANGES.map((r) => <button key={r.d} type="button" role="tab" aria-selected={range === r.d} className={range === r.d ? 'on' : ''} onClick={() => { setIx(null); onRange(r.d); }}>{r.label}</button>)}
        </div>
      </div>
      <div className="hl">{sx ? dd(sx.date) + ' · NAV ' + sx.nav.toFixed(4) : 'Your holding'}</div>
      <div className="big"><span>Rs</span>{sx ? n0(sx.val) : <CountUp id="fund-hero" value={L.val} format={fmt} />}</div>
      {sx
        ? <div className="chg-row"><span className={'dl ' + cl(sx.chg)}><Icon name={sx.chg >= 0 ? 'up' : 'down'} size={12} stroke={3} />Rs {n0(Math.abs(sx.chg))}</span><span className="when">that day</span></div>
        : <div className="hero-sub"><b className={net >= 0 ? 'g' : 'r'}>{(net >= 0 ? '+' : '−') + 'Rs ' + n0(Math.abs(net))}</b> on Rs {n0(f.sent)} put in · <b>{(pct >= 0 ? '+' : '−') + Math.abs(pct).toFixed(2)}%</b><span className="hero-sub2">{(rg >= 0 ? '+' : '−') + 'Rs ' + n0(Math.abs(rg))} {word}</span></div>}
      <AreaChart points={pts} height={140} bleed color={rg >= 0 ? C.upHero : C.dnHero} onDark ariaLabel={'Holding value ' + word} replay={String(range)} onScrub={setIx} tip={(p) => p.label + ' · Rs ' + n0(p.value)} />
      <div className="nw-foot" role="group" aria-label="Your units">
        <span><small>Invested</small><b>Rs {(f.sent / 1e5).toFixed(2)} L</b></span>
        <span><small>Units</small><b>{L.u.toLocaleString('en-PK', { maximumFractionDigits: 0 })}</b></span>
        <span><small>Avg cost</small><b>{f.be.toFixed(2)}</b></span>
      </div>
    </div>
  );
}

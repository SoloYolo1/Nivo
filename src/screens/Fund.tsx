// The Meezan Balanced Fund screen: everything that was on the Portfolio, Insights and History pages in 3.x.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { Card, Seg, Spark } from '../components/ui';
import { FundHero } from '../components/FundHero';
import { HeroHead } from '../components/Wordmark';
import { useColors } from '../components/theme';
import { useFund, type Fund } from '../state/derived';
import { deletePrice, getState, openEntry, openSheet, removeBuy, replaceTop, toast, useStore, type FundTab } from '../state/store';
import { refreshAll } from '../state/refresh';
import { dealing, expectedDate, feeOf, windowPL, type Row, type Stats } from '../lib/fund';
import { cl, dd, iso, n0, pc, sg } from '../lib/format';
import { haptic } from '../lib/native';
import { BackupCard } from './Backup';

export function FundScreen({ tab }: { tab: FundTab }) {
  const f = useFund();
  if (!f.last || !f.st) {
    return (
      <section className="pg">
        <Card icon="tag" title="No prices yet"><p className="hint">Tap + to add the first NAV, or pull down to check Al Meezan.</p></Card>
      </section>
    );
  }
  return (
    <>
      <div className="subnav"><Seg label="Fund sections" items={[{ v: 'overview', label: 'Overview' }, { v: 'analysis', label: 'Analysis' }, { v: 'history', label: 'History' }]} value={tab} onChange={(t) => replaceTop({ name: 'fund', tab: t as FundTab })} /></div>
      {tab === 'overview' && <Overview f={f} />}
      {tab === 'analysis' && <Analysis f={f} />}
      {tab === 'history' && <History f={f} />}
    </>
  );
}

// ---------------- overview ----------------
export function RefreshButton({ full }: { full?: boolean }) {
  const ui = useStore((s) => s.refreshUi);
  return (
    <button type="button" className={'btn sec rfb' + (ui === 'ok' ? ' ok' : '')} style={full ? undefined : { minHeight: 38, padding: '8px 14px', fontSize: 13 }} onClick={() => void refreshAll(false)} disabled={ui === 'busy'}>
      {ui === 'busy' ? <span className="spn" style={{ display: 'grid' }}><Icon name="loader" size={16} /></span>
        : ui === 'ok' ? <span className="chk" style={{ display: 'grid' }}><Icon name="check" size={16} /></span>
        : <Icon name="refresh" size={full ? 16 : 15} />}
      {full ? (ui === 'busy' ? 'Checking' : ui === 'ok' ? 'Updated' : 'Refresh') : 'Check'}
    </button>
  );
}

function navStatus(L: Row, lc: { t: number; src: string; latest: string }): { k: string; t: string } {
  const hh = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (lc.t) {
    if (L.date >= lc.latest) return { k: 'ok', t: 'Up to date. Al Meezan’s latest published price is ' + dd(L.date) + '. Checked ' + hh(lc.t) + ' via ' + lc.src + '.' };
    return { k: 'warn', t: 'A newer price (' + dd(lc.latest) + ') is available. Tap Refresh.' };
  }
  return L.date >= expectedDate() ? { k: 'ok', t: 'You have the latest price (' + dd(L.date) + ').' } : { k: '', t: 'Last price in the app is from ' + dd(L.date) + '. Tap Refresh to check for a newer one.' };
}

export function fundInsights(st: Stats, be: number, L: Row, peers: { items: Array<{ v: number; me?: boolean }> }): Array<[string, string]> {
  const out: Array<[string, string]> = [['cal', st.up + ' of ' + st.ch.length + ' trading days were up so far.']];
  out.push(L.nav >= be ? ['check', 'You are above break-even. The purchase fee is covered.'] : ['target', 'NAV must reach ' + be.toFixed(2) + ' (+' + ((be / L.nav - 1) * 100).toFixed(1) + '%) to cover the purchase fee.']);
  const mm = peers.items[0]?.v ?? 0, me = (peers.items.find((i) => i.me) || { v: 0 }).v;
  out.push(['scale', 'Money market funds are up ' + mm.toFixed(1) + '% since July, your fund ' + pc(me) + '. That gap is the price of stock exposure.']);
  out.push(['compass', 'Daily moves of about ' + st.vol.toFixed(1) + '% are normal for this fund. Check weekly, not daily.']);
  return out;
}

function DealingCard() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  const x = dealing(now);
  return (
    <Card icon="clock" title="Dealing window" more="When orders are accepted">
      <div className="rw" style={{ border: 0, padding: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span className={'live' + (x.open ? ' on' : '')} /><div><b style={{ fontSize: 16 }}>{x.t}</b><small>{x.s}</small></div></div>
        <span className="k" style={{ textAlign: 'right' }}>Mon to Thu 9 to 3<br />Fri 9 to 4</span>
      </div>
    </Card>
  );
}

function Overview({ f }: { f: Fund }) {
  const L = f.last as Row, st = f.st as Stats;
  const [range, setRange] = useState(0);
  const lc = useStore((s) => s.lastCheck);
  const busy = useStore((s) => s.refreshUi === 'busy');
  const peers = useStore((s) => s.peers);
  const C = useColors();
  const pv = f.prev;
  const ns = navStatus(L, lc);
  const go = (t: FundTab) => replaceTop({ name: 'fund', tab: t });
  const week = f.rows.slice(-5);
  return (
    <section className="pg">
      <FundHero f={f} range={range} onRange={setRange} />
      <div className="qa">
        <button type="button" onClick={() => openEntry('nav', { date: iso() })}><i><Icon name="coinplus" size={18} /></i>Add price</button>
        <button type="button" onClick={() => openEntry('inv', { date: iso() })}><i><Icon name="banknote" size={18} /></i>Invest</button>
        <button type="button" onClick={() => void refreshAll(false)}><i><Icon name="sync" size={18} /></i>Refresh</button>
        <button type="button" onClick={() => go('history')}><i><Icon name="save" size={18} /></i>Backup</button>
      </div>
      <div className="cap">Today</div>
      <Card icon="tag" title="Latest price" more="NAV per unit">
        <div className={'lp' + (busy ? ' busy' : '')}>
          <div>
            <div className="lpv">{L.nav.toFixed(4)}</div>
            <div className="k" style={{ marginTop: 3 }}>{dd(L.date)}{pv && <> · <span className={cl(L.chg)} style={{ fontWeight: 700 }}>{pc((L.nav / pv.nav - 1) * 100)}</span> vs {dd(pv.date)}</>}</div>
          </div>
          <RefreshButton full />
        </div>
        <div className="st"><i className={ns.k} /><span>{ns.t}</span></div>
      </Card>
      <div className="g" id="qs" onClick={() => go('analysis')}>
        {([['Today', L.chg, L.bs ? (L.chg / L.bs) * 100 : 0, f.rows.map((x) => x.val).slice(-5)], ['Since start', f.all, (f.all / f.first) * 100, f.rows.map((x) => x.val)]] as Array<[string, number, number, number[]]>).map((c) => (
          <div className="cd" key={c[0]}><div className="k">{c[0]}</div><div className={'v ' + cl(c[1])}>{sg(c[1])}</div><div className={'s ' + cl(c[1])}>{pc(c[2])}</div><Spark values={c[3]} color={c[1] >= 0 ? C.up : C.dn} /></div>
        ))}
      </div>
      <Card icon="cal" title="This week" more="Daily change in Rs">
        <div className="wk">
          {week.map((x) => {
            const first = f.rows.indexOf(x) === 0;
            return (
              <button type="button" className="wd tap" key={x.date} onClick={() => openSheet('day', x.date)} style={{ background: 'none', border: 0, color: 'inherit', font: 'inherit', padding: 0 }}>
                <span className="k">{new Date(x.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                <div className={'dot ' + (first ? '' : cl(x.chg))}>{!first && <Icon name="up" size={16} />}</div>
                <b className={first ? '' : cl(x.chg)}>{first ? 'Start' : sg(x.chg)}</b>
              </button>
            );
          })}
        </div>
      </Card>
      <div className="cap">Your money</div>
      <Card icon="wallet" title="Holdings" more="All entries" id="hold" onClick={() => go('history')}>
        <div className="rw" style={{ border: 0, padding: 0 }}>
          <div><b style={{ fontSize: 15 }}>Meezan Balanced Fund</b><small>{L.u.toLocaleString('en-PK', { maximumFractionDigits: 2 })} units · NAV {L.nav.toFixed(4)}</small></div>
          <div style={{ textAlign: 'right' }}><b>Rs {n0(L.val)}</b><small className={cl(L.val - f.sent)} style={{ fontWeight: 700 }}>{sg(L.val - f.sent)} ({pc(((L.val - f.sent) / f.sent) * 100)})</small></div>
        </div>
      </Card>
      <div className="cap">Good to know</div>
      <DealingCard />
      <Card icon="bulb" title="Worth knowing" more="Three quick reads" onClick={() => go('analysis')}>
        {fundInsights(st, f.be, L, peers).slice(0, 3).map((x) => <div className="ln" key={x[1]}><i><Icon name={x[0]} size={16} /></i><span>{x[1]}</span></div>)}
      </Card>
    </section>
  );
}

// ---------------- analysis ----------------
function Analysis({ f }: { f: Fund }) {
  const L = f.last as Row, st = f.st as Stats;
  const peers = useStore((s) => s.peers);
  const C = useColors();
  const [hmText, setHmText] = useState('Tap a square to see that day');
  const net = L.val - f.sent;
  const rows = [[1, 'Today'], [7, 'Last 7 days'], [30, 'Last 30 days'], [0, 'Since start']].map(([d, l]) => { const w = windowPL(f.rows, d as number); return { l: l as string, p: w.p, r: w.b ? (w.p / w.b) * 100 : 0 }; });
  const mx = Math.max(...rows.map((r) => Math.abs(r.r)), 0.01);
  const ch = st.ch;
  // price against cost chart
  const nc = useMemo(() => {
    const v = f.rows.map((x) => x.nav), be = f.be;
    const mn = Math.min(...v, be) * 0.998, mxv = Math.max(...v, be) * 1.002, rg = mxv - mn || 1;
    const Y = (y: number) => 16 + (1 - (y - mn) / rg) * 100, X = (i: number) => 8 + i * (284 / (f.rows.length - 1 || 1));
    return { Y, X, ln: f.rows.map((x, i) => X(i).toFixed(1) + ',' + Y(x.nav).toFixed(1)).join(' ') };
  }, [f.rows, f.be]);
  const g = f.be ? (L.nav / f.be - 1) * 100 : 0;
  const mxBar = Math.max(...ch.map((x) => Math.abs(x.chg)), 1), w = 280 / Math.max(1, ch.length), bw = Math.min(34, w * 0.62);
  const mx2 = Math.max(...peers.items.map((i) => Math.abs(i.v)), 1);
  const tiles: Array<[string, string, string, string, string?]> = [
    ['check', 'Win rate', Math.round((st.up / (st.ch.length || 1)) * 100) + '%', st.up + ' of ' + st.ch.length + ' days up'],
    ['flame', 'Streak', st.streak + (st.dir ? ' up' : ' down'), 'days in a row'],
    ['scale', 'Daily swing', st.vol.toFixed(2) + '%', 'typical daily move'],
    ['tag', 'Break-even NAV', f.be.toFixed(2), 'NAV now ' + L.nav.toFixed(2)],
    ['up', 'Best day', sg(st.best.chg), dd(st.best.date), st.best.date],
    ['snow', 'Worst day', sg(st.worst.chg), dd(st.worst.date), st.worst.date],
  ];
  return (
    <section className="pg">
      <div className="cd hero mini">
        <HeroHead label="Your result so far" chip={'since ' + dd(f.rows[0].date)} />
        <div className="mh-v"><span>PKR</span>{sg(net)}</div>
        <span className={'dl ' + cl(net)}>{(net >= 0 ? '▲ ' : '▼ ') + pc(f.sent ? (net / f.sent) * 100 : 0) + ' on Rs ' + n0(f.sent) + ' put in'}</span>
        <div className="hx"><div><small>Price move</small><b>{sg(f.all)}</b></div><div><small>Up days</small><b>{Math.round((st.up / (st.ch.length || 1)) * 100)}%</b></div><div><small>Days tracked</small><b>{f.rows.length}</b></div></div>
      </div>
      <div className="cap">Returns</div>
      <Card icon="trend" title="Performance" more="Profit or loss by period">
        {rows.map((r) => (
          <div className="perf" key={r.l}><span>{r.l}</span><div className="tk"><i className="z" /><b style={{ background: 'var(--' + cl(r.p) + ')', width: ((Math.abs(r.r) / mx) * 50).toFixed(1) + '%', ...(r.p >= 0 ? { left: '50%' } : { right: '50%' }) }} /></div><div className={'r ' + cl(r.p)}>{sg(r.p)}<small>{pc(r.r)}</small></div></div>
        ))}
      </Card>
      <Card icon="scale" title="Price against your cost" more="Break-even line">
        <div id="nc">
          <svg viewBox="0 0 300 140" role="img" aria-label="NAV against your average cost">
            <line x1="8" x2="292" y1={nc.Y(f.be).toFixed(1)} y2={nc.Y(f.be).toFixed(1)} stroke="var(--org)" strokeWidth="1.5" strokeDasharray="5 4" />
            <text x="292" y={(nc.Y(f.be) - 5).toFixed(1)} fontSize="9" textAnchor="end" style={{ fill: 'var(--org)' }}>Your cost {f.be.toFixed(2)}</text>
            <polyline fill="none" stroke="var(--a)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={nc.ln} />
            <circle cx={nc.X(f.rows.length - 1).toFixed(1)} cy={nc.Y(L.nav).toFixed(1)} r="4.5" style={{ fill: 'var(--a)' }} />
            <text x="8" y="136" fontSize="9" fill="currentColor" opacity=".55">{dd(f.rows[0].date)}</text>
            <text x="292" y="136" fontSize="9" textAnchor="end" fill="currentColor" opacity=".55">{dd(L.date)}</text>
          </svg>
        </div>
        <div className="k" style={{ marginTop: 8 }}>{g >= 0 ? 'NAV is ' + g.toFixed(1) + '% above your average cost.' : 'NAV is ' + Math.abs(g).toFixed(1) + '% below your average cost.'}</div>
      </Card>
      <div className="cap">Patterns</div>
      <div className="g" id="st">
        {tiles.map((x, i) => (
          <div className={'cd' + (x[4] ? ' tap' : '')} key={x[1]} onClick={x[4] ? () => openSheet('day', x[4] as string) : undefined}>
            <div className="ic"><Icon name={x[0]} size={15} /></div><div className="k">{x[1]}</div>
            <div className={'v ' + (i === 4 ? 'up' : i === 5 ? 'dn' : '')}>{x[2]}</div><div className="s" style={{ color: 'var(--mu)', fontWeight: 500 }}>{x[3]}</div>
          </div>
        ))}
      </div>
      <Card icon="shield" title="Risk" more="How bumpy the ride is">
        {[['Typical daily move', st.vol.toFixed(2) + '%'], ['Biggest drop from a peak', st.dr.toFixed(2) + '%'], ['Days tracked', String(f.rows.length)], ['Stocks in the fund', '30% to 60%']].map((x) => <div className="rw" key={x[0]}><span>{x[0]}</span><b>{x[1]}</b></div>)}
      </Card>
      <Card icon="bar" title="Daily profit and loss" more="Last trading days">
        <div id="bars">
          {ch.length ? (
            <svg viewBox="0 0 300 150" role="img" aria-label="Daily profit and loss">
              <line x1="8" x2="292" y1="60" y2="60" stroke="currentColor" strokeOpacity=".2" />
              {ch.map((x, i) => {
                const h = Math.max(3, (Math.abs(x.chg) / mxBar) * 48), cx = 8 + w * i + w / 2, y = x.chg >= 0 ? 60 - h : 60;
                return (
                  <g key={x.date}>
                    <rect className="gb" x={(cx - bw / 2).toFixed(1)} y={y.toFixed(1)} width={bw.toFixed(1)} height={h.toFixed(1)} rx="6" fill={x.chg >= 0 ? C.up : C.dn} style={{ transformBox: 'fill-box', transformOrigin: 'center ' + (x.chg >= 0 ? 'bottom' : 'top'), animationDelay: Math.min(i * 60, 600) + 'ms' }} />
                    {ch.length <= 14 && <text x={cx.toFixed(1)} y={(x.chg >= 0 ? y - 5 : y + h + 11).toFixed(1)} fontSize="9" fontWeight="700" textAnchor="middle" fill="currentColor" opacity=".8">{sg(x.chg)}</text>}
                    {ch.length <= 14 && <text x={cx.toFixed(1)} y="144" fontSize="9" textAnchor="middle" fill="currentColor" opacity=".5">{dd(x.date)}</text>}
                  </g>
                );
              })}
            </svg>
          ) : <span className="k">Add a second day’s price to see daily profit and loss.</span>}
        </div>
      </Card>
      <Card icon="grid" title="Day by day" more="Green up, red down">
        <div className="hm">
          {ch.length ? ch.map((x) => (
            <i key={x.date} role="button" tabIndex={0} onClick={() => setHmText(dd(x.date) + ': ' + sg(x.chg) + ' Rs · NAV ' + x.nav.toFixed(2))}
              style={{ background: x.chg >= 0 ? C.up : C.dn, opacity: Math.min(1, (Math.abs(x.chg) / ((x.bs || 1) * 0.01)) * 0.6 + 0.4).toFixed(2) }}>{dd(x.date).split(' ')[0]}</i>
          )) : <span className="k">Needs two or more days of prices.</span>}
        </div>
        <div className="k" style={{ marginTop: 10 }}>{hmText}</div>
      </Card>
      <div className="cap">The fund</div>
      <Card icon="compass" title="Other Meezan funds">
        <div className="k" style={{ margin: '-6px 0 8px' }}>Returns this financial year (since 1 July), as of {peers.asof}</div>
        {peers.items.map((i) => (
          <div className="pr" key={i.n}><span className="n" style={i.me ? { color: 'var(--a)', fontWeight: 700 } : undefined}>{i.n}</span><div className="tk"><div className="z" /><b style={{ background: 'var(--' + (i.v >= 0 ? 'up' : 'dn') + ')', width: (Math.abs(i.v) / mx2) * 50 + '%', ...(i.v >= 0 ? { left: '50%' } : { right: '50%' }) }} /></div><span className={cl(i.v)} style={{ width: 56, textAlign: 'right', fontWeight: 700, fontSize: 12 }}>{pc(i.v)}</span></div>
        ))}
      </Card>
      <Card icon="info" title="Fund details" more="Meezan Balanced Fund">
        {[['Launched', '20 Dec 2004'], ['Mix', '30% to 60% stocks, rest income'], ['Buy fee (app)', 'Up to 1.5%'], ['Sell fee', 'None'], ['Minimum', 'Rs 5,000'], ['Dealing hours', 'Mon to Thu 9 to 3, Fri 9 to 4'], ['Yearly cost cap', 'Up to 3%']].map((x) => <div className="rw" key={x[0]}><span>{x[0]}</span><b style={{ textAlign: 'right' }}>{x[1]}</b></div>)}
      </Card>
    </section>
  );
}

// ---------------- history ----------------
function SwipeRow({ row, onDelete, onEdit }: { row: Row; onDelete: () => void; onEdit: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const st = useRef<{ x0: number; dx: number } | null>(null);
  const [show, setShow] = useState(false);
  return (
    <div className={'sw-row' + (show ? ' show' : '')}>
      <div className="sw-bg"><Icon name="trash" size={14} />Delete</div>
      <div className="hr2 tap" ref={ref}
        onClick={(e) => { if (!(e.target as HTMLElement).closest('button')) openSheet('day', row.date); }}
        onTouchStart={(e) => { if ((e.target as HTMLElement).closest('button')) return; st.current = { x0: e.touches[0].clientX, dx: 0 }; if (ref.current) ref.current.style.transition = 'none'; }}
        onTouchMove={(e) => { const s = st.current; if (!s || !ref.current) return; s.dx = Math.min(0, e.touches[0].clientX - s.x0); ref.current.style.transform = 'translateX(' + s.dx + 'px)'; setShow(s.dx < -20); }}
        onTouchEnd={() => {
          const s = st.current, el = ref.current; st.current = null;
          if (!s || !el) return;
          el.style.transition = '';
          if (s.dx < -96) { el.style.transform = 'translateX(-110%)'; setTimeout(onDelete, 220); } else { el.style.transform = ''; setShow(false); }
        }}>
        <span>{dd(row.date)}</span><b>{row.nav.toFixed(4)}</b><span><span className={'chg ' + cl(row.chg)}>{sg(row.chg)}</span></span>
        <span className="a">
          <button type="button" className="x" aria-label={'Edit ' + dd(row.date)} onClick={onEdit}><Icon name="pencil" size={16} /></button>
          <button type="button" className="x" aria-label={'Delete ' + dd(row.date)} onClick={onDelete}><Icon name="trash" size={16} /></button>
        </span>
      </div>
    </div>
  );
}

function History({ f }: { f: Fund }) {
  const buys = useStore((s) => s.buys);
  const navs = useStore((s) => s.navs);
  const fee = buys.reduce((a, b) => a + feeOf(navs, b), 0);
  const del = (d: string) => { if (getState().navs.length < 2) { toast('Keep at least one price'); return; } haptic(8); deletePrice(d); };
  const ev = buys.map((b) => ({ d: b.date, k: 'inv', t: 'Invested Rs ' + n0(b.sent), s: b.units.toFixed(2) + ' units', c: 0 }))
    .concat(f.rows.slice(1).map((x) => ({ d: x.date, k: 'nav', t: 'NAV ' + x.nav.toFixed(4), s: sg(x.chg) + ' Rs that day', c: x.chg })))
    .sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0)).slice(0, 10);
  return (
    <section className="pg">
      <div className="cd hero mini">
        <HeroHead label="Money you put in" chip={buys.length + (buys.length > 1 ? ' entries' : ' entry')} />
        <div className="mh-v"><span>PKR</span>{n0(f.sent)}</div>
        <span className="dl">About Rs {n0(fee)} in fees ({f.sent ? ((fee / f.sent) * 100).toFixed(2) : '0'}%)</span>
        <div className="hx"><div><small>Prices logged</small><b>{navs.length}</b></div><div><small>First entry</small><b>{buys.length ? dd(buys.map((b) => b.date).sort()[0]) : '–'}</b></div><div><small>Avg cost</small><b>{f.be.toFixed(2)}</b></div></div>
      </div>
      <div className="cap">Activity</div>
      <Card icon="clock" title="Timeline" more="Latest first">
        {ev.map((e) => (
          <div className="rw tap" key={e.k + e.d} onClick={() => openSheet('day', e.d)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span className={'tic ' + (e.k === 'inv' ? 'inv' : e.c >= 0 ? 'up' : 'dn')}><Icon name={e.k === 'inv' ? 'wallet' : 'trend'} size={16} /></span><div><b style={{ fontSize: 14 }}>{e.t}</b><small>{e.s}</small></div></div>
            <span className="k">{dd(e.d)}</span>
          </div>
        ))}
      </Card>
      <Card icon="list" title="Price history" more="Edit or remove a day">
        <div className="hr2 k"><span>Date</span><span>NAV</span><span>Day</span><span /></div>
        {[...f.rows].reverse().map((x) => <SwipeRow key={x.date} row={x} onDelete={() => del(x.date)} onEdit={() => openEntry('nav', { date: x.date, nav: String(x.nav) })} />)}
      </Card>
      <Card icon="wallet" title="Contributions" more="Money you put in">
        {buys.map((b, i) => (
          <div className="rw" key={b.date + i}>
            <div><b>Rs {n0(b.sent)}</b><small>{dd(b.date)} · {b.units.toFixed(2)} units · paid {(b.sent / b.units).toFixed(2)} each · fee about Rs {n0(feeOf(navs, b))}</small></div>
            <button type="button" className="x" aria-label={'Delete investment of ' + dd(b.date)} onClick={() => { if (buys.length < 2) { toast('Keep at least one investment'); return; } removeBuy(i); }}><Icon name="trash" size={16} /></button>
          </div>
        ))}
      </Card>
      <div className="cap">Keep it safe</div>
      <BackupCard />
    </section>
  );
}


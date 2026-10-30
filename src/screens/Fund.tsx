// The Meezan Balanced Fund screen: everything that was on the Portfolio, Insights and History pages in 3.x.
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { Card, Tabs } from '../components/ui';
import { FundHero } from '../components/FundHero';
import { AreaChart } from '../components/AreaChart';
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
      <div className="subnav"><Tabs label="Fund sections" items={[{ v: 'overview', label: 'Overview' }, { v: 'analysis', label: 'Analysis' }, { v: 'history', label: 'History' }]} value={tab} onChange={(t) => replaceTop({ name: 'fund', tab: t as FundTab })} /></div>
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
  const month = windowPL(f.rows, 30);
  const last10 = f.rows.slice(1).slice(-10);
  const m10 = Math.max(...last10.map((x) => Math.abs(x.chg)), 1);
  const toBe = f.be ? (f.be / L.nav - 1) * 100 : 0;
  const fill = f.be ? Math.min(100, (L.nav / f.be) * 100) : 100;
  return (
    <section className="pg">
      <FundHero f={f} range={range} onRange={setRange} />

      <div className="g3" onClick={() => go('analysis')}>
        <div className="cd"><small>Today</small><b className={cl(L.chg)}>{sg(L.chg)}</b><span>{pv ? pc((L.nav / pv.nav - 1) * 100) : '–'}</span></div>
        <div className="cd"><small>This month</small><b className={cl(month.p)}>{sg(month.p)}</b><span>{month.b ? pc((month.p / month.b) * 100) : '–'}</span></div>
        <div className="cd"><small>Up days</small><b>{Math.round((st.up / (st.ch.length || 1)) * 100)}%</b><span>{st.up} of {st.ch.length}</span></div>
      </div>

      <Card icon="target" title="Break-even" more={toBe > 0 ? 'NAV must rise ' + toBe.toFixed(1) + '%' : 'Fees covered'}>
        <div className="be-bar"><i style={{ width: fill + '%' }} /></div>
        <div className="be-l"><span>NAV now {L.nav.toFixed(2)}</span><span>Break-even {f.be.toFixed(2)}</span></div>
      </Card>

      {last10.length > 1 && (
        <Card icon="bar" title={'Last ' + last10.length + ' days'} more="Rs change on your holding">
          <div className="d10">
            {last10.map((x, i) => {
              const h = Math.max(4, (Math.abs(x.chg) / m10) * 44);
              const lastOne = i === last10.length - 1;
              return (
                <button type="button" key={x.date} className={'d10c' + (lastOne ? ' last' : '')} onClick={(e) => { e.stopPropagation(); openSheet('day', x.date); }} aria-label={dd(x.date) + ' ' + sg(x.chg)}>
                  <span className="d10t">{x.chg >= 0 ? <i className="u" style={{ height: h, background: C.up }} /> : null}</span>
                  <span className="d10b">{x.chg < 0 ? <i className="d" style={{ height: h, background: C.dn }} /> : null}</span>
                  <small>{new Date(x.date + 'T00:00:00').getDate()}</small>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      <div className="two-act">
        <button type="button" className="btn gold big" onClick={() => openEntry('inv', { date: iso() })}>Add investment</button>
        <button type="button" className="btn sec big" onClick={() => openEntry('nav', { date: iso() })}>Add a price</button>
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
  const bars = ch.slice(-14), heat = ch.slice(-42);
  const g = f.be ? (L.nav / f.be - 1) * 100 : 0;
  const mxBar = Math.max(...bars.map((x) => Math.abs(x.chg)), 1), w = 280 / Math.max(1, bars.length), bw = Math.min(34, w * 0.62);
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
        <HeroHead icon="bar" label="Your result so far" chip={'since ' + dd(f.rows[0].date)} />
        <div className="mh-v"><span>Rs</span>{sg(net)}</div>
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
        <AreaChart points={f.rows.map((x) => ({ date: x.date, label: dd(x.date), value: x.nav }))} height={160} color={C.a} ariaLabel="NAV against your average cost" baseline={{ value: f.be, label: 'Your cost ' + f.be.toFixed(2), color: C.org }} tip={(p) => p.label + ' · NAV ' + p.value.toFixed(4)} />
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
      <Card icon="bar" title="Daily profit and loss" more={bars.length > 1 ? 'Last ' + bars.length + ' trading days' : 'Last trading days'}>
        <div id="bars">
          {bars.length ? (
            <svg viewBox="0 0 300 150" role="img" aria-label="Daily profit and loss">
              <line x1="8" x2="292" y1="60" y2="60" stroke="currentColor" strokeOpacity=".2" />
              {bars.map((x, i) => {
                const h = Math.max(3, (Math.abs(x.chg) / mxBar) * 48), cx = 8 + w * i + w / 2, y = x.chg >= 0 ? 60 - h : 60;
                return (
                  <g key={x.date}>
                    <rect className="gb" x={(cx - bw / 2).toFixed(1)} y={y.toFixed(1)} width={bw.toFixed(1)} height={h.toFixed(1)} rx="6" fill={x.chg >= 0 ? C.up : C.dn} style={{ transformBox: 'fill-box', transformOrigin: 'center ' + (x.chg >= 0 ? 'bottom' : 'top'), animationDelay: Math.min(i * 60, 600) + 'ms' }} />
                    <text x={cx.toFixed(1)} y={(x.chg >= 0 ? y - 5 : y + h + 11).toFixed(1)} fontSize={bars.length > 8 ? 7.5 : 9} fontWeight="700" textAnchor="middle" fill="currentColor" opacity=".8">{Math.abs(x.chg) >= 1000 ? (x.chg >= 0 ? '+' : '−') + (Math.abs(x.chg) / 1000).toFixed(1) + 'k' : sg(x.chg)}</text>
                    {(bars.length <= 7 || i % 2 === (bars.length - 1) % 2) && <text x={cx.toFixed(1)} y="144" fontSize="8.5" textAnchor="middle" fill="currentColor" opacity=".5">{dd(x.date)}</text>}
                  </g>
                );
              })}
            </svg>
          ) : <span className="k">Add a second day’s price to see daily profit and loss.</span>}
        </div>
      </Card>
      <Card icon="grid" title="Day by day" more={heat.length < ch.length ? 'Last ' + heat.length + ' days · green up' : 'Green up, red down'}>
        <div className="hm">
          {heat.length ? heat.map((x) => (
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
  const [showAll, setShowAll] = useState(false);
  const fee = buys.reduce((a, b) => a + feeOf(navs, b), 0);
  const del = (d: string) => { if (getState().navs.length < 2) { toast('Keep at least one price'); return; } haptic('medium'); deletePrice(d); };
  const ev = buys.map((b) => ({ d: b.date, k: 'inv', t: 'Invested Rs ' + n0(b.sent), s: b.units.toFixed(2) + ' units', c: 0 }))
    .concat(f.rows.slice(1).map((x) => ({ d: x.date, k: 'nav', t: 'NAV ' + x.nav.toFixed(4), s: sg(x.chg) + ' Rs that day', c: x.chg })))
    .sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0)).slice(0, 10);
  return (
    <section className="pg">
      <div className="cd hero mini">
        <HeroHead icon="clock" label="Money you put in" chip={buys.length + (buys.length > 1 ? ' entries' : ' entry')} />
        <div className="mh-v"><span>Rs</span>{n0(f.sent)}</div>
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
        {[...f.rows].reverse().slice(0, showAll ? undefined : 30).map((x) => <SwipeRow key={x.date} row={x} onDelete={() => del(x.date)} onEdit={() => openEntry('nav', { date: x.date, nav: String(x.nav) })} />)}
        {!showAll && f.rows.length > 30 && <button type="button" className="linkrow more-row" onClick={() => setShowAll(true)}><span>Show all {f.rows.length} days</span><Icon name="chevr" size={18} /></button>}
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


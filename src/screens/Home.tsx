// Home: net worth across every account, what needs attention, and the most useful tips.
import { useCallback, useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { Wordmark } from '../components/Wordmark';
import { AccountRow, FundRow } from '../components/Rows';
import { Card, Roll } from '../components/ui';
import { AreaChart } from '../components/AreaChart';
import { useColors } from '../components/theme';
import { useFund, useTotals } from '../state/derived';
import { goTab, openSheet, push, setMasked, setState, useStore } from '../state/store';
import { refreshAll } from '../state/refresh';
import { dailyNetWorth, emergency, endOfPrevMonth, growth, staleAccounts, workingIdle, worth, zakat, type Group } from '../lib/accounts';
import { UpdateCard } from '../components/Update';
import { DataTile } from '../components/DataTile';
import { MoveActions } from '../components/MoveActions';
import { cl, compact, dd, iso, n0, pc } from '../lib/format';
import { CATS, billsDue, dueWords, monthFlow, shiftMonth, spendingByCat } from '../lib/cashflow';
import { markPaid } from './Bills';
import { save, KEYS } from '../lib/storage';
import { requestPermission, askPower, openNotificationSettings } from '../lib/notify';
import { isNative } from '../lib/native';
import { canBridge } from '../lib/legacy';
import { load } from '../lib/storage';
import { syncBackground } from '../state/refresh';
import { toast } from '../state/store';

export const GROUP_COLOR: Record<Group, string> = { banks: '#8f9cff', business: '#56c8f0', investments: '#4fd59c', assets: '#d68bf5', loans: '#f2847b' };
const GROUP_SHORT: Record<Group, string> = { banks: 'Banks', business: 'Business', investments: 'Invest', assets: 'Assets', loans: 'Loans' };

export function Home() {
  const f = useFund();
  const accounts = useStore((s) => s.accounts);
  const spend = useStore((s) => s.spend);
  const nisab = useStore((s) => s.nisab);
  const fundZakat = useStore((s) => s.fundZakat);
  const newSince = useStore((s) => s.newSince);
  const alerts = useStore((s) => s.alerts);
  const busy = useStore((s) => s.refreshUi === 'busy');
  const today = iso();
  const stale = useMemo(() => staleAccounts(accounts, today), [accounts, today]);
  const tips = useMemo(() => {
    const out: Array<[string, string]> = [];
    const wi = workingIdle(accounts, f.last ? f.last.val : 0);
    if (wi.idle > 0) out.push(['info', 'Rs ' + n0(wi.idle) + ' sits in current accounts and cash, earning nothing.' + (wi.bestRate ? ' At your ' + wi.bestRate + '% savings rate it would earn about Rs ' + n0((wi.idle * wi.bestRate) / 100 / 12) + ' a month.' : '')]);
    const em = emergency(accounts, spend);
    if (em.months != null) out.push(['shield', 'Your emergency money covers about ' + em.months.toFixed(1) + ' months of spending. 6 months is a common safety target.']);
    else if (accounts.some((a) => a.kind === 'bank')) out.push(['shield', 'Add your monthly spending in Insights to see how many months your savings would last.']);
    const z = zakat(accounts, f.last ? f.last.val : 0, nisab, fundZakat);
    if (z.base > 0) out.push(['scale', 'Estimated zakat this year: Rs ' + n0(z.due) + ' (2.5% of zakatable wealth). See the breakdown in Insights.']);
    return out.slice(0, 3);
  }, [accounts, f.last, spend, nisab, fundZakat]);

  const L = f.last;
  const t = useTotals();
  const buys = useStore((s) => s.buys);
  const top = useMemo(() => accounts.slice().sort((a, b) => Math.abs(worth(b)) - Math.abs(worth(a))).slice(0, 4), [accounts]);
  // this month, without counting money put into the fund or accounts that were only added (see growth())
  const month = useMemo(() => growth(accounts, f.points, buys.map((b) => ({ date: b.date, amount: b.sent })), endOfPrevMonth(today), today), [accounts, f.points, buys, today]);
  const fresh = !!newSince && !!L && L.date > newSince;
  return (
    <section className="pg">
      {/* 1. net worth */}
      <NetWorthHero />

      {/* 2. accounts */}
      <div className="cap"><span>Your accounts</span>{accounts.length > 0 && <button type="button" className="cap-link" onClick={() => goTab('accounts')}>See all</button>}</div>
      <section className="cd list">
        <FundRow f={f} />
        {top.map((a) => <AccountRow key={a.id} a={a} today={today} />)}
        {!accounts.length && (
          <button type="button" className="acc" onClick={() => openSheet('add')}>
            <span className="l"><span className="ai banks"><Icon name="plus" size={18} /></span><span><b>Add your bank accounts</b><small>Banks, a business, gold, property, loans</small></span></span>
            <span className="r" style={{ color: 'var(--mu)' }}><Icon name="chevr" size={18} /></span>
          </button>
        )}
      </section>

      {/* 3. money in and out this month, and what is due */}
      <CashFlowCard />
      <DueSoon />

      {/* 4. summary: four tiles, then the fund's latest price */}
      <div className="cap"><span>At a glance</span></div>
      <GlanceTiles t={t} month={month} today={today} />
      {L && (
        <section className="cd glance">
          <button type="button" className={'navstrip' + (busy ? ' checking' : '')} aria-busy={busy || undefined} onClick={() => push({ name: 'fund', tab: 'overview' })}>
            <span className={'pulse-dot' + (fresh ? ' new' : '')} aria-hidden="true" />
            <span className="ns-t">
              <b>{fresh ? 'New NAV ' : 'NAV '}{L.nav.toFixed(4)}{f.prev && <span className={cl(L.chg)}> {pc((L.nav / f.prev.nav - 1) * 100)}</span>}</b>
              <small>{dd(L.date)} · your holding {f.prev ? (L.chg >= 0 ? '+' : '−') + 'Rs ' + n0(Math.abs(L.chg)) : 'Rs ' + n0(L.val)}{f.prev ? ' that day' : ''}</small>
            </span>
            <Icon name="chevr" size={18} />
          </button>
        </section>
      )}

      {/* 5. the four actions, in one container */}
      <div className="cap"><span>Quick actions</span></div>
      <div className="qa qa-box" role="group" aria-label="Quick actions">
        <button type="button" onClick={() => openSheet('add')}><i><Icon name="qadd" size={22} /></i>Add</button>
        <button type="button" onClick={() => (stale[0] ? openSheet('update', stale[0].id) : goTab('accounts'))}><i><Icon name="qedit" size={21} /></i>Update{stale.length > 0 && <em className="qa-badge" aria-label={stale.length + ' need updating'}>{stale.length}</em>}</button>
        <button type="button" onClick={() => void refreshAll(false)}><i className={busy ? 'spin' : ''}><Icon name="qsync" size={21} /></i>Prices</button>
        <button type="button" onClick={() => push({ name: 'cashflow' })}><i><Icon name="qchart" size={21} /></i>Cash flow</button>
      </div>

      {/* things that need you, then tips */}
      <UpdateCard />
      <MigrateCard />

      {alerts.perm === 'prompt' && Date.now() > Number(localStorage.getItem(KEYS.notifPromptUntil) || 0) && (
        <div className="cd np">
          <div className="bell"><Icon name="bell" size={22} /></div>
          <div style={{ flex: 1 }}><b>Get told when a new price lands</b><p>Al Meezan publishes the NAV every evening. Turn on notifications and Nivo will tell you the new price and what it did to your money.</p>
            <div className="acts"><button type="button" className="btn gold" onClick={() => void enableAlerts()}>Turn on notifications</button><button type="button" className="btn ghost" onClick={() => { save(KEYS.notifPromptUntil, Date.now() + 7 * 864e5); setState((s) => ({ alerts: { ...s.alerts, perm: 'unknown' } })); }}>Not now</button></div>
          </div>
        </div>
      )}

      {alerts.power === false && alerts.on && Date.now() > Number(localStorage.getItem(KEYS.powerUntil) || 0) && (
        <div className="cd pwc">
          <span className="tic"><Icon name="bell" size={16} /></span>
          <div style={{ flex: 1 }}><b>Your price alerts are arriving late</b><p>Android is pausing Nivo’s background check to save battery, so the new NAV only shows up when you open the app. Let Nivo run in the background to get alerts on time.</p>
            <div className="acts"><button type="button" className="btn gold" onClick={() => void askPower()}>Allow</button><button type="button" className="btn ghost" onClick={() => { save(KEYS.powerUntil, Date.now() + 3 * 864e5); setState((s) => ({ alerts: { ...s.alerts, power: null } })); }}>Not now</button></div>
          </div>
        </div>
      )}

      {tips.length > 0 && <>
        <div className="cap">Good to know</div>
        <Card icon="bulb" title="Worth knowing" more="Across all accounts">
          {tips.map((x) => <div className="ln" key={x[1]}><i><Icon name={x[0]} size={16} /></i><span>{x[1]}</span></div>)}
        </Card>
      </>}
    </section>
  );
}

/** This month's money in and out, from the transactions, and the biggest spending category. */
function CashFlowCard() {
  const txns = useStore((s) => s.txns);
  const accounts = useStore((s) => s.accounts);
  const budget = useStore((s) => s.budget);
  const C = useColors();
  const today = iso();
  const flow = useMemo(() => monthFlow(txns, today.slice(0, 7), accounts), [txns, today, accounts]);
  const prev = useMemo(() => monthFlow(txns, shiftMonth(today.slice(0, 7), -1), accounts), [txns, today, accounts]);
  const bank = accounts.find((a) => a.kind === 'bank' || a.kind === 'cash');
  if (!flow.count && !bank) return null;
  const spend = spendingByCat(flow);
  const top = spend[0];
  const mx = Math.max(flow.in, flow.out, 1);
  const month = new Date().toLocaleDateString('en-GB', { month: 'long' });
  return (
    <>
      <div className="cap"><span>Cash flow</span><button type="button" className="cap-link" onClick={() => push({ name: 'cashflow' })}>{month}</button></div>
      <section className="cd tap" onClick={() => push({ name: 'cashflow' })} role="button" tabIndex={0} aria-label={'Cash flow for ' + month}>
        {flow.count ? <>
          <div className="flow">
            <div><small>In</small><b className="up">{compact(flow.in)}</b><div className="trk"><i style={{ width: (flow.in / mx) * 100 + '%', background: C.up }} /></div></div>
            <div><small>Out</small><b>{compact(flow.out)}</b><div className="trk"><i style={{ width: (flow.out / mx) * 100 + '%', background: C.dn }} /></div></div>
          </div>
          <div className="net-l">
            <span>{top ? 'Most on ' + CATS[top.cat].label.toLowerCase() + ' (' + Math.round((top.amount / flow.out) * 100) + '%)' : flow.out ? 'Nothing categorised yet' : 'Nothing spent yet'}</span>
            <b className={flow.net >= 0 ? 'up' : 'dn'}>{flow.net >= 0 ? '+' : '−'}{compact(Math.abs(flow.net)).replace('Rs ', '')} kept</b>
          </div>
          {budget > 0 && <div className="trk" style={{ marginTop: 10, height: 6 }}><i style={{ width: Math.min(100, (flow.out / budget) * 100) + '%', background: flow.out >= budget ? 'var(--dn)' : flow.out >= budget * 0.8 ? 'var(--org)' : 'var(--gold)' }} /></div>}
          {budget > 0 && <div className="meter-l"><span>Target Rs {n0(budget)}</span><span>{flow.out <= budget ? 'Rs ' + n0(budget - flow.out) + ' left' : 'Over by Rs ' + n0(flow.out - budget)}</span></div>}
          {prev.out > 0 && budget <= 0 && <div className="meter-l" style={{ marginTop: 8 }}><span>Last month Rs {n0(prev.out)} out</span><span className={flow.out > prev.out ? 'dn' : 'up'}>{flow.out > prev.out ? '+' : '−'}Rs {n0(Math.abs(flow.out - prev.out))}</span></div>}
        </> : (
          <div className="ln" style={{ padding: '2px 0' }}><i><Icon name="sync" size={16} /></i><span>Nothing logged in {month} yet. Add money or take it out below and the month shows up here with what it went on.</span></div>
        )}
      </section>
      {bank && <MoveActions a={bank} compact />}
    </>
  );
}

/** Four tiles: what you own, what you owe, this month's growth, and what the month kept in cash. */
function GlanceTiles({ t, month, today }: { t: ReturnType<typeof useTotals>; month: ReturnType<typeof growth>; today: string }) {
  const accounts = useStore((s) => s.accounts);
  const txns = useStore((s) => s.txns);
  const budget = useStore((s) => s.budget);
  const spend = useStore((s) => s.spend);
  const f = useFund();
  const flow = useMemo(() => monthFlow(txns, today.slice(0, 7), accounts), [txns, today, accounts]);
  const em = useMemo(() => emergency(accounts, spend), [accounts, spend]);
  const count = accounts.length + (f.last ? 1 : 0);
  const owePct = t.assets > 0 && t.owed > 0 ? Math.round((t.owed / t.assets) * 100) : 0;
  const pct = month.owned >= 1000 ? (month.change / month.owned) * 100 : null;
  const since = month.started && month.started > endOfPrevMonth(today) ? 'since ' + dd(month.started) : 'this month';
  return (
    <div className="dt-grid">
      <DataTile icon="wallet" label="You own" value={compact(t.assets).replace('Rs ', '')} color="#8f9cff" sub={count + (count === 1 ? ' account' : ' accounts')} onClick={() => goTab('accounts')} ariaLabel="What you own. Open Accounts" />
      <DataTile icon="card" label="You owe" value={t.owed > 0 ? compact(t.owed).replace('Rs ', '') : 'Nothing'} tone={t.owed > 0 ? 'dn' : ''} color="#f2847b" sub={t.owed > 0 ? owePct + '% of what you own' : 'No loans or cards'} bar={t.owed > 0 ? { pct: owePct, tone: 'dn' } : undefined} onClick={() => goTab('accounts')} ariaLabel="What you owe. Open Accounts" />
      <DataTile icon="trend" label="Growth" value={Math.abs(month.change) < 1 ? 'Flat' : (month.change >= 0 ? '+' : '−') + compact(Math.abs(month.change)).replace('Rs ', '')} tone={Math.abs(month.change) >= 1 ? cl(month.change) : ''} color="#4fd59c" delta={pct != null && Math.abs(pct) >= 0.05 ? { text: (pct >= 0 ? '+' : '−') + Math.abs(pct).toFixed(1) + '%', tone: cl(pct) } : undefined} sub={since + (month.deposits > 0 ? ', after money put in' : '')} onClick={() => goTab('insights')} ariaLabel="Growth this month. Open Insights" />
      {flow.count
        ? <DataTile icon="sync" label="Kept" value={(flow.net >= 0 ? '+' : '−') + compact(Math.abs(flow.net)).replace('Rs ', '')} tone={flow.net >= 0 ? 'up' : 'dn'} color="#56c8f0" sub={budget > 0 ? (flow.out <= budget ? compact(budget - flow.out).replace('Rs ', '') + ' of target left' : 'over target') : 'in minus out this month'} bar={budget > 0 ? { pct: (flow.out / budget) * 100, tone: flow.out >= budget ? 'dn' : flow.out >= budget * 0.8 ? 'org' : 'up' } : undefined} onClick={() => push({ name: 'cashflow' })} ariaLabel="Kept this month. Open Cash flow" />
        : <DataTile icon="shield" label="Savings last" value={em.months != null ? em.months.toFixed(1) : '–'} unit={em.months != null ? 'months' : ''} tone={em.months != null && em.months >= 6 ? 'up' : ''} color="#d68bf5" sub={em.months != null ? 'aim for 6' : 'add spending in Insights'} bar={em.months != null ? { pct: (em.months / 6) * 100, tone: em.months >= 6 ? 'up' : 'org' } : undefined} onClick={() => goTab('insights')} ariaLabel="How long savings would last. Open Insights" />}
    </div>
  );
}

/** Bills due in the next week, with Paid one tap away. */
function DueSoon() {
  const bills = useStore((s) => s.bills);
  const today = iso();
  const due = useMemo(() => billsDue(bills, today, 7), [bills, today]);
  if (!due.length) return null;
  return (
    <>
      <div className="cap"><span>Due soon<em>{due.length}</em></span><button type="button" className="cap-link" onClick={() => push({ name: 'bills' })}>All bills</button></div>
      <div className="due-strip">
        {due.map((d) => (
          <button type="button" className="due-c" key={d.bill.id} style={{ ['--cc' as string]: CATS[d.bill.cat].color } as React.CSSProperties} onClick={() => markPaid(d.bill)}>
            <span className="ci"><Icon name={CATS[d.bill.cat].icon} size={15} /></span>
            <span><b>{d.bill.name}</b><small className={d.overdue ? 'over' : d.days <= 2 ? 'soon' : ''}>{dueWords(d)}</small></span>
            <span className="amt">Rs {n0(d.bill.amount)}</span>
            <span className="stat-pill">Tap when paid</span>
          </button>
        ))}
      </div>
    </>
  );
}

export async function enableAlerts(): Promise<void> {
  const r = await requestPermission();
  save(KEYS.notif, r === 'granted');
  if (r === 'granted') { toast('Price alerts are on', 'bell'); syncBackground(); setTimeout(() => void askPower(), 900); }
  else if (r === 'denied') toast('Notifications are blocked for Nivo', 'bell', isNative() ? { label: 'Open settings', fn: () => void openNotificationSettings() } : undefined);
  else toast('Notifications are not available here');
  setState((s) => ({ alerts: { ...s.alerts, perm: r, on: r === 'granted' } }));
}

/** One-time offer to bring over Nivo 3 history, until it is done or dismissed. */
function MigrateCard() {
  const pending = useStore((s) => s.pending);
  const navs = useStore((s) => s.navs);
  // hidden at once on "Not now" (saving the choice alone did not redraw Home)
  const [hidden, setHidden] = useState(() => load<boolean>(KEYS.migrateHide, false));
  if (!canBridge() || hidden || load<number>(KEYS.migrated, 0)) return null;
  return (
    <div className="cd mig">
      <span className="tic"><Icon name="clock" size={18} /></span>
      <div style={{ flex: 1 }}>
        <b>{pending ? 'Your Nivo 3 history is ready' : 'Bring over your Nivo 3 history'}</b>
        <p>{pending ? 'Choose whether to add it to Nivo 4.' : 'Your old prices and purchases from Nivo 3 can come along. ' + (navs.length > 20 ? 'Anything already here stays.' : 'Right now Nivo only has the last few days.')}</p>
        <div className="acts">
          <button type="button" className="btn gold" onClick={() => openSheet('import')}>{pending ? 'Review' : 'Bring it over'}</button>
          <button type="button" className="btn ghost" onClick={() => { save(KEYS.migrateHide, true); setHidden(true); setState({ pending: null }); }}>Not now</button>
        </div>
      </div>
    </div>
  );
}

const NW_RANGES = [{ v: 7, label: '1W', word: 'past week' }, { v: 30, label: '1M', word: 'past 30 days' }, { v: 90, label: '3M', word: 'past 3 months' }, { v: 0, label: 'All', word: 'since you started' }];
const daysBefore = (d: string, n: number): string => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() - n); return t.toISOString().slice(0, 10); };
const ALLOC: Group[] = ['banks', 'business', 'investments', 'assets'];

/**
 * The Home card: net worth, how it changed (money you put in is not counted as growth), a day-by-day chart
 * you can drag across, and what it is made of: one bar split by kind of account, with each kind's amount
 * and share beneath it.
 */
function NetWorthHero() {
  const f = useFund();
  const t = useTotals();
  const accounts = useStore((s) => s.accounts);
  const buys = useStore((s) => s.buys);
  const C = useColors();
  const [range, setRange] = useState(30);
  const [ix, setIx] = useState<number | null>(null);
  const masked = useStore((s) => s.masked);
  const today = iso();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fmt = useCallback((v: number) => n0(v), [masked]);
  const series = useMemo(() => dailyNetWorth(accounts, f.points, today, range), [accounts, f.points, today, range]);
  const pts = useMemo(() => series.map((p) => ({ date: p.date, label: p.date === today ? 'Today' : dd(p.date), value: p.value })), [series, today]);
  const deposits = useMemo(() => buys.map((b) => ({ date: b.date, amount: b.sent })), [buys]);
  const first = series[0];
  const sx = ix != null ? pts[ix] : null;
  // From the start of the range (not from the last update before it), or, while dragging, from the chart's first point.
  const from = sx || !range ? (first ? first.date : today) : daysBefore(today, range);
  const g = useMemo(() => (first ? growth(accounts, f.points, deposits, from, sx ? sx.date : today) : null), [first, accounts, f.points, deposits, from, sx, today]);
  const shown = g ? g.change : 0;
  const pct = g && g.owned >= 1000 ? (shown / g.owned) * 100 : null;
  const word = (NW_RANGES.find((r) => r.v === range) || NW_RANGES[1]).word;
  const kinds = ALLOC.filter((k) => t.groups[k] > 0).sort((a, b) => t.groups[b] - t.groups[a]);
  const share = (k: Group) => (t.assets > 0 ? (t.groups[k] / t.assets) * 100 : 0);
  return (
    <div className="cd hero nw nw2">
      <div className="hh">
        <Wordmark className="cw" />
        <div className="rp" role="tablist" aria-label="Chart range">
          {NW_RANGES.map((r) => <button key={r.v} type="button" role="tab" aria-selected={range === r.v} className={range === r.v ? 'on' : ''} onClick={() => { setIx(null); setRange(r.v); }}>{r.label}</button>)}
        </div>
      </div>
      <div className="hl nw-hl">
        <span>{sx ? (sx.label === 'Today' ? 'Today' : longish(sx.date)) : 'Net worth'}</span>
        <button type="button" className={'nw-eye' + (masked ? ' on' : '')} aria-pressed={masked} aria-label={masked ? 'Show amounts' : 'Hide amounts'} onClick={() => setMasked(!masked)}><Icon name={masked ? 'eyeoff' : 'eye'} size={18} /></button>
      </div>
      <div className="big"><span>Rs</span>{sx ? n0(sx.value) : <Roll id="net-worth" value={t.netWorth} format={fmt} />}</div>
      <div className="chg-row">
        {Math.abs(shown) >= 1
          ? <span className={'dl ' + cl(shown)}><Icon name={shown >= 0 ? 'up' : 'down'} size={12} stroke={3} />{compact(Math.abs(shown))}{pct != null && Math.abs(pct) >= 0.05 ? ' · ' + Math.abs(pct).toFixed(1) + '%' : ''}</span>
          : <span className="dl">No change</span>}
        <span className="when">{sx && first ? 'since ' + dd(first.date) : word}{g && g.deposits > 0 ? ', not counting Rs ' + compact(g.deposits).replace('Rs ', '') + ' put in' : ''}</span>
      </div>
      <AreaChart points={pts} height={118} bleed color={shown >= 0 ? C.upHero : C.dnHero} onDark ariaLabel={'Net worth ' + word} replay={String(range)} onScrub={setIx} tip={(p) => p.label + ' · ' + compact(p.value)} />
      {kinds.length > 0 && (
        <button type="button" className="nw-mix" onClick={() => goTab('accounts')} aria-label="What your net worth is made of. Open Accounts">
          <span className="mix-head">
            <span>Breakdown</span>
            {t.owed > 0 && <span className="mix-owe">Loans −{compact(t.owed).replace('Rs ', '')}</span>}
          </span>
          <span className="mix-bar" aria-hidden="true">{kinds.map((k) => <i key={k} style={{ flex: Math.max(share(k), 1.5), background: GROUP_COLOR[k] }} />)}</span>
          <span className="mix-key">
            {kinds.map((k) => <span key={k}><i style={{ background: GROUP_COLOR[k] }} />{GROUP_SHORT[k]}<b>{Math.round(share(k))}%</b></span>)}
          </span>
        </button>
      )}
    </div>
  );
}
const longish = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

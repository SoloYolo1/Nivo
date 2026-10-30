// Home: net worth across every account, what needs attention, and the most useful tips.
import { useCallback, useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { Wordmark } from '../components/Wordmark';
import { AccountRow, FundRow } from '../components/Rows';
import { Card, CountUp } from '../components/ui';
import { AreaChart } from '../components/AreaChart';
import { useColors } from '../components/theme';
import { useFund, useTotals } from '../state/derived';
import { goTab, openSheet, push, setState, useStore } from '../state/store';
import { refreshAll } from '../state/refresh';
import { dailyNetWorth, emergency, staleAccounts, workingIdle, worth, zakat, type Group } from '../lib/accounts';
import { cl, compact, dd, iso, n0, pc } from '../lib/format';
import { save, KEYS } from '../lib/storage';
import { requestPermission, askPower } from '../lib/notify';
import { canBridge } from '../lib/legacy';
import { load } from '../lib/storage';
import { syncBackground } from '../state/refresh';
import { toast } from '../state/store';

export const GROUP_COLOR: Record<Group, string> = { banks: '#8f9cff', business: '#f3d99b', investments: '#4fd59c', assets: '#ff9f0a', loans: '#f2847b' };
const GROUP_SHORT: Record<Group, string> = { banks: 'Banks', business: 'Business', investments: 'Invest', assets: 'Assets', loans: 'Loans' };

export function Home() {
  const f = useFund();
  const accounts = useStore((s) => s.accounts);
  const spend = useStore((s) => s.spend);
  const nisab = useStore((s) => s.nisab);
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
    const z = zakat(accounts, f.last ? f.last.val : 0, nisab);
    if (z.base > 0) out.push(['scale', 'Estimated zakat this year: Rs ' + n0(z.due) + ' (2.5% of zakatable wealth). See the breakdown in Insights.']);
    return out.slice(0, 3);
  }, [accounts, f.last, spend, nisab]);

  const L = f.last;
  const top = useMemo(() => accounts.slice().sort((a, b) => Math.abs(worth(b)) - Math.abs(worth(a))).slice(0, 4), [accounts]);
  return (
    <section className="pg">
      <NetWorthHero />

      <div className="qa qa-box">
        <button type="button" onClick={() => openSheet('add')}><i><Icon name="qadd" size={22} /></i>Add</button>
        <button type="button" onClick={() => (stale[0] ? openSheet('update', stale[0].id) : goTab('accounts'))}><i><Icon name="qedit" size={21} /></i>Update</button>
        <button type="button" onClick={() => void refreshAll(false)}><i className={busy ? 'spin' : ''}><Icon name="qsync" size={21} /></i>Prices</button>
        <button type="button" onClick={() => goTab('insights')}><i><Icon name="qchart" size={21} /></i>Insights</button>
      </div>

      {L && (
        <button type="button" className="cd navstrip" onClick={() => push({ name: 'fund', tab: 'overview' })}>
          <span className={'pulse-dot' + (newSince && L.date > newSince ? ' new' : '')} aria-hidden="true" />
          <span className="ns-t">
            <b>{newSince && L.date > newSince ? 'New NAV ' : 'NAV '}{L.nav.toFixed(4)}{f.prev && <span className={cl(L.chg)}> {pc((L.nav / f.prev.nav - 1) * 100)}</span>}</b>
            <small>{dd(L.date)} · your holding {f.prev ? (L.chg >= 0 ? '+' : '−') + 'Rs ' + n0(Math.abs(L.chg)) : 'Rs ' + n0(L.val)}{f.prev ? ' that day' : ''}</small>
          </span>
          <Icon name="chevr" size={18} />
        </button>
      )}

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

      {tips.length > 0 && <>
        <div className="cap">Good to know</div>
        <Card icon="bulb" title="Worth knowing" more="Across all accounts">
          {tips.map((x) => <div className="ln" key={x[1]}><i><Icon name={x[0]} size={16} /></i><span>{x[1]}</span></div>)}
        </Card>
      </>}
    </section>
  );
}

export async function enableAlerts(): Promise<void> {
  const r = await requestPermission();
  save(KEYS.notif, r === 'granted');
  if (r === 'granted') { toast('Price alerts are on', 'bell'); syncBackground(); setTimeout(() => void askPower(), 900); }
  else if (r === 'denied') toast('Notifications are blocked in your phone settings');
  else toast('Notifications are not available here');
  setState((s) => ({ alerts: { ...s.alerts, perm: r, on: r === 'granted' } }));
}

/** One-time offer to bring over Nivo 3 history, until it is done or dismissed. */
function MigrateCard() {
  const pending = useStore((s) => s.pending);
  const navs = useStore((s) => s.navs);
  if (!canBridge() || load<number>(KEYS.migrated, 0) || load<boolean>(KEYS.migrateHide, false)) return null;
  return (
    <div className="cd mig">
      <span className="tic"><Icon name="clock" size={18} /></span>
      <div style={{ flex: 1 }}>
        <b>{pending ? 'Your Nivo 3 history is ready' : 'Bring over your Nivo 3 history'}</b>
        <p>{pending ? 'Choose whether to add it to Nivo 4.' : 'Your old prices and purchases from Nivo 3 can come along. ' + (navs.length > 20 ? 'Anything already here stays.' : 'Right now Nivo only has the last few days.')}</p>
        <div className="acts">
          <button type="button" className="btn gold" onClick={() => openSheet('import')}>{pending ? 'Review' : 'Bring it over'}</button>
          <button type="button" className="btn ghost" onClick={() => { save(KEYS.migrateHide, true); setState({ pending: null }); }}>Not now</button>
        </div>
      </div>
    </div>
  );
}

const NW_RANGES = [{ v: 7, label: '1W', word: 'this week' }, { v: 30, label: '1M', word: 'this month' }, { v: 90, label: '3M', word: 'in 3 months' }, { v: 0, label: 'All', word: 'since you started' }];

/** The Home card: the nivo logo, net worth and a day-by-day chart you can drag across, edge to edge. */
function NetWorthHero() {
  const f = useFund();
  const t = useTotals();
  const accounts = useStore((s) => s.accounts);
  const C = useColors();
  const [range, setRange] = useState(30);
  const [ix, setIx] = useState<number | null>(null);
  const today = iso();
  const fmt = useCallback((v: number) => n0(v), []);
  const series = useMemo(() => dailyNetWorth(accounts, f.points, today, range), [accounts, f.points, today, range]);
  const pts = useMemo(() => series.map((p) => ({ date: p.date, label: p.date === today ? 'Today' : dd(p.date), value: p.value })), [series, today]);
  const groups = (['banks', 'business', 'investments', 'assets'] as Group[]).filter((g) => t.groups[g] > 0).sort((a, b) => t.groups[b] - t.groups[a]);
  const first = series[0], lastV = series.length ? series[series.length - 1].value : t.netWorth;
  const ch = first ? lastV - first.value : 0;
  const word = (NW_RANGES.find((r) => r.v === range) || NW_RANGES[1]).word;
  const sx = ix != null ? pts[ix] : null;
  const shown = sx && first ? sx.value - first.value : ch;
  const L = f.last;
  return (
    <div className="cd hero nw">
      <div className="hh">
        <Wordmark className="cw" />
        <div className="rp" role="tablist" aria-label="Chart range">
          {NW_RANGES.map((r) => <button key={r.v} type="button" role="tab" aria-selected={range === r.v} className={range === r.v ? 'on' : ''} onClick={() => { setIx(null); setRange(r.v); }}>{r.label}</button>)}
        </div>
      </div>
      <div className="hl">{sx ? (sx.label === 'Today' ? 'Today' : longish(sx.date)) : 'Net worth'}</div>
      <div className="big"><span>Rs</span>{sx ? n0(sx.value) : <CountUp id="net-worth" value={t.netWorth} format={fmt} />}</div>
      <div className="chg-row">
        <span className={'dl ' + cl(shown)}><Icon name={shown >= 0 ? 'up' : 'down'} size={12} stroke={3} />{'Rs ' + compact(Math.abs(shown)).replace('Rs ', '') + (first && first.value > 0 ? ' · ' + Math.abs((shown / first.value) * 100).toFixed(1) + '%' : '')}</span>
        <span className="when">{sx && first ? 'since ' + dd(first.date) : word}</span>
      </div>
      <AreaChart points={pts} height={150} bleed color={ch >= 0 ? C.upHero : C.dnHero} onDark ariaLabel={'Net worth ' + word} replay={String(range)} onScrub={setIx} tip={(p) => p.label + ' · Rs ' + compact(p.value).replace('Rs ', '')} />
      <button type="button" className="nw-foot" onClick={() => goTab('accounts')}>
        {groups.length > 1
          ? groups.slice(0, 3).map((g) => <span key={g}><small>{GROUP_SHORT[g]}</small><b>{compact(t.groups[g]).replace('Rs ', '')}</b></span>)
          : L ? <><span><small>Meezan fund</small><b>{L.u.toLocaleString('en-PK', { maximumFractionDigits: 0 })} units</b></span><span><small>NAV</small><b>{L.nav.toFixed(2)}</b></span><span><small>Accounts</small><b>{accounts.length + 1}</b></span></> : <span><small>Accounts</small><b>{accounts.length}</b></span>}
        <Icon name="chevr" size={16} />
      </button>
    </div>
  );
}
const longish = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

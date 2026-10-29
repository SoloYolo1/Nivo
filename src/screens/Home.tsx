// Home: net worth across every account, what needs attention, and the most useful tips.
import { useCallback, useMemo } from 'react';
import { Icon, KIND_ICON } from '../components/Icon';
import { HeroHead } from '../components/Wordmark';
import { Card, CountUp } from '../components/ui';
import { LineChart } from '../components/Charts';
import { useFund, useTotals } from '../state/derived';
import { goTab, openSheet, push, setState, useStore } from '../state/store';
import { refreshAll } from '../state/refresh';
import { GROUPS, KINDS, emergency, monthChange, netWorthSeries, staleAccounts, staleDays, workingIdle, zakat, type Group } from '../lib/accounts';
import { cl, compact, dd, iso, n0, pc, sg } from '../lib/format';
import { save, KEYS } from '../lib/storage';
import { requestPermission, askPower } from '../lib/notify';
import { syncBackground } from '../state/refresh';
import { toast } from '../state/store';

export const GROUP_COLOR: Record<Group, string> = { banks: '#8f9cff', business: '#f3d99b', investments: '#4fd59c', assets: '#ff9f0a', loans: '#f2847b' };
const GROUP_SHORT: Record<Group, string> = { banks: 'Banks', business: 'Business', investments: 'Invest', assets: 'Assets', loans: 'Loans' };

export function Home() {
  const f = useFund();
  const t = useTotals();
  const accounts = useStore((s) => s.accounts);
  const spend = useStore((s) => s.spend);
  const nisab = useStore((s) => s.nisab);
  const newSince = useStore((s) => s.newSince);
  const alerts = useStore((s) => s.alerts);
  const today = iso();
  const fmt = useCallback((v: number) => n0(v), []);
  const mc = useMemo(() => monthChange(accounts, f.points, today), [accounts, f.points, today]);
  const series = useMemo(() => netWorthSeries(accounts, f.points, today, 6), [accounts, f.points, today]);
  const stale = useMemo(() => staleAccounts(accounts, today), [accounts, today]);
  const positive = (['banks', 'business', 'investments', 'assets'] as Group[]).filter((g) => t.groups[g] > 0);
  const share = (g: Group) => (t.assets > 0 ? (t.groups[g] / t.assets) * 100 : 0);
  const count = accounts.length + (f.last ? 1 : 0);
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
  return (
    <section className="pg">
      <div className="cd hero">
        <HeroHead label={<>Net worth <span>· {t.owed > 0 ? 'everything you own, minus what you owe' : 'everything you own'}</span></>} chip={count + (count === 1 ? ' account' : ' accounts')} />
        <div className="big"><span>PKR</span><CountUp id="net-worth" value={t.netWorth} format={fmt} /></div>
        <span className={'dl ' + cl(mc.change)}>{(mc.change >= 0 ? '▲ ' : '▼ ') + 'Rs ' + n0(Math.abs(mc.change)) + (mc.base > 0 ? ' (' + pc((mc.change / mc.base) * 100) + ')' : '') + ' this month'}</span>
        {positive.length > 0 && (
          <>
            <div className="alloc" aria-hidden="true">{positive.map((g) => <i key={g} className={'c-' + g} style={{ width: share(g) + '%' }} />)}</div>
            <div className="hx">
              {positive.slice(0, 3).map((g) => <div key={g}><small><span className={'sw8 c-' + g} />{GROUP_SHORT[g]} · {Math.round(share(g))}%</small><b>{compact(t.groups[g])}</b></div>)}
            </div>
          </>
        )}
        {series.length >= 3 && <div style={{ marginTop: 14 }}><LineChart points={series.map((p) => ({ label: p.label, value: p.value }))} color={mc.change >= 0 ? '#4fd59c' : '#f2847b'} height={96} onDark ariaLabel="Net worth over recent months" /></div>}
      </div>

      <div className="qa">
        <button type="button" onClick={() => openSheet('add')}><i><Icon name="coinplus" size={18} /></i>Add</button>
        <button type="button" onClick={() => (stale[0] ? openSheet('update', stale[0].id) : goTab('accounts'))}><i><Icon name="pencil" size={18} /></i>Update</button>
        <button type="button" onClick={() => void refreshAll(false)}><i><Icon name="sync" size={18} /></i>Prices</button>
        <button type="button" onClick={() => goTab('insights')}><i><Icon name="bar" size={18} /></i>Insights</button>
      </div>

      {newSince && L && L.date > newSince && (
        <div className="cd newc">
          <span className="tic"><Icon name="bell" size={16} /></span>
          <div style={{ flex: 1 }}><b>New price since your last visit: {L.nav.toFixed(4)}{f.prev ? ' (' + pc((L.nav / f.prev.nav - 1) * 100) + ')' : ''}</b><small>{dd(L.date)}{f.prev ? ' · ' + sg(L.chg) + ' Rs on your holding' : ''}</small></div>
          <button type="button" className="x" aria-label="Dismiss" onClick={() => setState({ newSince: '' })}><Icon name="close" size={18} /></button>
        </div>
      )}

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

      {stale.length > 0 && (
        <div className="cd nudge">
          <span className="tic"><Icon name="clock" size={16} /></span>
          <div style={{ flex: 1 }}>
            <b>{stale.length === 1 ? '1 balance needs updating' : stale.length + ' balances need updating'}</b>
            <span className="k" style={{ display: 'block', lineHeight: 1.5, marginTop: 2 }}>{stale.slice(0, 3).map((a) => <span key={a.id} style={{ display: 'block' }}>{a.name + ', last updated ' + staleDays(a, today) + ' days ago'}</span>)}</span>
            <div className="acts"><button type="button" className="btn gold" onClick={() => openSheet('update', stale[0].id)}>Update now</button></div>
          </div>
        </div>
      )}

      <div className="cap">Your accounts</div>
      <section className="cd list">
        {L && (
          <button type="button" className="acc" onClick={() => push({ name: 'fund', tab: 'overview' })}>
            <span className="l"><span className="ai investments"><Icon name="trend" size={18} /></span><span><b>Meezan Balanced Fund</b><small><span className="livedot" />Live NAV · {L.u.toLocaleString('en-PK', { maximumFractionDigits: 0 })} units</small></span></span>
            <span className="r"><b>{n0(L.val)}</b><small className={cl(L.chg)}>{sg(L.chg)} today</small></span>
          </button>
        )}
        {GROUPS.filter((g) => accounts.some((a) => KINDS[a.kind].group === g.id)).map((g) => {
          const list = accounts.filter((a) => KINDS[a.kind].group === g.id);
          return (
            <button type="button" className="acc" key={g.id} onClick={() => goTab('accounts')}>
              <span className="l"><span className={'ai ' + g.id}><Icon name={KIND_ICON[list[0].kind]} size={18} /></span><span><b>{g.label}</b><small>{list.length + (list.length === 1 ? ' account · ' : ' accounts · ') + list.slice(0, 3).map((a) => a.name).join(', ')}</small></span></span>
              <span className="r"><b>{g.id === 'loans' ? '−' : ''}{n0(Math.abs(t.groups[g.id] - (g.id === 'investments' ? t.fund : 0)))}</b></span>
            </button>
          );
        })}
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

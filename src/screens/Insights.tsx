// Insights across everything: growth, mix, money working vs idle, emergency cushion, zakat.
import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { Card } from '../components/ui';
import { Wordmark } from '../components/Wordmark';
import { Donut } from '../components/Charts';
import { useFund, useTotals } from '../state/derived';
import { openSheet, push, setNisab, setSpend, useStore } from '../state/store';
import { emergency, endOfPrevMonth, growth, netWorthSeries, workingIdle, zakat, type Group } from '../lib/accounts';
import { compact, dd, iso, n0, parseAmount, sg } from '../lib/format';
import { GROUP_COLOR } from './Home';

const LABEL: Record<Group, string> = { banks: 'Banks and cash', business: 'Business', investments: 'Investments', assets: 'Other assets', loans: 'Loans' };

function InlineAmount({ id, label, value, onSave, placeholder }: { id: string; label: string; value: number | null; onSave: (v: number | null) => void; placeholder: string }) {
  const [t, setT] = useState(value ? n0(value) : '');
  const commit = () => { const v = parseAmount(t); onSave(Number.isFinite(v) && v > 0 ? v : null); if (Number.isFinite(v) && v > 0) setT(n0(v)); };
  return (
    <div className="spend">
      <label className="lab" htmlFor={id} style={{ flex: 1 }}><span>{label}</span>
        <input id={id} className="in" inputMode="decimal" placeholder={placeholder} value={t} onChange={(e) => setT(e.target.value.replace(/[^\d.,]/g, ''))} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
      </label>
    </div>
  );
}

export function Insights() {
  const f = useFund();
  const t = useTotals();
  const accounts = useStore((s) => s.accounts);
  const buys = useStore((s) => s.buys);
  const spend = useStore((s) => s.spend);
  const nisab = useStore((s) => s.nisab);
  const today = iso();
  const fundNow = f.last ? f.last.val : 0;
  const series = useMemo(() => netWorthSeries(accounts, f.points, today, 6), [accounts, f.points, today]);
  const wi = useMemo(() => workingIdle(accounts, fundNow), [accounts, fundNow]);
  const em = useMemo(() => emergency(accounts, spend), [accounts, spend]);
  const z = useMemo(() => zakat(accounts, fundNow, nisab), [accounts, fundNow, nisab]);
  const deposits = useMemo(() => buys.map((b) => ({ date: b.date, amount: b.sent })), [buys]);
  const hasHistory = series.length >= 2;
  const first = series[0];
  // Growth since the first month shown, and this month: money put into the fund and accounts that were
  // simply added are not counted as gains or losses (see growth() in lib/accounts).
  const since = useMemo(() => (hasHistory ? growth(accounts, f.points, deposits, first.date, today) : null), [hasHistory, accounts, f.points, deposits, first, today]);
  const monthStart = endOfPrevMonth(today);
  const g = useMemo(() => growth(accounts, f.points, deposits, monthStart, today), [accounts, f.points, deposits, monthStart, today]);
  const groups = (['banks', 'business', 'investments', 'assets'] as Group[]).filter((x) => t.groups[x] > 0);
  const totalWI = wi.working + wi.idle;
  const keep = spend > 0 ? Math.min(wi.idle, spend) : 0;
  // what moved, holding by holding
  const movers = g.parts.filter((x) => Math.abs(x.change) >= 1).sort((a, b) => b.change - a.change);
  const top = movers[0], worst = movers.length > 1 && movers[movers.length - 1].change < 0 ? movers[movers.length - 1] : null;
  const fundMove = g.parts.find((x) => x.id === 'fund');
  // Nothing to compare with from before this month: say since when, rather than "this month".
  const startedThisMonth = !!g.started && g.started > monthStart;
  const amt = (v: number) => (Math.abs(v) >= 1e5 ? 'Rs ' + (Math.abs(v) / 1e5).toFixed(2) + ' lakh' : 'Rs ' + n0(Math.abs(v)));
  const short = (v: number) => (v >= 0 ? '+' : '−') + (Math.abs(v) >= 1000 ? Math.round(Math.abs(v) / 1000) + 'k' : n0(Math.abs(v)));
  const working = totalWI > 0 ? Math.round((wi.working / totalWI) * 100) : 0;
  const gaugeLen = em.months != null ? Math.min(1, em.months / 6) : 0;
  return (
    <section className="pg">
      <div className="cd hero story-card">
        <div className="hh"><Wordmark className="cw" />{since && <span className="hd">{sg(since.change).replace('+', '+Rs ').replace('−', '−Rs ')} since {first.label}</span>}</div>
        <p className="story-line">
          {startedThisMonth ? <>Since you started on {dd(g.started)}, y</> : <>This month y</>}
          {Math.abs(g.change) < 1 ? <>our money has not moved yet.</>
            : g.change > 0 ? <>ou are up <span className="pos">{amt(g.change)}</span></> : <>ou are down <span className="neg">{amt(g.change)}</span></>}
          {Math.abs(g.change) >= 1 && top && top.change > 0 && g.change > 0 && movers.length > 1 && top.change >= g.change / 2 ? <>, mostly from <span className="who">{top.name}</span></> : null}
          {Math.abs(g.change) >= 1 ? '.' : null}
          {fundMove && Math.abs(fundMove.change) >= 1 && top && top.id !== 'fund' && movers.length > 1
            ? <> The fund is {fundMove.change >= 0 ? 'up' : 'down'} <span className={fundMove.change >= 0 ? 'pos' : 'neg'}>{amt(fundMove.change)}</span>{g.deposits > 0 && fundMove.change < 0 ? ', which includes the purchase fee' : ''}.</> : null}
        </p>
        {g.deposits > 0 && <p className="story-note">The Rs {n0(g.deposits)} you put into the fund {startedThisMonth ? 'since then' : 'this month'} is your own money moving, so it is not counted as growth.</p>}
        {movers.length > 1 && <div className="story-chips">
          {top && top.change > 0 && <span>Best: {top.name} {short(top.change)}</span>}
          {worst && worst !== top && <span>Worst: {worst.name} {short(worst.change)}</span>}
        </div>}
      </div>

      <div className="g2">
        <section className="cd tile2">
          <small>Savings would last</small>
          <svg viewBox="0 0 120 68" aria-hidden="true" className="gauge">
            <path d="M12 60 A48 48 0 0 1 108 60" fill="none" stroke="var(--tr)" strokeWidth="10" strokeLinecap="round" />
            {em.months != null && <path className="gauge-v" d="M12 60 A48 48 0 0 1 108 60" fill="none" stroke={em.months >= 6 ? 'var(--up)' : 'var(--org)'} strokeWidth="10" strokeLinecap="round" pathLength={100} strokeDasharray={Math.max(2, gaugeLen * 100) + ' 100'} />}
            <text x="60" y="57" fontSize="22" fontWeight="800" textAnchor="middle" style={{ fill: 'var(--tx)' }}>{em.months != null ? em.months.toFixed(1) : '–'}</text>
          </svg>
          <span className="t2s">{em.months != null ? 'months · aim for 6' : 'Add your spending below'}</span>
        </section>
        <section className="cd tile2">
          <small>Zakat this year</small>
          <b className="zk">{z.aboveNisab === false ? 'Below nisab' : 'Rs ' + n0(z.due)}</b>
          <span className="t2s">2.5% of {compact(z.base)} zakatable</span>
          <button type="button" className="t2l" onClick={() => document.getElementById('zakat-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>See breakdown</button>
        </section>
      </div>

      {totalWI > 0 && (
        <Card icon="trend" title="Is your money working?" more={working + '% is'}>
          <div className="work-bar"><i style={{ flex: wi.working || 0.0001 }} /><i style={{ flex: wi.idle || 0.0001 }} /></div>
          <div className="hint" style={{ marginTop: 10 }}>
            {wi.idle > 0
              ? <>{'Rs ' + n0(wi.idle) + ' sits in ' + (wi.idleAccounts.length === 1 ? wi.idleAccounts[0].name : wi.idleAccounts.map((a) => a.name).slice(0, 3).join(', ')) + ' earning nothing.'}{wi.bestRate && wi.idle - keep > 0 ? <> {spend > 0 ? 'Keeping a month of spending there and moving the rest' : 'Moved'} to savings at your {wi.bestRate}% rate it would earn about <b>Rs {n0(((wi.idle - keep) * wi.bestRate) / 100 / 12)} a month</b>.</> : null}</>
              : 'Everything you have added is earning a return.'}
          </div>
        </Card>
      )}

      <Card icon="pie" title="Where it is" more={t.owed > 0 ? 'Loans: −' + compact(t.owed) : undefined}>
        <div className="donut">
          <Donut slices={groups.map((g) => ({ label: LABEL[g], value: t.groups[g], color: GROUP_COLOR[g] }))} center={compact(t.assets).replace('Rs ', '')} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {groups.slice().sort((x, y) => t.groups[y] - t.groups[x]).map((g) => <div className="rw" key={g}><span><span className="dot9" style={{ background: GROUP_COLOR[g] }} />{LABEL[g]}</span><b>{Math.round((t.groups[g] / (t.assets || 1)) * 100)}%</b></div>)}
          </div>
        </div>
      </Card>

      <div className="cap">Safety</div>
      <Card icon="shield" title="Emergency cushion" more={spend > 0 ? 'Spending Rs ' + n0(spend) + ' / mo' : undefined}>
        {em.months != null ? <>
          <div className="bignum"><b style={{ color: em.months >= 6 ? 'var(--up)' : 'var(--org)' }}>{em.months.toFixed(1)}</b><span>months covered</span></div>
          <div className="trk" style={{ margin: '10px 0 0' }}><i style={{ width: Math.min(100, (em.months / 6) * 100) + '%', background: em.months >= 6 ? 'var(--up)' : 'var(--org)' }} /></div>
          <div className="meter-l"><span>0</span><span>6-month target{em.months >= 6 ? ' ✓' : ''}</span></div>
          <div className="hint" style={{ marginTop: 8 }}>Rs {n0(em.cash)} in accounts marked as emergency money, plus cash in hand. Business money is kept separate.</div>
        </> : <div className="hint">Tell Nivo roughly what your household spends in a month to see how long your savings would last.</div>}
        <InlineAmount id="spend" label="Monthly spending (Rs)" placeholder="e.g. 165,000" value={spend || null} onSave={(v) => setSpend(v || 0)} />
      </Card>

      <div className="cap">Zakat</div>
      <Card icon="scale" title="Zakat estimate" more="2.5% of zakatable wealth" id="zakat-card">
        {z.lines.length ? z.lines.map((l) => <div className="rw" key={l.label}><span>{l.label}</span><b>{l.amount < 0 ? '−' : ''}{n0(Math.abs(l.amount))}</b></div>) : <div className="hint">Add your accounts to see an estimate.</div>}
        <div className="rw"><span>Nisab (silver)</span><b style={{ color: nisab ? undefined : 'var(--mu)' }}>{nisab ? n0(nisab) : 'Not set'}</b></div>
        <div className="rw" style={{ paddingTop: 12 }}><span style={{ fontWeight: 700 }}>Zakat at 2.5%</span><b style={{ fontSize: 20, color: 'var(--gold)' }}>{z.aboveNisab === false ? 'Below nisab' : 'Rs ' + n0(z.due)}</b></div>
        <InlineAmount id="nisab" label="Today’s nisab in rupees (from your mosque or a scholar)" placeholder="Enter to compare" value={nisab} onSave={setNisab} />
        <div className="hint" style={{ marginTop: 8 }}>An estimate to plan with. Rules differ on business stock, funds and property, so check with a scholar you trust. You can include or leave out any account on its own screen.</div>
      </Card>

      {f.last && <>
        <div className="cap">Meezan Balanced Fund</div>
        <section className="cd list">
          <button type="button" className="acc" onClick={() => push({ name: 'fund', tab: 'analysis' })}>
            <span className="l"><span className="ai investments"><Icon name="bar" size={18} /></span><span><b>Fund analysis</b><small>Performance, risk, daily moves, other Meezan funds</small></span></span>
            <Icon name="chevr" size={18} />
          </button>
        </section>
      </>}
      {!accounts.length && (
        <section className="cd" style={{ marginTop: 12 }}>
          <div className="empty"><span className="tic inv"><Icon name="plus" size={22} /></span><b>See the full picture</b><p>Add your bank accounts, a business or other assets and these insights will cover all of it.</p><button type="button" className="btn gold" onClick={() => openSheet('add')}>Add an account</button></div>
        </section>
      )}
      <div className="f" style={{ marginTop: 8 }}>Updated {dd(today)}. Not financial or religious advice.</div>
    </section>
  );
}

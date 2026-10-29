// Insights across everything: growth, mix, money working vs idle, emergency cushion, zakat.
import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { Card } from '../components/ui';
import { HeroHead } from '../components/Wordmark';
import { Donut } from '../components/Charts';
import { useFund, useTotals } from '../state/derived';
import { openSheet, push, setNisab, setSpend, useStore } from '../state/store';
import { emergency, monthLabel, netWorthSeries, workingIdle, zakat, type Group } from '../lib/accounts';
import { cl, compact, dd, iso, n0, parseAmount, pc, sg } from '../lib/format';
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
  const spend = useStore((s) => s.spend);
  const nisab = useStore((s) => s.nisab);
  const today = iso();
  const fundNow = f.last ? f.last.val : 0;
  const series = useMemo(() => netWorthSeries(accounts, f.points, today, 6), [accounts, f.points, today]);
  const wi = useMemo(() => workingIdle(accounts, fundNow), [accounts, fundNow]);
  const em = useMemo(() => emergency(accounts, spend), [accounts, spend]);
  const z = useMemo(() => zakat(accounts, fundNow, nisab), [accounts, fundNow, nisab]);
  const first = series[0], last = series[series.length - 1];
  const growth = last && first ? last.value - first.value : 0;
  const best = series.slice(1).reduce<{ label: string; d: number } | null>((b, p, i) => { const d = p.value - series[i].value; return !b || d > b.d ? { label: monthLabel(p.date), d } : b; }, null);
  const hasHistory = series.length >= 2;
  const groups = (['banks', 'business', 'investments', 'assets'] as Group[]).filter((g) => t.groups[g] > 0);
  const biggest = groups.slice().sort((a, b) => t.groups[b] - t.groups[a])[0];
  const totalWI = wi.working + wi.idle;
  const keep = spend > 0 ? Math.min(wi.idle, spend) : 0;
  return (
    <section className="pg">
      <div className="cd hero mini">
        <HeroHead label={hasHistory ? 'Net worth growth' : 'Net worth today'} chip={hasHistory && 'since ' + first.label} />
        <div className="mh-v"><span>PKR</span>{hasHistory ? sg(growth) : n0(t.netWorth)}</div>
        {hasHistory
          ? <span className={'dl ' + cl(growth)}>{(growth >= 0 ? '▲ ' : '▼ ') + (first.value > 0 ? pc((growth / first.value) * 100) : '0.00%') + ' over ' + (series.length - 1) + (series.length - 1 === 1 ? ' month' : ' months')}</span>
          : <span className="dl">Growth shows after your first full month</span>}
        <div className="hx">
          <div><small>Best month</small><b>{best && best.d > 0 ? best.label + ' · +' + compact(best.d).replace('Rs ', '') : '–'}</b></div>
          <div><small>Biggest share</small><b>{biggest ? (biggest === 'banks' ? 'Banks' : biggest === 'business' ? 'Business' : biggest === 'investments' ? 'Invest' : 'Assets') + ' ' + Math.round((t.groups[biggest] / (t.assets || 1)) * 100) + '%' : '–'}</b></div>
          <div><small>Accounts</small><b>{accounts.length + (f.last ? 1 : 0)}</b></div>
        </div>
      </div>

      <div className="cap">Mix</div>
      <Card icon="pie" title="Where your money is" more={t.owed > 0 ? 'Loans: −' + compact(t.owed) : undefined}>
        <div className="donut">
          <Donut slices={groups.map((g) => ({ label: LABEL[g], value: t.groups[g], color: GROUP_COLOR[g] }))} center={compact(t.assets).replace('Rs ', '')} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {groups.map((g) => <div className="rw" key={g}><span><span className="dot9" style={{ background: GROUP_COLOR[g] }} />{LABEL[g]}</span><b>{Math.round((t.groups[g] / (t.assets || 1)) * 100)}%</b></div>)}
          </div>
        </div>
      </Card>

      {totalWI > 0 && (
        <Card icon="trend" title="Working or idle" more="Earning a return?">
          <div className="trk" style={{ height: 12 }}><i style={{ width: (wi.working / totalWI) * 100 + '%', background: 'var(--up)', borderRadius: 0 }} /><i style={{ left: (wi.working / totalWI) * 100 + '%', width: (wi.idle / totalWI) * 100 + '%', background: 'var(--mu2)', borderRadius: 0 }} /></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 13, fontWeight: 600 }}><span className="up">Working · {compact(wi.working)}</span><span style={{ color: 'var(--mu)' }}>Idle · {compact(wi.idle)}</span></div>
          <div className="hint" style={{ marginTop: 8 }}>
            {wi.idle > 0
              ? (wi.idleAccounts.length === 1 ? wi.idleAccounts[0].name + ' earns' : wi.idleAccounts.map((a) => a.name).slice(0, 3).join(', ') + ' earn') + ' nothing.' + (wi.bestRate && wi.idle - keep > 0 ? (spend > 0 ? ' Keeping a month of spending there and moving the rest' : ' Moving it') + ' to savings at your ' + wi.bestRate + '% rate could add about Rs ' + n0(((wi.idle - keep) * wi.bestRate) / 100 / 12) + ' a month.' : '')
              : 'Everything you have added is earning a return.'}
          </div>
        </Card>
      )}

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
      <Card icon="scale" title="Zakat estimate" more="2.5% of zakatable wealth">
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

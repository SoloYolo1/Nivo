// Cash flow: money in and out, month by month, what it went on, and every transaction.
import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { Card } from '../components/ui';
import { HeroHead } from '../components/Wordmark';
import { Bars } from '../components/Charts';
import { DataTile } from '../components/DataTile';
import { useColors } from '../components/theme';
import { openSheet, push, replaceTop, setBudget, useStore } from '../state/store';
import { CATS, monthFlow, monthName, monthOf, monthShort, monthsWithTxns, shiftMonth, spendingByCat, type Cat, type Txn } from '../lib/cashflow';
import { compact, dd, iso, n0, parseAmount, rawN0 } from '../lib/format';

/** Transactions grouped by day, newest first. */
export function byDay(txns: Txn[]): Array<{ date: string; items: Txn[] }> {
  const m = new Map<string, Txn[]>();
  for (const t of txns) { const l = m.get(t.date) || []; l.push(t); m.set(t.date, l); }
  return Array.from(m, ([date, items]) => ({ date, items: items.reverse() })).sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** One transaction row, used here and on the account screen. */
export function TxnRow({ t, showAcct = true }: { t: Txn; showAcct?: boolean }) {
  const accounts = useStore((s) => s.accounts);
  const a = accounts.find((x) => x.id === t.acct);
  const other = t.to ? accounts.find((x) => x.id === t.to) : null;
  const c = CATS[t.cat];
  const isLoan = a?.kind === 'loan';
  const title = t.note || (t.cat === 'transfer' ? (t.amount < 0 ? 'To ' : 'From ') + (other ? other.name : 'another account') : c.label);
  const sub = [t.cat !== 'transfer' && t.note ? c.label : '', showAcct && a ? a.name : ''].filter(Boolean).join(' · ');
  const tone = t.cat === 'transfer' ? 'mv' : (isLoan ? t.amount < 0 : t.amount >= 0) ? 'up' : 'dn';
  return (
    <button type="button" className="txr" style={{ ['--cc' as string]: c.color } as React.CSSProperties} onClick={() => openSheet('txn', t.id)}>
      <span className="ci"><Icon name={c.icon} size={16} /></span>
      <span className="tt"><b>{title}</b>{sub && <small>{sub}</small>}</span>
      <span className={'ta ' + tone}>{t.cat === 'transfer' ? (t.amount < 0 ? '→ ' : '← ') : t.amount >= 0 ? (isLoan ? '' : '+') : '−'}{n0(Math.abs(t.amount))}</span>
    </button>
  );
}

export function CashFlow({ month }: { month?: string }) {
  const txns = useStore((s) => s.txns);
  const accounts = useStore((s) => s.accounts);
  const budget = useStore((s) => s.budget);
  const C = useColors();
  const today = iso();
  const ym = month || monthOf(today);
  const months = useMemo(() => monthsWithTxns(txns, today), [txns, today]);
  const flow = useMemo(() => monthFlow(txns, ym, accounts), [txns, ym, accounts]);
  const prev = useMemo(() => monthFlow(txns, shiftMonth(ym, -1), accounts), [txns, ym, accounts]);
  const spend = spendingByCat(flow);
  const list = useMemo(() => byDay(txns.filter((t) => monthOf(t.date) === ym)), [txns, ym]);
  const trend = useMemo(() => Array.from({ length: 6 }, (_, i) => shiftMonth(ym, i - 5)).map((m) => ({ label: monthShort(m), value: monthFlow(txns, m, accounts).net })), [txns, ym, accounts]);
  const [bt, setBt] = useState(budget ? rawN0(budget) : '');
  const commitBudget = () => { const v = parseAmount(bt); setBudget(Number.isFinite(v) && v > 0 ? v : 0); if (Number.isFinite(v) && v > 0) setBt(rawN0(v)); };
  const go = (m: string) => replaceTop({ name: 'cashflow', month: m });
  const top = spend[0];
  const pct = budget > 0 ? Math.min(100, (flow.out / budget) * 100) : 0;
  const left = budget - flow.out;
  const bank = accounts.find((a) => a.kind === 'bank' || a.kind === 'cash');
  return (
    <section className="pg">
      <div className="cd hero mini">
        <HeroHead icon="sync" label={monthName(ym)} chip={flow.count ? flow.count + (flow.count === 1 ? ' transaction' : ' transactions') : 'Nothing yet'} />
        <div className="flow">
          <div><small>Money in</small><b>{compact(flow.in)}</b><div className="trk"><i style={{ width: (flow.in + flow.out ? (flow.in / Math.max(flow.in, flow.out)) * 100 : 0) + '%', background: C.upHero }} /></div></div>
          <div><small>Money out</small><b>{compact(flow.out)}</b><div className="trk"><i style={{ width: (flow.in + flow.out ? (flow.out / Math.max(flow.in, flow.out)) * 100 : 0) + '%', background: C.dnHero }} /></div></div>
        </div>
        <div className="net-l"><span>{flow.net >= 0 ? 'Kept' : 'Spent more than came in'}</span><b>{flow.net >= 0 ? '+' : '−'}Rs {n0(Math.abs(flow.net))}</b></div>
        {flow.transfers > 0 && <div className="net-l" style={{ marginTop: 4 }}><span>Moved between your accounts</span><b>Rs {n0(flow.transfers)}</b></div>}
        {flow.count > 0 && (() => {
          const current = ym === monthOf(today);
          const days = current ? Number(today.slice(8, 10)) : new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate();
          const perDay = flow.out / Math.max(1, days);
          const vs = prev.out > 0 ? flow.out - prev.out : null;
          return (
            <div className="dt-grid three">
              <DataTile label="A day" value={compact(perDay).replace('Rs ', '')} sub={'spent, ' + days + (days === 1 ? ' day' : ' days') + ' in'} />
              <DataTile label={'vs ' + monthShort(shiftMonth(ym, -1))} value={vs == null ? '–' : (vs >= 0 ? '+' : '−') + compact(Math.abs(vs)).replace('Rs ', '')} tone={vs == null ? '' : vs > 0 ? 'dn' : 'up'} sub={vs == null ? 'nothing the month before' : 'money out'} />
              <DataTile label="Target" value={budget > 0 ? Math.round(pct) + '%' : '–'} tone={budget > 0 ? (pct >= 100 ? 'dn' : pct >= 80 ? '' : 'up') : ''} sub={budget > 0 ? (left >= 0 ? compact(left).replace('Rs ', '') + ' left' : 'over by ' + compact(-left).replace('Rs ', '')) : 'set one below'} bar={budget > 0 ? { pct, tone: pct >= 100 ? 'dn' : pct >= 80 ? 'org' : 'up' } : undefined} />
            </div>
          );
        })()}
      </div>

      <div className="mons" role="tablist" aria-label="Month">
        {months.map((m) => <button key={m} type="button" role="tab" aria-selected={m === ym} className={m === ym ? 'on' : ''} onClick={() => go(m)}>{monthName(m).replace(' ' + m.slice(0, 4), m.slice(0, 4) !== today.slice(0, 4) ? ' ' + m.slice(2, 4) : '')}</button>)}
      </div>

      {!flow.count && (
        <section className="cd">
          <div className="empty"><span className="tic inv"><Icon name="sync" size={22} /></span><b>Nothing logged in {monthName(ym).split(' ')[0]}</b><p>Use Add money and Take out on an account, and every rupee in and out shows up here with a category.</p>
            {bank && <button type="button" className="btn gold" onClick={() => openSheet('update', bank.id + ':out')}>Log something</button>}</div>
        </section>
      )}

      {spend.length > 0 && <>
        <div className="cap"><span>Where it went</span><span>{top ? CATS[top.cat].label + ' ' + Math.round((top.amount / flow.out) * 100) + '%' : ''}</span></div>
        <section className="cd">
          {spend.map((c) => <CatLine key={c.cat} cat={c.cat} amount={c.amount} count={c.count} max={spend[0].amount} total={flow.out} />)}
          {prev.out > 0 && <div className="hint" style={{ marginTop: 10 }}>{flow.out > prev.out ? 'Rs ' + n0(flow.out - prev.out) + ' more than ' + monthShort(shiftMonth(ym, -1)) : flow.out < prev.out ? 'Rs ' + n0(prev.out - flow.out) + ' less than ' + monthShort(shiftMonth(ym, -1)) : 'The same as ' + monthShort(shiftMonth(ym, -1))}{prev.out > 0 ? ' (Rs ' + n0(prev.out) + ').' : ''}</div>}
        </section>
      </>}

      <div className="cap"><span>Spending target</span>{budget > 0 && <span className={left < 0 ? 'dn' : ''}>{left < 0 ? 'Over by Rs ' + n0(-left) : 'Rs ' + n0(left) + ' left'}</span>}</div>
      <Card icon="target" title={budget > 0 ? 'Rs ' + n0(flow.out) + ' of Rs ' + n0(budget) : 'Set a monthly target'} more={budget > 0 ? Math.round(pct) + '% used' : undefined} className="budget">
        {budget > 0 && <>
          <div className="trk"><i style={{ width: pct + '%', background: pct >= 100 ? 'var(--dn)' : pct >= 80 ? 'var(--org)' : 'var(--up)' }} /></div>
          <div className="meter-l"><span>{dd(ym + '-01')}</span><span>{ym === monthOf(today) ? daysLeft(today) + ' days left' : 'Month over'}</span></div>
        </>}
        <div className="spend"><label className="lab" htmlFor="bud" style={{ flex: 1 }}><span>Monthly spending target (Rs)</span><input id="bud" className="in" inputMode="decimal" placeholder="e.g. 150,000" value={bt} onChange={(e) => setBt(e.target.value.replace(/[^\d.,]/g, ''))} onBlur={commitBudget} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} /></label></div>
      </Card>

      {trend.some((t) => t.value !== 0) && (
        <Card icon="bar" title="Kept each month" more="In minus out">
          <Bars items={trend} upColor={C.up} dnColor={C.dn} />
        </Card>
      )}

      {list.length > 0 && <>
        <div className="cap"><span>Transactions</span><span>Tap one to change or remove it</span></div>
        <section className="cd">
          {list.map((d) => (
            <div key={d.date}>
              <div className="day-h"><span>{d.date === today ? 'Today' : longDay(d.date)}</span><span>{dayNet(d.items, accounts)}</span></div>
              {d.items.map((t) => <TxnRow key={t.id} t={t} />)}
            </div>
          ))}
        </section>
      </>}

      <div className="cap">Every month</div>
      <section className="cd list">
        <button type="button" className="acc" onClick={() => push({ name: 'bills' })}>
          <span className="l"><span className="ai assets"><Icon name="cal" size={18} /></span><span><b>Bills and fixed costs</b><small>Rent, utilities, subscriptions, with reminders</small></span></span>
          <Icon name="chevr" size={18} />
        </button>
      </section>
      <div className="f" style={{ marginTop: 8 }}>Transfers between your own accounts are not counted as spending. A loan payment counts on the account it was paid from.</div>
    </section>
  );
}

function CatLine({ cat, amount, count, max, total }: { cat: Cat; amount: number; count: number; max: number; total: number }) {
  const c = CATS[cat];
  return (
    <div className="catl" style={{ ['--cc' as string]: c.color } as React.CSSProperties}>
      <span className="ci"><Icon name={c.icon} size={17} /></span>
      <span className="ct"><b>{c.label}</b><small>{count} {count === 1 ? 'transaction' : 'transactions'}</small><div className="trk"><i style={{ width: Math.max(3, (amount / max) * 100) + '%', background: c.color }} /></div></span>
      <span className="cv">{n0(amount)}<small>{Math.round((amount / total) * 100)}%</small></span>
    </div>
  );
}

const longDay = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const daysLeft = (today: string): number => { const [y, m, d] = today.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate() - d; };
function dayNet(items: Txn[], accounts: Array<{ id: string; kind: string }>): string {
  const loans = new Set(accounts.filter((a) => a.kind === 'loan').map((a) => a.id));
  const v = items.filter((t) => t.cat !== 'transfer' && !loans.has(t.acct)).reduce((s, t) => s + t.amount, 0);
  if (!v) return '';
  return (v > 0 ? '+' : '−') + n0(Math.abs(v));
}

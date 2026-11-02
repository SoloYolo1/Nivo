// Bills: what comes round every month, when each is due, and one tap to mark it paid.
import { useMemo } from 'react';
import { Icon } from '../components/Icon';
import { DataTile } from '../components/DataTile';
import { Card } from '../components/ui';
import { HeroHead } from '../components/Wordmark';
import { openSheet, payBill, useStore } from '../state/store';
import { CATS, billsDue, billsTotal, dueWords, nextDue, type Bill } from '../lib/cashflow';
import { compact, dd, iso, n0 } from '../lib/format';
import { haptic } from '../lib/native';

/** Mark a bill paid: from its usual account at once, otherwise ask which account. */
export function markPaid(b: Bill): void {
  if (b.acct) {
    const r = payBill(b.id, b.acct, iso());
    if ('error' in r) { openSheet('bill', 'pay:' + b.id); return; }
    haptic('success');
  } else openSheet('bill', 'pay:' + b.id);
}

export function Bills() {
  const bills = useStore((s) => s.bills);
  const accounts = useStore((s) => s.accounts);
  const today = iso();
  const total = billsTotal(bills);
  const due = useMemo(() => billsDue(bills, today, 7), [bills, today]);
  const sorted = useMemo(() => bills.map((b) => ({ b, due: nextDue(b, today) })).sort((x, y) => (x.due < y.due ? -1 : 1)), [bills, today]);
  const paidThisMonth = bills.filter((b) => b.lastPaid && b.lastPaid.slice(0, 7) === today.slice(0, 7));
  const paidSum = paidThisMonth.reduce((s, b) => s + b.amount, 0);
  return (
    <section className="pg">
      <div className="cd hero mini">
        <HeroHead icon="cal" label="Every month" chip={bills.length ? bills.length + (bills.length === 1 ? ' bill' : ' bills') : 'No bills yet'} />
        <div className="mh-v"><span>Rs</span><span className="mh-n">{n0(total)}</span></div>
        <span className="dl">{bills.length ? 'Fixed costs a month' : 'Add rent, utilities and subscriptions'}</span>
        {bills.length > 0 && (
          <div className="dt-grid three">
            <DataTile label="Paid so far" value={compact(paidSum).replace('Rs ', '')} tone={paidSum > 0 ? 'up' : ''} sub={total > 0 ? Math.round((paidSum / total) * 100) + '% of the month' : ''} bar={{ pct: total > 0 ? (paidSum / total) * 100 : 0, tone: 'up' }} />
            <DataTile label="Still to pay" value={compact(Math.max(0, total - paidSum)).replace('Rs ', '')} sub={total - paidSum > 0 ? 'this month' : 'all paid'} />
            <DataTile label="Due this week" value={due.length ? String(due.length) : 'None'} tone={due.some((d) => d.overdue) ? 'dn' : ''} sub={due.some((d) => d.overdue) ? 'one is overdue' : due.length ? 'tap Paid when done' : 'nothing due'} />
          </div>
        )}
      </div>

      <button type="button" className="btn gold big full" style={{ margin: '0 0 12px' }} onClick={() => openSheet('bill', 'new')}><Icon name="plus" size={18} />Add a bill</button>

      {due.length > 0 && <>
        <div className="cap"><span>Coming up</span></div>
        <section className="cd">
          {due.map((d) => <BillRow key={d.bill.id} b={d.bill} words={dueWords(d)} tone={d.overdue ? 'over' : d.days <= 2 ? 'due' : ''} accounts={accounts.length} />)}
        </section>
      </>}

      {bills.length > 0 && <>
        <div className="cap"><span>All bills</span><span>Soonest first</span></div>
        <section className="cd">
          {sorted.filter((x) => !due.some((d) => d.bill.id === x.b.id)).map((x) => {
            const paid = x.b.lastPaid && x.b.lastPaid.slice(0, 7) === today.slice(0, 7);
            return <BillRow key={x.b.id} b={x.b} words={paid ? 'Paid ' + dd(x.b.lastPaid as string) + ' · next ' + dd(x.due) : 'Due ' + dd(x.due)} tone={paid ? 'ok' : ''} accounts={accounts.length} />;
          })}
          {sorted.length === due.length && <div className="hint" style={{ padding: '6px 0' }}>Everything is listed above.</div>}
        </section>
      </>}

      {!bills.length && (
        <Card icon="bulb" title="Why add bills" more="Two minutes">
          <div className="ln"><i><Icon name="bell" size={16} /></i><span>Nivo reminds you two days before each one is due.</span></div>
          <div className="ln"><i><Icon name="check" size={16} /></i><span>Tap Paid and the amount comes off the account, with a category, in one go.</span></div>
          <div className="ln"><i><Icon name="target" size={16} /></i><span>Plan shows what your fixed costs leave each month.</span></div>
        </Card>
      )}
      <div className="f" style={{ marginTop: 8 }}>Reminders need notifications to be on (Settings › Notifications).</div>
    </section>
  );
}

function BillRow({ b, words, tone, accounts }: { b: Bill; words: string; tone: string; accounts: number }) {
  const c = CATS[b.cat];
  const paid = tone === 'ok';
  return (
    <div className="bill" style={{ ['--cc' as string]: c.color } as React.CSSProperties}>
      <button type="button" className="ci" aria-label={'Edit ' + b.name} onClick={() => openSheet('bill', 'edit:' + b.id)} style={{ border: 0, font: 'inherit' }}><Icon name={c.icon} size={17} /></button>
      <button type="button" className="bt" onClick={() => openSheet('bill', 'edit:' + b.id)} style={{ border: 0, background: 'none', color: 'inherit', font: 'inherit', textAlign: 'left', padding: 0 }}>
        <b>{b.name}</b><small className={tone}>{words}</small>
      </button>
      <span className="ba">
        <b>{n0(b.amount)}</b>
        {!paid && accounts > 0 && <button type="button" className="btn sec mini" onClick={() => markPaid(b)}>Paid</button>}
      </span>
    </div>
  );
}

// One account in detail: bank, business, or any other asset or loan.
import { Icon, KIND_ICON } from '../components/Icon';
import { MoveActions } from '../components/MoveActions';
import { DataTile } from '../components/DataTile';
import { Card, Switch } from '../components/ui';
import { HeroHead } from '../components/Wordmark';
import { Bars } from '../components/Charts';
import { AreaChart } from '../components/AreaChart';
import { useColors } from '../components/theme';
import { useTotals } from '../state/derived';
import { deleteAccount, openSheet, pop, push, removeSnapshot, upsertAccount, useStore } from '../state/store';
import { KINDS, businessStats, monthLabel, snapshotOn, worth, worthOf, type Account } from '../lib/accounts';
import { cl, compact, dd, iso, n0, sg } from '../lib/format';
import { CATS, monthFlow, spendingByCat, type Txn } from '../lib/cashflow';
import { setMonthlyReminder } from '../lib/notify';
import { subtitle } from './Accounts';
import { TxnRow } from './CashFlow';

export function editRoute(a: Account) {
  if (a.kind === 'bank') return { name: 'editBank' as const, id: a.id };
  if (a.kind === 'business') return { name: 'editBusiness' as const, id: a.id };
  return { name: 'editAsset' as const, kind: a.kind, id: a.id };
}

export function AccountDetail({ id }: { id: string }) {
  const a = useStore((s) => s.accounts.find((x) => x.id === id));
  const allTxns = useStore((s) => s.txns);
  const t = useTotals();
  const C = useColors();
  const othersRemind = useStore((st) => st.accounts.some((x) => x.id !== id && x.remind));
  if (!a) return <section className="pg"><Card icon="info" title="This account was removed"><button type="button" className="btn sec" onClick={pop}>Back</button></Card></section>;
  const today = iso();
  const s = snapshotOn(a);
  const w = worth(a);
  const prev = a.history.length > 1 ? a.history[a.history.length - 2] : null;
  const diff = s && prev ? worthOf(a, s) - worthOf(a, prev) : null;
  const pct = t.assets > 0 && w > 0 ? Math.round((w / t.assets) * 100) : null;
  const isLoan = a.kind === 'loan';
  const biz = a.kind === 'business' ? businessStats(a) : null;
  const pts = a.history.map((h) => ({ date: h.date, label: dd(h.date), value: Math.abs(worthOf(a, h)) }));
  const txns = allTxns.filter((t) => t.acct === a.id);
  return (
    <section className="pg">
      <div className="cd hero mini" style={{ viewTransitionName: 'm-card' } as React.CSSProperties}>
        <HeroHead icon={KIND_ICON[a.kind]} label={a.kind === 'business' ? 'Net position' : isLoan ? 'You owe' : a.kind === 'bank' ? (a.acctType === 'current' ? 'Current account' : a.acctType === 'term' ? 'Term deposit' : 'Savings account') : KINDS[a.kind].label} chip={pct != null && pct + '% of your assets'} />
        <div className="mh-v"><span>Rs</span><span className="mh-n" style={{ viewTransitionName: 'm-val' } as React.CSSProperties}>{n0(Math.abs(s ? s.value : 0))}</span></div>
        {diff != null && prev
          ? <span className={'dl ' + cl(diff)}>{(diff >= 0 ? '▲ ' : '▼ ') + 'Rs ' + n0(Math.abs(diff)) + ' since ' + dd(prev.date)}</span>
          : <span className="dl">Updated {s ? dd(s.date) : 'never'}</span>}
        {a.kind === 'bank' && (
          <div className="hx">
            <div><small>Profit rate</small><b>{a.acctType === 'current' ? 'None' : a.rate ? a.rate + '% / yr' : 'Not set'}</b></div>
            <div><small>Profit a month</small><b>{a.acctType !== 'current' && a.rate && s ? '≈ Rs ' + n0((s.value * a.rate) / 100 / 12) : '–'}</b></div>
            <div><small>Since {a.history[0] ? monthLabel(a.history[0].date) : '–'}</small><b>{a.history.length > 1 && s ? sg(s.value - a.history[0].value) : '–'}</b></div>
          </div>
        )}
        {a.kind === 'business' && s && (
          <div className="hx">
            <div><small>In the bank</small><b>{compact(s.bank || 0)}</b></div>
            <div><small>Cash</small><b>{compact(s.cash || 0)}</b></div>
            <div><small>Owed to you</small><b>{compact(s.receivable || 0)}</b></div>
          </div>
        )}
        {a.kind === 'business' && (a.share ?? 100) !== 100 && <div className="k" style={{ marginTop: 10 }}>Your {a.share}% share counts as Rs {n0(w)} in your net worth.</div>}
      </div>

      {a.kind === 'business'
        ? <button type="button" className="btn gold big full" style={{ margin: '0 0 12px' }} onClick={() => openSheet('update', a.id)}><Icon name="pencil" size={18} />Update this month’s numbers</button>
        : <MoveActions a={a} />}

      <AccountTiles a={a} txns={txns} today={today} />

      {biz && biz.latest && biz.profit != null && (
        <Card icon="cal" title={monthLabel(biz.latest.date) + ' figures'} more="Sales minus costs">
          <div className="tri"><div><small>Sales</small><b>{n0(biz.latest.sales || 0)}</b></div><div><small>Costs</small><b>{n0(biz.latest.costs || 0)}</b></div><div><small>Profit</small><b className={cl(biz.profit)}>{n0(biz.profit)}</b></div></div>
          {(biz.latest.sales || 0) > 0 && biz.margin != null && <>
            <div className="trk" style={{ margin: '14px 0 8px' }}><i style={{ width: Math.min(100, Math.max(0, 100 - biz.margin)) + '%', background: 'var(--a)' }} /><i style={{ left: Math.min(100, Math.max(0, 100 - biz.margin)) + '%', width: Math.max(0, biz.margin) + '%', background: 'var(--up)', borderRadius: 0 }} /></div>
            <div className="hint">{biz.margin >= 0 ? 'Costs take ' + Math.round(100 - biz.margin) + '% of sales, leaving a ' + Math.round(biz.margin) + '% margin.' : 'Costs are higher than sales this month.'}</div>
          </>}
        </Card>
      )}
      {biz && biz.months.length >= 2 && (
        <Card icon="bar" title="Profit by month" more={'Last ' + Math.min(6, biz.months.length) + ' updates'}>
          <Bars items={biz.months.slice(-6).map((m) => ({ label: monthLabel(m.date), value: m.profit }))} upColor={C.up} dnColor={C.dn} />
        </Card>
      )}
      {biz && biz.runway != null && biz.latest && (
        <Card icon="shield" title="Cash cushion" more="If sales paused">
          <div className="bignum"><b style={{ color: biz.runway >= 3 ? 'var(--up)' : 'var(--org)' }}>{biz.runway.toFixed(1)}</b><span>months of costs</span></div>
          <div className="trk" style={{ margin: '10px 0 0' }}><i style={{ width: Math.min(100, (biz.runway / 3) * 100) + '%', background: biz.runway >= 3 ? 'var(--up)' : 'var(--org)' }} /></div>
          <div className="meter-l"><span>0</span><span>3-month target{biz.runway >= 3 ? ' ✓' : ''}</span></div>
          <div className="hint" style={{ marginTop: 8 }}>Bank plus cash (Rs {n0((biz.latest.bank || 0) + (biz.latest.cash || 0))}) would cover about {biz.runway.toFixed(1)} months of costs.{biz.latest.receivable ? ' Collecting what customers owe would take it to ' + (((biz.latest.bank || 0) + (biz.latest.cash || 0) + biz.latest.receivable) / (biz.latest.costs || 1)).toFixed(1) + '.' : ''}</div>
        </Card>
      )}
      {biz && biz.latest && ((biz.latest.receivable || 0) > 0 || (biz.latest.payable || 0) > 0) && (
        <Card icon="up" title="Money owed" more="Both ways">
          {(() => {
            const r = biz.latest.receivable || 0, p = biz.latest.payable || 0, m = Math.max(r, p, 1);
            return <>
              <div className="owe"><span>To you</span><div className="trk"><i style={{ width: (r / m) * 100 + '%', background: 'var(--up)' }} /></div><span>{n0(r)}</span></div>
              <div className="owe"><span>You owe</span><div className="trk"><i style={{ width: (p / m) * 100 + '%', background: 'var(--dn)' }} /></div><span>{n0(p)}</span></div>
              <div className="hint">{r >= p ? 'Rs ' + n0(r - p) + ' more is owed to you than you owe.' : 'You owe Rs ' + n0(p - r) + ' more than customers owe you.'}</div>
            </>;
          })()}
        </Card>
      )}

      {pts.length >= 2 && (
        <Card icon="trend" title={isLoan ? 'What you owe over time' : a.kind === 'business' ? 'Net position over time' : 'Balance over time'} more="From your updates">
          <AreaChart points={pts.slice(-12)} height={150} color={isLoan ? C.dn : C.a} ariaLabel="Balance over time" tip={(p) => p.label + ' · Rs ' + n0(p.value)} />
        </Card>
      )}

      {txns.length > 0 && (
        <Card icon="sync" title="Money in and out" more={txns.length > 8 ? 'Latest 8 of ' + txns.length : 'Newest first'}>
          {txns.slice(-8).reverse().map((t) => <TxnRow key={t.id} t={t} showAcct={false} />)}
          <button type="button" className="btn ghost full" style={{ marginTop: 6, minHeight: 36 }} onClick={() => push({ name: 'cashflow' })}>See the whole month</button>
        </Card>
      )}

      <Card icon="list" title="Balances" more={a.history.length > 1 ? 'Newest first' : undefined}>
        {[...a.history].reverse().slice(0, 24).map((h, i, arr) => {
          const older = arr[i + 1];
          const d = older ? worthOf(a, h) - worthOf(a, older) : null;
          return (
            <div className="rw" key={h.date}>
              <span><b>Rs {n0(Math.abs(h.value))}</b><small>{dd(h.date)}{h.note ? ' · ' + h.note : ''}</small></span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {d != null && <span className={'chg ' + cl(d)}>{sg(d)}</span>}
                {a.history.length > 1 && <button type="button" className="x" aria-label={'Remove the update of ' + dd(h.date)} onClick={() => removeSnapshot(a.id, h.date)}><Icon name="trash" size={16} /></button>}
              </span>
            </div>
          );
        })}
      </Card>

      <section className="cd" style={{ paddingTop: 4, paddingBottom: 4 }}>
        {a.kind === 'bank' && <div className="rw"><span>Count as emergency money<small>Part of your cash cushion in Insights</small></span><Switch label="Count as emergency money" on={a.emergency !== false} onChange={(v) => upsertAccount({ ...a, emergency: v })} /></div>}
        {(a.kind === 'bank' || a.kind === 'business') && <div className="rw"><span>Monthly reminder<small>On the 1st, to update this {a.kind === 'bank' ? 'balance' : 'business'}</small></span><Switch label="Monthly reminder" on={!!a.remind} onChange={(v) => { upsertAccount({ ...a, remind: v }); void setMonthlyReminder(v || othersRemind); }} /></div>}
        {a.kind !== 'loan' && <div className="rw"><span>Include in zakat estimate<small>{KINDS[a.kind].zakatDefault ? 'Usually zakatable' : 'Usually not zakatable'}</small></span><Switch label="Include in zakat estimate" on={a.zakatable ?? KINDS[a.kind].zakatDefault} onChange={(v) => upsertAccount({ ...a, zakatable: v })} /></div>}
        <div className="rw"><span>Details<small>{subtitle(a, today)}</small></span><button type="button" className="btn sec" style={{ minHeight: 38, padding: '8px 14px', fontSize: 13 }} onClick={() => push(editRoute(a))}>Edit</button></div>
        <div className="rw"><button type="button" className="btn ghost" style={{ color: 'var(--dn)', padding: '6px 0', minHeight: 40 }} onClick={() => { pop(); deleteAccount(a.id); }}>Remove this account</button></div>
      </section>
    </section>
  );
}

/**
 * Three tiles under the buttons: this month's in and out on the account (from its transactions), how the
 * balance moved over the last 30 days, and how long it has been tracked. A loan shows what has been paid
 * off instead; a business shows its margin and cushion.
 */
function AccountTiles({ a, txns, today }: { a: Account; txns: Txn[]; today: string }) {
  const ym = today.slice(0, 7);
  const flow = monthFlow(txns, ym, [a]);
  const month = new Date().toLocaleDateString('en-GB', { month: 'short' });
  const first = a.history[0];
  const latest = snapshotOn(a);
  const isLoan = a.kind === 'loan';
  // the balance about a month ago: the last update on or before 30 days back
  const cut = back30(today);
  const old = a.history.filter((h) => h.date <= cut).pop() || null;
  const move30 = old && latest ? worthOf(a, latest) - worthOf(a, old) : null;
  const topCat = spendingByCat(flow)[0];
  if (a.kind === 'business') {
    const biz = businessStats(a);
    if (!biz.latest) return null;
    return (
      <div className="dt-grid three">
        <DataTile label="Margin" value={biz.margin != null ? Math.round(biz.margin) + '%' : '–'} tone={biz.margin != null ? (biz.margin >= 0 ? 'up' : 'dn') : ''} sub={biz.latest.sales ? 'Rs ' + n0(biz.latest.sales) + ' in sales' : 'Add sales and costs'} />
        <DataTile label="Cushion" value={biz.runway != null ? biz.runway.toFixed(1) : '–'} unit={biz.runway != null ? 'mo' : ''} tone={biz.runway != null && biz.runway >= 3 ? 'up' : ''} sub="of costs, if sales paused" bar={biz.runway != null ? { pct: (biz.runway / 3) * 100, tone: biz.runway >= 3 ? 'up' : 'org' } : undefined} />
        <DataTile label="Owed to you" value={compact(biz.latest.receivable || 0).replace('Rs ', '')} sub={biz.latest.payable ? 'you owe ' + compact(biz.latest.payable).replace('Rs ', '') : 'nothing owed by you'} />
      </div>
    );
  }
  if (isLoan) {
    const start = first ? first.value : 0;
    const left = latest ? latest.value : 0;
    const paid = Math.max(0, start - left);
    const pct = start > 0 ? (paid / start) * 100 : 0;
    const paidMonth = txns.filter((t) => t.date.slice(0, 7) === ym && t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    return (
      <div className="dt-grid three">
        <DataTile label="Paid off" value={Math.round(pct) + '%'} tone="up" sub={'Rs ' + n0(paid) + ' of Rs ' + n0(start)} bar={{ pct, tone: 'up' }} />
        <DataTile label={month} value={paidMonth ? 'Rs ' + n0(paidMonth) : '–'} tone={paidMonth ? 'up' : ''} sub={paidMonth ? 'paid this month' : 'nothing paid yet'} />
        <DataTile label="Change" value={move30 != null ? (move30 >= 0 ? '−' : '+') + compact(Math.abs(move30)).replace('Rs ', '') : '–'} tone={move30 != null ? (move30 >= 0 ? 'up' : 'dn') : ''} sub={move30 != null ? (move30 >= 0 ? 'less owed since ' : 'more owed since ') + dd(old!.date) : 'needs a second update'} />
      </div>
    );
  }
  return (
    <div className="dt-grid three">
      <DataTile label={month + ' in'} value={flow.in ? compact(flow.in).replace('Rs ', '') : '–'} tone={flow.in ? 'up' : ''} sub={flow.in ? flow.count + (flow.count === 1 ? ' transaction' : ' transactions') : 'nothing added yet'} />
      <DataTile label={month + ' out'} value={flow.out ? compact(flow.out).replace('Rs ', '') : '–'} tone={flow.out ? 'dn' : ''} sub={flow.out && topCat ? 'most on ' + CATS[topCat.cat].label.toLowerCase() : 'nothing taken out'} />
      <DataTile label="Change" value={move30 != null ? (move30 >= 0 ? '+' : '−') + compact(Math.abs(move30)).replace('Rs ', '') : '–'} tone={move30 != null ? cl(move30) : ''} sub={move30 != null ? 'since ' + dd(old!.date) : first ? 'tracked since ' + dd(first.date) : 'no balance yet'} />
    </div>
  );
}
const back30 = (d: string): string => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() - 30); return t.toISOString().slice(0, 10); };

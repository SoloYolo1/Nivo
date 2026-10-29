// One account in detail: bank, business, or any other asset or loan.
import { Icon } from '../components/Icon';
import { Card, Switch } from '../components/ui';
import { HeroHead } from '../components/Wordmark';
import { Bars, LineChart } from '../components/Charts';
import { useColors } from '../components/theme';
import { useTotals } from '../state/derived';
import { deleteAccount, openSheet, pop, push, removeSnapshot, upsertAccount, useStore } from '../state/store';
import { KINDS, businessStats, monthLabel, snapshotOn, worth, worthOf, type Account } from '../lib/accounts';
import { cl, compact, dd, iso, n0, sg } from '../lib/format';
import { setMonthlyReminder } from '../lib/notify';
import { subtitle } from './Accounts';

export function editRoute(a: Account) {
  if (a.kind === 'bank') return { name: 'editBank' as const, id: a.id };
  if (a.kind === 'business') return { name: 'editBusiness' as const, id: a.id };
  return { name: 'editAsset' as const, kind: a.kind, id: a.id };
}

export function AccountDetail({ id }: { id: string }) {
  const a = useStore((s) => s.accounts.find((x) => x.id === id));
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
  const pts = a.history.map((h) => ({ label: dd(h.date), value: worthOf(a, h) }));
  return (
    <section className="pg">
      <div className="cd hero mini">
        <HeroHead label={a.kind === 'business' ? 'Net position' : isLoan ? 'You owe' : a.kind === 'bank' ? (a.acctType === 'current' ? 'Current account' : a.acctType === 'term' ? 'Term deposit' : 'Savings account') : KINDS[a.kind].label} chip={pct != null && pct + '% of your assets'} />
        <div className="mh-v"><span>PKR</span>{n0(Math.abs(s ? s.value : 0))}</div>
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

      <button type="button" className="btn gold big full" style={{ margin: '0 0 12px' }} onClick={() => openSheet('update', a.id)}><Icon name="pencil" size={18} />{a.kind === 'business' ? 'Update this month’s numbers' : isLoan ? 'Update what you owe' : 'Update balance'}</button>

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
          <LineChart points={pts.slice(-12)} color={isLoan ? C.dn : '#8f9cff'} ariaLabel="Balance over time" />
        </Card>
      )}

      <Card icon="list" title="Updates" more={a.history.length > 1 ? 'Newest first' : undefined}>
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

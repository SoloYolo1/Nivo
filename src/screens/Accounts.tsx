// Accounts: every bank, business, fund, asset and loan, grouped with totals.
import { Icon } from '../components/Icon';
import { AccountRow, FundRow } from '../components/Rows';
import { useFund, useTotals } from '../state/derived';
import { openSheet, push, useStore } from '../state/store';
import { GROUPS, KINDS, snapshotOn, staleAccounts, staleDays, type Account, type Group } from '../lib/accounts';
import { ago, compact, iso, n0 } from '../lib/format';
import { Wordmark } from '../components/Wordmark';

export function subtitle(a: Account, today: string): React.ReactNode {
  const s = snapshotOn(a);
  const when = s ? 'updated ' + ago(s.date, today) : 'no balance yet';
  const stale = s && staleDays(a, today) > 30;
  let what = KINDS[a.kind].label;
  if (a.kind === 'bank') what = (a.acctType === 'current' ? 'Current' : a.acctType === 'term' ? 'Term deposit' : 'Savings') + (a.last4 ? ' ••' + a.last4 : '');
  if (a.kind === 'business') what = (a.bizType || 'Business') + ' · ' + (a.share ?? 100) + '% yours';
  if (a.detail) what = a.detail;
  return <>{stale && <span className="stale" />}{what} · {when}</>;
}

const DOT: Record<Group, string> = { banks: '#8f9cff', business: '#f3d99b', investments: '#4fd59c', assets: '#ff9f0a', loans: '#ff6961' };
const SHORT: Record<Group, string> = { banks: 'Banks', business: 'Business', investments: 'Invest', assets: 'Assets', loans: 'Loans' };

/** A loan: what is left and how much has been paid off since it was added. */
function LoanCard({ a }: { a: Account }) {
  const s = snapshotOn(a);
  const first = a.history[0];
  const left = s ? s.value : 0;
  const paid = first && first.value > 0 ? Math.max(0, Math.min(1, 1 - left / first.value)) : 0;
  const prev = a.history.length > 1 ? a.history[a.history.length - 2] : null;
  const step = prev && s ? prev.value - s.value : 0;
  return (
    <button type="button" className="cd loan" onClick={() => push({ name: 'account', id: a.id })}>
      <span className="loan-t"><b>{a.name}</b><b className="num">{n0(left)} left</b></span>
      <span className="loan-bar"><i style={{ width: paid * 100 + '%' }} /></span>
      <small>{paid > 0 ? Math.round(paid * 100) + '% paid off since ' + new Date(first.date + 'T00:00:00').toLocaleDateString('en-GB', { month: 'short' }) : 'Added ' + (first ? ago(first.date, iso()) : '')}{step > 0 ? ' · −Rs ' + n0(step) + ' last update' : ''}</small>
    </button>
  );
}

export function Accounts() {
  const accounts = useStore((s) => s.accounts);
  const f = useFund();
  const t = useTotals();
  const today = iso();
  const L = f.last;
  const stale = staleAccounts(accounts, today).length;
  const count = accounts.length + (L ? 1 : 0);
  const groups = (['banks', 'business', 'investments', 'assets'] as Group[]).filter((g) => t.groups[g] > 0);
  const share = (g: Group) => (t.assets > 0 ? Math.round((t.groups[g] / t.assets) * 100) : 0);
  return (
    <section className="pg">
      <div className="cd hero acct-hero">
        <div className="hh"><Wordmark className="cw" /><span className="hd">{stale ? stale + (stale === 1 ? ' needs updating' : ' need updating') : count + (count === 1 ? ' account' : ' accounts')}</span></div>
        <div className="hl">{t.owed > 0 ? 'Own Rs ' + compact(t.assets).replace('Rs ', '') + ' · owe Rs ' + compact(t.owed).replace('Rs ', '') : 'Everything you own'}</div>
        <div className="big mid"><span>Rs</span>{n0(t.netWorth)}</div>
        {groups.length > 0 && <>
          <div className="alloc2" aria-hidden="true">{groups.map((g) => <i key={g} style={{ flex: t.groups[g], background: DOT[g] }} />)}</div>
          <div className="legend4">{groups.map((g) => <span key={g}><b>{share(g)}%</b>{SHORT[g]}</span>)}</div>
        </>}
      </div>

      {GROUPS.map((g) => {
        const list = accounts.filter((a) => KINDS[a.kind].group === g.id);
        const hasFund = g.id === 'investments' && !!L;
        const total = t.groups[g.id];
        if (!list.length && !hasFund) {
          if (g.id !== 'loans') return null;
          return (
            <div key={g.id}>
              <div className="cap"><span><i className="gdot" style={{ background: DOT[g.id] }} />Loans and cards</span></div>
              <section className="cd" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span className="ai loans"><Icon name="card" size={18} /></span>
                <span className="hint" style={{ flex: 1 }}>Owe anything? Add a loan or a card balance so your net worth stays honest.</span>
                <button type="button" className="btn sec" style={{ minHeight: 40, padding: '0 14px' }} onClick={() => push({ name: 'editAsset', kind: 'loan' })}>Add</button>
              </section>
            </div>
          );
        }
        return (
          <div key={g.id}>
            <div className="cap"><span><i className="gdot" style={{ background: DOT[g.id] }} />{g.label}</span><b className={g.id === 'loans' ? 'dn' : ''}>{total < 0 ? '−' : ''}Rs {n0(Math.abs(total))}</b></div>
            {g.id === 'loans'
              ? list.map((a) => <LoanCard key={a.id} a={a} />)
              : <section className="cd list">{hasFund && <FundRow f={f} />}{list.map((a) => <AccountRow key={a.id} a={a} today={today} />)}</section>}
          </div>
        );
      })}
      <button type="button" className="dash" style={{ marginTop: 16 }} onClick={() => openSheet('add')}><Icon name="plus" size={18} />Add an account</button>
      <button type="button" className="linkrow" style={{ marginTop: 6 }} onClick={() => push({ name: 'activity' })}><span><Icon name="list" size={18} />All activity and backup</span><Icon name="chevr" size={18} /></button>
    </section>
  );
}

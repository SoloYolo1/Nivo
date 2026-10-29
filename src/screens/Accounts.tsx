// Accounts: every bank, business, fund, asset and loan, grouped with totals.
import { useState } from 'react';
import { Icon, KIND_ICON } from '../components/Icon';
import { Seg } from '../components/ui';
import { useFund, useTotals } from '../state/derived';
import { openSheet, push, useStore } from '../state/store';
import { GROUPS, KINDS, businessStats, snapshotOn, staleDays, worth, type Account, type Group } from '../lib/accounts';
import { ago, cl, compact, iso, n0, sg } from '../lib/format';
import { HeroHead } from '../components/Wordmark';

type Filter = 'all' | 'banks' | 'business' | 'investments' | 'other';
const inFilter = (g: Group, f: Filter) => f === 'all' || (f === 'other' ? g === 'assets' || g === 'loans' : g === f);

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

function sideNote(a: Account): React.ReactNode {
  if (a.kind === 'bank') return a.acctType === 'current' ? 'No profit' : a.rate ? a.rate + '% profit' : '';
  if (a.kind === 'business') { const b = businessStats(a); return b.profit != null ? <span className={cl(b.profit)}>{sg(b.profit)} a month</span> : ''; }
  if (a.history.length > 1) { const d = a.history[a.history.length - 1].value - a.history[a.history.length - 2].value; return <span className={cl(a.kind === 'loan' ? -d : d)}>{sg(d)}</span>; }
  return '';
}

export function AccountRow({ a, today }: { a: Account; today: string }) {
  const g = KINDS[a.kind].group;
  const w = worth(a);
  const words = a.kind === 'bank' && a.bank && a.bank !== 'Other' ? a.bank.split(' ') : [];
  const initials = words.length > 1 ? words.map((x) => x[0]).join('').slice(0, 3).toUpperCase() : words.length ? words[0].slice(0, 3).toUpperCase() : '';
  return (
    <button type="button" className="acc" onClick={() => push({ name: 'account', id: a.id })}>
      <span className="l"><span className={'ai ' + g}>{initials || <Icon name={KIND_ICON[a.kind]} size={18} />}</span><span><b>{a.name}</b><small>{subtitle(a, today)}</small></span></span>
      <span className="r"><b>{w < 0 ? '−' : ''}{n0(Math.abs(w))}</b><small>{sideNote(a)}</small></span>
    </button>
  );
}

export function Accounts() {
  const [filter, setFilter] = useState<Filter>('all');
  const accounts = useStore((s) => s.accounts);
  const f = useFund();
  const t = useTotals();
  const today = iso();
  const L = f.last;
  return (
    <section className="pg">
      <div className="cd hero mini">
        <HeroHead label="Across all accounts" chip={(accounts.length + (L ? 1 : 0)) + ((accounts.length + (L ? 1 : 0)) === 1 ? ' account' : ' accounts')} />
        <div className="mh-v"><span>PKR</span>{n0(t.netWorth)}</div>
        <div className="hx">
          <div><small>Banks and cash</small><b>{compact(t.groups.banks)}</b></div>
          <div><small>Business</small><b>{compact(t.groups.business)}</b></div>
          <div><small>{t.owed > 0 ? 'You owe' : 'Investments'}</small><b>{t.owed > 0 ? compact(t.owed) : compact(t.groups.investments)}</b></div>
        </div>
      </div>
      <Seg label="Filter accounts" value={filter} onChange={setFilter} style={{ margin: '0 0 4px' }}
        items={[{ v: 'all', label: 'All' }, { v: 'banks', label: 'Banks' }, { v: 'business', label: 'Business' }, { v: 'investments', label: 'Invest' }, { v: 'other', label: 'Other' }]} />
      {GROUPS.filter((g) => inFilter(g.id, filter)).map((g) => {
        const list = accounts.filter((a) => KINDS[a.kind].group === g.id);
        const hasFund = g.id === 'investments' && !!L;
        if (!list.length && !hasFund) {
          if (g.id === 'loans' && filter === 'all') {
            return (
              <div key={g.id}>
                <div className="cap"><span>Loans and cards · 0</span><b>Rs 0</b></div>
                <section className="cd" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span className="ai loans"><Icon name="card" size={18} /></span>
                  <span className="hint" style={{ flex: 1 }}>Owe anything? Add a loan or a card balance so your net worth stays honest.</span>
                  <button type="button" className="btn ghost" style={{ minHeight: 40, padding: '0 10px', color: 'var(--a)' }} onClick={() => push({ name: 'editAsset', kind: 'loan' })}>Add</button>
                </section>
              </div>
            );
          }
          if (filter !== 'all' && g.id !== 'loans') {
            return (
              <section className="cd" key={g.id} style={{ marginTop: 12 }}>
                <div className="empty"><span className={'ai ' + g.id}><Icon name={g.id === 'business' ? 'briefcase' : g.id === 'banks' ? 'bank' : 'coinplus'} size={20} /></span><b>No {g.label.toLowerCase()} yet</b><button type="button" className="btn sec" onClick={() => openSheet('add')}>Add one</button></div>
              </section>
            );
          }
          return null;
        }
        const n = list.length + (hasFund ? 1 : 0);
        const total = t.groups[g.id];
        return (
          <div key={g.id}>
            <div className="cap"><span>{g.label} · {n}</span><b>{total < 0 ? '−' : ''}Rs {n0(Math.abs(total))}</b></div>
            <section className="cd list">
              {hasFund && L && (
                <button type="button" className="acc" onClick={() => push({ name: 'fund', tab: 'overview' })}>
                  <span className="l"><span className="ai investments"><Icon name="trend" size={18} /></span><span><b>Meezan Balanced Fund</b><small><span className="livedot" />Live · {L.u.toLocaleString('en-PK', { maximumFractionDigits: 0 })} units · NAV {L.nav.toFixed(2)}</small></span></span>
                  <span className="r"><b>{n0(L.val)}</b><small className={cl(L.chg)}>{sg(L.chg)}</small></span>
                </button>
              )}
              {list.map((a) => <AccountRow key={a.id} a={a} today={today} />)}
            </section>
          </div>
        );
      })}
      <button type="button" className="dash" style={{ marginTop: 16 }} onClick={() => openSheet('add')}><Icon name="plus" size={18} />Add an account</button>
      <button type="button" className="linkrow" style={{ marginTop: 6 }} onClick={() => push({ name: 'activity' })}><span><Icon name="list" size={18} />All activity and backup</span><Icon name="chevr" size={18} /></button>
    </section>
  );
}

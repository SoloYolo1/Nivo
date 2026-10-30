// Account rows used on Home and Accounts: icon, name, one useful line, a small trend and the value.
import { Icon, KIND_ICON } from './Icon';
import { useColors } from './theme';
import { KINDS, businessStats, snapshotOn, staleDays, worthOf, type Account } from '../lib/accounts';
import type { Fund } from '../state/derived';
import { openSheet, push } from '../state/store';
import { amountsHidden, dd, n0, sg } from '../lib/format';
import { SwipeRow, type SwipeAction } from './Swipe';
import { editRoute } from '../screens/AccountDetail';

/** A tiny trend line; flat when there is only one value. */
export function MiniSpark({ values, color }: { values: number[]; color: string }) {
  const v = values.length === 1 ? [values[0], values[0]] : values;
  if (v.length < 2) return <span className="msp" aria-hidden="true" />;
  const mn = Math.min(...v), mx = Math.max(...v), r = mx - mn || 1;
  const d = v.map((y, i) => (i ? 'L' : 'M') + ((i * 58) / (v.length - 1) + 1).toFixed(1) + ' ' + (mx === mn ? 11 : 20 - ((y - mn) / r) * 18).toFixed(1)).join(' ');
  return <svg className="msp" viewBox="0 0 60 22" aria-hidden="true"><path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

const monthShort = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { month: 'short' });

/** The one line under an account's name that says something useful. */
export function noteFor(a: Account, today: string): { text: string; tone: '' | 'warn' | 'up' } {
  const s = snapshotOn(a);
  if (!s) return { text: 'No balance yet', tone: 'warn' };
  const days = staleDays(a, today);
  if (days > 30) return { text: 'Update due · last ' + dd(s.date), tone: 'warn' };
  if (a.kind === 'bank') {
    if (a.acctType === 'current') return { text: 'Current account · earns nothing', tone: '' };
    if (a.rate) return { text: a.rate + '% profit · ≈ Rs ' + n0((s.value * a.rate) / 100 / 12) + ' a month', tone: '' };
    return { text: a.acctType === 'term' ? 'Term deposit' : 'Savings account', tone: '' };
  }
  if (a.kind === 'business') {
    const b = businessStats(a);
    if (b.profit != null && b.latest) return { text: 'Profit Rs ' + n0(b.profit) + ' in ' + monthShort(b.latest.date) + (b.margin != null ? ' · ' + Math.round(b.margin) + '% margin' : ''), tone: '' };
    return { text: (a.bizType || 'Business') + ' · ' + (a.share ?? 100) + '% yours', tone: '' };
  }
  if (a.kind === 'loan') {
    const first = a.history[0];
    if (first && first.value > 0 && s.value < first.value) return { text: Math.round((1 - s.value / first.value) * 100) + '% paid off since ' + monthShort(first.date), tone: 'up' };
    return { text: a.detail || 'Loan or card', tone: '' };
  }
  return { text: a.detail || KINDS[a.kind].label, tone: '' };
}

function initials(a: Account): string {
  if (a.kind !== 'bank') return '';
  const b = a.bank && a.bank !== 'Other' ? a.bank : a.name;
  const w = b.replace(/[^A-Za-z ]/g, '').split(/\s+/).filter(Boolean);
  if (w.length === 1 && w[0].length <= 4 && w[0] === w[0].toUpperCase()) return w[0];
  return w.slice(0, 2).map((x) => x[0]).join('').toUpperCase();
}

/** Swipe left to type a new balance, right to edit the account. */
export function swipeFor(a: Account): { left: SwipeAction; right: SwipeAction } {
  return {
    left: { label: 'Edit', icon: 'pencil', tone: 'indigo', run: () => push(editRoute(a)) },
    right: { label: a.kind === 'loan' ? 'Update' : 'Update', icon: 'qedit', tone: 'gold', run: () => openSheet('update', a.id) },
  };
}

export function AccountRow({ a, today, hint = false }: { a: Account; today: string; hint?: boolean }) {
  const C = useColors();
  const s = snapshotOn(a);
  const prev = a.history.length > 1 ? a.history[a.history.length - 2] : null;
  const diff = s && prev ? worthOf(a, s) - worthOf(a, prev) : null;
  const note = noteFor(a, today);
  const g = KINDS[a.kind].group;
  const ini = initials(a);
  const vals = a.history.slice(-8).map((h) => worthOf(a, h));
  const good = diff == null ? true : diff >= 0;
  const sw = swipeFor(a);
  return (
    <SwipeRow left={sw.left} right={sw.right} hint={hint}>
    <button type="button" className="acc" onClick={() => push({ name: 'account', id: a.id })}>
      <span className="l"><span className={'ai ' + g}>{ini || <Icon name={KIND_ICON[a.kind]} size={18} />}</span><span><b>{a.name}</b><small className={note.tone}>{note.text}</small></span></span>
      {a.kind !== 'loan' && vals.length > 1 && <MiniSpark values={vals} color={good ? C.up : C.dn} />}
      <span className="r"><b>{a.kind === 'loan' ? '−' : ''}{n0(Math.abs(s ? s.value : 0))}</b>{diff != null && diff !== 0 && <small className={good ? 'up' : 'dn'}>{a.kind === 'loan' ? (diff > 0 ? n0(diff) + ' paid' : '+' + n0(-diff) + ' owed') : sg(diff)}</small>}</span>
    </button>
    </SwipeRow>
  );
}

export function FundRow({ f }: { f: Fund }) {
  const C = useColors();
  const L = f.last;
  if (!L) return null;
  const vals = f.rows.slice(-10).map((r) => r.val);
  const trend = vals.length > 1 ? vals[vals.length - 1] - vals[0] : 0;
  return (
    <button type="button" className="acc" onClick={() => push({ name: 'fund', tab: 'overview' })}>
      <span className="l"><span className="ai investments"><Icon name="trend" size={18} /></span><span><b>Meezan Balanced</b><small><span className="livedot" />Live · {amountsHidden() ? '••••' : L.u.toLocaleString('en-PK', { maximumFractionDigits: 0 })} units</small></span></span>
      <MiniSpark values={vals} color={trend >= 0 ? C.up : C.dn} />
      <span className="r"><b>{n0(L.val)}</b>{f.prev && <small className={L.chg >= 0 ? 'up' : 'dn'}>{sg(L.chg)}</small>}</span>
    </button>
  );
}

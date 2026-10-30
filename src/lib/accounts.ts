// Accounts other than the Meezan fund: banks, businesses and anything else a person owns or owes.
// Every balance is typed in by the person; Nivo never connects to a bank.
import { daysBetween } from './format';

export type Kind = 'bank' | 'business' | 'stock' | 'gold' | 'property' | 'nss' | 'cash' | 'loan' | 'other';
export type BankType = 'savings' | 'current' | 'term';

/** One recorded state of an account. For a business, value = bank + cash + receivable − payable (the whole business). */
export interface Snapshot {
  date: string;
  value: number;
  note?: string;
  bank?: number; cash?: number; receivable?: number; payable?: number; sales?: number; costs?: number;
}

export interface Account {
  id: string;
  kind: Kind;
  name: string;
  created: string;
  history: Snapshot[];
  // bank
  bank?: string; acctType?: BankType; last4?: string; rate?: number; emergency?: boolean; remind?: boolean;
  // business
  bizType?: string; share?: number;
  // assets
  detail?: string; zakatable?: boolean;
}

export const BANKS = ['Meezan Bank', 'HBL', 'UBL', 'MCB', 'Bank Alfalah', 'Allied Bank', 'Faysal Bank', 'Other'];
export const BIZ_TYPES = ['Shop', 'Trading', 'Services', 'Online', 'Making things', 'Other'];

export interface KindInfo { label: string; plural: string; group: Group; hint: string; detailLabel?: string; zakatDefault: boolean }
export type Group = 'banks' | 'business' | 'investments' | 'assets' | 'loans';

export const KINDS: Record<Kind, KindInfo> = {
  bank: { label: 'Bank account', plural: 'Banks', group: 'banks', hint: 'Savings, current or term deposit', zakatDefault: true },
  business: { label: 'Business', plural: 'Business', group: 'business', hint: 'Balance, cash, what is owed', zakatDefault: true },
  stock: { label: 'Stocks', plural: 'Stocks', group: 'investments', hint: 'PSX shares, at today’s value', detailLabel: 'Which shares (optional)', zakatDefault: true },
  gold: { label: 'Gold and silver', plural: 'Gold and silver', group: 'assets', hint: 'At today’s value', detailLabel: 'How much, e.g. 2 tola (optional)', zakatDefault: true },
  property: { label: 'Property', plural: 'Property', group: 'assets', hint: 'Plot, house or shop, at your estimate', detailLabel: 'Where (optional)', zakatDefault: false },
  nss: { label: 'National Savings', plural: 'National Savings', group: 'investments', hint: 'Certificates and bonds', detailLabel: 'Which certificates (optional)', zakatDefault: true },
  cash: { label: 'Cash in hand', plural: 'Cash', group: 'banks', hint: 'At home or in your wallet', zakatDefault: true },
  loan: { label: 'Loan or card', plural: 'Loans and cards', group: 'loans', hint: 'Money you owe, taken off net worth', detailLabel: 'Who it is with (optional)', zakatDefault: false },
  other: { label: 'Something else', plural: 'Other', group: 'assets', hint: 'Your own name and value', detailLabel: 'Notes (optional)', zakatDefault: false },
};

export const GROUPS: Array<{ id: Group; label: string }> = [
  { id: 'banks', label: 'Banks and cash' },
  { id: 'business', label: 'Business' },
  { id: 'investments', label: 'Investments' },
  { id: 'assets', label: 'Other assets' },
  { id: 'loans', label: 'Loans and cards' },
];

export const newId = (): string => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const byDate = (a: Snapshot, b: Snapshot) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

/** Latest snapshot on or before date d (or the latest of all when d is omitted). */
export function snapshotOn(a: Account, d?: string): Snapshot | null {
  let best: Snapshot | null = null;
  for (const s of a.history) if ((!d || s.date <= d) && (!best || s.date >= best.date)) best = s;
  return best;
}

/** What one snapshot adds to (or takes off) net worth. */
export function worthOf(a: Account, s: Snapshot | null): number {
  if (!s) return 0;
  if (a.kind === 'loan') return -Math.abs(s.value);
  if (a.kind === 'business') return s.value * ((a.share ?? 100) / 100);
  return s.value;
}

/** What the account adds to net worth now (or on date d). */
export const worth = (a: Account, d?: string): number => worthOf(a, snapshotOn(a, d));

/** Add or replace the snapshot for that date, keeping history sorted. */
export function withSnapshot(a: Account, s: Snapshot): Account {
  const h = a.history.filter((x) => x.date !== s.date).concat(s).sort(byDate);
  return { ...a, history: h };
}

export const businessValue = (s: Pick<Snapshot, 'bank' | 'cash' | 'receivable' | 'payable'>): number =>
  (s.bank || 0) + (s.cash || 0) + (s.receivable || 0) - (s.payable || 0);

/** Days since the account was last updated. */
export function staleDays(a: Account, today: string): number {
  const s = snapshotOn(a);
  return s ? daysBetween(s.date, today) : 0;
}

/** Accounts not updated for more than 30 days, oldest first. */
export function staleAccounts(list: Account[], today: string, limit = 30): Account[] {
  return list.filter((a) => staleDays(a, today) > limit).sort((x, y) => staleDays(y, today) - staleDays(x, today));
}

/** Sanitise accounts read from storage or a backup. */
export function cleanAccounts(raw: unknown): Account[] {
  if (!Array.isArray(raw)) return [];
  const out: Account[] = [];
  for (const r of raw as Array<Partial<Account>>) {
    if (!r || typeof r !== 'object' || !r.id || !r.kind || !(r.kind in KINDS) || !Array.isArray(r.history)) continue;
    const history = r.history
      .filter((s) => s && typeof s.date === 'string' && Number.isFinite(Number(s.value)))
      .map((s) => ({ ...s, value: Number(s.value) }))
      .sort(byDate);
    out.push({ ...(r as Account), name: String(r.name || KINDS[r.kind].label), history });
  }
  return out;
}

// ---------- totals across everything (fund included) ----------

export interface FundPoint { date: string; val: number }

/** Fund value on date d: the last tracked day on or before it. */
export function fundValueOn(fund: FundPoint[], d: string): number {
  let v = 0;
  for (const p of fund) if (p.date <= d) v = p.val;
  return v;
}

export interface GroupTotal { id: Group | 'fund'; label: string; total: number; count: number }

export interface Totals {
  netWorth: number;
  assets: number;
  owed: number;
  fund: number;
  groups: Record<Group, number>;
}

export function totals(list: Account[], fundNow: number): Totals {
  const groups: Record<Group, number> = { banks: 0, business: 0, investments: fundNow, assets: 0, loans: 0 };
  for (const a of list) groups[KINDS[a.kind].group] += worth(a);
  const owed = -groups.loans;
  const assets = groups.banks + groups.business + groups.investments + groups.assets;
  return { netWorth: assets - owed, assets, owed, fund: fundNow, groups };
}

/** Net worth on a given date, using each account's balance as it stood then. */
export function netWorthOn(list: Account[], fund: FundPoint[], d: string): number {
  return list.reduce((s, a) => s + worth(a, d), 0) + fundValueOn(fund, d);
}

/** Last day of the month before the one containing d. */
export function endOfPrevMonth(d: string): string {
  const [y, m] = d.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, 0));
  return t.toISOString().slice(0, 10);
}

/** Month-end points for the last n months plus today. */
export function netWorthSeries(list: Account[], fund: FundPoint[], today: string, n = 6): Array<{ date: string; label: string; value: number }> {
  const pts: Array<{ date: string; label: string; value: number }> = [];
  let d = today;
  const ends: string[] = [];
  for (let i = 0; i < n - 1; i++) { d = endOfPrevMonth(d); ends.unshift(d); }
  const firstKnown = earliestDate(list, fund);
  for (const e of ends) {
    if (firstKnown && e < firstKnown) continue;
    pts.push({ date: e, label: monthLabel(e), value: netWorthOn(list, fund, e) });
  }
  pts.push({ date: today, label: 'Now', value: netWorthOn(list, fund, today) });
  return pts;
}

function earliestDate(list: Account[], fund: FundPoint[]): string {
  const ds: string[] = [];
  list.forEach((a) => { if (a.history[0]) ds.push(a.history[0].date); });
  if (fund[0]) ds.push(fund[0].date);
  return ds.sort()[0] || '';
}

export const monthLabel = (d: string): string =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { month: 'short' });

/** Money put into the fund on a day (a purchase). */
export interface Flow { date: string; amount: number }

export interface Growth {
  /** What your money actually did over the period: value now − value at the start − money put in. */
  change: number;
  /** Net worth at the start plus the money put in. */
  base: number;
  /** What you owned at the start (loans not taken off) plus the money put in: the base for a percentage.
   *  Net worth can be close to zero or negative with a loan, which would make any percentage meaningless. */
  owned: number;
  /** Money put into the fund during the period (not counted as growth). */
  deposits: number;
  /** The same, holding by holding, so the biggest movers can be named. */
  parts: Array<{ id: string; name: string; change: number }>;
  /** The first day Nivo has any data for, so the app can say "since you started tracking". */
  started: string;
}

/**
 * Growth from the end of `from` to `to`, without counting deposits or new accounts as gains:
 * - an account that already had a balance at `from` counts from that balance;
 * - an account added during the period counts from its first balance (adding it is not growth);
 * - the fund counts from its value at `from` (0 if you did not hold it yet), and the money put in
 *   during the period is taken off, so a purchase shows up as its fee and market move, not as a gain or a loss.
 */
export function growth(list: Account[], fund: FundPoint[], deposits: Flow[], from: string, to: string, fundName = 'Meezan fund'): Growth {
  const parts: Growth['parts'] = [];
  let start = 0, end = 0, owned = 0;
  for (const a of list) {
    const first = a.history.reduce<Snapshot | null>((m, s) => (!m || s.date < m.date ? s : m), null);
    if (!first || first.date > to) continue;
    const s0 = snapshotOn(a, from) ?? first;
    const s1 = snapshotOn(a, to);
    const v0 = worthOf(a, s0), v1 = worthOf(a, s1);
    start += v0; end += v1; if (v0 > 0) owned += v0;
    parts.push({ id: a.id, name: a.name, change: v1 - v0 });
  }
  const f0 = fundValueOn(fund, from), f1 = fundValueOn(fund, to);
  const dep = deposits.filter((d) => d.date > from && d.date <= to).reduce((t, d) => t + d.amount, 0);
  if (f0 || f1 || dep) parts.push({ id: 'fund', name: fundName, change: f1 - f0 - dep });
  start += f0; end += f1;
  return { change: end - start - dep, base: start + dep, owned: owned + f0 + dep, deposits: dep, parts, started: earliestDate(list, fund) };
}

/** Change since the end of last month (see growth). Pass the fund purchases so they are not counted as gains. */
export function monthChange(list: Account[], fund: FundPoint[], today: string, deposits: Flow[] = []): { change: number; base: number } {
  const g = growth(list, fund, deposits, endOfPrevMonth(today), today);
  return { change: g.change, base: g.base };
}

// ---------- insights ----------

/** Money earning a return vs money sitting idle (current accounts and cash in hand). */
export function workingIdle(list: Account[], fundNow: number): { working: number; idle: number; idleAccounts: Account[]; bestRate: number } {
  let working = fundNow, idle = 0, bestRate = 0;
  const idleAccounts: Account[] = [];
  for (const a of list) {
    const w = worth(a);
    if (w <= 0) continue;
    if ((a.kind === 'bank' && a.acctType === 'current') || a.kind === 'cash') { idle += w; idleAccounts.push(a); }
    else if (a.kind !== 'property' && a.kind !== 'other') working += w;
    if (a.kind === 'bank' && a.acctType !== 'current' && (a.rate || 0) > bestRate) bestRate = a.rate || 0;
  }
  return { working, idle, idleAccounts, bestRate };
}

/** Months of spending covered by accounts marked as emergency money (plus cash in hand). */
export function emergency(list: Account[], monthlySpend: number): { cash: number; months: number | null } {
  const cash = list.filter((a) => (a.kind === 'bank' && a.emergency !== false) || a.kind === 'cash').reduce((s, a) => s + Math.max(0, worth(a)), 0);
  return { cash, months: monthlySpend > 0 ? cash / monthlySpend : null };
}

export interface ZakatLine { label: string; amount: number }

/**
 * A planning estimate: 2.5% of zakatable wealth (cash, bank balances, fund, business at your share, gold,
 * shares and certificates, plus anything you marked zakatable), minus loans and cards due.
 */
export function zakat(list: Account[], fundNow: number, nisab: number | null): { lines: ZakatLine[]; base: number; due: number; aboveNisab: boolean | null } {
  const lines: ZakatLine[] = [];
  const sum = (f: (a: Account) => boolean) => list.filter(f).reduce((s, a) => s + Math.max(0, worth(a)), 0);
  const zk = (a: Account) => a.zakatable ?? KINDS[a.kind].zakatDefault;
  const banks = sum((a) => (a.kind === 'bank' || a.kind === 'cash') && zk(a));
  if (banks) lines.push({ label: 'Bank balances and cash', amount: banks });
  if (fundNow) lines.push({ label: 'Meezan Balanced Fund', amount: fundNow });
  const biz = sum((a) => a.kind === 'business' && zk(a));
  if (biz) lines.push({ label: 'Business (your share)', amount: biz });
  const other = sum((a) => a.kind !== 'bank' && a.kind !== 'cash' && a.kind !== 'business' && a.kind !== 'loan' && zk(a));
  if (other) lines.push({ label: 'Gold, shares and other', amount: other });
  const debts = list.filter((a) => a.kind === 'loan').reduce((s, a) => s + Math.abs(worth(a)), 0);
  if (debts) lines.push({ label: 'Loans and cards due', amount: -debts });
  const base = Math.max(0, lines.reduce((s, l) => s + l.amount, 0));
  const aboveNisab = nisab && nisab > 0 ? base >= nisab : null;
  return { lines, base, due: aboveNisab === false ? 0 : base * 0.025, aboveNisab };
}

/** Business figures for its detail screen. */
export function businessStats(a: Account): { latest: Snapshot | null; profit: number | null; margin: number | null; runway: number | null; months: Array<{ date: string; profit: number }> } {
  const latest = snapshotOn(a);
  const profit = latest && latest.sales != null && latest.costs != null ? latest.sales - latest.costs : null;
  const margin = latest && profit != null && latest.sales ? (profit / latest.sales) * 100 : null;
  const liquid = latest ? (latest.bank || 0) + (latest.cash || 0) : 0;
  const runway = latest && latest.costs ? liquid / latest.costs : null;
  const months = a.history.filter((s) => s.sales != null && s.costs != null).map((s) => ({ date: s.date, profit: (s.sales as number) - (s.costs as number) }));
  return { latest, profit, margin, runway, months };
}

/** Net worth day by day: every day the fund priced or an account was updated, plus today. days = 0 for all. */
export function dailyNetWorth(list: Account[], fund: FundPoint[], today: string, days: number): Array<{ date: string; value: number }> {
  const set = new Set<string>(fund.map((p) => p.date));
  for (const a of list) for (const h of a.history) set.add(h.date);
  set.add(today);
  const first = earliestDate(list, fund);
  let dates = Array.from(set).filter((d) => (!first || d >= first) && d <= today).sort();
  if (days > 0) {
    const t = new Date(today + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() - days);
    const from = t.toISOString().slice(0, 10);
    const inRange = dates.filter((d) => d >= from);
    const before = dates.filter((d) => d < from).pop();
    dates = before ? [before, ...inRange] : inRange;
  }
  return dates.map((d) => ({ date: d, value: netWorthOn(list, fund, d) }));
}

// Cash flow: money in and out of your accounts as transactions with a category, bills that come round
// every month, and the monthly sums built from them. Transactions are made when money is added, taken out
// or moved; the balance history (accounts.ts) stays the source of truth for what each account holds.
import type { Account, Snapshot } from './accounts';
import { daysBetween } from './format';

export type Cat =
  | 'salary' | 'business' | 'profit' | 'gift' | 'income'
  | 'rent' | 'groceries' | 'bills' | 'transport' | 'food' | 'shopping' | 'health' | 'education' | 'family' | 'loan' | 'charity' | 'spend'
  | 'transfer';

export interface CatInfo { label: string; icon: string; color: string; in: boolean; words: string[] }

/** Every category, with the words in a note that suggest it. */
export const CATS: Record<Cat, CatInfo> = {
  salary: { label: 'Salary', icon: 'briefcase', color: '#4fd59c', in: true, words: ['salary', 'pay', 'wage', 'payroll', 'tankhwa'] },
  business: { label: 'Business', icon: 'bar', color: '#56c8f0', in: true, words: ['business', 'client', 'invoice', 'sale', 'customer', 'order', 'shop'] },
  profit: { label: 'Profit', icon: 'trend', color: '#8fd3ff', in: true, words: ['profit', 'dividend', 'interest', 'return', 'munafa', 'rental'] },
  gift: { label: 'Gift', icon: 'flame', color: '#f0b2e0', in: true, words: ['gift', 'eidi', 'bonus', 'prize', 'refund'] },
  income: { label: 'Other income', icon: 'qin', color: '#8f9cff', in: true, words: ['income', 'received', 'in'] },
  rent: { label: 'Rent', icon: 'house', color: '#f2847b', in: false, words: ['rent', 'kiraya', 'mortgage', 'house'] },
  groceries: { label: 'Groceries', icon: 'wallet', color: '#f5b56b', in: false, words: ['grocer', 'ration', 'sabzi', 'market', 'imtiaz', 'carrefour', 'metro', 'milk', 'bread'] },
  bills: { label: 'Bills', icon: 'tag', color: '#d68bf5', in: false, words: ['bill', 'electric', 'k-electric', 'lesco', 'gas', 'sui', 'water', 'internet', 'ptcl', 'phone', 'mobile', 'jazz', 'zong', 'telenor', 'ufone', 'netflix', 'subscription'] },
  transport: { label: 'Transport', icon: 'compass', color: '#7fd0ff', in: false, words: ['fuel', 'petrol', 'diesel', 'cng', 'careem', 'uber', 'indrive', 'bykea', 'bus', 'train', 'flight', 'ticket', 'toll', 'parking', 'car'] },
  food: { label: 'Eating out', icon: 'sun', color: '#ffb86b', in: false, words: ['food', 'lunch', 'dinner', 'breakfast', 'restaurant', 'cafe', 'coffee', 'chai', 'foodpanda', 'biryani', 'pizza', 'burger'] },
  shopping: { label: 'Shopping', icon: 'card', color: '#ff8fb1', in: false, words: ['shopping', 'clothes', 'shoes', 'daraz', 'amazon', 'mall', 'gadget', 'phone'] },
  health: { label: 'Health', icon: 'shield', color: '#6fe3c8', in: false, words: ['doctor', 'hospital', 'medicine', 'pharmacy', 'clinic', 'dentist', 'health', 'gym'] },
  education: { label: 'Education', icon: 'bulb', color: '#9ad0ff', in: false, words: ['school', 'fee', 'tuition', 'college', 'university', 'course', 'book', 'academy'] },
  family: { label: 'Family', icon: 'home', color: '#f7c8a8', in: false, words: ['family', 'parents', 'ammi', 'abbu', 'wife', 'kids', 'children', 'sent home', 'pocket'] },
  loan: { label: 'Loan payment', icon: 'banknote', color: '#c9b1ff', in: false, words: ['instalment', 'installment', 'emi', 'loan', 'repay', 'card payment'] },
  charity: { label: 'Charity', icon: 'scale', color: '#ffd166', in: false, words: ['zakat', 'sadqa', 'sadaqah', 'charity', 'donation', 'fitrana', 'qurbani'] },
  spend: { label: 'Other spending', icon: 'minus', color: '#a8b0cc', in: false, words: [] },
  transfer: { label: 'Transfer', icon: 'sync', color: '#8f9cff', in: false, words: ['transfer', 'moved', 'to savings', 'to fund', 'meezan'] },
};

export const IN_CATS: Cat[] = ['salary', 'business', 'profit', 'gift', 'income'];
export const OUT_CATS: Cat[] = ['groceries', 'bills', 'rent', 'food', 'transport', 'shopping', 'health', 'education', 'family', 'loan', 'charity', 'spend'];

/** Guess a category from a note; the generic one when nothing fits. */
export function guessCat(note: string, dir: 'in' | 'out'): Cat {
  const n = ' ' + note.toLowerCase().replace(/[^a-z\s-]/g, ' ') + ' ';
  const pool = dir === 'in' ? IN_CATS : OUT_CATS;
  let best: Cat | null = null, bestLen = 0;
  for (const c of pool) for (const w of CATS[c].words) if (n.includes(' ' + w) && w.length > bestLen) { best = c; bestLen = w.length; }
  return best || (dir === 'in' ? 'income' : 'spend');
}

/** One movement of money: + into the account, − out of it. A transfer has the other account in `to`. */
export interface Txn { id: string; acct: string; date: string; amount: number; cat: Cat; note?: string; to?: string }

export const isTxn = (x: unknown): x is Txn => {
  const t = x as Txn;
  return !!t && typeof t === 'object' && typeof t.id === 'string' && typeof t.acct === 'string' && typeof t.date === 'string' && Number.isFinite(Number(t.amount)) && typeof t.cat === 'string' && t.cat in CATS;
};

export const cleanTxns = (raw: unknown): Txn[] => (Array.isArray(raw) ? raw.filter(isTxn).map((t) => ({ ...t, amount: Number(t.amount) })).sort(byDate) : []);
const byDate = (a: Txn, b: Txn) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

export const monthOf = (d: string): string => d.slice(0, 7);
export const monthName = (ym: string): string => new Date(ym + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
export const monthShort = (ym: string): string => new Date(ym + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'short' });
export function shiftMonth(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export interface Flow { in: number; out: number; net: number; byCat: Array<{ cat: Cat; amount: number; count: number }>; count: number; transfers: number }

/** Money in, money out and the spending by category for one month. Transfers between your own accounts are
 *  counted separately, not as income or spending; paying a loan from a bank account is spending. */
export function monthFlow(txns: Txn[], ym: string, accounts: Account[] = []): Flow {
  const loanIds = new Set(accounts.filter((a) => a.kind === 'loan').map((a) => a.id));
  let inn = 0, out = 0, transfers = 0, count = 0;
  const cats = new Map<Cat, { amount: number; count: number }>();
  for (const t of txns) {
    if (monthOf(t.date) !== ym) continue;
    count++;
    // on a loan account, + means borrowed more and − means paid off; the payment shows on the bank side
    if (loanIds.has(t.acct)) continue;
    if (t.cat === 'transfer') { if (t.amount < 0) transfers += -t.amount; continue; }
    if (t.amount >= 0) inn += t.amount; else out += -t.amount;
    const k = cats.get(t.cat) || { amount: 0, count: 0 };
    k.amount += Math.abs(t.amount); k.count++;
    cats.set(t.cat, k);
  }
  const byCat = Array.from(cats, ([cat, v]) => ({ cat, ...v })).sort((a, b) => b.amount - a.amount);
  return { in: inn, out, net: inn - out, byCat, count, transfers };
}

/** Spending by category this month (out only). */
export const spendingByCat = (f: Flow) => f.byCat.filter((c) => !CATS[c.cat].in);

/** The months that have transactions, newest first, always including this month. */
export function monthsWithTxns(txns: Txn[], today: string): string[] {
  const s = new Set<string>([monthOf(today)]);
  txns.forEach((t) => s.add(monthOf(t.date)));
  return Array.from(s).sort().reverse();
}

/** Take a transaction back out of an account's history: every balance from that day on moves by the
 *  opposite amount, so the latest balance and the chart stay right. On a loan the amount runs the same way
 *  (+ borrowed, − paid), because loan snapshots hold what is owed. */
export function reverseTxn(a: Account, t: Txn): Account {
  const history: Snapshot[] = a.history.map((h) => (h.date >= t.date ? { ...h, value: Math.max(0, Math.round((h.value - t.amount) * 100) / 100) } : h));
  return { ...a, history };
}

// ---------- bills ----------

export interface Bill { id: string; name: string; amount: number; day: number; cat: Cat; acct?: string; lastPaid?: string; created?: string }

export const isBill = (x: unknown): x is Bill => {
  const b = x as Bill;
  return !!b && typeof b === 'object' && typeof b.id === 'string' && typeof b.name === 'string' && Number(b.amount) > 0 && Number(b.day) >= 1 && Number(b.day) <= 31 && typeof b.cat === 'string' && b.cat in CATS;
};
export const cleanBills = (raw: unknown): Bill[] => (Array.isArray(raw) ? raw.filter(isBill).map((b) => ({ ...b, amount: Number(b.amount), day: Math.round(Number(b.day)) })) : []);

const clampDay = (y: number, m: number, day: number): string => {
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return y + '-' + String(m).padStart(2, '0') + '-' + String(Math.min(day, last)).padStart(2, '0');
};

/** When the bill is next due: this month's date, or next month's once it is paid this month. A bill added
 *  after its day this month starts next month rather than showing as overdue at once. */
export function nextDue(b: Bill, today: string): string {
  const [y, m] = today.split('-').map(Number);
  const thisMonth = clampDay(y, m, b.day);
  const nextMonth = () => { const ym = shiftMonth(monthOf(today), 1); const [ny, nm] = ym.split('-').map(Number); return clampDay(ny, nm, b.day); };
  if (b.lastPaid && monthOf(b.lastPaid) === monthOf(today)) return nextMonth();
  if (!b.lastPaid && b.created && thisMonth < b.created) return nextMonth();
  return thisMonth;
}

export interface Due { bill: Bill; due: string; days: number; overdue: boolean }

/** Bills due within `within` days (or overdue), soonest first. */
export function billsDue(bills: Bill[], today: string, within = 7): Due[] {
  return bills.map((bill) => { const due = nextDue(bill, today); const days = daysBetween(today, due); return { bill, due, days, overdue: days < 0 }; })
    .filter((d) => d.days <= within).sort((a, b) => a.days - b.days);
}

/** Everything that comes round monthly, added up. */
export const billsTotal = (bills: Bill[]): number => bills.reduce((s, b) => s + b.amount, 0);

/** Words for how far away a due date is. */
export function dueWords(d: Due): string {
  if (d.days < -1) return Math.abs(d.days) + ' days overdue';
  if (d.days === -1) return 'Due yesterday';
  if (d.days === 0) return 'Due today';
  if (d.days === 1) return 'Due tomorrow';
  return 'Due in ' + d.days + ' days';
}

// Search: find anything in Nivo, and do the quick things, from one box. Pure; the screen renders the hits.
import { KINDS, type Account } from './accounts';
import { CATS, type Bill, type Txn } from './cashflow';
import { calcAmount } from './format';

export type Hit =
  | { kind: 'action'; id: string; title: string; sub: string; icon: string; go: { sheet: 'update'; arg: string } | { sheet: 'add' } | { sheet: 'entry'; tab: 'nav' | 'inv' } | { sheet: 'bill'; arg: string } }
  | { kind: 'account'; id: string; title: string; sub: string; icon: string; accountId: string }
  | { kind: 'txn'; id: string; title: string; sub: string; icon: string; color: string; amount: number; txnId: string }
  | { kind: 'bill'; id: string; title: string; sub: string; icon: string; color: string; billId: string }
  | { kind: 'price'; id: string; title: string; sub: string; icon: string; date: string }
  | { kind: 'page'; id: string; title: string; sub: string; icon: string; page: string };

export interface Hits { actions: Hit[]; accounts: Hit[]; txns: Hit[]; bills: Hit[]; prices: Hit[]; pages: Hit[]; total: number }

interface Price { date: string; nav: number; chg: number }

export const PAGES: Array<{ page: string; title: string; sub: string; icon: string; words: string[] }> = [
  { page: 'cashflow', title: 'Cash flow', sub: 'In, out and what it went on', icon: 'sync', words: ['cash', 'flow', 'spending', 'spend', 'income', 'budget', 'target', 'month', 'category', 'categories'] },
  { page: 'bills', title: 'Bills', sub: 'What comes round every month', icon: 'cal', words: ['bill', 'bills', 'rent', 'utilities', 'subscription', 'due', 'reminder', 'fixed'] },
  { page: 'fund', title: 'Meezan Balanced Fund', sub: 'Your holding, analysis and history', icon: 'trend', words: ['fund', 'meezan', 'nav', 'units', 'invest', 'investment', 'holding', 'price', 'prices'] },
  { page: 'insights:zakat', title: 'Zakat estimate', sub: 'On Insights', icon: 'scale', words: ['zakat', 'nisab', 'charity'] },
  { page: 'insights', title: 'Insights', sub: 'Growth, mix, idle money, cushion', icon: 'qchart', words: ['insight', 'insights', 'growth', 'emergency', 'cushion', 'idle', 'working', 'mix'] },
  { page: 'plan', title: 'Plan', sub: 'Goal, forecast, milestones', icon: 'target', words: ['plan', 'goal', 'forecast', 'milestone', 'sip', 'scenario', 'checklist', 'crore', 'lakh'] },
  { page: 'activity', title: 'Activity', sub: 'Everything you have logged', icon: 'clock', words: ['activity', 'history', 'log', 'everything'] },
  { page: 'notifications', title: 'Notifications', sub: 'New prices, reminders, updates', icon: 'bell', words: ['notification', 'notifications', 'inbox', 'alert', 'alerts', 'bell'] },
  { page: 'settings:appearance', title: 'Appearance', sub: 'Theme and colour', icon: 'sun', words: ['theme', 'dark', 'light', 'colour', 'color', 'appearance', 'midnight', 'oxblood', 'plum', 'cognac', 'onyx', 'petrol', 'racing', 'green'] },
  { page: 'settings:notifications', title: 'Notification settings', sub: 'Price alerts and reminders', icon: 'bell', words: ['notification', 'alert', 'remind', 'reminder'] },
  { page: 'settings:security', title: 'Privacy and lock', sub: 'PIN, fingerprint, hide amounts', icon: 'lock', words: ['pin', 'lock', 'fingerprint', 'biometric', 'privacy', 'hide', 'amounts', 'security'] },
  { page: 'settings:data', title: 'Your data', sub: 'Backup, restore, export', icon: 'save', words: ['backup', 'restore', 'export', 'csv', 'data', 'copy', 'import'] },
  { page: 'settings:updates', title: 'Updates', sub: 'Install the newest Nivo', icon: 'sync', words: ['update', 'updates', 'version', 'apk', 'upgrade'] },
  { page: 'settings:prices', title: 'Prices', sub: 'How NAVs are fetched', icon: 'tag', words: ['price', 'prices', 'fetch', 'refresh'] },
  { page: 'settings:profile', title: 'Your name', sub: 'Shown in the greeting', icon: 'sliders', words: ['name', 'profile', 'greeting'] },
  { page: 'settings:about', title: 'About Nivo', sub: 'Version and how it works', icon: 'info', words: ['about', 'version', 'help'] },
];

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const norm = (s: string) => s.toLowerCase().replace(/[^\w\s.,-]/g, ' ').replace(/\s+/g, ' ').trim();

const MONTHS_FULL = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const monthIx = (w: string): number => { const i = MONTHS.indexOf(w); return i >= 0 ? i : MONTHS_FULL.indexOf(w); };

/** "23 oct", "oct 23", "october", "2026-10" as it appears in ISO dates. Only whole month names count. */
function dateNeedle(q: string): { month?: number; day?: number; year?: number } | null {
  const m3 = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(q);
  if (m3) return { year: +m3[1], month: +m3[2], day: m3[3] ? +m3[3] : undefined };
  const m1 = /^(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?$/.exec(q);
  if (m1 && monthIx(m1[2]) >= 0) return { day: +m1[1], month: monthIx(m1[2]) + 1, year: m1[3] ? +m1[3] : undefined };
  const m2 = /^([a-z]+)(?:\s+(\d{1,2}))?(?:\s+(\d{4}))?$/.exec(q);
  if (m2 && monthIx(m2[1]) >= 0) return { day: m2[2] ? +m2[2] : undefined, month: monthIx(m2[1]) + 1, year: m2[3] ? +m2[3] : undefined };
  return null;
}
const dateMatches = (iso: string, d: { month?: number; day?: number; year?: number }): boolean => {
  const [y, m, dd] = iso.split('-').map(Number);
  return (d.month == null || d.month === m) && (d.day == null || d.day === dd) && (d.year == null || d.year === y);
};

const fmt = (n: number) => Math.round(n).toLocaleString('en-PK');
const dd = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export function search(raw: string, data: { accounts: Account[]; txns: Txn[]; bills: Bill[]; prices: Price[] }, limit = 6): Hits {
  const q = norm(raw);
  const out: Hits = { actions: [], accounts: [], txns: [], bills: [], prices: [], pages: [], total: 0 };
  if (!q) return out;
  const words = q.split(' ');
  const has = (text: string) => { const t = norm(text); return words.every((w) => t.includes(w)); };
  const amount = /^(rs\.?\s*)?[\d.,]+(\s*(k|lakh|lac|l|crore|cr))?$/.test(q) ? calcAmount(q) : NaN;
  const dn = dateNeedle(q);

  // actions: an amount offers to log it; words like "add", "price", "invest" offer their sheets
  const bank = data.accounts.find((a) => a.kind === 'bank' || a.kind === 'cash');
  if (amount > 0 && bank) {
    out.actions.push({ kind: 'action', id: 'out', title: 'Take out Rs ' + fmt(amount), sub: 'From ' + bank.name + ', with a category', icon: 'minus', go: { sheet: 'update', arg: bank.id + ':out:' + amount } });
    out.actions.push({ kind: 'action', id: 'in', title: 'Add Rs ' + fmt(amount), sub: 'Into ' + bank.name, icon: 'qin', go: { sheet: 'update', arg: bank.id + ':in:' + amount } });
  }
  if (/^(add|new)( account| bank| business| asset| loan)?$/.test(q)) out.actions.push({ kind: 'action', id: 'add', title: 'Add an account', sub: 'Bank, business, gold, property, loan', icon: 'qadd', go: { sheet: 'add' } });
  if (/^(add |new |log )?(price|nav)$/.test(q)) out.actions.push({ kind: 'action', id: 'nav', title: 'Add a price', sub: 'Today’s NAV', icon: 'tag', go: { sheet: 'entry', tab: 'nav' } });
  if (/^(add |new |log )?(invest|investment|buy)$/.test(q)) out.actions.push({ kind: 'action', id: 'inv', title: 'Add an investment', sub: 'Money you put into the fund', icon: 'coinplus', go: { sheet: 'entry', tab: 'inv' } });
  if (/^(add |new )?bill$/.test(q)) out.actions.push({ kind: 'action', id: 'bill', title: 'Add a bill', sub: 'Something that comes round every month', icon: 'cal', go: { sheet: 'bill', arg: 'new' } });

  // accounts: by name, bank, kind, last digits
  for (const a of data.accounts) {
    const text = [a.name, a.bank || '', KINDS[a.kind].label, KINDS[a.kind].plural, a.last4 || '', a.detail || '', a.bizType || ''].join(' ');
    if (has(text)) out.accounts.push({ kind: 'account', id: a.id, title: a.name, sub: KINDS[a.kind].label + (a.bank && a.bank !== a.name ? ' · ' + a.bank : ''), icon: 'bank', accountId: a.id });
  }

  // transactions: by note, category, account, amount or date
  const acctName = (id: string) => data.accounts.find((a) => a.id === id)?.name || '';
  const txns = data.txns.slice().reverse();
  for (const t of txns) {
    const c = CATS[t.cat];
    const text = [t.note || '', c.label, acctName(t.acct), t.to ? acctName(t.to) : ''].join(' ');
    const byAmount = amount > 0 && Math.abs(Math.abs(t.amount) - amount) < 0.5;
    const byDate = dn ? dateMatches(t.date, dn) : false;
    if (has(text) || byAmount || byDate) {
      out.txns.push({ kind: 'txn', id: t.id, title: t.note || (t.cat === 'transfer' ? 'Transfer' : c.label), sub: dd(t.date) + ' · ' + (t.note ? c.label + ' · ' : '') + acctName(t.acct), icon: c.icon, color: c.color, amount: t.amount, txnId: t.id });
    }
  }

  // bills
  for (const b of data.bills) {
    const c = CATS[b.cat];
    if (has([b.name, c.label, 'bill'].join(' ')) || (amount > 0 && Math.abs(b.amount - amount) < 0.5)) out.bills.push({ kind: 'bill', id: b.id, title: b.name, sub: 'Rs ' + fmt(b.amount) + ' on the ' + b.day + (b.day === 1 ? 'st' : b.day === 2 ? 'nd' : b.day === 3 ? 'rd' : 'th') + ' · ' + c.label, icon: c.icon, color: c.color, billId: b.id });
  }

  // prices: by date, or an exact NAV
  if (dn || (amount > 0 && amount < 1000)) {
    for (const p of data.prices.slice().reverse()) {
      if ((dn && dateMatches(p.date, dn)) || (amount > 0 && Math.abs(p.nav - amount) < 0.01)) out.prices.push({ kind: 'price', id: p.date, title: 'NAV ' + p.nav.toFixed(4), sub: dd(p.date) + (p.chg ? ' · ' + (p.chg >= 0 ? '+' : '−') + fmt(Math.abs(p.chg)) + ' on your holding' : ''), icon: 'tag', date: p.date });
    }
  }

  // pages
  for (const p of PAGES) if (p.words.some((w) => words.some((x) => w.startsWith(x) && x.length >= 2)) || has(p.title)) out.pages.push({ kind: 'page', id: p.page, title: p.title, sub: p.sub, icon: p.icon, page: p.page });

  for (const k of ['accounts', 'txns', 'bills', 'prices', 'pages'] as const) out[k] = out[k].slice(0, k === 'txns' ? limit * 2 : limit);
  out.total = out.actions.length + out.accounts.length + out.txns.length + out.bills.length + out.prices.length + out.pages.length;
  return out;
}

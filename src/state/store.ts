// One small store for the whole app. Components read it with useStore(selector);
// every change goes through an action below, which also saves it.
import { useSyncExternalStore } from 'react';
import { KEYS, load, loadArray, save, remove } from '../lib/storage';
import { SEED_BUYS, SEED_NAVS, SEED_PEERS, mergeNavs, type Buy, type Nav, type Peers } from '../lib/fund';
import { DEFAULT_GOAL, type Goal } from '../lib/plan';
import type { Legacy } from '../lib/legacy';
import { setAmountsHidden } from '../lib/format';
import { cleanAccounts, moveSnapshot, newId, snapshotOn, type Account, type Snapshot, withSnapshot } from '../lib/accounts';
import { cleanBills, cleanTxns, reverseTxn, type Bill, type Cat, type Txn } from '../lib/cashflow';

export type Theme = 'system' | 'light' | 'dark';
export type Tab = 'home' | 'accounts' | 'insights' | 'plan';
export type FundTab = 'overview' | 'analysis' | 'history';
export type Route =
  | { name: 'fund'; tab: FundTab }
  | { name: 'account'; id: string }
  | { name: 'editBank'; id?: string }
  | { name: 'editBusiness'; id?: string }
  | { name: 'editAsset'; kind: Account['kind']; id?: string }
  | { name: 'activity' }
  | { name: 'settings'; page?: SettingsPage }
  | { name: 'notifications' }
  | { name: 'cashflow'; month?: string }
  | { name: 'bills' };
export type SettingsPage = 'profile' | 'appearance' | 'notifications' | 'security' | 'prices' | 'data' | 'updates' | 'phone' | 'about';
export type SheetName = '' | 'add' | 'entry' | 'day' | 'notif' | 'update' | 'import' | 'txn' | 'bill';

export interface Toast { id: number; text: string; icon?: string; action?: { label: string; fn: () => void } }
export interface LastCheck { t: number; src: string; latest: string }
export interface Alerts { perm: 'granted' | 'denied' | 'prompt' | 'unsupported' | 'unknown'; on: boolean; power: boolean | null }

export interface State {
  navs: Nav[]; buys: Buy[]; deleted: string[]; overrides: string[]; peers: Peers;
  accounts: Account[];
  goal: Goal; checklist: number[];
  name: string; theme: Theme; spend: number; nisab: number | null;
  /** Count the Meezan fund in the zakat estimate (off when the person pays zakat on it separately or does not consider it zakatable). */
  fundZakat: boolean;
  /** Money in and out, as it was added, taken out or moved (lib/cashflow). */
  txns: Txn[];
  /** Bills that come round every month. */
  bills: Bill[];
  /** Monthly spending target, 0 for none. */
  budget: number;
  lastCheck: LastCheck; refreshing: boolean; refreshUi: '' | 'busy' | 'ok' | 'done';
  // navigation and UI
  tab: Tab; stack: Route[]; dir: 'l' | 'r' | '';
  sheet: SheetName; sheetArg: string; entryTab: 'nav' | 'inv'; entryPrefill: { date?: string; nav?: string };
  toast: Toast | null; confetti: number;
  booted: boolean; splash: boolean; locked: boolean; onboarding: boolean;
  newSince: string; alerts: Alerts;
  /** History found in Nivo 3 (or a pasted backup), waiting for the person to choose to bring it over. */
  pending: Legacy | null;
  /** Amounts drawn as dots (the eye on the Net worth card). */
  masked: boolean;
  /** Colour theme (see lib/palettes). */
  palette: string;
  /** The screen beneath is drawn while a back gesture is in progress. */
  peek: boolean;
  /** The + button's shortcuts are open. */
  fan: boolean;
}

function boot(): Omit<State, 'tab' | 'stack' | 'dir' | 'sheet' | 'sheetArg' | 'entryTab' | 'entryPrefill' | 'toast' | 'confetti' | 'booted' | 'splash' | 'locked' | 'onboarding' | 'refreshing' | 'refreshUi' | 'newSince' | 'alerts' | 'pending' | 'masked' | 'palette' | 'peek' | 'fan'> {
  const deleted = loadArray<string>(KEYS.deleted);
  const overrides = loadArray<string>(KEYS.overrides);
  const m: Record<string, Nav> = {};
  SEED_NAVS.forEach((x) => { m[x.date] = { ...x }; });
  loadArray<Nav>(KEYS.navs).forEach((x) => { if (x && x.date && Number(x.nav) > 0) m[x.date] = { date: x.date, nav: Number(x.nav) }; });
  const navs = Object.values(m).filter((x) => !deleted.includes(x.date)).sort((a, b) => (a.date < b.date ? -1 : 1));
  save(KEYS.navs, navs);
  const stored = loadArray<Buy>(KEYS.buys).filter((b) => b && b.date && b.sent > 0 && b.units > 0);
  const buys = stored.length ? stored : SEED_BUYS.map((b) => ({ ...b }));
  if (!stored.length) save(KEYS.buys, buys);
  const g = load<Goal | null>(KEYS.goal, null);
  const ck = loadArray<number>(KEYS.checklist);
  const th = load<string>(KEYS.theme, 'system');
  const peers = load<Peers | null>('nv_peers', null);
  return {
    navs, buys, deleted, overrides,
    peers: peers && Array.isArray(peers.items) && peers.items.length ? peers : SEED_PEERS,
    accounts: cleanAccounts(load<unknown>(KEYS.accounts, [])),
    goal: g && g.amount > 0 && g.years > 0 ? g : DEFAULT_GOAL,
    checklist: ck.length === 4 ? ck : [1, 0, 0, 0],
    name: String(load<string>(KEYS.name, '') || '').trim(),
    theme: th === 'light' || th === 'dark' ? th : 'system',
    spend: Number(load<number>(KEYS.spend, 0)) || 0,
    nisab: Number(load<number | null>(KEYS.nisab, null)) || null,
    fundZakat: load<boolean>(KEYS.fundZakat, true) !== false,
    txns: cleanTxns(load<unknown>(KEYS.txns, [])),
    bills: cleanBills(load<unknown>(KEYS.bills, [])),
    budget: Number(load<number>(KEYS.budget, 0)) || 0,
    lastCheck: { t: 0, src: '', latest: '' },
  };
}

let state: State = {
  ...boot(),
  refreshing: false, refreshUi: '',
  tab: 'home', stack: [], dir: '',
  sheet: '', sheetArg: '', entryTab: 'nav', entryPrefill: {},
  toast: null, confetti: 0,
  booted: false, splash: true, locked: false, onboarding: false,
  newSince: '', alerts: { perm: 'unknown', on: false, power: null },
  pending: null,
  palette: String(load<string>(KEYS.palette, 'midnight') || 'midnight'),
  peek: false, fan: false,
  masked: (() => { const m = !!load<boolean>(KEYS.hideOnLaunch, false); setAmountsHidden(m); return m; })(),
};

const listeners = new Set<() => void>();
export const getState = (): State => state;
export function setState(patch: Partial<State> | ((s: State) => Partial<State>)): void {
  const p = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...p };
  listeners.forEach((l) => l());
}
export const subscribe = (l: () => void): (() => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state), () => sel(state));
}

/** Re-read everything from storage (used after a restore and in tests). */
export function reloadFromStorage(): void { setState(boot()); }

// ---------------- toasts ----------------
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let toastId = 0;
export function toast(text: string, icon?: string, action?: Toast['action']): void {
  clearTimeout(toastTimer);
  const t: Toast = { id: ++toastId, text, icon, action };
  setState({ toast: t });
  toastTimer = setTimeout(() => { if (state.toast && state.toast.id === t.id) setState({ toast: null }); }, action ? 5000 : 2400);
}
export const dismissToast = () => setState({ toast: null });
export const celebrate = () => setState((s) => ({ confetti: s.confetti + 1 }));

// ---------------- navigation ----------------
const TAB_ORDER: Tab[] = ['home', 'accounts', 'insights', 'plan'];
export function goTab(tab: Tab): void {
  const from = TAB_ORDER.indexOf(state.tab), to = TAB_ORDER.indexOf(tab);
  setState({ tab, stack: [], dir: from === to ? '' : to > from ? 'r' : 'l', sheet: '', fan: false });
  scrollTop();
}
export function swipeTab(delta: 1 | -1): void {
  if (state.stack.length) return;
  const i = TAB_ORDER.indexOf(state.tab) + delta;
  if (i >= 0 && i < TAB_ORDER.length) goTab(TAB_ORDER[i]);
}
export function push(r: Route): void { setState((s) => ({ stack: [...s.stack, r], dir: 'r', sheet: '', fan: false })); scrollTop(); }
export function replaceTop(r: Route): void { setState((s) => ({ stack: [...s.stack.slice(0, -1), r], dir: '' })); }
export function pop(): boolean {
  if (!state.stack.length) return false;
  setState((s) => ({ stack: s.stack.slice(0, -1), dir: 'l' }));
  scrollTop();
  return true;
}
export function resetHome(): void { setState({ tab: 'home', stack: [], dir: '', sheet: '' }); scrollTop(); }
export function scrollTop(): void { try { window.scrollTo(0, 0); } catch { /* ignore */ } }
/** Settings is a page of its own: the menu, or one of its pages. */
export function openSettings(page?: SettingsPage): void { push(page ? { name: 'settings', page } : { name: 'settings' }); }
export const openSheet = (sheet: SheetName, sheetArg = '') => setState({ sheet, sheetArg });
export const closeSheet = () => setState({ sheet: '' });
export function openEntry(tab: 'nav' | 'inv', prefill: { date?: string; nav?: string } = {}): void {
  setState({ sheet: 'entry', entryTab: tab, entryPrefill: prefill });
}

// ---------------- fund data ----------------
export function mergePrices(rows: Array<Partial<Nav>>, net: boolean): void {
  const navs = mergeNavs(state.navs, rows, state.deleted, state.overrides, net);
  save(KEYS.navs, navs);
  setState({ navs });
}
export function setPeers(peers: Peers): void { save('nv_peers', peers); setState({ peers }); }

/** Save a price typed by hand. It wins over prices from the network for that day. */
export function savePrice(date: string, nav: number): void {
  const overrides = state.overrides.filter((x) => x !== date).concat(date);
  const deleted = state.deleted.filter((x) => x !== date);
  save(KEYS.overrides, overrides); save(KEYS.deleted, deleted);
  setState({ overrides, deleted });
  mergePrices([{ date, nav }], false);
}

export function deletePrice(date: string): void {
  const row = state.navs.find((x) => x.date === date);
  const deleted = state.deleted.includes(date) ? state.deleted : state.deleted.concat(date);
  const overrides = state.overrides.filter((x) => x !== date);
  const navs = state.navs.filter((x) => x.date !== date);
  save(KEYS.deleted, deleted); save(KEYS.overrides, overrides); save(KEYS.navs, navs);
  setState({ deleted, overrides, navs });
  if (row) {
    toast('Removed ' + new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), 'trash', {
      label: 'Undo',
      fn: () => {
        const d2 = state.deleted.filter((x) => x !== date);
        save(KEYS.deleted, d2);
        setState({ deleted: d2 });
        mergePrices([row], false);
        toast('Restored', 'check');
      },
    });
  }
}

export function addBuy(b: Buy): void {
  const buys = [...state.buys, b].sort((x, y) => (x.date < y.date ? -1 : 1));
  save(KEYS.buys, buys);
  setState({ buys });
}
export function removeBuy(i: number): void {
  const gone = state.buys[i];
  if (!gone) return;
  const buys = state.buys.filter((_, k) => k !== i);
  save(KEYS.buys, buys);
  setState({ buys });
  toast('Investment removed', 'trash', {
    label: 'Undo',
    fn: () => { const b2 = [...state.buys, gone].sort((x, y) => (x.date < y.date ? -1 : 1)); save(KEYS.buys, b2); setState({ buys: b2 }); toast('Restored', 'check'); },
  });
}
export function setBuys(buys: Buy[]): void { save(KEYS.buys, buys); setState({ buys }); }

// ---------------- accounts ----------------
function saveAccounts(accounts: Account[]): void { save(KEYS.accounts, accounts); setState({ accounts }); }
export function upsertAccount(a: Account): void {
  const exists = state.accounts.some((x) => x.id === a.id);
  saveAccounts(exists ? state.accounts.map((x) => (x.id === a.id ? a : x)) : [...state.accounts, a]);
}
export function addSnapshot(id: string, s: Snapshot): void {
  saveAccounts(state.accounts.map((a) => (a.id === id ? withSnapshot(a, s) : a)));
}
/** Remove one update. `quiet` skips the toast (used when undoing a move the person just made). */
export function removeSnapshot(id: string, date: string, quiet = false): void {
  const a = state.accounts.find((x) => x.id === id);
  if (!a || a.history.length < 2) { if (!quiet) toast('An account keeps at least one balance'); return; }
  const s = a.history.find((x) => x.date === date);
  saveAccounts(state.accounts.map((x) => (x.id === id ? { ...x, history: x.history.filter((h) => h.date !== date) } : x)));
  if (s && !quiet) toast('Update removed', 'trash', { label: 'Undo', fn: () => { addSnapshot(id, s); toast('Restored', 'check'); } });
}
// ---------------- cash flow ----------------
function saveTxns(txns: Txn[]): void { save(KEYS.txns, txns); setState({ txns }); }
function saveBills(bills: Bill[]): void { save(KEYS.bills, bills); setState({ bills }); }
export function setBudget(budget: number): void { if (budget > 0) save(KEYS.budget, budget); else remove(KEYS.budget); setState({ budget: budget > 0 ? budget : 0 }); }

/** Record a movement of money (the balance snapshot is saved separately by the caller). */
export function addTxn(t: Omit<Txn, 'id'> & { id?: string }): Txn {
  const txn: Txn = { ...t, id: t.id || newId() };
  saveTxns([...state.txns, txn].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)));
  return txn;
}
export function updateTxn(id: string, patch: Partial<Pick<Txn, 'cat' | 'note'>>): void {
  saveTxns(state.txns.map((t) => (t.id === id ? { ...t, ...patch } : t)));
}
/** Remove a transaction and take its amount back out of the account's balances from that day on (and the
 *  other side of a transfer). Undo from the toast puts everything back. */
export function deleteTxn(id: string, quiet = false): void {
  const t = state.txns.find((x) => x.id === id);
  if (!t) return;
  const pair = t.to ? state.txns.find((x) => x.id !== t.id && x.to === t.acct && x.acct === t.to && x.date === t.date && Math.abs(x.amount) === Math.abs(t.amount)) : undefined;
  const gone = pair ? [t, pair] : [t];
  const before = state.accounts;
  saveAccounts(state.accounts.map((a) => gone.reduce((acc, g) => (g.acct === acc.id ? reverseTxn(acc, g) : acc), a)));
  const left = state.txns.filter((x) => !gone.some((g) => g.id === x.id));
  saveTxns(left);
  if (!quiet) toast('Removed and balance put back', 'trash', { label: 'Undo', fn: () => { saveAccounts(before); saveTxns([...state.txns, ...gone].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))); toast('Restored', 'check'); } });
}
/** Drop the record of a transaction without touching balances (the caller has already put them back). */
export function forgetTxn(id: string): void { saveTxns(state.txns.filter((x) => x.id !== id)); }
/** Move money between two of your accounts: out of one, into the other, as a transfer on both. */
export function moveMoney(from: string, to: string, amount: number, date: string, note = ''): { id: string } | { error: string } {
  const a = state.accounts.find((x) => x.id === from), b = state.accounts.find((x) => x.id === to);
  if (!a || !b || !(amount > 0)) return { error: 'Pick both accounts and an amount.' };
  const n = note.trim();
  // on a loan the money runs the other way: moving money out of a loan borrows more, moving money in pays it off
  const sa = moveSnapshot(a, a.kind === 'loan' ? 'in' : 'out', amount, date, n || 'To ' + b.name);
  if (typeof sa === 'string') return { error: sa };
  // paying more than is owed just clears the loan
  const lb = snapshotOn(b);
  const toAmt = b.kind === 'loan' ? Math.min(amount, lb ? lb.value : 0) : amount;
  const sb = b.kind === 'loan' && toAmt <= 0 ? { date, value: 0, note: n || 'From ' + a.name } : moveSnapshot(b, b.kind === 'loan' ? 'out' : 'in', toAmt, date, n || 'From ' + a.name);
  if (typeof sb === 'string') return { error: sb };
  saveAccounts(state.accounts.map((x) => (x.id === from ? withSnapshot(x, sa) : x.id === to ? withSnapshot(x, sb) : x)));
  const t1 = addTxn({ acct: from, to, date, amount: a.kind === 'loan' ? amount : -amount, cat: 'transfer', ...(n ? { note: n } : {}) });
  addTxn({ acct: to, to: from, date, amount: b.kind === 'loan' ? -amount : amount, cat: 'transfer', ...(n ? { note: n } : {}) });
  return { id: t1.id };
}
export function upsertBill(b: Bill): void {
  const exists = state.bills.some((x) => x.id === b.id);
  saveBills(exists ? state.bills.map((x) => (x.id === b.id ? b : x)) : [...state.bills, b]);
}
export function deleteBill(id: string): void {
  const i = state.bills.findIndex((x) => x.id === id);
  if (i < 0) return;
  const gone = state.bills[i];
  saveBills(state.bills.filter((x) => x.id !== id));
  toast('Removed ' + gone.name, 'trash', { label: 'Undo', fn: () => { const l = [...state.bills]; l.splice(Math.min(i, l.length), 0, gone); saveBills(l); toast('Restored', 'check'); } });
}
/** Pay a bill from an account: a spending transaction, the balance down, and the bill marked paid this month. */
export function payBill(id: string, acct: string, date: string, amount?: number): { id: string } | { error: string } {
  const b = state.bills.find((x) => x.id === id), a = state.accounts.find((x) => x.id === acct);
  if (!b || !a) return { error: 'Pick the account it was paid from.' };
  const amt = amount && amount > 0 ? amount : b.amount;
  const last = snapshotOn(a), base = last ? last.value : 0;
  if (a.kind !== 'loan' && amt > base + 0.005) return { error: 'That is more than the Rs ' + Math.round(base).toLocaleString('en-PK') + ' in ' + a.name + '.' };
  const value = a.kind === 'loan' ? base + amt : base - amt;
  const before = state.accounts, beforeBills = state.bills;
  saveAccounts(state.accounts.map((x) => (x.id === acct ? withSnapshot(x, { date, value: Math.round(value * 100) / 100, note: b.name }) : x)));
  const t = addTxn({ acct, date, amount: a.kind === 'loan' ? amt : -amt, cat: b.cat as Cat, note: b.name });
  saveBills(state.bills.map((x) => (x.id === id ? { ...x, lastPaid: date, acct } : x)));
  toast(b.name + ' paid · Rs ' + Math.round(amt).toLocaleString('en-PK') + ' from ' + a.name, 'check', { label: 'Undo', fn: () => { saveAccounts(before); saveBills(beforeBills); forgetTxn(t.id); toast('Undone', 'check'); } });
  return { id: t.id };
}

export function deleteAccount(id: string): void {
  const i = state.accounts.findIndex((x) => x.id === id);
  if (i < 0) return;
  const gone = state.accounts[i];
  const goneTxns = state.txns.filter((t) => t.acct === id);
  saveAccounts(state.accounts.filter((x) => x.id !== id));
  if (goneTxns.length) saveTxns(state.txns.filter((t) => t.acct !== id));
  toast('Removed ' + gone.name, 'trash', {
    label: 'Undo',
    fn: () => { const list = [...state.accounts]; list.splice(Math.min(i, list.length), 0, gone); saveAccounts(list); if (goneTxns.length) saveTxns([...state.txns, ...goneTxns].sort((a, b) => (a.date < b.date ? -1 : 1))); toast('Restored', 'check'); },
  });
}

// ---------------- hiding amounts ----------------
export function setMasked(masked: boolean): void { setAmountsHidden(masked); setState({ masked }); }

// ---------------- settings ----------------
export function setGoal(goal: Goal): void { save(KEYS.goal, goal); setState({ goal }); }
export function toggleCheck(i: number): void {
  const checklist = state.checklist.map((v, k) => (k === i ? (v ? 0 : 1) : v));
  save(KEYS.checklist, checklist);
  setState({ checklist });
}
export function setName(name: string): void { const n = name.slice(0, 24); save(KEYS.name, n); setState({ name: n.trim() }); }
export function setTheme(theme: Theme): void { save(KEYS.theme, theme); setState({ theme }); }
export function setPaletteId(palette: string): void { save(KEYS.palette, palette); setState({ palette }); }
export function setSpend(spend: number): void { save(KEYS.spend, spend); setState({ spend }); }
export function setNisab(nisab: number | null): void { if (nisab) save(KEYS.nisab, nisab); else remove(KEYS.nisab); setState({ nisab }); }
export function setFundZakat(fundZakat: boolean): void { save(KEYS.fundZakat, fundZakat); setState({ fundZakat }); }

// ---------------- backup ----------------
export interface Backup { navs?: Nav[]; buys?: Buy[]; goal?: Goal; accounts?: Account[]; v?: number; fundZakat?: boolean; txns?: Txn[]; bills?: Bill[]; budget?: number }
export function backupJson(): string {
  return JSON.stringify({ v: 4, navs: state.navs, buys: state.buys, goal: state.goal, accounts: state.accounts, fundZakat: state.fundZakat, txns: state.txns, bills: state.bills, budget: state.budget });
}
/** Restore a backup from Nivo 3 or 4. Returns false when the text is not a backup. */
export function restore(text: string): boolean {
  let j: Backup;
  try { j = JSON.parse(text) as Backup; } catch { return false; }
  if (!j || typeof j !== 'object') return false;
  let any = false;
  if (Array.isArray(j.navs)) { mergePrices(j.navs, false); any = true; }
  if (Array.isArray(j.buys)) {
    const nb = j.buys.filter((b) => b && b.date && b.sent > 0 && b.units > 0).map((b) => ({ date: b.date, sent: +b.sent, units: +b.units }));
    if (nb.length) { setBuys(nb); any = true; }
  }
  if (j.goal && j.goal.amount > 0 && j.goal.years > 0) { setGoal({ amount: +j.goal.amount, years: Math.round(+j.goal.years) }); any = true; }
  if (Array.isArray(j.accounts)) { const acc = cleanAccounts(j.accounts); saveAccounts(acc); any = true; }
  if (typeof j.fundZakat === 'boolean') setFundZakat(j.fundZakat);
  if (Array.isArray(j.txns)) saveTxns(cleanTxns(j.txns));
  if (Array.isArray(j.bills)) saveBills(cleanBills(j.bills));
  if (typeof j.budget === 'number') setBudget(j.budget);
  return any;
}

// ---------------- bringing over Nivo 3 history ----------------
const isSampleBuys = (b: Buy[]) => b.length === 1 && b[0].date === SEED_BUYS[0].date && b[0].sent === SEED_BUYS[0].sent && b[0].units === SEED_BUYS[0].units;

/** Merge history from Nivo 3 (or a backup) into what is here. Nothing already in Nivo 4 is removed. */
export function importLegacy(l: Legacy): { prices: number; buys: number; accounts: number } {
  const before = state.navs.length;
  // days deleted or typed by hand in Nivo 3 keep that status here
  const has = new Set(l.navs.map((x) => x.date));
  const deleted = Array.from(new Set(state.deleted.concat(l.deleted))).filter((d) => !has.has(d));
  const overrides = Array.from(new Set(state.overrides.concat(l.overrides)));
  save(KEYS.deleted, deleted); save(KEYS.overrides, overrides);
  const navs0 = state.navs.filter((x) => !deleted.includes(x.date));
  const navs = mergeNavs(navs0, l.navs, deleted, overrides, false);
  save(KEYS.navs, navs);
  // purchases: Nivo 3's list replaces the sample; otherwise add the ones not already here
  let buys = state.buys, addedBuys = 0;
  if (l.buys.length) {
    if (isSampleBuys(state.buys)) { buys = l.buys.slice(); addedBuys = l.buys.length; }
    else {
      const key = (b: Buy) => b.date + '|' + b.sent + '|' + b.units;
      const have = new Set(state.buys.map(key));
      const add = l.buys.filter((b) => !have.has(key(b)));
      buys = state.buys.concat(add); addedBuys = add.length;
    }
    buys = buys.slice().sort((x, y) => (x.date < y.date ? -1 : 1));
    save(KEYS.buys, buys);
  }
  // accounts (only in Nivo 4 backups): add the ones not here yet
  let accounts = state.accounts, addedAcc = 0;
  if (l.accounts && l.accounts.length) {
    const ids = new Set(state.accounts.map((a) => a.id));
    const add = l.accounts.filter((a) => !ids.has(a.id));
    accounts = state.accounts.concat(add); addedAcc = add.length;
    save(KEYS.accounts, accounts);
  }
  const patch: Partial<State> = { navs, buys, deleted, overrides, accounts, pending: null };
  if (l.goal && state.goal.amount === DEFAULT_GOAL.amount && state.goal.years === DEFAULT_GOAL.years) { patch.goal = l.goal; save(KEYS.goal, l.goal); }
  if (l.checklist) { patch.checklist = l.checklist; save(KEYS.checklist, l.checklist); }
  if (l.name && !state.name) { patch.name = l.name; save(KEYS.name, l.name); }
  save(KEYS.onboarded, true);
  save(KEYS.migrated, Date.now());
  remove(KEYS.above); remove(KEYS.milestone); remove(KEYS.nwMilestone);
  setState(patch);
  return { prices: navs.length - before, buys: addedBuys, accounts: addedAcc };
}

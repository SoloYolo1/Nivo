// One small store for the whole app. Components read it with useStore(selector);
// every change goes through an action below, which also saves it.
import { useSyncExternalStore } from 'react';
import { KEYS, load, loadArray, save, remove } from '../lib/storage';
import { SEED_BUYS, SEED_NAVS, SEED_PEERS, mergeNavs, type Buy, type Nav, type Peers } from '../lib/fund';
import { DEFAULT_GOAL, type Goal } from '../lib/plan';
import type { Legacy } from '../lib/legacy';
import { cleanAccounts, type Account, type Snapshot, withSnapshot } from '../lib/accounts';

export type Theme = 'system' | 'light' | 'dark';
export type Tab = 'home' | 'accounts' | 'insights' | 'plan';
export type FundTab = 'overview' | 'analysis' | 'history';
export type Route =
  | { name: 'fund'; tab: FundTab }
  | { name: 'account'; id: string }
  | { name: 'editBank'; id?: string }
  | { name: 'editBusiness'; id?: string }
  | { name: 'editAsset'; kind: Account['kind']; id?: string }
  | { name: 'activity' };
export type SheetName = '' | 'add' | 'entry' | 'day' | 'settings' | 'notif' | 'update' | 'import';

export interface Toast { id: number; text: string; icon?: string; action?: { label: string; fn: () => void } }
export interface LastCheck { t: number; src: string; latest: string }
export interface Alerts { perm: 'granted' | 'denied' | 'prompt' | 'unsupported' | 'unknown'; on: boolean; power: boolean | null }

export interface State {
  navs: Nav[]; buys: Buy[]; deleted: string[]; overrides: string[]; peers: Peers;
  accounts: Account[];
  goal: Goal; checklist: number[];
  name: string; theme: Theme; spend: number; nisab: number | null;
  lastCheck: LastCheck; refreshing: boolean; refreshUi: '' | 'busy' | 'ok' | 'done';
  // navigation and UI
  tab: Tab; stack: Route[]; dir: 'l' | 'r' | '';
  sheet: SheetName; sheetArg: string; entryTab: 'nav' | 'inv'; entryPrefill: { date?: string; nav?: string };
  toast: Toast | null; confetti: number;
  booted: boolean; splash: boolean; locked: boolean; onboarding: boolean;
  newSince: string; alerts: Alerts;
  /** History found in Nivo 3 (or a pasted backup), waiting for the person to choose to bring it over. */
  pending: Legacy | null;
}

function boot(): Omit<State, 'tab' | 'stack' | 'dir' | 'sheet' | 'sheetArg' | 'entryTab' | 'entryPrefill' | 'toast' | 'confetti' | 'booted' | 'splash' | 'locked' | 'onboarding' | 'refreshing' | 'refreshUi' | 'newSince' | 'alerts' | 'pending'> {
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
  setState({ tab, stack: [], dir: from === to ? '' : to > from ? 'r' : 'l', sheet: '' });
  scrollTop();
}
export function swipeTab(delta: 1 | -1): void {
  if (state.stack.length) return;
  const i = TAB_ORDER.indexOf(state.tab) + delta;
  if (i >= 0 && i < TAB_ORDER.length) goTab(TAB_ORDER[i]);
}
export function push(r: Route): void { setState((s) => ({ stack: [...s.stack, r], dir: 'r', sheet: '' })); scrollTop(); }
export function replaceTop(r: Route): void { setState((s) => ({ stack: [...s.stack.slice(0, -1), r], dir: '' })); }
export function pop(): boolean {
  if (!state.stack.length) return false;
  setState((s) => ({ stack: s.stack.slice(0, -1), dir: 'l' }));
  scrollTop();
  return true;
}
export function resetHome(): void { setState({ tab: 'home', stack: [], dir: '', sheet: '' }); scrollTop(); }
export function scrollTop(): void { try { window.scrollTo(0, 0); } catch { /* ignore */ } }
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
export function removeSnapshot(id: string, date: string): void {
  const a = state.accounts.find((x) => x.id === id);
  if (!a || a.history.length < 2) { toast('An account keeps at least one balance'); return; }
  const s = a.history.find((x) => x.date === date);
  saveAccounts(state.accounts.map((x) => (x.id === id ? { ...x, history: x.history.filter((h) => h.date !== date) } : x)));
  if (s) toast('Update removed', 'trash', { label: 'Undo', fn: () => { addSnapshot(id, s); toast('Restored', 'check'); } });
}
export function deleteAccount(id: string): void {
  const i = state.accounts.findIndex((x) => x.id === id);
  if (i < 0) return;
  const gone = state.accounts[i];
  saveAccounts(state.accounts.filter((x) => x.id !== id));
  toast('Removed ' + gone.name, 'trash', {
    label: 'Undo',
    fn: () => { const list = [...state.accounts]; list.splice(Math.min(i, list.length), 0, gone); saveAccounts(list); toast('Restored', 'check'); },
  });
}

// ---------------- settings ----------------
export function setGoal(goal: Goal): void { save(KEYS.goal, goal); setState({ goal }); }
export function toggleCheck(i: number): void {
  const checklist = state.checklist.map((v, k) => (k === i ? (v ? 0 : 1) : v));
  save(KEYS.checklist, checklist);
  setState({ checklist });
}
export function setName(name: string): void { const n = name.slice(0, 24); save(KEYS.name, n); setState({ name: n.trim() }); }
export function setTheme(theme: Theme): void { save(KEYS.theme, theme); setState({ theme }); }
export function setSpend(spend: number): void { save(KEYS.spend, spend); setState({ spend }); }
export function setNisab(nisab: number | null): void { if (nisab) save(KEYS.nisab, nisab); else remove(KEYS.nisab); setState({ nisab }); }

// ---------------- backup ----------------
export interface Backup { navs?: Nav[]; buys?: Buy[]; goal?: Goal; accounts?: Account[]; v?: number }
export function backupJson(): string {
  return JSON.stringify({ v: 4, navs: state.navs, buys: state.buys, goal: state.goal, accounts: state.accounts });
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

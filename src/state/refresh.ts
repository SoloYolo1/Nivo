// Checking for new prices, ported from Nivo 3.x refreshAll():
// background-check memory, data.json, Al Meezan's site (and the price email inside Claude), all at once.
import { getState, setState, mergePrices, setPeers, toast } from './store';
import { computeFund } from './derived';
import { fetchDataJson, fetchSite, fromEmail, fromRunner, peersFrom, syncRunner } from '../lib/prices';
import { send } from '../lib/notify';
import { addInbox } from '../lib/inbox';
import { KEYS, load } from '../lib/storage';
import { dd, n0, pc, sg } from '../lib/format';

let lastAuto = 0;
export const lastAutoAt = () => lastAuto;

/** Let the background check know the latest price, units and whether alerts are on. */
export function syncBackground(): void {
  const s = getState();
  const f = computeFund(s.navs, s.buys);
  if (f.last) syncRunner({ date: f.last.date, nav: f.last.nav, units: f.last.u, enabled: load<boolean>(KEYS.notif, true) });
}

export async function notifyNew(prevDate: string): Promise<void> {
  const s = getState();
  const f = computeFund(s.navs, s.buys);
  const L = f.last;
  if (!L || !(L.date > prevDate)) return;
  if (!load<boolean>(KEYS.notif, true)) { syncBackground(); return; }
  const seen = await fromRunner();
  if (seen && seen.date >= L.date) { syncBackground(); return; }
  const pv = f.prev;
  const ch = pv ? (L.nav / pv.nav - 1) * 100 : 0;
  let body = 'NAV ' + L.nav.toFixed(4) + (pv ? ' (' + pc(ch) + ' vs ' + dd(pv.date) + ')' : '');
  if (L.u) body += '. Your holding is now Rs ' + n0(L.val) + (pv ? ', ' + sg(L.chg) + ' today' : '') + '.';
  await send('New NAV for ' + dd(L.date), body);
  syncBackground();
}

export async function refreshAll(auto: boolean): Promise<void> {
  const s0 = getState();
  if (s0.refreshing) return;
  lastAuto = Date.now();
  const f0 = computeFund(s0.navs, s0.buys);
  const n = s0.navs.length, prev = f0.last ? f0.last.date : '';
  setState({ refreshing: true, refreshUi: auto ? s0.refreshUi : 'busy' });
  const ok: string[] = [];
  const t0 = Date.now();
  const inClaude = typeof window !== 'undefined' && !!window.claude;
  await Promise.all([
    fromRunner().then((r) => { if (r && !getState().navs.some((x) => x.date === r.date)) mergePrices([r], true); }),
    fetchDataJson().then((d) => { if (d) { mergePrices(d.navs, true); if (d.peers) setPeers(d.peers); } }),
    inClaude ? Promise.resolve() : fetchSite().then((p) => {
      if (!p) return;
      mergePrices([{ date: p.date, nav: p.nav }], true);
      const pe = peersFrom(p); if (pe) setPeers(pe);
      setState({ lastCheck: { t: Date.now(), src: 'Al Meezan website', latest: p.date } });
      ok.push('Al Meezan website');
    }),
    fromEmail().then((list) => {
      if (!list || !list.length) return;
      mergePrices(list.map((p) => ({ date: p.date, nav: p.nav })), true);
      const last = list[list.length - 1];
      const pe = peersFrom(last); if (pe) setPeers(pe);
      setState({ lastCheck: { t: Date.now(), src: 'Gmail', latest: last.date } });
      ok.push('Gmail');
    }),
  ].map((p) => p.catch(() => undefined)));
  if (!auto) await new Promise((r) => setTimeout(r, Math.max(0, 900 - (Date.now() - t0))));
  const s1 = getState();
  const f1 = computeFund(s1.navs, s1.buys);
  const fresh = s1.navs.length > n || !!(f1.last && f1.last.date > prev);
  setState({ refreshing: false, refreshUi: auto ? '' : fresh ? 'ok' : 'done' });
  if (!auto) setTimeout(() => { if (getState().refreshUi === 'ok' || getState().refreshUi === 'done') setState({ refreshUi: '' }); }, fresh ? 1600 : 400);
  if (fresh && f1.last) {
    toast('New price added: ' + dd(f1.last.date), 'check');
    const L = f1.last, pv = f1.prev;
    addInbox({
      key: 'nav-' + L.date, kind: 'nav', go: 'fund', title: 'New NAV for ' + dd(L.date),
      body: 'NAV ' + L.nav.toFixed(4) + (pv ? ' (' + pc((L.nav / pv.nav - 1) * 100) + ')' : '') + (L.u ? '. Your holding is Rs ' + n0(L.val) + (pv ? ', ' + sg(L.chg) + ' that day' : '') + '.' : '.'),
    });
    if (prev) void notifyNew(prev);
  } else if (!auto) {
    toast(ok.length ? 'Checked ' + ok.join(' and ') + '. Nothing newer yet.' : 'Could not reach a price source. Add the price with the + button.', ok.length ? 'check' : 'close');
  }
}

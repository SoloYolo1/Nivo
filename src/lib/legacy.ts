// Bringing history over from Nivo 3.
//
// Nivo 3 ran inside the app as the GitHub page, so its data sits in the phone's web storage for
// https://<you>.github.io. Nivo 4 is bundled inside the APK and runs as https://localhost, which
// cannot read that storage directly. To fetch it, the app briefly opens bridge.html on the GitHub
// page (same storage as Nivo 3). The bridge reads the saved keys and hands them straight back
// to the app in the address, never to any other site. A pasted or chosen backup works too.
import { PAGE } from './prices';
import { cleanAccounts, type Account } from './accounts';
import type { Buy, Nav } from './fund';
import type { Goal } from './plan';

export const HASH = 'nv-import=';

export interface Legacy {
  navs: Nav[]; buys: Buy[]; deleted: string[]; overrides: string[];
  goal?: Goal; checklist?: number[]; name?: string; accounts?: Account[];
  source: 'phone' | 'backup';
}

const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const parse = (v: unknown): unknown => {
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return null; }
};

function clean(raw: Record<string, unknown>, source: Legacy['source']): Legacy | null {
  const navs = arr<Nav>(raw.navs).filter((x) => x && typeof x.date === 'string' && /^\d{4}-\d\d-\d\d$/.test(x.date) && Number(x.nav) > 0).map((x) => ({ date: x.date, nav: Number(x.nav) }));
  const buys = arr<Buy>(raw.buys).filter((b) => b && typeof b.date === 'string' && Number(b.sent) > 0 && Number(b.units) > 0).map((b) => ({ date: b.date, sent: Number(b.sent), units: Number(b.units) }));
  const g = raw.goal as Goal | null | undefined;
  const ck = arr<number>(raw.checklist);
  const accounts = raw.accounts != null ? cleanAccounts(raw.accounts) : [];
  const out: Legacy = {
    navs, buys,
    deleted: arr<string>(raw.deleted).filter((d) => typeof d === 'string'),
    overrides: arr<string>(raw.overrides).filter((d) => typeof d === 'string'),
    source,
  };
  if (g && Number(g.amount) > 0 && Number(g.years) > 0) out.goal = { amount: Number(g.amount), years: Math.round(Number(g.years)) };
  if (ck.length === 4) out.checklist = ck.map((x) => (x ? 1 : 0));
  if (typeof raw.name === 'string' && raw.name.trim()) out.name = raw.name.trim().slice(0, 24);
  if (accounts.length) out.accounts = accounts;
  return navs.length || buys.length || accounts.length ? out : null;
}

/** The raw localStorage values the bridge sends back (Nivo 3 key names). */
export function fromStorage(kv: Record<string, string>): Legacy | null {
  return clean({
    navs: parse(kv.mw_navs), buys: parse(kv.mw_buys), deleted: parse(kv.mw_del), overrides: parse(kv.mw_ovr),
    goal: parse(kv.mw_goal), checklist: parse(kv.plan3), name: parse(kv.mw_name), accounts: parse(kv.nv_accounts),
  }, 'phone');
}

/** A backup copied from Nivo 3 (History › Backup) or Nivo 4. */
export function fromBackup(text: string): Legacy | null {
  const j = parse(text.trim());
  return j && typeof j === 'object' ? clean(j as Record<string, unknown>, 'backup') : null;
}

/** True when the app runs somewhere other than the GitHub page, so Nivo 3's storage is out of reach. */
export function canBridge(): boolean {
  try { return location.origin !== new URL(PAGE).origin; } catch { return false; }
}

/** Check the bridge page is online before leaving the app for it (no internet, or the page not published yet). */
export async function bridgeReady(): Promise<'ok' | 'offline' | 'missing'> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 7000);
  try {
    const r = await fetch(PAGE + 'bridge.html?check=' + Date.now(), { cache: 'no-store', signal: c.signal });
    if (!r.ok) return 'missing';
    const x = await r.text();
    return x.includes('nv-import=') ? 'ok' : 'missing';
  } catch { return 'offline'; } finally { clearTimeout(t); }
}

/** Open the bridge on the GitHub page; it comes straight back with whatever Nivo 3 saved. */
export function startBridge(): void {
  const back = location.origin + location.pathname;
  location.href = PAGE + 'bridge.html?back=' + encodeURIComponent(back) + '&t=' + Date.now();
}

/** Read (and clear) what the bridge sent back. Returns undefined when there was nothing in the address. */
export function takeFromAddress(): { data: Legacy | null; found: boolean } | undefined {
  const h = location.hash || '';
  const i = h.indexOf(HASH);
  if (i < 0) return undefined;
  const enc = h.slice(i + HASH.length);
  try { history.replaceState(null, '', location.pathname + location.search); } catch { /* ignore */ }
  try {
    const json = decodeURIComponent(escape(atob(decodeURIComponent(enc))));
    const kv = JSON.parse(json) as Record<string, string> & { found?: string };
    return { data: fromStorage(kv), found: kv.found === '1' };
  } catch {
    return { data: null, found: false };
  }
}

export interface LegacySummary { prices: number; first: string; last: string; buys: number; sent: number; accounts: number }
export function summarize(l: Legacy): LegacySummary {
  const ds = l.navs.map((x) => x.date).sort();
  return { prices: l.navs.length, first: ds[0] || '', last: ds[ds.length - 1] || '', buys: l.buys.length, sent: l.buys.reduce((a, b) => a + b.sent, 0), accounts: l.accounts ? l.accounts.length : 0 };
}

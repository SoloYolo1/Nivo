// Where new NAVs come from: Al Meezan's website (directly in the app, through relays in a browser),
// the page's data.json kept fresh by the Update NAV workflow, the background check's memory,
// and (only when Nivo runs inside Claude) the Al Meezan price email.
import type { Nav, Peers, Peer } from './fund';
import { dd } from './format';
import { call, firstOk } from './native';

export const SITE = 'https://www.almeezangroup.com/';
export const PAGE = 'https://soloyolo1.github.io/Nivo/';
export const RUNNER = 'com.mywealth.app.nav';

const MO: Record<string, number> = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

/** "23 Oct 2026" -> "2026-10-23". */
export function isoD(t: string): string | null {
  const m = String(t).match(/(\d{1,2}) (\w{3}) (\d{4})/);
  return m && MO[m[2]] ? m[3] + '-' + String(MO[m[2]]).padStart(2, '0') + '-' + m[1].padStart(2, '0') : null;
}

const toText = (raw: string): string =>
  raw.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function fundRow(t: string, name: string): { nav: number; date: string | null; fy: number } | null {
  const m = t.match(new RegExp(escRe(name) + '\\**\\s+Offer Price \\(Rs\\.\\) ([\\d,.]+) Redemption Price \\(Rs\\.\\) ([\\d,.]+) NAV \\(Rs\\.\\) ([\\d,.]+) Launch Date \\d{1,2} \\w{3} \\d{4} Validity Date (\\d{1,2} \\w{3} \\d{4}) FYTD Returns (-?[\\d.]+)%'));
  if (!m) return null;
  const f = (q: string) => parseFloat(q.replace(/,/g, ''));
  const p = f(m[2]) || f(m[3]);
  return p > 0 ? { nav: p, date: isoD(m[4]), fy: f(m[5]) } : null;
}

export interface SiteResult { date: string; nav: number; items: Peer[] }

/** Read the Balanced Fund price and the peers' FY returns from Al Meezan's home page HTML. */
export function parseSite(raw: string): SiteResult | null {
  const t = toText(raw);
  const b = fundRow(t, 'Meezan Balanced Fund');
  if (!b || !b.date) return null;
  const mp: Array<[string, string, boolean?]> = [
    ['Meezan Cash Fund', 'Money Market'], ['Conservative Allocation Plan', 'Conservative FoF'], ['Moderate Allocation Plan', 'Moderate FoF'],
    ['Meezan Gold Fund', 'Gold'], ['Meezan Balanced Fund', 'Balanced (you)', true], ['Aggressive Allocation Plan', 'Aggressive FoF'], ['Al Meezan Mutual Fund', 'Equity'],
  ];
  const items = mp.map((m) => { const r = m[2] ? b : fundRow(t, m[0]); return r ? ({ n: m[1], v: r.fy, me: !!m[2] } as Peer) : null; }).filter((x): x is Peer => !!x);
  return { date: b.date, nav: b.nav, items };
}

/** Parse the price table in Al Meezan's "Fund Prices and Performance" email (markdown table). */
export function parseEmail(t: string): SiteResult | null {
  const rows: Record<string, string[]> = {};
  String(t).split('\n').forEach((l) => { if (l[0] !== '|') return; const c = l.split('|').map((x) => x.trim()); if (c.length > 9 && c[1]) rows[c[1]] = c; });
  const b = rows['Meezan Balanced Fund'];
  if (!b) return null;
  const nav = parseFloat(String(b[4] || b[6] || '').replace(/,/g, '')), date = isoD(b[3]);
  if (!(nav > 0) || !date) return null;
  const mp: Array<[string, string, boolean?]> = [
    ['Meezan Cash Fund', 'Money Market'], ['MFPF-CONSERVATIVE ALLOCATION PLAN', 'Conservative FoF'], ['MFPF-MODERATE ALLOCATION PLAN', 'Moderate FoF'],
    ['Meezan Gold Fund*', 'Gold'], ['Meezan Balanced Fund', 'Balanced (you)', true], ['MFPF-AGGRESSIVE ALLOCATION PLAN', 'Aggressive FoF'], ['Al Meezan Mutual Fund', 'Equity'],
  ];
  const items = mp.map((m) => { const r = rows[m[0]]; const v = r ? parseFloat(r[8]) : NaN; return isNaN(v) ? null : ({ n: m[1], v, me: !!m[2] } as Peer); }).filter((x): x is Peer => !!x);
  return { date, nav, items };
}

const RELAYS: Array<(u: string) => string> = [
  (u) => u,
  (u) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
  (u) => 'https://corsproxy.io/?' + encodeURIComponent(u),
  (u) => 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(u),
  (u) => 'https://r.jina.ai/' + u,
  (u) => 'https://cors.isomorphic-git.org/' + u,
];

const looksRight = (x: string) => x.length > 5000 && x.indexOf('Redemption Price') > 0;

/** In the installed app: a direct request through the phone's own HTTP stack (no CORS, no relays). */
async function nativeSite(): Promise<string | null> {
  const r = await call<{ status: number; data: unknown }>('CapacitorHttp', 'get', {
    url: SITE, headers: { 'Cache-Control': 'no-cache', 'User-Agent': 'Mozilla/5.0 (Linux; Android) Nivo' },
    responseType: 'text', connectTimeout: 8000, readTimeout: 12000,
  });
  const x = r && typeof r.data === 'string' ? r.data : '';
  return r && r.status >= 200 && r.status < 300 && looksRight(x) ? x : null;
}

async function viaRelay(f: (u: string) => string): Promise<string> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 8000);
  try {
    const r = await fetch(f(SITE), { cache: 'no-store', signal: c.signal });
    if (!r.ok) throw new Error('http');
    const x = await r.text();
    if (looksRight(x)) return x;
    throw new Error('page');
  } finally { clearTimeout(t); }
}

export async function fetchSite(): Promise<SiteResult | null> {
  let raw = await nativeSite();
  if (!raw) { try { raw = await firstOk(RELAYS.map(viaRelay)); } catch { raw = null; } }
  return raw ? parseSite(raw) : null;
}

/** data.json from the GitHub page. Inside the app (served from localhost) it is read from the live page. */
export async function fetchDataJson(): Promise<{ navs: Nav[]; peers: Peers | null } | null> {
  try {
    const local = typeof location !== 'undefined' && location.hostname === 'localhost';
    const r = await fetch((local ? PAGE : '') + 'data.json?' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return null;
    const d = (await r.json()) as { navs?: Nav[]; peers?: Peers };
    if (!d || !Array.isArray(d.navs) || !d.navs.length) return null;
    return { navs: d.navs, peers: d.peers && Array.isArray(d.peers.items) && d.peers.items.length ? d.peers : null };
  } catch { return null; }
}

/** The price the background check last saw (installed app only). */
export async function fromRunner(): Promise<Nav | null> {
  const r = await call<{ date?: string; nav?: number }>('BackgroundRunner', 'dispatchEvent', { label: RUNNER, event: 'getLast', details: {} });
  return r && r.date && Number(r.nav) > 0 ? { date: r.date, nav: Number(r.nav) } : null;
}

/** Tell the background check what the app already knows so it does not alert twice. */
export function syncRunner(details: { date: string; nav: number; units: number; enabled: boolean }): void {
  void call('BackgroundRunner', 'dispatchEvent', { label: RUNNER, event: 'syncNav', details });
}

declare global {
  interface Window { claude?: { use: (k: string) => Promise<{ callTool: (s: string, t: string, a: unknown) => Promise<unknown> }> } }
}

/** Only inside Claude: read recent Al Meezan price emails. */
export async function fromEmail(): Promise<SiteResult[] | null> {
  if (typeof window === 'undefined' || !window.claude) return null;
  try {
    const mcp = await window.claude.use('mcp');
    type R = { payload?: unknown; structuredContent?: unknown; content?: Array<{ type: string; text?: string }> };
    const dat = (r: unknown): Record<string, unknown> => {
      const x = r as R;
      return (x.payload || x.structuredContent || JSON.parse((x.content?.find((c) => c.type === 'text') || {}).text || '{}')) as Record<string, unknown>;
    };
    const q = 'from:newsletters@almeezangroup.com subject:"Fund Prices and Performance" newer_than:14d';
    const sr = dat(await mcp.callTool('Gmail', 'search_threads', { query: q, pageSize: 14 }));
    const ids: string[] = [];
    ((sr.threads as Array<{ messages?: Array<{ id: string; subject?: string }> }>) || []).forEach((t) => (t.messages || []).forEach((m) => { if (/^Fund Prices and Performance/.test(m.subject || '')) ids.push(m.id); }));
    const got: SiteResult[] = [];
    for (const id of ids.slice(0, 10)) {
      const m = dat(await mcp.callTool('Gmail', 'get_message', { messageId: id, messageFormat: 'PLAIN_TEXT' }));
      const p = parseEmail(String(m.plaintextBody || ''));
      if (p) got.push(p);
    }
    return got.sort((a, b) => (a.date < b.date ? -1 : 1));
  } catch { return null; }
}

export const peersFrom = (r: SiteResult): Peers | null =>
  r.items.length > 3 ? { asof: dd(r.date), items: [...r.items].sort((a, b) => b.v - a.v) } : null;

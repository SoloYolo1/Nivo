// Meezan Balanced Fund maths, ported one-to-one from Nivo 3.x.
import { back } from './format';

export interface Nav { date: string; nav: number }
export interface Buy { date: string; sent: number; units: number }
/** A tracked day: NAV plus the units held, value, and the rupee change from the day before. */
export interface Row extends Nav { u: number; val: number; chg: number; bs: number }
export interface Peer { n: string; v: number; me?: boolean }
export interface Peers { asof: string; items: Peer[] }

export const SEED_NAVS: Nav[] = [
  { date: '2026-10-13', nav: 26.7116 }, { date: '2026-10-14', nav: 26.79 }, { date: '2026-10-15', nav: 26.87 },
  { date: '2026-10-16', nav: 26.86 }, { date: '2026-10-19', nav: 26.83 }, { date: '2026-10-20', nav: 26.7495 },
  { date: '2026-10-21', nav: 26.785 }, { date: '2026-10-22', nav: 26.6 }, { date: '2026-10-23', nav: 26.4174 },
];
export const SEED_BUYS: Buy[] = [{ date: '2026-10-13', sent: 200000, units: 7360.42 }];
export const SEED_PEERS: Peers = {
  asof: '23 Oct',
  items: [
    { n: 'Money Market', v: 10.06 }, { n: 'Conservative FoF', v: 0.03 }, { n: 'Moderate FoF', v: -3.51 },
    { n: 'Balanced (you)', v: -4.77, me: true }, { n: 'Aggressive FoF', v: -6.2 }, { n: 'Gold', v: -7.02 }, { n: 'Equity', v: -10.21 },
  ],
};

const byDate = <T extends { date: string }>(a: T, b: T) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

/** Units held at the end of day d. */
export const unitsOn = (buys: Buy[], d: string): number =>
  buys.filter((b) => b.date <= d).reduce((s, b) => s + b.units, 0);

/**
 * Merge new prices into the list. Deleted days stay deleted. Prices that came from the network
 * (net = true) never overwrite a price the person typed in by hand (overrides).
 */
export function mergeNavs(navs: Nav[], rows: Array<Partial<Nav> | null | undefined>, deleted: string[], overrides: string[], net = false): Nav[] {
  const m: Record<string, Nav> = {};
  navs.forEach((x) => { m[x.date] = x; });
  rows.forEach((x) => {
    if (!x || !x.date || !(Number(x.nav) > 0)) return;
    if (deleted.includes(x.date)) return;
    if (net && overrides.includes(x.date) && m[x.date]) return;
    m[x.date] = { date: x.date, nav: Number(x.nav) };
  });
  return Object.values(m).sort(byDate);
}

/** Build the tracked rows from the first purchase onwards. */
export function buildRows(navs: Nav[], buys: Buy[]): Row[] {
  const first = buys.map((b) => b.date).sort()[0] || '';
  const sorted = navs.filter((x) => x.date >= first).sort(byDate);
  const rows: Row[] = [];
  sorted.forEach((x, i) => {
    const u = unitsOn(buys, x.date);
    const p = rows[i - 1];
    rows.push({ date: x.date, nav: x.nav, u, val: u * x.nav, chg: p ? p.u * (x.nav - p.nav) : 0, bs: p ? p.u * p.nav : 0 });
  });
  return rows;
}

/** Rows for a chart range: 1, 7, 30 days, or 0 for everything. */
export function rangeRows(rows: Row[], days: number): Row[] {
  if (!days || !rows.length) return rows;
  const last = rows[rows.length - 1];
  const from = back(last.date, days);
  const s = rows.filter((x) => x.date >= from);
  return s.length < 2 ? rows.slice(-2) : s;
}

/** Profit over a window and the value it started from. */
export function windowPL(rows: Row[], days: number): { p: number; b: number } {
  if (!rows.length) return { p: 0, b: 0 };
  const last = rows[rows.length - 1];
  const from = days ? back(last.date, days) : '';
  const s = days ? rows.filter((x) => x.date > from) : rows.slice(1);
  return { p: s.reduce((a, x) => a + x.chg, 0), b: s.length ? (s[0].bs || s[0].val) : 0 };
}

export interface Stats {
  ch: Row[]; up: number; vol: number; streak: number; dir: boolean; dr: number; best: Row; worst: Row;
}

export function stats(rows: Row[]): Stats {
  const ch = rows.slice(1);
  const pr = ch.map((x, i) => (x.nav / rows[i].nav - 1) * 100);
  const up = ch.filter((x) => x.chg >= 0).length;
  const mean = pr.reduce((a, b) => a + b, 0) / (pr.length || 1);
  const vol = Math.sqrt(pr.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (pr.length || 1));
  let streak = 0;
  const dir = ch.length ? ch[ch.length - 1].chg >= 0 : true;
  for (let i = ch.length - 1; i >= 0; i--) { if ((ch[i].chg >= 0) === dir) streak++; else break; }
  let pk = 0, dr = 0;
  rows.forEach((x) => { if (x.nav > pk) pk = x.nav; dr = Math.min(dr, (x.nav / pk - 1) * 100); });
  const last = rows[rows.length - 1];
  const best = ch.reduce((a, x) => (x.chg > a.chg ? x : a), ch[0] || last);
  const worst = ch.reduce((a, x) => (x.chg < a.chg ? x : a), ch[0] || last);
  return { ch, up, vol, streak, dir, dr, best, worst };
}

/** The NAV in effect on day d (latest on or before d). */
export function navOn(navs: Nav[], d: string): number | null {
  let best: Nav | null = null;
  for (const n of navs) if (n.date <= d && (!best || n.date > best.date)) best = n;
  return best ? best.nav : null;
}

/** Estimated purchase fee: money sent minus what the units were worth that day. */
export function feeOf(navs: Nav[], b: Buy): number {
  const n = navOn(navs, b.date);
  return n ? Math.max(0, b.sent - b.units * n) : 0;
}

/** The date whose NAV we expect to already be published (after 7 pm, today; skips weekends). */
export function expectedDate(now: Date = new Date()): string {
  const x = new Date(now.getTime());
  if (x.getHours() < 19) x.setDate(x.getDate() - 1);
  while (x.getDay() === 0 || x.getDay() === 6) x.setDate(x.getDate() - 1);
  return new Date(x.getTime() - x.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
}

export interface Dealing { open: boolean; t: string; s: string }

/** Whether Al Meezan accepts orders now (Mon–Thu 9–3, Fri 9–4). */
export function dealing(d: Date = new Date()): Dealing {
  const wd = d.getDay(), m = d.getHours() * 60 + d.getMinutes(), close = wd === 5 ? 960 : 900;
  if (wd >= 1 && wd <= 5 && m >= 540 && m < close) {
    const l = close - m;
    return { open: true, t: 'Open', s: 'Orders close in ' + Math.floor(l / 60) + 'h ' + String(l % 60).padStart(2, '0') + 'm' };
  }
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const t = new Date(d.getTime());
  let k = 0;
  if (!(wd >= 1 && wd <= 5 && m < 540)) {
    do { t.setDate(t.getDate() + 1); k++; } while (t.getDay() === 0 || t.getDay() === 6);
  }
  return { open: false, t: 'Closed', s: 'Opens ' + (k === 0 ? 'today' : k === 1 ? 'tomorrow' : days[t.getDay()]) + ' at 9:00 am' };
}

/** Index of the hero chart's range buttons. */
export const RANGES: Array<{ d: number; label: string; word: string }> = [
  { d: 1, label: '1D', word: 'today' },
  { d: 7, label: '1W', word: 'this week' },
  { d: 30, label: '1M', word: 'this month' },
  { d: 0, label: 'All', word: 'since start' },
];

/** Milestones used for celebrations and the Plan page. */
export const MILESTONES = [5e5, 1e6, 2.5e6, 5e6, 1e7];

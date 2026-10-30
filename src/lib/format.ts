// Number and date formatting. Same rules as Nivo 3.x so every figure reads the same.

// ---------- hiding amounts ----------
// When amounts are hidden, every rupee figure drawn on screen becomes dots. Percentages, dates and
// prices per unit stay visible. Text that is stored or sent (notifications) uses the raw* versions.
let masked = false;
export const amountsHidden = (): boolean => masked;
export const setAmountsHidden = (v: boolean): void => { masked = v; };
const DOTS = '••••••';
/** Run f with amounts shown, for text that is stored or sent rather than drawn. */
export function unmasked<T>(f: () => T): T { const m = masked; masked = false; try { return f(); } finally { masked = m; } }

/** Whole rupees with thousands separators, ignoring "hide amounts". */
export const rawN0 = (x: number): string => Math.round(x).toLocaleString('en-PK');
/** Signed whole rupees, ignoring "hide amounts". */
export const rawSg = (x: number): string => (x >= 0 ? '+' : '−') + rawN0(Math.abs(x));

/** Whole rupees with thousands separators, e.g. 194443 -> "194,443". */
export const n0 = (x: number): string => (masked ? DOTS : rawN0(x));

/** Signed whole rupees with a real minus sign, e.g. -1344 -> "−1,344". */
export const sg = (x: number): string => (masked ? (x >= 0 ? '+' : '−') + '••••' : rawSg(x));

/** Hide rupee amounts inside text that was written earlier (the notification list). */
export const maskText = (t: string): string =>
  masked ? t.replace(/(Rs\.?\s?)?[+−-]?\d[\d,]*(\.\d+)?(\s?(L|Cr|lakh|crore)\b)?/g, (m, rs: string | undefined, _d, unit: string | undefined) => (rs || unit || /\d{1,3},\d{3}/.test(m) ? (rs ? 'Rs ' : '') + '••••' : m)) : t;

/** Signed percentage with two decimals, e.g. -1.1 -> "−1.10%". */
export const pc = (x: number): string => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(2) + '%';

/** CSS class for a gain or a loss. */
export const cl = (x: number): 'up' | 'dn' => (x >= 0 ? 'up' : 'dn');

/** Large amounts in lakh or crore, e.g. 2123643 -> "Rs 21.2 lakh". */
export const big = (t: number): string => {
  if (masked) return 'Rs ••••';
  const neg = t < 0;
  const a = Math.abs(t);
  const s = a >= 1e7 ? (a / 1e7).toFixed(2) + ' crore' : (a / 1e5).toFixed(1) + ' lakh';
  return (neg ? '−Rs ' : 'Rs ') + s;
};

/** Compact rupees for tiles, e.g. 1289200 -> "Rs 12.89 L", 35000 -> "Rs 35,000". */
export const compact = (t: number): string => {
  if (masked) return 'Rs ••••';
  const a = Math.abs(t);
  const sign = t < 0 ? '−' : '';
  if (a >= 1e7) return sign + 'Rs ' + (a / 1e7).toFixed(2) + ' Cr';
  if (a >= 1e5) return sign + 'Rs ' + (a / 1e5).toFixed(2) + ' L';
  return sign + 'Rs ' + n0(a);
};

/** "2026-10-23" -> "23 Oct". */
export const dd = (d: string): string =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/** "2026-10-23" -> "Friday 23 October". */
export const longDate = (d: string): string =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

/** Today's date in local time as YYYY-MM-DD. */
export const iso = (now: Date = new Date()): string =>
  new Date(now.getTime() - now.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);

/** The date n days before d (both YYYY-MM-DD). */
export const back = (d: string, n: number): string => {
  const t = new Date(d + 'T00:00:00Z');
  t.setUTCDate(t.getUTCDate() - n);
  return t.toISOString().slice(0, 10);
};

/** Whole days from date a to date b. */
export const daysBetween = (a: string, b: string): number =>
  Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);

/** "updated today", "updated 3 days ago". */
export const ago = (d: string, today: string = iso()): string => {
  const n = daysBetween(d, today);
  if (n <= 0) return 'today';
  if (n === 1) return 'yesterday';
  return n + ' days ago';
};

/** Greeting for the hour. */
export const greeting = (hour: number): string =>
  hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

/** Parse a rupee amount typed by a person: "850,000", "Rs 8.5 lakh" is not supported, plain numbers only. */
export const parseAmount = (s: string): number => {
  const v = parseFloat(String(s).replace(/[,\s]/g, '').replace(/^rs\.?/i, ''));
  return Number.isFinite(v) ? v : NaN;
};

/** Escape text for the few places that build HTML strings (none in React views). */
export const esc = (s: unknown): string =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

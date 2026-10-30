// The monthly summary: how net worth moved last month (money put in is not counted as growth)
// and which account moved it most. Posted to the notification list once, early in the new month.
import { endOfPrevMonth, growth, type Account, type FundPoint } from './accounts';
import { rawN0 } from './format';

export interface MonthSummary { key: string; month: string; title: string; body: string; change: number }

const monthName = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { month: 'long' });

/** Last month's summary, or null when Nivo has nothing from before the end of last month. */
export function monthSummary(list: Account[], fund: FundPoint[], deposits: Array<{ date: string; amount: number }>, today: string): MonthSummary | null {
  const to = endOfPrevMonth(today), from = endOfPrevMonth(to);
  const g = growth(list, fund, deposits, from, to, 'Meezan Balanced');
  if (!g.started || g.started > to) return null;
  const month = monthName(to);
  const key = 'sum-' + to.slice(0, 7);
  const abs = Math.abs(g.change);
  const pct = g.owned >= 1000 ? (g.change / g.owned) * 100 : null;
  if (abs < 1) return { key, month, change: 0, title: month + ' in review', body: 'Your net worth held steady in ' + month + '.' };
  // the account that moved most in the same direction as the total
  const top = g.parts.filter((p) => Math.sign(p.change) === Math.sign(g.change)).sort((a, b) => Math.abs(b.change) - Math.abs(a.change))[0];
  const share = top ? Math.abs(top.change) / abs : 0;
  const why = top && share >= 0.5 ? ', mostly from ' + top.name : top ? ', led by ' + top.name : '';
  const body = month + ': ' + (g.change >= 0 ? 'up' : 'down') + ' Rs ' + rawN0(abs) + (pct != null && Math.abs(pct) >= 0.05 ? ' (' + Math.abs(pct).toFixed(1) + '%)' : '') + why + '.' + (g.deposits > 0 ? ' Rs ' + rawN0(g.deposits) + ' you put in is not counted.' : '');
  return { key, month, change: g.change, title: month + ' in review', body };
}

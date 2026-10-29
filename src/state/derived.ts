// Figures computed from the store. Memoised on the arrays they depend on, so they are
// only recomputed when prices, purchases or accounts actually change.
import { useMemo } from 'react';
import { useStore } from './store';
import { buildRows, stats, feeOf, type Row, type Stats, type Nav, type Buy } from '../lib/fund';
import { totals, type Totals, type FundPoint } from '../lib/accounts';

export interface Fund {
  rows: Row[]; last: Row | null; prev: Row | null; st: Stats | null;
  sent: number; be: number; all: number; first: number; fees: number;
  points: FundPoint[];
}

export function computeFund(navs: Nav[], buys: Buy[]): Fund {
  const rows = buildRows(navs, buys);
  const last = rows[rows.length - 1] || null;
  const prev = rows[rows.length - 2] || null;
  const sent = buys.reduce((s, b) => s + b.sent, 0);
  return {
    rows, last, prev,
    st: last ? stats(rows) : null,
    sent,
    be: last && last.u ? sent / last.u : 0,
    all: rows.reduce((a, x) => a + x.chg, 0),
    first: rows[0] ? rows[0].val || 1 : 1,
    fees: buys.reduce((a, b) => a + feeOf(navs, b), 0),
    points: rows.map((r) => ({ date: r.date, val: r.val })),
  };
}

export function useFund(): Fund {
  const navs = useStore((s) => s.navs);
  const buys = useStore((s) => s.buys);
  return useMemo(() => computeFund(navs, buys), [navs, buys]);
}

export function useTotals(): Totals & { fundValue: number } {
  const f = useFund();
  const accounts = useStore((s) => s.accounts);
  return useMemo(() => {
    const v = f.last ? f.last.val : 0;
    return { ...totals(accounts, v), fundValue: v };
  }, [accounts, f.last]);
}

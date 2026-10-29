import test from 'node:test';
import assert from 'node:assert/strict';
import {
  worth, totals, monthChange, netWorthOn, netWorthSeries, endOfPrevMonth, staleAccounts, withSnapshot,
  workingIdle, emergency, zakat, businessValue, businessStats, cleanAccounts, type Account,
} from '../src/lib/accounts';

const fund = [{ date: '2026-10-13', val: 196000 }, { date: '2026-10-23', val: 194443 }];
const acc = (a: Partial<Account> & Pick<Account, 'id' | 'kind' | 'history'>): Account => ({ name: a.id, created: '2026-05-01', ...a });

const meezan = acc({ id: 'mb', kind: 'bank', acctType: 'savings', rate: 9.5, emergency: true, history: [{ date: '2026-09-30', value: 825000 }, { date: '2026-10-27', value: 850000 }] });
const hbl = acc({ id: 'hbl', kind: 'bank', acctType: 'current', emergency: true, history: [{ date: '2026-09-25', value: 312400 }] });
const ubl = acc({ id: 'ubl', kind: 'bank', acctType: 'current', emergency: false, history: [{ date: '2026-10-23', value: 126800 }] });
const biz = acc({ id: 'at', kind: 'business', share: 100, history: [{ date: '2026-10-08', value: businessValue({ bank: 520000, cash: 35000, receivable: 180000, payable: 95000 }), bank: 520000, cash: 35000, receivable: 180000, payable: 95000, sales: 410000, costs: 348000 }] });
const list = [meezan, hbl, ubl, biz];

test('net worth adds every account and the fund', () => {
  const t = totals(list, 194443);
  assert.equal(t.netWorth, 850000 + 312400 + 126800 + 640000 + 194443);
  assert.equal(t.groups.banks, 1289200);
  assert.equal(t.groups.business, 640000);
  assert.equal(t.groups.investments, 194443);
});

test('loans are taken off and business counts only your share', () => {
  const loan = acc({ id: 'car', kind: 'loan', history: [{ date: '2026-10-01', value: 300000 }] });
  const half = { ...biz, share: 50 };
  assert.equal(worth(loan), -300000);
  assert.equal(worth(half), 320000);
  const t = totals([loan, half], 0);
  assert.equal(t.netWorth, 20000);
  assert.equal(t.owed, 300000);
});

test('balances are read as of a date', () => {
  assert.equal(worth(meezan, '2026-10-01'), 825000);
  assert.equal(worth(meezan, '2026-09-01'), 0);
  assert.equal(netWorthOn(list, fund, '2026-09-30'), 825000 + 312400);
});

test('month change ignores accounts that were simply added this month', () => {
  const r = monthChange(list, fund, '2026-10-29');
  // Meezan Bank +25,000; HBL unchanged; UBL and the business are new this month (count from their first balance);
  // the fund started this month too, so it counts from its first value: 194,443 − 196,000.
  assert.equal(Math.round(r.change), 25000 + (194443 - 196000));
});

test('end of previous month', () => {
  assert.equal(endOfPrevMonth('2026-10-29'), '2026-09-30');
  assert.equal(endOfPrevMonth('2026-03-05'), '2026-02-28');
  assert.equal(endOfPrevMonth('2026-01-15'), '2025-12-31');
});

test('net worth series ends with today and skips months before any data', () => {
  const s = netWorthSeries(list, fund, '2026-10-29', 6);
  assert.equal(s[s.length - 1].label, 'Now');
  assert.equal(s[0].date, '2026-09-30');
});

test('stale accounts are the ones not updated in 30 days', () => {
  assert.deepEqual(staleAccounts(list, '2026-10-29').map((a) => a.id), ['hbl']);
});

test('a new balance for the same day replaces the old one', () => {
  const a = withSnapshot(meezan, { date: '2026-10-27', value: 860000 });
  assert.equal(a.history.length, 2);
  assert.equal(worth(a), 860000);
  const b = withSnapshot(a, { date: '2026-10-01', value: 830000 });
  assert.deepEqual(b.history.map((h) => h.date), ['2026-09-30', '2026-10-01', '2026-10-27']);
});

test('idle money is current accounts and cash in hand', () => {
  const w = workingIdle(list, 194443);
  assert.equal(w.idle, 312400 + 126800);
  assert.equal(w.working, 194443 + 850000 + 640000);
  assert.equal(w.bestRate, 9.5);
});

test('emergency cushion counts only accounts marked as emergency money', () => {
  const e = emergency(list, 165000);
  assert.equal(e.cash, 850000 + 312400);
  assert.ok(Math.abs((e.months as number) - 1162400 / 165000) < 1e-9);
  assert.equal(emergency(list, 0).months, null);
});

test('zakat is 2.5% of zakatable wealth minus debts, and zero below nisab', () => {
  const z = zakat(list, 194443, null);
  assert.equal(z.base, 1289200 + 194443 + 640000);
  assert.ok(Math.abs(z.due - z.base * 0.025) < 1e-9);
  const loan = acc({ id: 'l', kind: 'loan', history: [{ date: '2026-10-01', value: 100000 }] });
  assert.equal(zakat([...list, loan], 194443, null).base, z.base - 100000);
  assert.equal(zakat(list, 0, 1e9).due, 0);
  const prop = acc({ id: 'p', kind: 'property', history: [{ date: '2026-10-01', value: 9e6 }] });
  assert.equal(zakat([prop], 0, null).base, 0);
});

test('business figures', () => {
  const b = businessStats(biz);
  assert.equal(b.profit, 62000);
  assert.ok(Math.abs((b.margin as number) - 62000 / 410000 * 100) < 1e-9);
  assert.ok(Math.abs((b.runway as number) - 555000 / 348000) < 1e-9);
});

test('accounts from storage or a backup are cleaned', () => {
  const raw = [{ id: 'x', kind: 'bank', name: 'A', created: '2026-01-01', history: [{ date: '2026-02-01', value: '500' }, { date: 5 }] }, { id: 'y', kind: 'spaceship', history: [] }, null, 'junk'];
  const c = cleanAccounts(raw);
  assert.equal(c.length, 1);
  assert.equal(c[0].history.length, 1);
  assert.equal(c[0].history[0].value, 500);
  assert.deepEqual(cleanAccounts('nope'), []);
});

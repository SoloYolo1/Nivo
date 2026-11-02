// Transactions, categories, monthly sums, transfers, bills.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATS, IN_CATS, OUT_CATS, billsDue, cleanTxns, dueWords, guessCat, monthFlow, monthsWithTxns, nextDue, reverseTxn, shiftMonth, spendingByCat, type Bill, type Txn } from '../src/lib/cashflow';
import type { Account } from '../src/lib/accounts';

const acc = (a: Partial<Account> & Pick<Account, 'id' | 'kind' | 'history'>): Account => ({ name: a.id, created: '2026-05-01', ...a });
const bank = acc({ id: 'b', kind: 'bank', history: [{ date: '2026-10-01', value: 100000 }, { date: '2026-10-20', value: 120000 }, { date: '2026-10-25', value: 115000 }] });
const loan = acc({ id: 'l', kind: 'loan', history: [{ date: '2026-10-01', value: 50000 }] });
const T: Txn[] = [
  { id: '1', acct: 'b', date: '2026-10-20', amount: 20000, cat: 'salary', note: 'Salary' },
  { id: '2', acct: 'b', date: '2026-10-25', amount: -5000, cat: 'groceries' },
  { id: '3', acct: 'b', date: '2026-10-26', amount: -3000, cat: 'transfer', to: 'l' },
  { id: '4', acct: 'l', date: '2026-10-26', amount: -3000, cat: 'transfer', to: 'b' },
  { id: '5', acct: 'b', date: '2026-10-27', amount: -2000, cat: 'groceries' },
  { id: '6', acct: 'b', date: '2026-09-15', amount: -9000, cat: 'rent' },
];

test('a note suggests its category', () => {
  assert.equal(guessCat('Salary for October', 'in'), 'salary');
  assert.equal(guessCat('Imtiaz groceries', 'out'), 'groceries');
  assert.equal(guessCat('K-Electric bill', 'out'), 'bills');
  assert.equal(guessCat('Careem to office', 'out'), 'transport');
  assert.equal(guessCat('Zakat', 'out'), 'charity');
  assert.equal(guessCat('', 'out'), 'spend');
  assert.equal(guessCat('something else', 'in'), 'income');
  // every category has an icon and a colour, and the pools cover all but transfer
  for (const c of Object.keys(CATS)) assert.ok(CATS[c as keyof typeof CATS].icon && CATS[c as keyof typeof CATS].color);
  assert.equal(IN_CATS.length + OUT_CATS.length + 1, Object.keys(CATS).length);
});

test('a month adds up money in, money out and the categories; transfers and loan accounts are kept apart', () => {
  const f = monthFlow(T, '2026-10', [bank, loan]);
  assert.equal(f.in, 20000);
  assert.equal(f.out, 7000);
  assert.equal(f.net, 13000);
  assert.equal(f.transfers, 3000);
  assert.equal(f.count, 5);
  assert.deepEqual(spendingByCat(f).map((c) => [c.cat, c.amount, c.count]), [['groceries', 7000, 2]]);
  assert.equal(monthFlow(T, '2026-09', [bank, loan]).out, 9000);
  assert.deepEqual(monthsWithTxns(T, '2026-11-02'), ['2026-11', '2026-10', '2026-09']);
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
});

test('removing a transaction moves every later balance back', () => {
  const r = reverseTxn(bank, T[0]);
  assert.deepEqual(r.history.map((h) => h.value), [100000, 100000, 95000]);
  const l = reverseTxn(loan, { id: 'x', acct: 'l', date: '2026-10-01', amount: -10000, cat: 'loan' });
  assert.equal(l.history[0].value, 60000);
});

test('bad records are dropped when reading transactions', () => {
  const ok = cleanTxns([T[0], { id: 'z' }, null, { ...T[1], cat: 'nope' }, { ...T[4], amount: '12' }]);
  assert.deepEqual(ok.map((t) => t.id), ['1', '5']);
  assert.equal(ok[1].amount, 12);
});

test('bills know when they are next due', () => {
  const rent: Bill = { id: 'r', name: 'Rent', amount: 25000, day: 5, cat: 'rent', created: '2026-09-01' };
  assert.equal(nextDue(rent, '2026-11-02'), '2026-11-05');
  assert.equal(nextDue({ ...rent, lastPaid: '2026-11-01' }, '2026-11-02'), '2026-12-05');
  assert.equal(nextDue(rent, '2026-11-20'), '2026-11-05', 'unpaid and past: overdue this month');
  assert.equal(nextDue({ ...rent, created: '2026-11-10' }, '2026-11-20'), '2026-12-05', 'added after its day: starts next month');
  assert.equal(nextDue({ ...rent, day: 31 }, '2026-11-02'), '2026-11-30', 'the 31st in a 30-day month');
  const due = billsDue([rent, { ...rent, id: 'n', name: 'Netflix', day: 25, amount: 1500 }], '2026-11-02', 7);
  assert.deepEqual(due.map((d) => [d.bill.id, d.days]), [['r', 3]]);
  assert.equal(dueWords(due[0]), 'Due in 3 days');
  assert.equal(dueWords({ ...due[0], days: 0 }), 'Due today');
  assert.equal(dueWords({ ...due[0], days: -3, overdue: true }), '3 days overdue');
});

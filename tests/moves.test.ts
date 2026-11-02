// Adding or taking out money from an account, and the sums the amount box accepts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { moveSnapshot, moveWords, zakat, type Account } from '../src/lib/accounts';
import { calcAmount, isSum } from '../src/lib/format';

const acc = (a: Partial<Account> & Pick<Account, 'id' | 'kind' | 'history'>): Account => ({ name: a.id, created: '2026-05-01', ...a });
const bank = acc({ id: 'b', kind: 'bank', history: [{ date: '2026-10-01', value: 100000 }, { date: '2026-10-20', value: 120000, note: 'Salary' }] });
const loan = acc({ id: 'l', kind: 'loan', history: [{ date: '2026-10-01', value: 50000 }] });

test('adding money is worked out from the latest balance', () => {
  assert.deepEqual(moveSnapshot(bank, 'in', 5000, '2026-10-28', 'Bonus'), { date: '2026-10-28', value: 125000, note: 'Bonus' });
  assert.deepEqual(moveSnapshot(bank, 'out', 20000, '2026-10-28'), { date: '2026-10-28', value: 100000 });
  assert.deepEqual(moveSnapshot(bank, 'set', 90000, '2026-10-28'), { date: '2026-10-28', value: 90000 });
});

test('taking out more than there is, or nothing, is refused', () => {
  assert.equal(moveSnapshot(bank, 'out', 120001, '2026-10-28'), 'That is more than the Rs 120,000 in this account.');
  assert.equal(moveSnapshot(bank, 'out', 0, '2026-10-28'), 'Enter an amount.');
  assert.equal(moveSnapshot(bank, 'in', NaN, '2026-10-28'), 'Enter an amount.');
  assert.equal(moveSnapshot(bank, 'set', -1, '2026-10-28'), 'Enter the new balance.');
  assert.equal(moveSnapshot(loan, 'out', 60000, '2026-10-28'), 'That is more than the Rs 50,000 you owe.');
});

test('loans run the other way: borrowing adds, paying takes off', () => {
  assert.equal((moveSnapshot(loan, 'in', 10000, '2026-10-28') as { value: number }).value, 60000);
  assert.equal((moveSnapshot(loan, 'out', 10000, '2026-10-28') as { value: number }).value, 40000);
  assert.equal(moveWords('loan', 'out').title, 'Paid off');
  assert.equal(moveWords('bank', 'in').title, 'Add money');
});

test('a second move on the same day keeps both notes', () => {
  const s = moveSnapshot(bank, 'out', 2000, '2026-10-20', 'Groceries');
  assert.deepEqual(s, { date: '2026-10-20', value: 118000, note: 'Salary · Groceries' });
  // setting a balance replaces the day's note
  assert.deepEqual(moveSnapshot(bank, 'set', 118000, '2026-10-20', 'Statement'), { date: '2026-10-20', value: 118000, note: 'Statement' });
});

test('the amount box does sums', () => {
  assert.equal(calcAmount('12,500'), 12500);
  assert.equal(calcAmount('Rs 12,500 + 3000'), 15500);
  assert.equal(calcAmount('2.5 lakh'), 250000);
  assert.equal(calcAmount('4 × 25k'), 100000);
  assert.equal(calcAmount('(1500-200)*3'), 3900);
  assert.equal(calcAmount('1 crore / 2'), 5000000);
  assert.ok(Number.isNaN(calcAmount('abc')));
  assert.ok(Number.isNaN(calcAmount('5+')));
  assert.ok(Number.isNaN(calcAmount('')));
  assert.equal(isSum('12,500'), false);
  assert.equal(isSum('12,500+3000'), true);
  assert.equal(isSum('2 lakh'), true);
});

test('the Meezan fund can be left out of the zakat estimate', () => {
  const on = zakat([bank], 200000, null, true), off = zakat([bank], 200000, null, false);
  assert.equal(on.base, 320000);
  assert.equal(off.base, 120000);
  assert.ok(!off.lines.some((l) => l.label === 'Meezan Balanced Fund'));
});

// 4.12: a business can add and take out money like any account; the figures carry over

test('business: money in goes to the bank, the other figures stay', () => {
  const a = { id: 'b', kind: 'business' as const, name: 'Shop', created: '2026-01-01', history: [{ date: '2026-10-01', value: 150, bank: 100, cash: 50, receivable: 30, payable: 30, sales: 500, costs: 400 }] };
  const s = moveSnapshot(a, 'in', 25, '2026-10-05');
  assert.equal(typeof s, 'object');
  if (typeof s === 'object') { assert.equal(s.bank, 125); assert.equal(s.cash, 50); assert.equal(s.receivable, 30); assert.equal(s.payable, 30); assert.equal(s.sales, 500); assert.equal(s.value, 175); }
});
test('business: money out comes from the bank first, then cash, and cannot exceed both', () => {
  const a = { id: 'b', kind: 'business' as const, name: 'Shop', created: '2026-01-01', history: [{ date: '2026-10-01', value: 150, bank: 100, cash: 50, receivable: 0, payable: 0 }] };
  const s = moveSnapshot(a, 'out', 120, '2026-10-05');
  if (typeof s === 'object') { assert.equal(s.bank, 0); assert.equal(s.cash, 30); assert.equal(s.value, 30); } else assert.equal(s, 'a snapshot');
  assert.equal(typeof moveSnapshot(a, 'out', 151, '2026-10-05'), 'string');
});

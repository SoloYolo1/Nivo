// The store's cash flow actions, run against an in-memory localStorage.
import test from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => (mem.has(k) ? (mem.get(k) as string) : null),
  setItem: (k: string, v: string) => { mem.set(k, String(v)); },
  removeItem: (k: string) => { mem.delete(k); },
  clear: () => mem.clear(), key: () => null, length: 0,
} as Storage;

const store = await import('../src/state/store');
const { addTxn, deleteTxn, getState, moveMoney, payBill, reloadFromStorage, upsertAccount, upsertBill } = store;

const bal = (id: string) => { const h = getState().accounts.find((a) => a.id === id)!.history; return h[h.length - 1].value; };

const bank = { id: 'b', kind: 'bank' as const, name: 'HBL', created: '2026-09-01', history: [{ date: '2026-10-01', value: 100000 }] };
const loan = { id: 'l', kind: 'loan' as const, name: 'Car loan', created: '2026-09-01', history: [{ date: '2026-10-01', value: 50000 }] };

test('moving money between accounts changes both balances and records a transfer on each side', () => {
  reloadFromStorage();
  upsertAccount(bank); upsertAccount(loan);
  const r = moveMoney('b', 'l', 10000, '2026-10-10', 'Instalment');
  assert.ok('id' in r);
  const s = getState();
  assert.equal(bal('b'), 90000);
  assert.equal(bal('l'), 40000, 'paying into a loan brings what is owed down');
  assert.equal(s.txns.length, 2);
  assert.deepEqual(s.txns.map((t) => [t.acct, t.amount, t.cat, t.to]), [['b', -10000, 'transfer', 'l'], ['l', -10000, 'transfer', 'b']]);
  const bad = moveMoney('b', 'l', 999999, '2026-10-11');
  assert.ok('error' in bad && bad.error.includes('more than the Rs 90,000'));
});

test('deleting a transaction puts the money back, on both sides of a transfer', () => {
  const t = getState().txns[0];
  deleteTxn(t.id);
  const s = getState();
  assert.equal(s.txns.length, 0);
  assert.equal(bal('b'), 100000);
  assert.equal(bal('l'), 50000);
  // undo from the toast brings it all back
  getState().toast!.action!.fn();
  assert.equal(getState().txns.length, 2);
  assert.equal(bal('b'), 90000);
});

test('paying a bill takes it off the account with its category and marks the month paid', () => {
  upsertBill({ id: 'rent', name: 'Rent', amount: 25000, day: 5, cat: 'rent', created: '2026-09-01' });
  const r = payBill('rent', 'b', '2026-10-12');
  assert.ok('id' in r);
  const s = getState();
  assert.equal(bal('b'), 65000);
  assert.equal(s.bills[0].lastPaid, '2026-10-12');
  assert.equal(s.bills[0].acct, 'b');
  const paid = s.txns.find((t) => t.cat === 'rent')!;
  assert.equal(paid.amount, -25000);
  assert.equal(paid.note, 'Rent');
  const over = payBill('rent', 'b', '2026-10-13', 999999);
  assert.ok('error' in over);
});

test('everything new survives a reload and a backup', () => {
  addTxn({ acct: 'b', date: '2026-10-14', amount: 500, cat: 'gift' });
  const before = getState();
  reloadFromStorage();
  const after = getState();
  assert.deepEqual(after.txns, before.txns);
  assert.deepEqual(after.bills, before.bills);
  const j = JSON.parse(store.backupJson());
  assert.equal(j.txns.length, after.txns.length);
  assert.equal(j.bills.length, 1);
});

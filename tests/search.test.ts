// Search across accounts, transactions, bills, prices and pages, plus the quick actions an amount offers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { search } from '../src/lib/search';
import type { Account } from '../src/lib/accounts';
import type { Bill, Txn } from '../src/lib/cashflow';

const acc = (a: Partial<Account> & Pick<Account, 'id' | 'kind' | 'history'>): Account => ({ name: a.id, created: '2026-05-01', ...a });
const data = {
  accounts: [acc({ id: 'b1', kind: 'bank', name: 'HBL savings', bank: 'HBL', last4: '4412', history: [{ date: '2026-10-01', value: 1e5 }] }), acc({ id: 'l1', kind: 'loan', name: 'Car loan', history: [{ date: '2026-10-01', value: 5e4 }] })],
  txns: [
    { id: 't1', acct: 'b1', date: '2026-10-23', amount: -2500, cat: 'transport', note: 'Careem to office' },
    { id: 't2', acct: 'b1', date: '2026-11-01', amount: -25000, cat: 'rent', note: 'Rent' },
    { id: 't3', acct: 'b1', date: '2026-11-02', amount: 5000, cat: 'gift' },
  ] as Txn[],
  bills: [{ id: 'r', name: 'Rent', amount: 25000, day: 5, cat: 'rent' }] as Bill[],
  prices: [{ date: '2026-10-22', nav: 26.6, chg: -1850 }, { date: '2026-10-23', nav: 26.4174, chg: -1826 }],
};

test('a word finds notes, categories, accounts, bills and pages', () => {
  const h = search('careem', data);
  assert.deepEqual(h.txns.map((t) => t.id), ['t1']);
  assert.equal(h.total, 1);
  const r = search('rent', data);
  assert.deepEqual(r.txns.map((t) => t.id), ['t2']);
  assert.deepEqual(r.bills.map((b) => b.id), ['r']);
  assert.ok(r.pages.some((p) => p.id === 'bills'));
  assert.deepEqual(search('hbl', data).accounts.map((a) => a.id), ['b1']);
  assert.deepEqual(search('4412', data).accounts.map((a) => a.id), ['b1']);
  assert.deepEqual(search('transport', data).txns.map((t) => t.id), ['t1']);
  assert.ok(search('zakat', data).pages.some((p) => p.id === 'insights:zakat'));
  assert.ok(search('backup', data).pages.some((p) => p.id === 'settings:data'));
});

test('an amount offers to log it and finds matching transactions and bills', () => {
  const h = search('5000', data);
  assert.deepEqual(h.actions.map((a) => a.id), ['out', 'in']);
  assert.equal(h.actions[0].title, 'Take out Rs 5,000');
  assert.ok(h.actions[0].kind === 'action' && h.actions[0].go.sheet === 'update' && h.actions[0].go.arg === 'b1:out:5000');
  assert.deepEqual(h.txns.map((t) => t.id), ['t3']);
  assert.deepEqual(search('25,000', data).bills.map((b) => b.id), ['r']);
  assert.deepEqual(search('2.5k', data).txns.map((t) => t.id), ['t1']);
});

test('a date finds that day’s transactions and price', () => {
  const h = search('23 oct', data);
  assert.deepEqual(h.txns.map((t) => t.id), ['t1']);
  assert.deepEqual(h.prices.map((p) => p.id), ['2026-10-23']);
  assert.equal(search('october', data).prices.length, 2);
  assert.equal(search('nov', data).txns.length, 2);
  // a word that merely starts with a month abbreviation is not a date
  assert.equal(search('market', data).txns.length, 0);
});

test('a price is found by its exact NAV, and the empty query gives nothing', () => {
  assert.deepEqual(search('26.4174', data).prices.map((p) => p.id), ['2026-10-23']);
  assert.equal(search('   ', data).total, 0);
  assert.equal(search('add bill', data).actions[0].id, 'bill');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { pickQuip, quipsFor } from '../src/lib/quips';

const base = { hour: 19, day: 3, name: 'Muhammad', fundToday: null, stale: 0, goalPct: 20, monthUp: null };

test('lines are short and never contain an amount', () => {
  const all = quipsFor({ ...base, fundToday: 5, stale: 3, monthUp: true, hour: 8, day: 6 });
  for (const q of all) { assert.ok(q.length <= 44, q); assert.ok(!/Rs|\d{1,3},\d{3}/.test(q), q); }
});

test('the same line never shows twice in a row', () => {
  let prev = '';
  for (let i = 0; i < 50; i++) { const q = pickQuip(base); assert.notEqual(q, prev); prev = q; }
});

test('your own news is in the mix', () => {
  assert.ok(quipsFor({ ...base, stale: 2 }).includes('2 balances could use a refresh.'));
  assert.ok(quipsFor({ ...base, fundToday: -100 }).some((q) => q.startsWith('A red day')));
});

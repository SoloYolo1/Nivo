import test from 'node:test';
import assert from 'node:assert/strict';
import { fromBackup, fromStorage, summarize } from '../src/lib/legacy';

test('reads what Nivo 3 kept in storage', () => {
  const l = fromStorage({
    mw_navs: JSON.stringify([{ date: '2026-05-04', nav: 24.1 }, { date: '2026-05-05', nav: '24.2' }, { date: 'bad', nav: 1 }, { date: '2026-05-06', nav: 0 }]),
    mw_buys: JSON.stringify([{ date: '2026-05-04', sent: 150000, units: 6132.09 }, { date: '2026-05-05', sent: 0, units: 1 }]),
    mw_del: JSON.stringify(['2026-05-07']), mw_goal: JSON.stringify({ amount: 5e6, years: 7.4 }), plan3: JSON.stringify([1, 1, 0, 0]), mw_name: JSON.stringify('Ali'),
  });
  if (!l) throw new Error('nothing read');
  assert.equal(l.navs.length, 2);
  assert.equal(l.navs[1].nav, 24.2);
  assert.equal(l.buys.length, 1);
  assert.deepEqual(l.deleted, ['2026-05-07']);
  assert.deepEqual(l.goal, { amount: 5e6, years: 7 });
  assert.equal(l.name, 'Ali');
  const s = summarize(l);
  assert.equal(s.first, '2026-05-04'); assert.equal(s.last, '2026-05-05'); assert.equal(s.sent, 150000);
});

test('empty or broken storage gives nothing to import', () => {
  assert.equal(fromStorage({}), null);
  assert.equal(fromStorage({ mw_navs: 'not json' }), null);
});

test('reads a pasted Nivo 3 backup and rejects other text', () => {
  const l = fromBackup('  {"navs":[{"date":"2026-10-13","nav":26.7116}],"buys":[{"date":"2026-10-13","sent":200000,"units":7360.42}],"goal":{"amount":10000000,"years":10}} ');
  if (!l) throw new Error('nothing read');
  assert.equal(l.source, 'backup');
  assert.equal(l.navs.length, 1);
  assert.equal(fromBackup('hello'), null);
  assert.equal(fromBackup('{"navs":[]}'), null);
});

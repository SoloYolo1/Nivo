// The fund maths must give exactly what Nivo 3.1 gave. golden.json was recorded by running
// 3.1's own functions in a browser on the same inputs.
import test from 'node:test';
import assert from 'node:assert/strict';
import golden from './golden.json';
import { buildRows, rangeRows, windowPL, stats, feeOf, dealing, expectedDate, mergeNavs, type Nav, type Buy } from '../src/lib/fund';
import { futureValue, monthsTo, duration } from '../src/lib/plan';
import { n0, sg, pc, big } from '../src/lib/format';

const close = (a: number, b: number, msg: string) => assert.ok(Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(b)), msg + ': ' + a + ' vs ' + b);

for (const [k, g] of golden.sets.entries()) {
  const navs = g.input.navs as Nav[], buys = g.input.buys as Buy[];
  const rows = buildRows(navs, buys);

  test('rows match 3.1 (set ' + k + ')', () => {
    assert.equal(rows.length, g.rows.length);
    rows.forEach((r, i) => {
      const o = g.rows[i];
      assert.equal(r.date, o.date);
      close(r.u, o.u, 'units ' + r.date); close(r.val, o.val, 'value ' + r.date); close(r.chg, o.chg, 'change ' + r.date); close(r.bs, o.bs, 'base ' + r.date);
    });
  });

  test('chart ranges and period profit match 3.1 (set ' + k + ')', () => {
    [1, 7, 30, 0].forEach((d, i) => {
      assert.deepEqual(rangeRows(rows, d).map((x) => x.date), g.sub[i]);
      const w = windowPL(rows, d);
      close(w.p, g.win[i].p, 'profit ' + d); close(w.b, g.win[i].b, 'base ' + d);
    });
  });

  test('stats match 3.1 (set ' + k + ')', () => {
    const s = stats(rows);
    assert.equal(s.up, g.stats.up); assert.equal(s.streak, g.stats.streak); assert.equal(s.dir, g.stats.dir);
    close(s.vol, g.stats.vol, 'volatility'); close(s.dr, g.stats.dr, 'drawdown');
    assert.equal(s.best.date, g.stats.best); assert.equal(s.worst.date, g.stats.worst);
  });

  test('purchase fees match 3.1 (set ' + k + ')', () => {
    buys.forEach((b, i) => close(feeOf(navs, b), g.fees[i], 'fee ' + b.date));
  });

  test('plan maths matches 3.1 (set ' + k + ')', () => {
    const args: Array<[number, number, number, number]> = [[194443, 20000, 0.12, 10], [2123643, 0, 0.08, 5], [0, 5000, 0.16, 30]];
    args.forEach((a, i) => {
      close(futureValue(a[0], a[1], a[2], a[3]), g.plan[i].fv, 'future value');
      assert.equal(monthsTo(a[0], a[1], a[2], 1e7), g.plan[i].eta);
      assert.equal(duration(monthsTo(a[0], a[1], a[2], 1e7)), g.plan[i].dur);
    });
  });

  test('formatting matches 3.1 (set ' + k + ')', () => {
    assert.equal(n0(1234567.6), g.fmt.n0); assert.equal(sg(-1344.01), g.fmt.sg); assert.equal(pc(-1.1), g.fmt.pc);
    assert.equal(big(2123643), g.fmt.big[0]); assert.equal(big(12345678), g.fmt.big[1]);
  });
}

test('dealing window and expected NAV date match 3.1', () => {
  for (const g of golden.dealing) {
    const d = new Date(g.t);
    assert.deepEqual(dealing(d), g.dealing, g.t);
    assert.equal(expectedDate(d), g.exp, g.t);
  }
});

test('merging prices respects deletions and hand-typed prices', () => {
  const base: Nav[] = [{ date: '2026-10-20', nav: 26.7 }, { date: '2026-10-21', nav: 26.8 }];
  // a deleted day never comes back from the network
  assert.equal(mergeNavs(base, [{ date: '2026-10-22', nav: 26.9 }], ['2026-10-22'], [], true).length, 2);
  // a hand-typed price is not overwritten by the network
  const kept = mergeNavs(base, [{ date: '2026-10-21', nav: 30 }], [], ['2026-10-21'], true);
  assert.equal(kept.find((x) => x.date === '2026-10-21')?.nav, 26.8);
  // but a hand edit itself does overwrite
  const edited = mergeNavs(base, [{ date: '2026-10-21', nav: 30 }], [], ['2026-10-21'], false);
  assert.equal(edited.find((x) => x.date === '2026-10-21')?.nav, 30);
  // junk rows are ignored and the result stays sorted
  const m = mergeNavs(base, [null, { date: '2026-10-19', nav: 26.5 }, { date: '2026-10-23', nav: 0 }], [], [], true);
  assert.deepEqual(m.map((x) => x.date), ['2026-10-19', '2026-10-20', '2026-10-21']);
});

test('no purchases means no rows, and the app does not crash on empty data', () => {
  assert.equal(buildRows([], []).length, 0);
  assert.deepEqual(windowPL([], 7), { p: 0, b: 0 });
  assert.deepEqual(rangeRows([], 7), []);
});

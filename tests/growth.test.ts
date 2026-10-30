// Growth over a period must not count money you put in, or accounts you simply added, as gains or losses.
import test from 'node:test';
import assert from 'node:assert/strict';
import { growth, monthChange, type Account } from '../src/lib/accounts';

const acc = (a: Partial<Account> & Pick<Account, 'id' | 'kind' | 'history'>): Account => ({ name: a.id, created: '2026-05-01', ...a });
const r0 = (n: number) => Math.round(n);

// Fund rows begin on the first purchase day (buildRows), so the first value already contains the deposit.
const fundBoughtThisMonth = [{ date: '2026-10-13', val: 196000 }, { date: '2026-10-23', val: 194443 }];
const boughtOct13 = [{ date: '2026-10-13', amount: 200000 }];

test('a fund bought this month is not counted as a 2 lakh loss (the reported Insights bug)', () => {
  const g = growth([], fundBoughtThisMonth, boughtOct13, '2026-09-30', '2026-10-29');
  // Put in 200,000, now worth 194,443: down 5,557 (the purchase fee plus the market move). Not down 2 lakh.
  assert.equal(r0(g.change), 194443 - 200000);
  assert.equal(r0(g.deposits), 200000);
  const fund = g.parts.find((p) => p.id === 'fund');
  assert.equal(r0(fund!.change), 194443 - 200000);
});

test('a fund held before the month: only the market move counts, new purchases do not', () => {
  const fund = [{ date: '2026-09-01', val: 100000 }, { date: '2026-09-30', val: 101000 }, { date: '2026-10-10', val: 152000 }, { date: '2026-10-28', val: 153500 }];
  const buys = [{ date: '2026-09-01', amount: 100000 }, { date: '2026-10-10', amount: 50000 }];
  const g = growth([], fund, buys, '2026-09-30', '2026-10-29');
  assert.equal(r0(g.change), 153500 - 101000 - 50000);
});

test('an account added during the period counts from its first balance, not as a gain', () => {
  const gold = acc({ id: 'gold', kind: 'gold', history: [{ date: '2026-10-05', value: 1500000 }] });
  const bank = acc({ id: 'mb', kind: 'bank', history: [{ date: '2026-09-02', value: 850000 }, { date: '2026-10-01', value: 905000 }] });
  const g = growth([gold, bank], [], [], '2026-09-30', '2026-10-29');
  assert.equal(r0(g.change), 905000 - 850000);
  assert.equal(r0(g.parts.find((p) => p.id === 'gold')!.change), 0);
});

test('paying a loan down is a gain; adding a loan is not a loss', () => {
  const car = acc({ id: 'car', kind: 'loan', history: [{ date: '2026-06-01', value: 900000 }, { date: '2026-10-01', value: 780000 }] });
  const card = acc({ id: 'card', kind: 'loan', history: [{ date: '2026-10-20', value: 40000 }] });
  const g = growth([car, card], [], [], '2026-09-30', '2026-10-29');
  assert.equal(r0(g.change), 120000);
});

test('accounts that start after the period are left out entirely', () => {
  const later = acc({ id: 'later', kind: 'bank', history: [{ date: '2026-11-03', value: 10000 }] });
  const g = growth([later], [], [], '2026-09-30', '2026-10-29');
  assert.equal(g.change, 0);
  assert.equal(g.parts.length, 0);
});

test('monthChange takes the purchases into account the same way', () => {
  const bank = acc({ id: 'mb', kind: 'bank', history: [{ date: '2026-09-30', value: 825000 }, { date: '2026-10-27', value: 850000 }] });
  const r = monthChange([bank], fundBoughtThisMonth, '2026-10-29', boughtOct13);
  assert.equal(r0(r.change), 25000 + (194443 - 200000));
});

test('the start date of the data is reported, so the app can say when tracking began', () => {
  const g = growth([], fundBoughtThisMonth, boughtOct13, '2026-09-30', '2026-10-29');
  assert.equal(g.started, '2026-10-13');
});

test('the percentage is measured on what you owned, so a big loan does not turn a small gain into 166%', () => {
  const bank = acc({ id: 'mb', kind: 'bank', history: [{ date: '2026-06-01', value: 820000 }, { date: '2026-10-01', value: 905000 }] });
  const car = acc({ id: 'car', kind: 'loan', history: [{ date: '2026-06-01', value: 900000 }, { date: '2026-10-01', value: 780000 }] });
  const g = growth([bank, car], fundBoughtThisMonth, boughtOct13, '2026-09-30', '2026-10-29');
  assert.equal(r0(g.change), 85000 + 120000 + (194443 - 200000));
  // net worth at the start was only 820,000 − 900,000 + 200,000 put in = 120,000; what you owned was 1,020,000
  assert.equal(r0(g.owned), 820000 + 200000);
  assert.ok(g.change / g.owned < 0.25);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { monthSummary } from '../src/lib/summary';
import type { Account } from '../src/lib/accounts';

const acc = (a: Partial<Account> & Pick<Account, 'id' | 'kind' | 'history'>): Account => ({ name: a.id, created: '2026-05-01', ...a });

test('summary names the month, the change and the account that moved it most', () => {
  const gold = acc({ id: 'g', name: 'Wedding gold', kind: 'gold', history: [{ date: '2026-09-01', value: 1000000 }, { date: '2026-10-20', value: 1080000 }] });
  const bank = acc({ id: 'b', name: 'Meezan savings', kind: 'bank', history: [{ date: '2026-09-01', value: 500000 }, { date: '2026-10-20', value: 505000 }] });
  const s = monthSummary([gold, bank], [], [], '2026-11-02')!;
  assert.equal(s.key, 'sum-2026-10');
  assert.equal(s.title, 'October in review');
  assert.match(s.body, /^October: up Rs 85,000 \(5\.7%\), mostly from Wedding gold\.$/);
});

test('no summary before there is anything from last month', () => {
  const bank = acc({ id: 'b', kind: 'bank', history: [{ date: '2026-11-01', value: 500000 }] });
  assert.equal(monthSummary([bank], [], [], '2026-11-02'), null);
});

test('money put in is left out of the summary', () => {
  const fund = [{ date: '2026-09-30', val: 100000 }, { date: '2026-10-31', val: 151000 }];
  const s = monthSummary([], fund, [{ date: '2026-10-10', amount: 50000 }], '2026-11-05')!;
  assert.match(s.body, /up Rs 1,000 .*Rs 50,000 you put in is not counted/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import golden from './golden.json';
import { parseSite, parseEmail, isoD } from '../src/lib/prices';
import { hashPin } from '../src/lib/lock';

test('Al Meezan page parses exactly like 3.1', () => {
  const html = readFileSync('tests/site_sample.html', 'utf8');
  assert.deepEqual(parseSite(html), golden.site);
});

test('pages without the fund table give nothing', () => {
  assert.equal(parseSite('<html>nothing here</html>'), null);
});

test('dates from the site', () => {
  assert.equal(isoD('28 Oct 2026'), '2026-10-28');
  assert.equal(isoD('3 Jan 2027'), '2027-01-03');
  assert.equal(isoD('soon'), null);
});

test('price email table', () => {
  const t = [
    '| Fund | Category | Validity | NAV | x | y | z | FYTD |',
    '| Meezan Balanced Fund | Balanced | 28 Oct 2026 | 27.0001 | a | b | c | -3.20 |',
    '| Meezan Cash Fund | MM | 28 Oct 2026 | 52.1 | a | b | c | 10.06 |',
  ].join('\n');
  const r = parseEmail(t);
  assert.equal(r?.date, '2026-10-28');
  assert.equal(r?.nav, 27.0001);
  assert.deepEqual(r?.items.map((i) => i.n), ['Money Market', 'Balanced (you)']);
});

test('PIN hashing is stable so existing PINs keep working', async () => {
  const a = await hashPin('1234', 'c2FsdA==');
  const b = await hashPin('1234', 'c2FsdA==');
  assert.equal(a, b);
  assert.equal(a, 'L5ljt06frxAVKFmu1p/+/EWWKqnFMF2axvkSLaPH+Xk=', 'same hash as Nivo 3.1');
  assert.notEqual(a, await hashPin('1235', 'c2FsdA=='));
});

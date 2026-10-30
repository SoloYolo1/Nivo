// bridge.html is served from the site in both GitHub Pages modes: the built site (public/ → dist/)
// and the branch root. The two copies must stay the same, or one of them goes stale.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('the bridge page at the repository root matches public/bridge.html', () => {
  const a = readFileSync('bridge.html', 'utf8'), b = readFileSync('public/bridge.html', 'utf8');
  assert.equal(a, b);
  assert.ok(a.includes('nv-import='), 'the app checks for this marker before opening the bridge');
});

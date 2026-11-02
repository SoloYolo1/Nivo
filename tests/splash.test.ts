// The start-up screen is painted by index.html before any script runs, from a copy of each theme's hero
// colours. These tests keep that copy, and the gradient it builds, the same as src/lib/palettes.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PALETTES, splashGradient } from '../src/lib/palettes';

const html = readFileSync('index.html', 'utf8');

test('index.html carries every theme’s hero colours and accent', () => {
  const m = /var P=(\{.*?\});/.exec(html);
  if (!m) throw new Error('no palette table in index.html');
  const table = JSON.parse(m[1]) as Record<string, string[]>;
  assert.deepEqual(Object.keys(table).sort(), PALETTES.map((p) => p.id).sort());
  for (const p of PALETTES) assert.deepEqual(table[p.id], [...p.hero, p.dark.a], p.id);
});

test('index.html builds the same splash gradient as the app', () => {
  const m = /"--sp-bg","linear-gradient\(155deg,"\+h\[2\]\+" 0%,"\+h\[3\]\+" 55%,#0b0b0e 100%\)"/.exec(html);
  assert.ok(m, 'gradient formula in index.html');
  const p = PALETTES[1];
  assert.equal(splashGradient(p), 'linear-gradient(155deg,' + p.hero[2] + ' 0%,' + p.hero[3] + ' 55%,#0b0b0e 100%)');
});

test('the boot and app splash screens fall back to Midnight', () => {
  assert.match(html, /#boot\{[^}]*var\(--sp-bg,linear-gradient\(155deg,#171b45 0%,#111428 55%,#0b0b0e 100%\)\)/);
  const css = readFileSync('src/styles/app.css', 'utf8');
  assert.match(css, /#splash\{[^}]*var\(--sp-bg,linear-gradient\(155deg,#171b45 0%,#111428 55%,#0b0b0e 100%\)\)/);
});

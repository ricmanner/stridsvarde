/**
 * Nyckeltalen räknas upp när befälet loggar in (Richard, 16 oktober, val A).
 *
 * En kort rörelse från noll till värdet. Kurvan bromsar in mot slutet, så att
 * det sista man ser före vila är talet självt, och talet visas med samma
 * antal decimaler hela vägen — 4,7 räknas 0,0 … 4,7, aldrig 4,6999.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import './setup.mjs';

test('börjar på noll och slutar exakt på värdet', async () => {
  const { uppraknat } = await import('../src/lib/rakna-upp.ts');
  assert.equal(uppraknat(0, 4.7, 1), 0);
  assert.equal(uppraknat(1, 4.7, 1), 4.7);
  assert.equal(uppraknat(1.4, 63, 0), 63, 'efter tiden står värdet still');
});

test('stiger hela vägen och bromsar in mot slutet', async () => {
  const { uppraknat } = await import('../src/lib/rakna-upp.ts');
  let forra = -1;
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const v = uppraknat(t, 63, 0);
    assert.ok(v >= forra, `sjönk vid ${t}`);
    forra = v;
  }
  // Mer än halva vägen efter en fjärdedel av tiden: inbromsning, inte jämn fart.
  assert.ok(uppraknat(0.25, 100, 0) > 50);
});

test('avrundas till lika många decimaler som det färdiga talet', async () => {
  const { uppraknat } = await import('../src/lib/rakna-upp.ts');
  for (let t = 0; t <= 1; t += 0.07) {
    const v = uppraknat(t, 4.7, 1);
    assert.equal(Math.round(v * 10) / 10, v, `${v} har fler än en decimal`);
    assert.equal(Number.isInteger(uppraknat(t, 3, 0)), true);
  }
});

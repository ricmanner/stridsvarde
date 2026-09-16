/**
 * Talformatet som visas för befäl och värnpliktiga.
 *
 * Appen visas för svenska befäl. "5.0" med punkt ser ut som en
 * felöversättning; svensk standard är decimalkomma.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import './setup.mjs';

test('snitt visas med decimalkomma och en decimal', async () => {
  const { formatScore } = await import('../src/lib/format.ts');

  assert.equal(formatScore(5), '5,0', 'heltal får en nolla efter kommat');
  assert.equal(formatScore(6.25), '6,3', 'avrundas till en decimal');
  assert.equal(formatScore(3.44), '3,4');
  assert.equal(formatScore(10), '10,0');
  assert.equal(formatScore(1), '1,0');

  // Ingen punkt får slinka igenom, oavsett värde på skalan.
  for (let v = 1; v <= 10; v += 0.37) {
    assert.ok(!formatScore(v).includes('.'), `${v} gav "${formatScore(v)}"`);
  }
});

/**
 * Förslaget på namn när en ny underenhet skapas i adminvyn.
 *
 * Var tidigare hårdkodat: alltid "Pluton 10" och "Grupp 4", oavsett vad som
 * fanns. Upptäckt när ett kompani med tre plutoner föreslog Pluton 10.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import './setup.mjs';

test('nästa nummer efter det som redan finns under enheten', async () => {
  const { suggestChildName } = await import('../src/lib/unit-names.ts');

  // Fallen som rapporterades.
  assert.equal(suggestChildName('pluton', ['Pluton 1', 'Pluton 2', 'Pluton 3']), 'Pluton 4');
  assert.equal(suggestChildName('grupp', []), 'Grupp 1', 'en ny tom pluton börjar på Grupp 1');

  assert.equal(suggestChildName('kompani', ['1. Kompaniet', '2. Kompaniet', '3. Kompaniet']), '4. Kompaniet');
  assert.equal(suggestChildName('pluton', []), 'Pluton 1');
});

test('föreslår aldrig ett namn som redan finns', async () => {
  const { suggestChildName } = await import('../src/lib/unit-names.ts');

  /*
   * Demon numrerar plutonerna över hela bataljonen: 2. Kompaniet har Pluton
   * 4, 5 och 6. "Antal plus ett" hade föreslagit Pluton 4 där — som finns.
   */
  assert.equal(suggestChildName('pluton', ['Pluton 4', 'Pluton 5', 'Pluton 6']), 'Pluton 7');

  // Små bokstäver är samma namn för den som läser listan.
  assert.equal(suggestChildName('pluton', ['Pluton 1', 'Pluton 2', 'Pluton 3', 'pluton 4']), 'Pluton 5');

  // En lucka fylls inte; nästa efter det högsta.
  assert.equal(suggestChildName('grupp', ['Grupp 1', 'Grupp 3']), 'Grupp 4');

  // Ett namn utan nummer räknas inte, men krockar inte heller.
  assert.equal(suggestChildName('grupp', ['Sjukvårdsgrupp']), 'Grupp 1');
});

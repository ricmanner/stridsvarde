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
  assert.equal(suggestChildName('pluton', ['1. pluton', '2. pluton', '3. pluton']), '4. pluton');
  assert.equal(suggestChildName('grupp', []), '1. grupp', 'en ny tom pluton börjar på 1. grupp');

  assert.equal(suggestChildName('kompani', ['1. kompani', '2. kompani', '3. kompani']), '4. kompani');
  assert.equal(suggestChildName('pluton', []), '1. pluton');
});

/*
 * Namnen skrivs som Försvarsmakten skriver dem: siffra med punkt före ordet,
 * "1. plut/1. komp" (FAL-A, FM2019-26245:1). Appen föreslog "Pluton 4" och
 * "Grupp 1" medan kompanierna hette "1. Kompaniet" — två skrivsätt för samma
 * sak. Obestämd form — "1. pluton", inte "1. plutonen" — på Richards
 * beslut.
 */
test('förslagen skrivs som Försvarsmakten skriver förband', async () => {
  const { suggestChildName } = await import('../src/lib/unit-names.ts');

  assert.equal(suggestChildName('kompani', []), '1. kompani');
  assert.equal(suggestChildName('pluton', []), '1. pluton');
  assert.equal(suggestChildName('grupp', []), '1. grupp');
});

test('föreslår aldrig ett namn som redan finns', async () => {
  const { suggestChildName } = await import('../src/lib/unit-names.ts');

  // Små bokstäver är samma namn för den som läser listan.
  assert.equal(suggestChildName('pluton', ['1. pluton', '2. pluton', '3. Pluton']), '4. pluton');

  // En lucka fylls inte; nästa efter det högsta.
  assert.equal(suggestChildName('grupp', ['1. grupp', '3. grupp']), '4. grupp');

  // Ett namn utan nummer räknas inte, men krockar inte heller.
  assert.equal(suggestChildName('grupp', ['Sjukvårdsgrupp']), '1. grupp');

  // Namn i det gamla skrivsättet räknas fortfarande: nästa efter Pluton 3.
  assert.equal(suggestChildName('pluton', ['Pluton 1', 'Pluton 2', 'Pluton 3']), '4. pluton');
});

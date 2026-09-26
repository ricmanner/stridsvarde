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
  assert.equal(suggestChildName('pluton', ['1. plutonen', '2. plutonen', '3. plutonen']), '4. plutonen');
  assert.equal(suggestChildName('grupp', []), '1. gruppen', 'en ny tom pluton börjar på 1. gruppen');

  assert.equal(suggestChildName('kompani', ['1. kompaniet', '2. kompaniet', '3. kompaniet']), '4. kompaniet');
  assert.equal(suggestChildName('pluton', []), '1. plutonen');
});

/*
 * Namnen skrivs som Försvarsmakten skriver dem: siffra med punkt före ordet,
 * "1. plut/1. komp" (FAL-A, FM2019-26245:1). Appen föreslog "Pluton 4" och
 * "Grupp 1" medan kompanierna hette "1. Kompaniet" — två skrivsätt för samma
 * sak. Bestämd form, som det sägs: "första plutonen".
 */
test('förslagen skrivs som Försvarsmakten skriver förband', async () => {
  const { suggestChildName } = await import('../src/lib/unit-names.ts');

  assert.equal(suggestChildName('kompani', []), '1. kompaniet');
  assert.equal(suggestChildName('pluton', []), '1. plutonen');
  assert.equal(suggestChildName('grupp', []), '1. gruppen');
});

test('föreslår aldrig ett namn som redan finns', async () => {
  const { suggestChildName } = await import('../src/lib/unit-names.ts');

  // Små bokstäver är samma namn för den som läser listan.
  assert.equal(suggestChildName('pluton', ['1. plutonen', '2. plutonen', '3. Plutonen']), '4. plutonen');

  // En lucka fylls inte; nästa efter det högsta.
  assert.equal(suggestChildName('grupp', ['1. gruppen', '3. gruppen']), '4. gruppen');

  // Ett namn utan nummer räknas inte, men krockar inte heller.
  assert.equal(suggestChildName('grupp', ['Sjukvårdsgrupp']), '1. gruppen');

  // Namn i det gamla skrivsättet räknas fortfarande: nästa efter Pluton 3.
  assert.equal(suggestChildName('pluton', ['Pluton 1', 'Pluton 2', 'Pluton 3']), '4. plutonen');
});

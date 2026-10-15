/**
 * Ett tryck på skalan blir en siffra.
 *
 * Reglaget börjar tomt sedan den 15 oktober, och det första trycket ska ge
 * den siffra man trycker på. Webbläsaren gör det själv på en dator, men inte
 * i iPhones Safari, där ett reglage bara flyttas genom att man drar i tummen
 * — och ett tomt reglage har ingen tumme att dra i. Därför räknar appen ut
 * siffran själv. Räkningen måste stämma med var webbläsaren ritar tummen:
 * dess mittpunkt rör sig mellan en halv tumbredd från vardera kanten.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import './setup.mjs';

const BREDD = 342; // reglaget i telefonbredd
const TUMME = 28;

test('kanterna ger 1 och 10, också en bit utanför', async () => {
  const { vardeVidTryck } = await import('../src/lib/reglage.ts');
  assert.equal(vardeVidTryck(0, BREDD, TUMME), 1);
  assert.equal(vardeVidTryck(-20, BREDD, TUMME), 1);
  assert.equal(vardeVidTryck(BREDD, BREDD, TUMME), 10);
  assert.equal(vardeVidTryck(BREDD + 20, BREDD, TUMME), 10);
});

test('ett tryck mitt på en siffras plats ger den siffran', async () => {
  const { vardeVidTryck } = await import('../src/lib/reglage.ts');
  for (let v = 1; v <= 10; v++) {
    const x = TUMME / 2 + ((BREDD - TUMME) * (v - 1)) / 9;
    assert.equal(vardeVidTryck(x, BREDD, TUMME), v, `siffran ${v}`);
  }
});

test('under dragningen följer knappen fingret, mellan siffrorna', async () => {
  /*
   * Knappen står där fingret är medan man drar och glider till närmaste
   * siffra när man släpper. Annars hackar den, eller släpar efter (Richard,
   * iPhone, 15 oktober). Andelen är var på spåret knappens mitt står, 0–1.
   */
  const { andelVidTryck } = await import('../src/lib/reglage.ts');
  assert.equal(andelVidTryck(TUMME / 2, BREDD, TUMME), 0);
  assert.equal(andelVidTryck(BREDD - TUMME / 2, BREDD, TUMME), 1);
  assert.equal(andelVidTryck(BREDD / 2, BREDD, TUMME), 0.5);
  assert.equal(andelVidTryck(-50, BREDD, TUMME), 0);
  assert.equal(andelVidTryck(BREDD + 50, BREDD, TUMME), 1);
});

/**
 * Vilka stödkontakter en värnpliktig med röda värden får se först.
 *
 * Tidigare fick alla samma lista, så den som sovit och ätit dåligt möttes av
 * Självmordslinjen men aldrig av Försvarshälsan. Nu styr de röda värdena
 * ordningen — men ingenting får försvinna.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import './setup.mjs';

const ALLA = ['fysisk', 'psykisk', 'social', 'somn', 'kost', 'energi'];
const SINNE = ['psykisk', 'social'];

/** Alla 64 kombinationer av vilka kategorier som är röda. */
function kombinationer() {
  const ut = [];
  for (let m = 0; m < 1 << ALLA.length; m++) ut.push(ALLA.filter((_, i) => m & (1 << i)));
  return ut;
}

const namn = (plan) => [...plan.primary, ...plan.secondary].map((c) => c.name);

test('inget rött värde ger inget stödblock', async () => {
  const { supportPlan } = await import('../src/lib/support.ts');
  assert.equal(supportPlan([]), null);
});

test('ingen kontakt försvinner, oavsett vilka värden som är röda', async () => {
  const { supportPlan, NATIONAL_CONTACTS, HEALTH_SERVICE_CONTACT } = await import(
    '../src/lib/support.ts'
  );

  /*
   * Den viktigaste regeln. Någon kan må dåligt psykiskt och ändå svara högt
   * på den frågan — då ska 112 och Självmordslinjen fortfarande stå där, bara
   * längre ned.
   */
  const forvantade = [...NATIONAL_CONTACTS, HEALTH_SERVICE_CONTACT].map((c) => c.name).sort();

  for (const rott of kombinationer().filter((k) => k.length > 0)) {
    const plan = supportPlan(rott);
    assert.deepEqual(namn(plan).sort(), forvantade, `saknas något för [${rott}]`);
    assert.equal(new Set(namn(plan)).size, namn(plan).length, `dubbletter för [${rott}]`);
  }
});

test('psykiskt eller socialt rött: stödlinjerna först', async () => {
  const { supportPlan } = await import('../src/lib/support.ts');

  for (const rott of kombinationer().filter((k) => k.some((c) => SINNE.includes(c)))) {
    const forsta = supportPlan(rott).primary.map((c) => c.name);
    assert.ok(forsta.includes('Självmordslinjen'), `[${rott}] saknar Självmordslinjen överst`);
    assert.ok(forsta.includes('Akut fara'), `[${rott}] saknar 112 överst`);
  }
});

test('bara kropp, sömn, kost eller energi röd: Försvarshälsan först, inte Självmordslinjen', async () => {
  const { supportPlan, HEALTH_SERVICE_CONTACT } = await import('../src/lib/support.ts');

  const baraKropp = kombinationer().filter((k) => k.length > 0 && !k.some((c) => SINNE.includes(c)));
  assert.equal(baraKropp.length, 15, 'fyra kategorier ger femton icke-tomma kombinationer');

  for (const rott of baraKropp) {
    const plan = supportPlan(rott);
    assert.equal(plan.primary[0].name, HEALTH_SERVICE_CONTACT.name, `[${rott}]`);
    assert.ok(
      !plan.primary.some((c) => c.name === 'Självmordslinjen'),
      `[${rott}] ska inte ha Självmordslinjen överst`,
    );
    assert.ok(plan.secondaryLabel, `[${rott}] resten måste ha en rubrik`);
  }
});

test('Försvarshälsan visas utan påhittat telefonnummer', async () => {
  const { HEALTH_SERVICE_CONTACT } = await import('../src/lib/support.ts');
  // Numret skiljer sig mellan förband. Ett gissat nummer är värre än inget.
  assert.equal(HEALTH_SERVICE_CONTACT.phone, undefined);
});

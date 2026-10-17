/**
 * Vilka stödkontakter en värnpliktig med röda värden får se först.
 *
 * Tidigare fick alla samma lista, så den som sovit och ätit dåligt möttes av
 * Självmordslinjen men aldrig av Försvarshälsan. Nu styr de röda värdena
 * ordningen — men ingenting får försvinna.
 *
 * Sedan den 15 oktober är numren avstängda (fysioterapeuternas önskemål,
 * Richards beslut). Testerna med `{ nummer: true }` gäller läget när de slås
 * på igen; de längst ned gäller läget som är ute nu.
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
    const plan = supportPlan(rott, { nummer: true });
    assert.deepEqual(namn(plan).sort(), forvantade, `saknas något för [${rott}]`);
    assert.equal(new Set(namn(plan)).size, namn(plan).length, `dubbletter för [${rott}]`);
  }
});

test('psykiskt eller socialt rött: stödlinjerna först', async () => {
  const { supportPlan } = await import('../src/lib/support.ts');

  for (const rott of kombinationer().filter((k) => k.some((c) => SINNE.includes(c)))) {
    const forsta = supportPlan(rott, { nummer: true }).primary.map((c) => c.name);
    assert.ok(forsta.includes('Självmordslinjen'), `[${rott}] saknar Självmordslinjen överst`);
    assert.ok(forsta.includes('Akut fara'), `[${rott}] saknar 112 överst`);
  }
});

test('bara kropp, sömn, kost eller energi röd: Försvarshälsan först, inte Självmordslinjen', async () => {
  const { supportPlan, HEALTH_SERVICE_CONTACT } = await import('../src/lib/support.ts');

  const baraKropp = kombinationer().filter((k) => k.length > 0 && !k.some((c) => SINNE.includes(c)));
  assert.equal(baraKropp.length, 15, 'fyra kategorier ger femton icke-tomma kombinationer');

  for (const rott of baraKropp) {
    const plan = supportPlan(rott, { nummer: true });
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

test('beslutet den 15 oktober: inga nummer och inga samtalsknappar', async () => {
  /*
   * Fysioterapeuterna: appen ska inte bli en kommunikationskanal mellan
   * värnpliktiga och befäl, och vägen till vård går via befälet. Faller det
   * här testet har någon slagit på en av dem igen — gör det med flit.
   */
  const { VISA_STODNUMMER, SAMTALSBEGARAN_PA } = await import('../src/lib/support.ts');
  assert.equal(VISA_STODNUMMER, false);
  assert.equal(SAMTALSBEGARAN_PA, false);
});

test('utan nummer finns rutan kvar, med text men utan kontakter', async () => {
  const { supportPlan } = await import('../src/lib/support.ts');

  for (const rott of kombinationer().filter((k) => k.length > 0)) {
    for (const plan of [supportPlan(rott, { nummer: false }), supportPlan(rott)]) {
      assert.deepEqual(namn(plan), [], `[${rott}] ska inte visa några kontakter`);
      assert.ok(plan.intro.length > 0, `[${rott}] ska ha en text`);
    }
  }
  assert.equal(supportPlan([], { nummer: false }), null, 'inget rött ger ingen ruta');
});

test('råden hänvisar till befälet, inte till krisstöd eller sjukvårdaren direkt', async () => {
  const { getSoldierTips } = await import('../src/lib/advice.ts');

  const allaRoda = Object.fromEntries(ALLA.map((c) => [c, 1]));
  const rad = getSoldierTips(allaRoda).flatMap((t) => t.tips).join('\n');

  // Krisstödet hade numren i stödrutan att peka på; de är borta.
  assert.doesNotMatch(rad, /krisstöd/i);
  // Vägen till vård går via befälet, enligt fysioterapeuterna.
  assert.doesNotMatch(rad, /Kontakta kompaniets sjukvårdare/);
  assert.match(rad, /Säg till ditt befäl direkt om det känns akut/);
  assert.match(rad, /Säg till ditt befäl, som ordnar kontakt med sjukvården/);
});

test('stödrutans inledning räknar rätt och nämner bara det som är lågt', async () => {
  // Externa granskare, 17 oktober: "Några av dina värden är låga. Brist på
  // sömn, mat och återhämtning…" stod också när bara sömnen var röd.
  const { supportPlan } = await import('../src/lib/support.ts');
  const en = supportPlan(['somn']).intro;
  assert.match(en, /^Ett av dina värden är lågt\./);
  assert.doesNotMatch(en, /mat/);
  const tva = supportPlan(['somn', 'kost']).intro;
  assert.match(tva, /^Några av dina värden är låga\./);
  assert.match(tva, /sömn/);
  assert.match(tva, /mat/);
});

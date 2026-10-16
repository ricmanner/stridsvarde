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

test('ett enstaka datum skrivs som en människa läser det', async () => {
  const { fullDateLabel } = await import('../src/lib/date.ts');

  // Adminsidans "äldsta uppgift" visade råa 2026-09-08 — appens enda
  // maskindatum framför en läsare. Allt annat formateras på svenska.
  assert.equal(fullDateLabel('2026-09-08'), '8 september 2026');
  assert.equal(fullDateLabel('2026-01-01'), '1 januari 2026');
  assert.equal(fullDateLabel('2025-12-31'), '31 december 2025');

  // Får inte hoppa en dag kring sommartidsomställningarna.
  assert.equal(fullDateLabel('2026-03-29'), '29 mars 2026');
  assert.equal(fullDateLabel('2026-10-25'), '25 oktober 2026');
});

/*
 * Antal och böjning hör ihop.
 *
 * Fyra ställen satte ihop ett tal med ett substantiv i plural och lät
 * participet stå kvar i plural: "1 incheckning raderade", "1 rapporter
 * raderade", "1 poster är äldre än så", "1 incheckningar gjorda efter
 * historiken". Siffran ett är inte ovanlig i något av dem — en administratör
 * som raderar en persons svar ser den nästan alltid.
 */
test('ett antal böjer både substantivet och participet efter talet', async () => {
  const { antal } = await import('../src/lib/format.ts');

  assert.equal(antal(1, 'incheckning raderad', 'incheckningar raderade'), '1 incheckning raderad');
  assert.equal(antal(3, 'incheckning raderad', 'incheckningar raderade'), '3 incheckningar raderade');

  // Noll tar plural på svenska: "0 uppgifter", inte "0 uppgift".
  assert.equal(antal(0, 'uppgift', 'uppgifter'), '0 uppgifter');
  assert.equal(antal(2, 'underenhet', 'underenheter'), '2 underenheter');
});

/*
 * Procenttecknet har ett mellanslag före sig.
 *
 * Svensk skrivregel, och appen följde den på två ställen av sex:
 * utskriftsrapporten och larmtexten skrev "78 %", medan befälsvyn, den
 * värnpliktiges vy och incheckningens framstegsrad skrev "78%".
 */
test('procent skrivs med mellanslag före tecknet', async () => {
  const { procent } = await import('../src/lib/format.ts');

  assert.equal(procent(78), '78 %');
  assert.equal(procent(0), '0 %');
  assert.equal(procent(100), '100 %');
});

/*
 * Förändringen mot perioden före, skriven på ett ställe.
 *
 * Befälsvyns kategoritabell hade regeln för sig själv. När rapporten fick
 * samma kolumn (16 oktober) flyttades den hit, så att skärm och papper inte
 * kan säga olika om samma tal.
 */
test('förändringen: pil från ett halvt steg, räknad på de visade talen', async () => {
  const { forandring } = await import('../src/lib/format.ts');
  assert.deepEqual(forandring(5.3, 6.0), { steg: -0.7, riktning: 'ned', text: '↓ 0,7' });
  assert.deepEqual(forandring(4.7, 4.1), { steg: 0.6, riktning: 'upp', text: '↑ 0,6' });
  assert.equal(forandring(3.3, 3.6).text, '−0,3');
  assert.equal(forandring(3.6, 3.5).text, '+0,1');
  assert.equal(forandring(5.7, 5.7).text, '±0,0');
  // 4,96 visas som 5,0 och 4,54 som 4,5: steget är 0,5, inte 0,42.
  assert.equal(forandring(4.96, 4.54).riktning, 'upp');
});

test('kategorinamn räknas upp med "samt" när ett namn själv innehåller "och"', async () => {
  const { uppräkningSamt } = await import('../src/lib/format.ts');
  assert.equal(uppräkningSamt(['sömn']), 'sömn');
  assert.equal(uppräkningSamt(['sömn', 'energinivå']), 'sömn och energinivå');
  assert.equal(uppräkningSamt(['sömn', 'kost och näring']), 'sömn samt kost och näring');
  assert.equal(uppräkningSamt(['sömn', 'hälsa', 'energinivå']), 'sömn, hälsa och energinivå');
});

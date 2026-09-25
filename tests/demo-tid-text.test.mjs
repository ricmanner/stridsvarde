/**
 * Vad statussidan säger om demodatans ålder.
 *
 * Själva flytten är testad i demo-tid.test.mjs. Det här testar bedömningen:
 * när ska administratören uppmanas att trycka, och vad ska hen få veta innan
 * hen gör det. Texten är det enda en besökare ser, och den ska stämma med vad
 * knappen faktiskt gör.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

// Ingen databas behövs här — men uppsättningen registrerar resolvern som
// låter en .mjs-fil importera appens .ts-moduler.
import './setup.mjs';

const { beskrivDemoTidslinje } = await import('../src/lib/db/demo-timeline.ts');

/** En plan som planDemoTimeline() skulle ha returnerat. */
const plan = (over) => ({
  idag: '2026-11-20',
  senasteHistorikdag: '2026-11-20',
  dagar: 0,
  efterHistoriken: 0,
  flyttas: 1200,
  ...over,
});

test('aktuell data behöver ingen knapp', () => {
  const b = beskrivDemoTidslinje(plan());

  assert.equal(b.aktuell, true);
  assert.match(b.text, /aktuell/i);
});

test('en dag efter är inte värt att larma om', () => {
  // Befälsvyns kortaste period är sju dagar. En dags glapp syns inte i någon
  // vy, och en knapp som alltid lyser slutar man se.
  const b = beskrivDemoTidslinje(plan({ dagar: 1, senasteHistorikdag: '2026-11-19' }));

  assert.equal(b.aktuell, true);
});

test('en vecka gammal data ska flyttas fram', () => {
  const b = beskrivDemoTidslinje(plan({ dagar: 7, senasteHistorikdag: '2026-11-13' }));

  assert.equal(b.aktuell, false);
  assert.match(b.text, /7 dagar/);
});

test('tre veckor gammal data säger att vyerna är tomma', () => {
  // Efter 21 dagar är även den längsta perioden tom. Då räcker det inte att
  // säga att datan är gammal — då är demon obrukbar, och det ska stå.
  const b = beskrivDemoTidslinje(plan({ dagar: 22, senasteHistorikdag: '2026-10-29' }));

  assert.equal(b.aktuell, false);
  assert.match(b.text, /tom|obrukbar/i);
});

test('en databas utan historik varken larmar eller lovar något', () => {
  // Ingen seedad demo. Knappen skulle inte ha något att flytta.
  const b = beskrivDemoTidslinje(plan({ senasteHistorikdag: null, flyttas: 0 }));

  assert.equal(b.aktuell, true);
  assert.match(b.text, /ingen seedad historik/i);
});

test('incheckningar gjorda efter historiken nämns, för de försvinner', () => {
  // Besökare som provat demon har lagt till rader efter historikens slut.
  // Flytten raderar dem, och det ska stå innan någon trycker.
  const b = beskrivDemoTidslinje(plan({ dagar: 9, senasteHistorikdag: '2026-11-11', efterHistoriken: 3 }));

  assert.equal(b.aktuell, false);
  assert.match(b.text, /3/);
  assert.match(b.text, /raderas|tas bort/i);
});

test('en enda incheckning efter historiken nämns i singular', () => {
  // Siffran ett är det vanliga fallet här: någon har provat demon en gång
  // efter att historiken tagit slut. Då stod det "1 incheckningar gjorda".
  const b = beskrivDemoTidslinje(plan({ dagar: 9, senasteHistorikdag: '2026-11-11', efterHistoriken: 1 }));

  assert.match(b.text, /1 incheckning gjord /, 'ett i singular');
  assert.ok(!/1 incheckningar/.test(b.text), 'plural efter ettan');
});

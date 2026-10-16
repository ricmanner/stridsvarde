/**
 * Vad siffrorna betyder — texten under reglaget och listan bakom info-knappen.
 *
 * Fysioterapeuterna bad om det den 14 oktober, med appen Readiness Advisor
 * som förebild. Kravet som testas här är att texten aldrig säger emot färgen:
 * en fyra är gul, och då ska texten för en fyra vara den gula. Därför följer
 * nivåerna GREEN_MIN och YELLOW_MIN, inte egna gränser.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import './setup.mjs';

const ALLA = ['fysisk', 'psykisk', 'social', 'somn', 'kost', 'energi'];

test('varje fråga har en text för varje färg', async () => {
  const { SKALA } = await import('../src/lib/skala.ts');
  for (const cat of ALLA) {
    for (const status of ['red', 'yellow', 'green']) {
      assert.ok(SKALA[cat]?.[status]?.length > 10, `${cat}/${status} saknar text`);
    }
  }
});

test('texten under reglaget har samma färg som siffran', async () => {
  const { SKALA, skaltext } = await import('../src/lib/skala.ts');
  const { getStatus } = await import('../src/lib/data.ts');
  for (const cat of ALLA) {
    for (let v = 1; v <= 10; v++) {
      assert.equal(skaltext(cat, v), SKALA[cat][getStatus(v)], `${cat} ${v}`);
    }
  }
});

test('listan bakom info-knappen täcker 1–10 utan lucka, och varje rad har en färg', async () => {
  const { skalnivaer, skaltext } = await import('../src/lib/skala.ts');
  const { getStatus } = await import('../src/lib/data.ts');

  for (const cat of ALLA) {
    const nivaer = skalnivaer(cat);
    assert.deepEqual(
      nivaer.map((n) => `${n.fran}–${n.till}`),
      ['1–3', '4–6', '7–10'],
      'ordningen följer reglaget, från vänster',
    );
    for (const n of nivaer) {
      for (let v = n.fran; v <= n.till; v++) {
        assert.equal(getStatus(v), n.status, `${cat} ${v} ligger i fel färg`);
        assert.equal(skaltext(cat, v), n.text, `${cat} ${v}: listan och reglaget säger olika`);
      }
    }
  }
});

test('skalan beskriver, utan "du" och utan omdöme om tjänsten', async () => {
  /*
   * Richard, 16 oktober: om någon kan tjänstgöra avgör befälet och
   * sjukvården, inte den värnpliktige — "du klarar tjänsten" sa annat. Och
   * korta beskrivningar som i Readiness Advisor, inte meningar riktade till
   * läsaren.
   */
  const { SKALA } = await import('../src/lib/skala.ts');
  for (const [kategori, nivaer] of Object.entries(SKALA)) {
    for (const [status, text] of Object.entries(nivaer)) {
      assert.doesNotMatch(text, /\b[Dd]u\b|\bdig\b|\bdin\b/, `${kategori}/${status}: "${text}"`);
      assert.doesNotMatch(text, /tjänst/i, `${kategori}/${status}: "${text}"`);
    }
  }
});

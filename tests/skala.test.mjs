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

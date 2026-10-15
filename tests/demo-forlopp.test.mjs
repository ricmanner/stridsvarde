/**
 * Demodatans förlopp: vad varje pluton har varit med om de senaste tre
 * veckorna.
 *
 * Fysioterapeuterna sa den 14 oktober att befälsvyns kurvor var "raka
 * sträck" och att jämförelserna mellan plutoner och kompanier var för vaga.
 * Uppmätt den 15 oktober: varje plutons dagliga snitt rörde sig 0,4–0,6 på
 * två veckor, och kompaniernas 0,3–0,4. Demon kunde alltså inte visa det
 * appen är till för — att något förändras.
 *
 * Testerna håller historierna: tar någon bort fältövningen eller gör
 * kompanierna lika igen, faller de.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import './setup.mjs';

const KATEGORIER = ['fysisk', 'psykisk', 'social', 'somn', 'kost', 'energi'];
const DAGAR = 21;
const dagar = (fran, till) => Array.from({ length: fran - till + 1 }, (_, i) => fran - i);
const snitt = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

test('tre veckors historik, så att alla perioder i befälsvyn är fyllda', async () => {
  const { HISTORIK_DAGAR } = await import('../src/lib/demo-forlopp.ts');
  assert.equal(HISTORIK_DAGAR, 21);
});

test('varje värde ligger på skalan', async () => {
  const { forlopp } = await import('../src/lib/demo-forlopp.ts');
  for (let p = 1; p <= 9; p++) {
    for (const k of KATEGORIER) {
      for (let d = 0; d < DAGAR; d++) {
        const v = forlopp(p, k, d);
        assert.ok(v >= 1 && v <= 10, `pluton ${p}, ${k}, dag ${d}: ${v}`);
      }
    }
  }
});

test('1. kompani, 1. pluton: fältövning för en vecka sedan, sömnen rasar och kommer delvis tillbaka', async () => {
  const { forlopp } = await import('../src/lib/demo-forlopp.ts');
  const somn = (d) => forlopp(1, 'somn', d);
  assert.ok(somn(20) > 4.5, 'före övningen');
  assert.ok(Math.min(...dagar(9, 5).map(somn)) < 2.8, 'under övningen');
  assert.ok(somn(0) > Math.min(...dagar(9, 5).map(somn)) + 1, 'på väg tillbaka');
  // Den senaste veckan ligger sömn och kost fortfarande i rött — det är det
  // larmet i befälsvyn bygger på.
  for (const k of ['somn', 'kost']) {
    assert.ok(snitt(dagar(6, 0).map((d) => forlopp(1, k, d))) < 4, `${k} ska vara röd senaste veckan`);
  }
});

test('1. kompani, 2. pluton: psykiskt mående och trivsel sjunker sakta i tre veckor', async () => {
  const { forlopp } = await import('../src/lib/demo-forlopp.ts');
  for (const k of ['psykisk', 'social']) {
    assert.ok(forlopp(2, k, 20) >= 6, `${k} började gult eller grönt`);
    assert.ok(forlopp(2, k, 0) < 4.5, `${k} är nära rött idag`);
    for (let d = 20; d > 0; d--) {
      assert.ok(forlopp(2, k, d - 1) <= forlopp(2, k, d), `${k} ska inte vända uppåt, dag ${d}`);
    }
  }
});

test('2. kompani, 1. pluton: återhämtar sig efter en tung period', async () => {
  const { forlopp } = await import('../src/lib/demo-forlopp.ts');
  const dag = (d) => snitt(KATEGORIER.map((k) => forlopp(4, k, d)));
  assert.ok(dag(20) < 5, 'tungt i början');
  assert.ok(dag(0) > 6.5, 'bra idag');
});

test('2. kompani, 3. pluton: fysisk belastning efter en marsch de senaste dagarna', async () => {
  const { forlopp } = await import('../src/lib/demo-forlopp.ts');
  assert.ok(forlopp(6, 'fysisk', 8) > 6, 'före marschen');
  for (const d of dagar(2, 0)) assert.ok(forlopp(6, 'fysisk', d) < 4.5, `efter marschen, dag ${d}`);
});

test('plutonerna med en historia har kurvor som rör sig — inte raka sträck', async () => {
  const { forlopp } = await import('../src/lib/demo-forlopp.ts');
  for (const p of [1, 2, 4, 6]) {
    const dagsnitt = dagar(DAGAR - 1, 0).map((d) => snitt(KATEGORIER.map((k) => forlopp(p, k, d))));
    const spann = Math.max(...dagsnitt) - Math.min(...dagsnitt);
    assert.ok(spann >= 1, `pluton ${p} rör sig bara ${spann.toFixed(2)} — förut 0,4–0,6`);
  }
});

test('kompanierna skiljer sig åt, med 3. kompani bäst', async () => {
  const { forlopp } = await import('../src/lib/demo-forlopp.ts');
  const kompani = (plutoner) =>
    snitt(plutoner.flatMap((p) => KATEGORIER.flatMap((k) => dagar(DAGAR - 1, 0).map((d) => forlopp(p, k, d)))));
  const [k1, k2, k3] = [kompani([1, 2, 3]), kompani([4, 5, 6]), kompani([7, 8, 9])];
  assert.ok(k1 + 0.5 <= k2, `1. kompani ${k1.toFixed(1)} mot 2. kompani ${k2.toFixed(1)}`);
  assert.ok(k2 + 0.5 <= k3, `2. kompani ${k2.toFixed(1)} mot 3. kompani ${k3.toFixed(1)}`);
});

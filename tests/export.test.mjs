/**
 * Exportfilen som befälet öppnar i Excel.
 *
 * Den ska innehålla samma siffror som skärmen — inte beräkningens fulla
 * precision — och den ska inte kunna köra formler när den öppnas.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import './setup.mjs';

test('siffrorna i filen är desamma som i vyn', async () => {
  const { toCsv, scoreCell } = await import('../src/lib/csv.ts');
  const { formatScore } = await import('../src/lib/format.ts');

  const snitt = 6.043478260869565;
  const rader = toCsv(
    ['Datum', 'Svarande', 'Snitt'],
    [['2026-09-12', 23, scoreCell(snitt)]],
  ).split('\r\n');

  assert.equal(rader[1], '2026-09-12;23;6,0', 'en decimal, decimalkomma, antal orört');
  assert.equal(rader[1].split(';').at(-1), formatScore(snitt), 'samma tal som skärmen visar');

  // Undanhållet blir ett tomt fält, inte en nolla.
  assert.equal(scoreCell(null), null);
  assert.equal(scoreCell(undefined), null);
  assert.equal(toCsv(['a'], [[scoreCell(null)]]).split('\r\n')[1], '');

  // Ett jämnt värde får ändå sin decimal, så kolumnen ser likadan ut hela vägen.
  assert.equal(scoreCell(5), '5,0');
});

test('ett enhetsnamn kan inte smuggla in en formel i Excel', async () => {
  const { toCsv } = await import('../src/lib/csv.ts');

  const rad = toCsv(['Enhet'], [['=HYPERLINK("http://elak.example","klicka")']]).split('\r\n')[1];
  assert.ok(rad.startsWith('"\''), 'formeltecknet neutraliseras med apostrof');
});

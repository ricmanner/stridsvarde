/**
 * Kodlappen i adminvyn.
 *
 * En utfärdad kod visas exakt en gång och går aldrig att få fram igen — bara
 * hashen sparas. Visas lappen inte är personen utelåst utan att någon märker
 * det. Testerna nedan bevakar just det fallet.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import './setup.mjs';

const kod = (code, label = 'Värnpliktig 01') => ({ label, code });

test('en ny lapp visas även när den förra hade lika många koder', async () => {
  const { kodnyckel, visaKodlapp } = await import('../src/lib/kodlapp.ts');

  // Administratören byter kod åt en person och stänger lappen.
  const forsta = [kod('ABCDE-FGHJK')];
  assert.equal(visaKodlapp(forsta, ''), true, 'första lappen visas');
  const stangd = kodnyckel(forsta);
  assert.equal(visaKodlapp(forsta, stangd), false, 'stängd lapp stannar stängd');

  // Byter sedan kod åt NÄSTA person i samma enhet. Lika många koder, lika
  // långa — men en annan kod, och lappen måste visas.
  const andra = [kod('MNPQR-STUVW', 'Värnpliktig 02')];
  assert.equal(kodnyckel(andra).length, kodnyckel(forsta).length, 'lika långa, som i verkligheten');
  assert.equal(visaKodlapp(andra, stangd), true, 'den andra personens kod får inte tappas bort');
});

test('flera koder på en gång räknas som en lapp', async () => {
  const { kodnyckel, visaKodlapp } = await import('../src/lib/kodlapp.ts');

  const parti = [kod('AAAAA-BBBBB'), kod('CCCCC-DDDDD', 'Värnpliktig 02')];
  assert.equal(kodnyckel(parti), 'AAAAA-BBBBB|CCCCC-DDDDD');
  assert.equal(visaKodlapp(parti, ''), true);
  assert.equal(visaKodlapp(parti, kodnyckel(parti)), false);

  // Ett nytt parti med samma antal koder är ändå ett nytt parti.
  const nastaParti = [kod('EEEEE-FFFFF'), kod('GGGGG-HHHHH', 'Värnpliktig 04')];
  assert.equal(visaKodlapp(nastaParti, kodnyckel(parti)), true);
});

test('ingen lapp utan koder', async () => {
  const { visaKodlapp } = await import('../src/lib/kodlapp.ts');

  assert.equal(visaKodlapp([], ''), false);
  assert.equal(visaKodlapp(null, ''), false);
  assert.equal(visaKodlapp(undefined, ''), false);
});

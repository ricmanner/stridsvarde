/**
 * Varningen som stod fem gånger i befälsvyn.
 *
 * Ur designgenomgången den 26 september (fynd 1): märket "2 kategorier i
 * rött", den dagliga notisen "kritisk nivå", de röda märkena i
 * kategorilistan, rutan Tröskelvärden och Befälsrådet sa samma sak — och
 * veckosammanfattningen blev den femte den 15 oktober. Richard valde väg B
 * den 16 oktober: rutan och den dagliga notisen göms. Inget raderas;
 * notiserna skapas fortfarande.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import './setup.mjs';

test('beslutet den 16 oktober: ingen tröskelruta och ingen daglig larmnotis', async () => {
  const { VISA_TROSKELRUTA, VISA_DAGLIG_LARMNOTIS } = await import('../src/lib/varningar.ts');
  assert.equal(VISA_TROSKELRUTA, false);
  assert.equal(VISA_DAGLIG_LARMNOTIS, false);
});

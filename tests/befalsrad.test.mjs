/**
 * Befälsrådet i översikten.
 *
 * Det hade tre fasta texter och sa "kritisk nivå i 2 kategorier" utan att
 * säga vilka (genomgången den 16 oktober). Kräsna befäl märker standardtext.
 * Nu nämns kategorierna, med en åtgärd för var och en.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import './setup.mjs';

const lika = (v) => ({ fysisk: v, halsa: v, psykisk: v, social: v, somn: v, kost: v, energi: v });

test('röda kategorier nämns vid namn, med en åtgärd var', async () => {
  const { generateLeaderAdvice } = await import('../src/lib/advice.ts');
  const t = generateLeaderAdvice({ ...lika(5.5), somn: 3.4, kost: 3.7 });
  assert.match(t, /^Sömn samt kost och näring ligger på röd nivå\./);
  assert.match(t, /dygnsrytm/);
  assert.match(t, /måltider/);
  assert.match(t, /enskilda samtal/);
});

test('hälsa i rött handlar om smitta och sjukvård', async () => {
  const { generateLeaderAdvice } = await import('../src/lib/advice.ts');
  const t = generateLeaderAdvice({ ...lika(6), halsa: 3.5 });
  assert.match(t, /^Hälsa ligger på röd nivå\./);
  assert.match(t, /smitta/);
  assert.match(t, /sjukvård/);
});

test('utan rött nämns den lägsta kategorin, med sitt snitt', async () => {
  const { generateLeaderAdvice } = await import('../src/lib/advice.ts');
  const t = generateLeaderAdvice({ ...lika(6.2), energi: 4.8 });
  assert.match(t, /Ingen kategori ligger på röd nivå\. Lägst är energinivå, med 4,8\./);
});

test('allt grönt ger ett kort besked', async () => {
  const { generateLeaderAdvice } = await import('../src/lib/advice.ts');
  assert.match(generateLeaderAdvice(lika(7.6)), /^Alla kategorier ligger på grön nivå\./);
});

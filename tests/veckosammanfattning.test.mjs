/**
 * Veckosammanfattningen — några meningar om senaste veckan, överst i
 * befälsvyn och i rapporten.
 *
 * Fysioterapeuterna bad den 14 oktober om en kort text till plutonchefens
 * kompanimöte. Den skrivs ur siffrorna, utan AI: inget lämnar appen, och
 * texten kan aldrig säga något siffrorna inte säger.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildOrg, checkIn, database } from './setup.mjs';

const lika = (v) => ({ fysisk: v, halsa: v, psykisk: v, social: v, somn: v, kost: v, energi: v });
const grund = {
  eligible: 27,
  svarsandel: 0.82,
  denna: lika(6),
  forra: lika(6),
  lagst: null,
};

test('svarsfrekvensen och antalet först', async () => {
  const { veckotext } = await import('../src/lib/veckosammanfattning.ts');
  assert.equal(veckotext(grund)[0], 'I snitt svarade 82 % av de 27 värnpliktiga varje dag.');
});

test('röda kategorier nämns, med "samt" när ett namn självt innehåller "och"', async () => {
  const { veckotext } = await import('../src/lib/veckosammanfattning.ts');
  const t = veckotext({ ...grund, denna: { ...lika(6), somn: 3.2, kost: 3.6 } });
  assert.ok(t.includes('Sömn samt kost och näring ligger på röd nivå.'), t.join(' | '));
});

test('utan rött nämns det gula, och utan gult sägs det att allt är grönt', async () => {
  const { veckotext } = await import('../src/lib/veckosammanfattning.ts');
  const gul = veckotext({ ...grund, denna: { ...lika(7.5), somn: 5.1 } });
  assert.ok(gul.includes('Ingen kategori ligger på röd nivå. Sömn ligger på gul nivå.'), gul.join(' | '));
  const gron = veckotext({ ...grund, denna: lika(7.5), forra: lika(7.5) });
  assert.ok(gron.includes('Alla kategorier ligger på grön nivå.'), gron.join(' | '));
});

test('är alla gula räknas de inte upp, men den lägsta nämns', async () => {
  // På kompani- och bataljonsnivå är ofta alla sex gula. Uppräkningen blev en
  // mening utan information (sett i demon den 15 oktober).
  const { veckotext } = await import('../src/lib/veckosammanfattning.ts');
  const t = veckotext({ ...grund, denna: { ...lika(6), somn: 5.12 } });
  assert.ok(t.includes('Ingen kategori ligger på röd nivå. Alla ligger på gul nivå, lägst sömn med 5,1.'), t.join(' | '));
});

test('texten och färgen avrundar likadant: 3,96 är 4,0 och gult, inte rött', async () => {
  const { veckotext } = await import('../src/lib/veckosammanfattning.ts');
  const t = veckotext({ ...grund, denna: { ...lika(7.5), somn: 3.96 } });
  assert.ok(t.includes('Ingen kategori ligger på röd nivå. Sömn ligger på gul nivå.'), t.join(' | '));
});

test('största förändringen mot veckan innan, i de siffror som visas', async () => {
  const { veckotext } = await import('../src/lib/veckosammanfattning.ts');
  const upp = veckotext({ ...grund, forra: { ...lika(6), energi: 3.9 }, denna: { ...lika(6), energi: 5.04 } });
  assert.ok(
    upp.includes('Störst förändring mot veckan innan: energinivå, som stigit från 3,9 till 5,0.'),
    upp.join(' | '),
  );
  const ned = veckotext({ ...grund, forra: { ...lika(6), somn: 4.8 }, denna: { ...lika(6), somn: 3.9 } });
  assert.ok(ned.some((m) => m.includes('sömn, som sjunkit från 4,8 till 3,9')), ned.join(' | '));
});

test('små förändringar räknas inte som förändringar', async () => {
  const { veckotext } = await import('../src/lib/veckosammanfattning.ts');
  const t = veckotext({ ...grund, forra: lika(6), denna: { ...lika(6), somn: 6.4 } });
  assert.ok(t.includes('Inga stora förändringar mot veckan innan.'), t.join(' | '));
});

test('för få svar ger inga tal — varken denna vecka eller i en jämförelse', async () => {
  const { veckotext } = await import('../src/lib/veckosammanfattning.ts');
  const tom = veckotext({ ...grund, svarsandel: 0.1, denna: null, forra: lika(6) });
  assert.deepEqual(tom.slice(1), ['Underlag saknas — för få svar för att sammanfatta veckan.']);

  const utanForra = veckotext({ ...grund, forra: null });
  assert.ok(utanForra.includes('Veckan innan har för få svar för att jämföra.'), utanForra.join(' | '));
});

test('enheten som ligger lägst, bara när det finns något att jämföra', async () => {
  const { veckotext } = await import('../src/lib/veckosammanfattning.ts');
  const t = veckotext({ ...grund, lagst: { namn: '3. grupp', snitt: 4.44 } });
  assert.equal(t.at(-1), 'Lägst ligger 3. grupp, med 4,4.');
  assert.ok(!veckotext(grund).some((m) => m.startsWith('Lägst')));
});

/*
 * Databasfrågan: siffrorna för två veckor, med samma skydd som resten av
 * befälsvyn. Under fyra svarande skickas null — aldrig ett tal.
 */
test('underlaget: denna vecka, veckan innan, och null när för få svarat', async () => {
  const { client } = await database();
  const org = await buildOrg(client);
  const { getVeckounderlag } = await import('../src/lib/db/queries/aggregates.ts');
  const { serviceDateDaysAgo } = await import('../src/lib/date.ts');

  const [a, b, c, d, e] = org.soldater['Grupp A'];
  // Denna vecka: fem personer svarar 3. Veckan innan: fem personer svarar 7.
  await checkIn(client, [a, b, c, d, e], serviceDateDaysAgo(1), 3);
  await checkIn(client, [a, b, c, d, e], serviceDateDaysAgo(9), 7);

  const u = await getVeckounderlag(org.grupper['Grupp A']);
  assert.equal(u.eligible, 8);
  assert.equal(u.denna?.somn, 3);
  assert.equal(u.forra?.somn, 7);
  assert.ok(Math.abs(u.svarsandel - 5 / (8 * 7)) < 1e-9, `svarsandel ${u.svarsandel}`);

  // Grupp B: tre svarande — under gränsen. Inget tal får lämna servern.
  const [f, g, h] = org.soldater['Grupp B'];
  await checkIn(client, [f, g, h], serviceDateDaysAgo(2), 2);
  const liten = await getVeckounderlag(org.grupper['Grupp B']);
  assert.equal(liten.denna, null);
  assert.equal(liten.forra, null);
});

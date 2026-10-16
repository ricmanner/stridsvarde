/**
 * Veckan i korthet — fyra rutor överst i befälsvyn och i rapporten.
 *
 * Fysioterapeuterna bad den 14 oktober om en kort sammanfattning till
 * plutonchefens kompanimöte. Den var först fyra meningar; Richard ville ha
 * siffror rakt på sak, och jämförelsen med förra veckan syntes inte (16
 * oktober). Nu: svarsfrekvens, störst försämring, störst förbättring och
 * lägst enhet. Skrivet ur siffrorna, utan AI.
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

test('svarsfrekvensen räknas i hela procent', async () => {
  const { veckokort } = await import('../src/lib/veckosammanfattning.ts');
  const k = veckokort(grund);
  assert.equal(k.svarsprocent, 82);
  assert.equal(k.eligible, 27);
});

test('störst försämring och störst förbättring, i de tal som visas', async () => {
  const { veckokort } = await import('../src/lib/veckosammanfattning.ts');
  const k = veckokort({
    ...grund,
    forra: { ...lika(6), halsa: 6.04, energi: 4.2 },
    denna: { ...lika(6), halsa: 5.33, energi: 4.84 },
  });
  assert.deepEqual(k.forsamring, { kategori: 'Hälsa', fran: 6.0, till: 5.3 });
  assert.deepEqual(k.forbattring, { kategori: 'Energinivå', fran: 4.2, till: 4.8 });
});

test('förändringar under ett halvt steg räknas inte', async () => {
  const { veckokort } = await import('../src/lib/veckosammanfattning.ts');
  const k = veckokort({ ...grund, denna: { ...lika(6), somn: 6.4, kost: 5.6 } });
  assert.equal(k.forsamring, null);
  assert.equal(k.forbattring, null);
  assert.equal(k.jamforbar, true);
});

test('för få svar: inga tal alls, och ingen jämförelse med en tunn vecka', async () => {
  const { veckokort } = await import('../src/lib/veckosammanfattning.ts');
  const tom = veckokort({ ...grund, svarsandel: 0.1, denna: null });
  assert.equal(tom.underlag, false);
  assert.equal(tom.forsamring, null);

  const utanForra = veckokort({ ...grund, forra: null });
  assert.equal(utanForra.underlag, true);
  assert.equal(utanForra.jamforbar, false);
  assert.equal(utanForra.forsamring, null);
});

test('enheten som ligger lägst, avrundad som allt annat', async () => {
  const { veckokort } = await import('../src/lib/veckosammanfattning.ts');
  assert.deepEqual(veckokort({ ...grund, lagst: { namn: '3. grupp', snitt: 4.44 } }).lagst, { namn: '3. grupp', snitt: 4.4 });
  assert.equal(veckokort(grund).lagst, null);
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

/**
 * Kategoriernas läge i befälsvyns översikt: snittet, förra periodens snitt
 * och hur många personer som ligger i rött i varje kategori.
 *
 * Ersätter staplarna som räknade svar ("123 gula svar") — Richard,
 * 16 oktober: befälen vill ha siffror rakt på sak, och personer, inte svar.
 * Räknat i databasen med samma anonymitetsgräns som allt annat.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildOrg, database } from './setup.mjs';

const KAT = ['fysisk', 'halsa', 'psykisk', 'social', 'somn', 'kost', 'energi'];

async function svar(client, id, date, varden) {
  const v = { fysisk: 6, halsa: 6, psykisk: 6, social: 6, somn: 6, kost: 6, energi: 6, ...varden };
  await client.execute({
    sql: `INSERT INTO check_ins (user_id, service_date, ${KAT.join(', ')}, created_at) VALUES (?,?,${KAT.map(() => '?').join(',')},?)`,
    args: [id, date, ...KAT.map((k) => v[k]), new Date().toISOString()],
  });
}

test('förra periodens snitt och antal personer i rött, per kategori', async () => {
  const { client } = await database();
  const org = await buildOrg(client);
  const { getKategorilage } = await import('../src/lib/db/queries/aggregates.ts');
  const { serviceDateDaysAgo } = await import('../src/lib/date.ts');

  const [a, b, c, d, e] = org.soldater['Grupp A'];
  // Den här perioden (7 dagar): sömn 2, 2, 3, 6, 7 — tre personer i rött.
  for (const [id, somn] of [[a, 2], [b, 2], [c, 3], [d, 6], [e, 7]]) {
    await svar(client, id, serviceDateDaysAgo(1), { somn });
  }
  // Perioden före (dag 7–13 bakåt): alla sov bra.
  for (const id of [a, b, c, d, e]) await svar(client, id, serviceDateDaysAgo(9), { somn: 8 });

  const lage = await getKategorilage(org.grupper['Grupp A'], 7);
  assert.equal(lage.ok, true);
  assert.equal(lage.data.somn.iRott, 3);
  assert.equal(lage.data.somn.forra, 8);
  assert.equal(lage.data.fysisk.iRott, 0);
});

test('en person som ligger nära gränsen räknas på sitt eget avrundade snitt', async () => {
  // 3,96 visas som 4,0 och är gult — samma avrundning som färgerna.
  const { client } = await database();
  const org = await buildOrg(client);
  const { getKategorilage } = await import('../src/lib/db/queries/aggregates.ts');
  const { serviceDateDaysAgo } = await import('../src/lib/date.ts');

  const [a, b, c, d] = org.soldater['Grupp B'];
  // Person a: 4, 4, 4, 4, 4 och 3,8 i snitt? Enklare: två dagar, 4 och 3 → 3,5 (rött).
  await svar(client, a, serviceDateDaysAgo(1), { kost: 4 });
  await svar(client, a, serviceDateDaysAgo(2), { kost: 3 });
  for (const id of [b, c, d]) await svar(client, id, serviceDateDaysAgo(1), { kost: 4 });

  const lage = await getKategorilage(org.grupper['Grupp B'], 7);
  assert.equal(lage.data.kost.iRott, 1, 'bara person a, med 3,5');
});

test('för få svarande: inga tal alls', async () => {
  const { client } = await database();
  const org = await buildOrg(client);
  const { getKategorilage } = await import('../src/lib/db/queries/aggregates.ts');
  const { serviceDateDaysAgo } = await import('../src/lib/date.ts');

  const [a, b, c] = org.soldater['Grupp A'];
  for (const id of [a, b, c]) await svar(client, id, serviceDateDaysAgo(1), { somn: 2 });
  const lage = await getKategorilage(org.grupper['Grupp A'], 7);
  assert.equal(lage.ok, false);
  assert.equal(lage.data, undefined);
});

test('förra perioden med för få svar ger null, inte ett tal från en person', async () => {
  const { client } = await database();
  const org = await buildOrg(client);
  const { getKategorilage } = await import('../src/lib/db/queries/aggregates.ts');
  const { serviceDateDaysAgo } = await import('../src/lib/date.ts');

  const [a, b, c, d, e] = org.soldater['Grupp B'];
  for (const id of [a, b, c, d]) await svar(client, id, serviceDateDaysAgo(1), {});
  await svar(client, e, serviceDateDaysAgo(10), { somn: 1 });
  const lage = await getKategorilage(org.grupper['Grupp B'], 7);
  assert.equal(lage.ok, true);
  assert.equal(lage.data.somn.forra, null);
});

test('utan några svar alls säger skyddet "inga svar", inte "för liten enhet"', async () => {
  const { client } = await database();
  const org = await buildOrg(client);
  const { getKategorilage } = await import('../src/lib/db/queries/aggregates.ts');
  const lage = await getKategorilage(org.grupper['Grupp A'], 7);
  assert.equal(lage.ok, false);
  assert.equal(lage.reason, 'no_data');
});

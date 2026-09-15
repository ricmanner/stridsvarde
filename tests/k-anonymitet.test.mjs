/**
 * Tester för k-anonymiteten.
 *
 * Det här är den egenskap i systemet som går sönder tystast. Glömmer någon
 * tröskeln i en ny databasfråga kraschar ingenting — det står bara plötsligt
 * en siffra där det förut stod "underlag saknas", och en enskild soldats
 * hälsodata är utlämnad. Testerna nedan kör den RIKTIGA koden mot en riktig
 * databas, inte en kopia av frågorna.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildOrg, checkIn, database } from './setup.mjs';

/** Dagens datum i svensk tidszon, samma sätt som appen räknar. */
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Stockholm' });

test('guard() släpper bara igenom aggregat som klarar båda trösklarna', async () => {
  const { guard } = await import('../src/lib/privacy.ts');

  const data = { värde: 7 };

  // Färre svar än tröskeln
  assert.equal(guard(data, 3, 8, 4).ok, false, '3 svar av 8 ska undanhållas');
  assert.equal(guard(data, 4, 8, 4).ok, true, '4 svar av 8 ska visas');

  // För liten enhet — även 100 % svarsfrekvens röjer individer
  const litenEnhet = guard(data, 3, 3, 4);
  assert.equal(litenEnhet.ok, false, 'enhet med 3 medlemmar ska aldrig visas');
  assert.equal(litenEnhet.ok === false && litenEnhet.reason, 'too_few_members');

  // Inga svar alls
  assert.equal(guard(null, 0, 8, 4).ok, false);
  assert.equal(guard(data, 0, 8, 4).ok, false);

  // Förklaringen ska följa med, annars kan gränssnittet inte berätta varför
  const blockerad = guard(data, 2, 8, 4);
  assert.equal(blockerad.ok, false);
  assert.ok(
    blockerad.ok === false && blockerad.message.includes('2 av 8'),
    'meddelandet ska innehålla det verkliga underlaget',
  );
});

test('tröskeln kan inte konfigureras bort', async () => {
  const saved = process.env.MIN_RESPONDERS;
  const { minResponders } = await import('../src/lib/db/client.ts');

  for (const försök of ['1', '0', '-5', 'noll', '']) {
    process.env.MIN_RESPONDERS = försök;
    assert.ok(
      minResponders() >= 3,
      `MIN_RESPONDERS=${JSON.stringify(försök)} gav ${minResponders()} — golvet på 3 måste hålla`,
    );
  }

  process.env.MIN_RESPONDERS = saved;
});

test('kategorisnitt undanhålls när för få svarat', async () => {
  const { client } = await database();
  // Varje test bygger sin egen organisation. Id:n räknas uppåt och delas
  // aldrig, så testerna kan köras parallellt utan att störa varandra —
  // därför finns ingen gemensam rensning som skulle radera under fötterna
  // på ett test som kör samtidigt.
  const org = await buildOrg(client);

  // Grupp A: 6 av 8 svarar. Grupp B: 2 av 8.
  await checkIn(client, org.soldater['Grupp A'].slice(0, 6), today, 8);
  await checkIn(client, org.soldater['Grupp B'].slice(0, 2), today, 2);

  const { getUnitCategorySeries } = await import('../src/lib/db/queries/aggregates.ts');

  const aSerie = await getUnitCategorySeries(org.grupper['Grupp A'], 7);
  const aIdag = aSerie.find((p) => p.date === today);
  assert.ok(aIdag, 'dagens rad ska finnas');
  assert.equal(aIdag.responders, 6);
  assert.ok(aIdag.scores !== null, 'Grupp A har 6 svar och ska visas');
  assert.equal(aIdag.scores.somn, 8);

  const bSerie = await getUnitCategorySeries(org.grupper['Grupp B'], 7);
  const bIdag = bSerie.find((p) => p.date === today);
  assert.ok(bIdag, 'dagens rad ska finnas även när den är undanhållen');
  assert.equal(bIdag.responders, 2, 'antalet svar får visas — det är inte hälsodata');
  assert.equal(bIdag.scores, null, 'Grupp B har bara 2 svar och får INTE visa värden');
  assert.equal(bIdag.overall, null);
});

test('översikten undanhåller både snitt och färgfördelning', async () => {
  const { client } = await database();
  // Varje test bygger sin egen organisation. Id:n räknas uppåt och delas
  // aldrig, så testerna kan köras parallellt utan att störa varandra —
  // därför finns ingen gemensam rensning som skulle radera under fötterna
  // på ett test som kör samtidigt.
  const org = await buildOrg(client);
  await checkIn(client, org.soldater['Grupp B'].slice(0, 2), today, 2);

  const { getUnitOverview } = await import('../src/lib/db/queries/aggregates.ts');
  const o = await getUnitOverview(org.grupper['Grupp B'], 7);

  assert.equal(o.categories.ok, false, 'kategorisnitt ska undanhållas');
  assert.equal(o.distribution.ok, false, 'färgfördelningen röjer lika mycket');
  assert.equal(o.soldierStatus.ok, false, 'antal gröna/gula/röda röjer också');

  // Svarsfrekvensen ska däremot synas — annars går det inte att förklara
  // för befälet VARFÖR siffrorna saknas.
  assert.equal(o.today.responders, 2);
  assert.equal(o.eligible, 8);
});

test('jämförelsen undanhåller per underenhet, inte allt eller inget', async () => {
  const { client } = await database();
  // Varje test bygger sin egen organisation. Id:n räknas uppåt och delas
  // aldrig, så testerna kan köras parallellt utan att störa varandra —
  // därför finns ingen gemensam rensning som skulle radera under fötterna
  // på ett test som kör samtidigt.
  const org = await buildOrg(client);
  await checkIn(client, org.soldater['Grupp A'].slice(0, 6), today, 8);
  await checkIn(client, org.soldater['Grupp B'].slice(0, 2), today, 2);

  const { getChildComparison } = await import('../src/lib/db/queries/aggregates.ts');
  const { children } = await getChildComparison(org.pluton, 7);

  const a = children.find((c) => c.name === 'Grupp A');
  const b = children.find((c) => c.name === 'Grupp B');

  assert.ok(a.overall !== null, 'Grupp A ska visas');
  assert.equal(b.overall, null, 'Grupp B ska undanhållas');
  assert.equal(b.scores, null);
  assert.equal(b.green + b.yellow + b.red, 0, 'inga färgantal får läcka för Grupp B');
  assert.equal(b.responders, 2, 'men underlaget får redovisas');
});

test('plutonen som helhet visas även när en av dess grupper är för tunn', async () => {
  const { client } = await database();
  // Varje test bygger sin egen organisation. Id:n räknas uppåt och delas
  // aldrig, så testerna kan köras parallellt utan att störa varandra —
  // därför finns ingen gemensam rensning som skulle radera under fötterna
  // på ett test som kör samtidigt.
  const org = await buildOrg(client);
  await checkIn(client, org.soldater['Grupp A'].slice(0, 6), today, 8);
  await checkIn(client, org.soldater['Grupp B'].slice(0, 2), today, 2);

  const { getUnitOverview } = await import('../src/lib/db/queries/aggregates.ts');
  const o = await getUnitOverview(org.pluton, 7);

  // 8 svarande av 16 på plutonsnivå — över tröskeln, ska visas.
  assert.equal(o.categories.ok, true, 'plutonen har tillräckligt underlag');
  assert.equal(o.today.responders, 8);
});

test('en dag utan svar ger lucka, aldrig en nolla', async () => {
  const { client } = await database();
  // Varje test bygger sin egen organisation. Id:n räknas uppåt och delas
  // aldrig, så testerna kan köras parallellt utan att störa varandra —
  // därför finns ingen gemensam rensning som skulle radera under fötterna
  // på ett test som kör samtidigt.
  const org = await buildOrg(client);
  // Ingen checkar in alls.

  const { getUnitCategorySeries } = await import('../src/lib/db/queries/aggregates.ts');
  const serie = await getUnitCategorySeries(org.pluton, 7);

  assert.equal(serie.length, 7, 'alla sju dagar ska finnas med i serien');
  for (const p of serie) {
    assert.equal(p.responders, 0);
    assert.equal(p.scores, null, 'en dag utan svar får inte bli 0 — det läses som att alla mår uselt');
    assert.equal(p.overall, null);
  }
});

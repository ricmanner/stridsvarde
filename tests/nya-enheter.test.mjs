/**
 * Dyker en ny grupp eller pluton upp hos befälet av sig själv?
 *
 * Frågan är praktisk: en administratör lägger till en fjärde grupp i en
 * pluton, eller en ny pluton i ett kompani, medan appen används. Ingen ska
 * behöva göra något mer för att den ska synas i översikt, trender och
 * jämförelse — och den ska synas direkt, inte efter en omstart.
 *
 * Testet lägger till enheter i efterhand, precis som adminsidan gör, och
 * kontrollerar vad plutonchefen respektive kompanichefen ser. Det visar också
 * var gränsen går: hur många som måste ha rapporterat innan siffror visas.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildOrg, checkIn, database } from './setup.mjs';

const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Stockholm' });
const iso = () => new Date().toISOString();

async function skapaEnhet(client, name, kind, parent) {
  const r = await client.execute({
    sql: 'INSERT INTO units (name, kind, parent_id, created_at) VALUES (?,?,?,?)',
    args: [name, kind, parent, iso()],
  });
  return Number(r.lastInsertRowid);
}

async function skapaVarnpliktiga(client, unitId, antal) {
  const ids = [];
  for (let i = 0; i < antal; i++) {
    const r = await client.execute({
      sql: 'INSERT INTO users (code_hash, label, role, unit_id, active, created_at) VALUES (?,?,?,?,1,?)',
      args: [`hash-ny-${unitId}-${i}-${Math.random()}`, `Värnpliktig ${i + 1}`, 'soldat', unitId, iso()],
    });
    ids.push(Number(r.lastInsertRowid));
  }
  return ids;
}

test('en ny grupp syns hos plutonchefen så fort den skapats', async () => {
  const { client } = await database();
  const { pluton, grupper, soldater } = await buildOrg(client);
  const { getChildComparison, getUnitOverview, getUnitCategorySeries } = await import(
    '../src/lib/db/queries/aggregates.ts'
  );

  await checkIn(client, soldater['Grupp A'], today, 8);

  const innan = await getChildComparison(pluton, 7);
  assert.equal(innan.children.length, 2, 'Grupp A och Grupp B');

  // Administratören lägger till en fjärde grupp — först helt tom.
  const gruppC = await skapaEnhet(client, 'Grupp C', 'grupp', pluton);

  const tom = await getChildComparison(pluton, 7);
  const radC = tom.children.find((c) => c.id === gruppC);
  assert.ok(radC, 'den nya gruppen får en rad direkt, utan omstart');
  assert.equal(radC.eligible, 0, 'ingen är placerad i den ännu');
  assert.equal(radC.overall, null, 'utan värnpliktiga finns inget att visa');

  // Sex värnpliktiga placeras i gruppen. Ingen har rapporterat ännu.
  const nya = await skapaVarnpliktiga(client, gruppC, 6);
  const utanSvar = await getChildComparison(pluton, 7);
  assert.equal(utanSvar.children.find((c) => c.id === gruppC).eligible, 6, 'de räknas med direkt');
  assert.equal(utanSvar.children.find((c) => c.id === gruppC).overall, null, 'men inga siffror utan svar');

  // Plutonens totaler växer med gruppen, redan innan den rapporterat.
  const ov = await getUnitOverview(pluton, 7);
  assert.equal(ov.eligible, 8 + 8 + 6, 'de nya ingår i plutonens antal');

  // Tre svar räcker inte. Fyra gör det.
  await checkIn(client, nya.slice(0, 3), today, 5);
  const tre = await getChildComparison(pluton, 7);
  assert.equal(tre.children.find((c) => c.id === gruppC).responders, 3, 'svaren räknas');
  assert.equal(tre.children.find((c) => c.id === gruppC).overall, null, 'tre svar är för få för att visa');

  await checkIn(client, nya.slice(3, 4), today, 5);
  const fyra = await getChildComparison(pluton, 7);
  const klar = fyra.children.find((c) => c.id === gruppC);
  assert.equal(klar.responders, 4);
  assert.equal(klar.overall, 5, 'med fyra svar visas gruppens snitt');
  assert.equal(klar.scores.somn, 5);

  // Gruppen finns med i jämförelsens kurva, och i plutonens egen trend.
  const rad = fyra.series.find((r) => r.date === today);
  assert.equal(rad['Grupp C'], 5, 'gruppen har en egen kurva');

  const serie = await getUnitCategorySeries(pluton, 7);
  const idag = serie.at(-1);
  assert.equal(idag.eligible, 8 + 8 + 6, 'plutonens trend räknar med den nya gruppen');
  assert.equal(idag.responders, 8 + 4, 'och med dess svar');

  assert.ok(grupper['Grupp A'], 'de gamla grupperna finns kvar');
});

test('en ny pluton syns hos kompanichefen, med sina grupper under sig', async () => {
  const { client } = await database();
  const { kompani, pluton, soldater } = await buildOrg(client);
  const { getChildComparison, getUnitOverview } = await import('../src/lib/db/queries/aggregates.ts');

  await checkIn(client, soldater['Grupp A'], today, 7);

  const innan = await getChildComparison(kompani, 7);
  assert.deepEqual(innan.children.map((c) => c.id), [pluton], 'bara den ursprungliga plutonen');

  // Ny pluton med en grupp under sig — två nivåer skapade i efterhand.
  const nyPluton = await skapaEnhet(client, 'Pluton 2', 'pluton', kompani);
  const nyGrupp = await skapaEnhet(client, 'Grupp 1', 'grupp', nyPluton);
  const nya = await skapaVarnpliktiga(client, nyGrupp, 5);
  await checkIn(client, nya, today, 4);

  const efter = await getChildComparison(kompani, 7);
  const rad = efter.children.find((c) => c.id === nyPluton);
  assert.ok(rad, 'den nya plutonen syns hos kompanichefen');
  assert.equal(rad.eligible, 5, 'värnpliktiga i gruppen räknas till plutonen');
  assert.equal(rad.overall, 4, 'och deras svar syns på plutonens rad');

  // Kompaniets egna siffror omfattar den nya plutonen utan att något ändrats.
  const ov = await getUnitOverview(kompani, 7);
  assert.equal(ov.eligible, 8 + 8 + 5);
  assert.equal(ov.categories.ok, true);

  // Plutonchefen för den nya plutonen ser i sin tur sin grupp.
  const under = await getChildComparison(nyPluton, 7);
  assert.deepEqual(under.children.map((c) => c.id), [nyGrupp]);
  assert.equal(under.children[0].overall, 4);
});

test('gränsen för att visa något: fyra svar, och minst fyra i enheten', async () => {
  const { client } = await database();
  const { pluton } = await buildOrg(client);
  const { getUnitOverview, getUnitCategorySeries } = await import('../src/lib/db/queries/aggregates.ts');

  // En grupp med tre personer kan aldrig visas, hur flitigt de än rapporterar.
  const liten = await skapaEnhet(client, 'Liten grupp', 'grupp', pluton);
  const tre = await skapaVarnpliktiga(client, liten, 3);
  await checkIn(client, tre, today, 6);
  const litenOv = await getUnitOverview(liten, 7);
  assert.equal(litenOv.categories.ok, false, 'tre personer är för få — även vid full svarsfrekvens');
  assert.equal(litenOv.categories.ok === false && litenOv.categories.reason, 'too_few_members');
  assert.equal(litenOv.today.responders, 3, 'men antalet svar får visas: det är inte hälsodata');

  // En större grupp: siffror först vid det fjärde svaret, dag för dag.
  const stor = await skapaEnhet(client, 'Stor grupp', 'grupp', pluton);
  const tio = await skapaVarnpliktiga(client, stor, 10);
  await checkIn(client, tio.slice(0, 3), today, 6);
  let ov = await getUnitOverview(stor, 7);
  assert.equal(ov.categories.ok, false, 'tre av tio är för få');
  assert.equal(ov.categories.ok === false && ov.categories.reason, 'too_few_responses');
  assert.equal((await getUnitCategorySeries(stor, 7)).at(-1).scores, null, 'dagen är tom i grafen');

  await checkIn(client, tio.slice(3, 4), today, 6);
  ov = await getUnitOverview(stor, 7);
  assert.equal(ov.categories.ok, true, 'fyra svar räcker');
  assert.equal((await getUnitCategorySeries(stor, 7)).at(-1).scores.fysisk, 6, 'dagen ritas ut');
});

/**
 * Radering av hälsodata: skydden och ordningen.
 *
 * Två fel som fanns här och som testerna nedan låser:
 *
 *  1. Radering av en persons hälsodata saknade de skydd som byt kod, spärra
 *     och radera konto redan hade. En administratör kunde nolla historiken
 *     för ett av demons publicerade konton — och koden till det står på
 *     inloggningssidan.
 *  2. Hälsodatan raderades i ett eget steg FÖRE raderingen av kontot eller
 *     enheten, utanför transaktionen. Ett avbrott däremellan lämnade ett
 *     konto utan sin historik, eller ett felmeddelande som såg ut som att
 *     ingenting hänt fast rapporterna redan var borta.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildOrg, checkIn, database } from './setup.mjs';

const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Stockholm' });
const iso = () => new Date().toISOString();

async function skapaAdmin(client, unitId) {
  const r = await client.execute({
    sql: 'INSERT INTO users (code_hash, label, role, unit_id, active, created_at) VALUES (?,?,?,?,1,?)',
    args: [`hash-adm-${Math.random()}`, 'Administratör', 'admin', unitId, iso()],
  });
  return Number(r.lastInsertRowid);
}

const antalIncheckningar = async (client, userId) =>
  Number(
    (
      await client.execute({
        sql: 'SELECT COUNT(*) AS n FROM check_ins WHERE user_id = ?',
        args: [userId],
      })
    ).rows[0].n,
  );

const senasteLoggrader = async (client, n) =>
  (
    await client.execute({ sql: 'SELECT action FROM audit_log ORDER BY id DESC LIMIT ?', args: [n] })
  ).rows.map((r) => r.action);

test('hälsodata går inte att nolla för någon som inte finns', async () => {
  await database();
  const { canErasePersonalData } = await import('../src/lib/db/queries/admin.ts');

  const saknas = await canErasePersonalData(999_999);
  assert.equal(saknas.ok, false, 'ett okänt id ska nekas, inte tyst lyckas med noll rader');
  assert.match(saknas.error, /saknas/i);
});

test('hälsodata går inte att nolla för ett befäl — befäl har ingen', async () => {
  const { client } = await database();
  const org = await buildOrg(client);
  const { canErasePersonalData } = await import('../src/lib/db/queries/admin.ts');

  /*
   * Bara rollen soldat släpps in i incheckningen, och det finns ingen väg i
   * gränssnittet att byta roll på någon. Ett befäls antal incheckningar är
   * alltså alltid noll, och att erbjuda radering av dem är att erbjuda en
   * åtgärd som inte gör något.
   *
   * Det farliga är inte de noll raderna utan vad vyn PÅSTÅR: att befäl har
   * egna hälsouppgifter. Hela appen bygger på motsatsen. Spärren ligger här
   * och inte bara i listan, av samma skäl som k-anonymiteten ligger i
   * SELECT-satsen: gränssnittet är aldrig skyddet.
   *
   * Skulle befäl någon gång börja rapportera sitt eget mående är det HÄR den
   * regeln ändras — och då faller det här testet och pekar ut stället.
   */
  const befal = async (roll, unitId) =>
    Number(
      (
        await client.execute({
          sql: 'INSERT INTO users (code_hash, label, role, unit_id, active, created_at) VALUES (?,?,?,?,1,?) RETURNING id',
          args: [`hash-bef-${Math.random()}`, `Chef ${roll}`, roll, unitId, iso()],
        })
      ).rows[0].id,
    );

  for (const [roll, unitId] of [
    ['pluton', org.pluton],
    ['kompani', org.kompani],
    ['bataljon', org.bataljon],
  ]) {
    const svar = await canErasePersonalData(await befal(roll, unitId));
    assert.equal(svar.ok, false, `${roll} borde ha nekats`);
    assert.match(svar.error, /värnpliktig/i, 'felet ska säga varför, inte bara nej');
  }

  // Administratören har ingen hälsodata heller.
  const adm = await skapaAdmin(client, org.bataljon);
  assert.equal((await canErasePersonalData(adm)).ok, false);

  // Men en värnpliktig ska fortfarande gå att radera — rättigheten enligt
  // GDPR artikel 17 får inte spärras bort på vägen.
  const soldat = org.soldater['Grupp A'][0];
  assert.equal((await canErasePersonalData(soldat)).ok, true, 'en värnpliktig måste gå att radera');
});

test('radering av en person tar konto, rapporter och båda loggraderna på en gång', async () => {
  const { client } = await database();
  const { deleteUser } = await import('../src/lib/db/queries/admin.ts');

  const org = await buildOrg(client);
  const admin = await skapaAdmin(client, org.bataljon);
  const person = org.soldater['Grupp B'][0];
  const granne = org.soldater['Grupp B'][1];

  await checkIn(client, [person, granne], today, 6);
  assert.equal(await antalIncheckningar(client, person), 1);

  const r = await deleteUser(admin, person);
  assert.equal(r.ok, true);
  assert.equal(r.erased, 1, 'antalet raderade rapporter räknas innan kontot försvinner');

  assert.equal(await antalIncheckningar(client, person), 0, 'rapporterna är borta');
  assert.equal(await antalIncheckningar(client, granne), 1, 'grannens rapport är orörd');

  const logg = await senasteLoggrader(client, 2);
  assert.deepEqual(
    [...logg].sort(),
    ['retention.erase_person', 'user.delete'].sort(),
    'både raderingen och nollningen står i granskningsloggen',
  );
});

test('en nekad radering lämnar rapporterna i fred', async () => {
  const { client } = await database();
  const { deleteUser } = await import('../src/lib/db/queries/admin.ts');

  const org = await buildOrg(client);
  const admin = await skapaAdmin(client, org.bataljon);
  const person = org.soldater['Grupp A'][2];
  await checkIn(client, [person], today, 7);

  // Den enda kontrollerade vägen till ett nej: att radera sig själv.
  const nekad = await deleteUser(person, person);
  assert.equal(nekad.ok, false);
  assert.equal(
    await antalIncheckningar(client, person),
    1,
    'nekas raderingen får ingen hälsodata ha hunnit försvinna',
  );

  // Och admin kan fortfarande radera personen på riktigt.
  const r = await deleteUser(admin, person);
  assert.equal(r.ok, true);
  assert.equal(r.erased, 1);
});

test('radering av en enhet raderar rapporterna i samma transaktion', async () => {
  const { client } = await database();
  const { deleteUnit } = await import('../src/lib/db/queries/admin.ts');

  const org = await buildOrg(client);
  const admin = await skapaAdmin(client, org.bataljon);
  const grupp = org.grupper['Grupp A'];
  const medlemmar = org.soldater['Grupp A'];

  await checkIn(client, medlemmar, today, 5);
  const fore = await antalIncheckningar(client, medlemmar[0]);
  assert.equal(fore, 1);

  const r = await deleteUnit(admin, grupp, 'Grupp A');
  assert.equal(r.ok, true, r.ok ? '' : r.error);
  assert.equal(r.erased, medlemmar.length, 'alla gruppens rapporter räknas');

  for (const m of medlemmar) {
    assert.equal(await antalIncheckningar(client, m), 0);
  }

  const logg = await senasteLoggrader(client, 2);
  assert.deepEqual([...logg].sort(), ['retention.erase_unit', 'unit.delete'].sort());
});

test('en nekad enhetsradering rör ingenting', async () => {
  const { client } = await database();
  const { deleteUnit } = await import('../src/lib/db/queries/admin.ts');

  const org = await buildOrg(client);
  const admin = await skapaAdmin(client, org.bataljon);
  const medlemmar = org.soldater['Grupp B'];
  await checkIn(client, medlemmar, today, 8);

  // Fel namn i bekräftelsen.
  const nekad = await deleteUnit(admin, org.grupper['Grupp B'], 'Fel namn');
  assert.equal(nekad.ok, false);

  for (const m of medlemmar) {
    assert.equal(await antalIncheckningar(client, m), 1, 'ingen rapport får ha raderats');
  }
  const [kvar] = (
    await client.execute({
      sql: 'SELECT COUNT(*) AS n FROM units WHERE id = ?',
      args: [org.grupper['Grupp B']],
    })
  ).rows;
  assert.equal(Number(kvar.n), 1, 'enheten står kvar');
});

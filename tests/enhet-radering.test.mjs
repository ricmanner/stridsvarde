/**
 * Radering av en hel enhet — med underenheter, personer och rapporter.
 *
 * Den mest omfattande åtgärden i appen. Stegen körs i ordning i ett enda
 * test, eftersom kontrollen av "sista administratören" räknar administratörer
 * i hela databasen och parallella tester annars påverkar varandra.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildOrg, checkIn, database } from './setup.mjs';

test('en enhet raderas med allt under sig, men aldrig förbi skydden', async (t) => {
  const { client } = await database();
  const org = await buildOrg(client); // Bataljon › Kompani › Pluton 1 › Grupp A, Grupp B
  const annan = await buildOrg(client);

  const { hashCode } = await import('../src/lib/auth/codes.ts');
  const { getUnitDeletion, getUnitDeletionUserIds, deleteUnit } = await import('../src/lib/db/queries/admin.ts');
  const { eraseCheckInsForUsers } = await import('../src/lib/db/retention.ts');

  const nu = () => new Date().toISOString();
  const n = async (sql, args = []) => Number((await client.execute({ sql, args })).rows[0].n);
  const skapa = async (hash, label, role, unitId) =>
    Number((await client.execute({
      sql: 'INSERT INTO users (code_hash, label, role, unit_id, active, created_at) VALUES (?,?,?,?,1,?) RETURNING id',
      args: [hash, label, role, unitId, nu()],
    })).rows[0].id);

  const allaSoldater = [...org.soldater['Grupp A'], ...org.soldater['Grupp B']];
  await checkIn(client, allaSoldater, '2026-09-10', 6);
  await checkIn(client, allaSoldater, '2026-09-11', 4);

  const utanfor = annan.soldater['Grupp A'][0];
  const tidigare = process.env.PSVI_ENVIRONMENT;

  try {
    await t.test('vägrar om enheten innehåller den sista administratören', async () => {
      await skapa(`hash-enda-admin-${Date.now()}`, 'Ensam admin', 'admin', org.grupper['Grupp A']);
      const d = await getUnitDeletion(utanfor, org.pluton);
      assert.match(d.refusal ?? '', /sista aktiva administratören/);
      assert.equal((await deleteUnit(utanfor, org.pluton, 'Pluton 1')).ok, false);
    });

    const admin = await skapa(`hash-admin-utanfor-${Date.now()}`, 'Admin', 'admin', annan.bataljon);

    await t.test('vägrar om enheten innehåller ditt eget konto', async () => {
      const inuti = org.soldater['Grupp B'][0];
      const d = await getUnitDeletion(inuti, org.pluton);
      assert.match(d.refusal ?? '', /ditt eget konto/);
    });

    await t.test('i demoläge: vägrar om ett publicerat demokonto ligger under — bara då', async () => {
      await skapa(hashCode('P1G1-01'), 'Ingång', 'soldat', org.grupper['Grupp B']);

      process.env.PSVI_ENVIRONMENT = 'demo';
      assert.match((await getUnitDeletion(admin, org.pluton)).refusal ?? '', /inloggningssidan/);

      process.env.PSVI_ENVIRONMENT = 'pilot';
      assert.equal((await getUnitDeletion(admin, org.pluton)).refusal, null);
    });

    const personerFore = await n('SELECT count(*) n FROM users WHERE unit_id IN (?,?,?)', [org.pluton, org.grupper['Grupp A'], org.grupper['Grupp B']]);
    const rapporterFore = await n('SELECT count(*) n FROM check_ins');

    await t.test('förhandsvisningen räknar rätt', async () => {
      const d = await getUnitDeletion(admin, org.pluton);
      assert.equal(d.name, 'Pluton 1');
      assert.equal(d.subunits, 2, 'Grupp A och Grupp B');
      assert.equal(d.people, personerFore);
      assert.equal(d.parentId, org.kompani);
    });

    await t.test('fel namn: ingenting raderas', async () => {
      const r = await deleteUnit(admin, org.pluton, 'pluton 1');
      assert.equal(r.ok, false, 'namnet ska stämma exakt, även stora och små bokstäver');
      assert.equal(await n('SELECT count(*) n FROM units WHERE id = ?', [org.pluton]), 1);
      assert.equal(await n('SELECT count(*) n FROM check_ins'), rapporterFore);
    });

    await t.test('rätt namn: enheten, underenheterna, personerna och rapporterna försvinner', async () => {
      const ids = await getUnitDeletionUserIds(admin, org.pluton);
      const raderade = await eraseCheckInsForUsers(admin, ids, 'Pluton 1');
      assert.equal(raderade, allaSoldater.length * 2);

      const r = await deleteUnit(admin, org.pluton, 'Pluton 1');
      assert.equal(r.ok, true, r.error);

      for (const id of [org.pluton, org.grupper['Grupp A'], org.grupper['Grupp B']]) {
        assert.equal(await n('SELECT count(*) n FROM units WHERE id = ?', [id]), 0, `enhet ${id} ska vara borta`);
      }
      assert.equal(await n(`SELECT count(*) n FROM users WHERE id IN (${ids.join(',')})`), 0);
      assert.equal(await n(`SELECT count(*) n FROM check_ins WHERE user_id IN (${allaSoldater.join(',')})`), 0);

      // Ovanför och bredvid rörs ingenting.
      assert.equal(await n('SELECT count(*) n FROM units WHERE id = ?', [org.kompani]), 1, 'kompaniet ska finnas kvar');
      assert.equal(await n('SELECT count(*) n FROM units WHERE id = ?', [annan.pluton]), 1, 'den andra organisationen ska finnas kvar');
    });

    await t.test('en tom enhet raderas utan namnbekräftelse', async () => {
      const tom = Number((await client.execute({
        sql: 'INSERT INTO units (name, kind, parent_id, created_at) VALUES (?,?,?,?) RETURNING id',
        args: ['Grupp 9', 'grupp', annan.pluton, nu()],
      })).rows[0].id);
      assert.equal((await deleteUnit(admin, tom, '')).ok, true);
      assert.equal(await n('SELECT count(*) n FROM units WHERE id = ?', [tom]), 0);
    });
  } finally {
    if (tidigare === undefined) delete process.env.PSVI_ENVIRONMENT;
    else process.env.PSVI_ENVIRONMENT = tidigare;
  }
});

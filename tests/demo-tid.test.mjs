/**
 * `npm run demo:uppdatera` — att flytta fram demodatan så att den slutar idag.
 *
 * Kommandot skriver om datum i HELA incheckningstabellen, inte bara för en
 * organisation. Därför är allt ett enda test med steg i ordning, i stället
 * för flera tester som delar databasen: de skulle flytta varandras data.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildOrg, database } from './setup.mjs';

const IDAG = '2026-10-01';
const HISTORIKENS_SLUT = '2026-09-16';

const dagFore = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - n * 86_400_000).toISOString().slice(0, 10);
};

test('demodatan flyttas fram utan att något går förlorat eller krockar', async (t) => {
  const { client } = await database();
  const org = await buildOrg(client);
  const soldater = [...org.soldater['Grupp A'], ...org.soldater['Grupp B']];

  const { hashCode } = await import('../src/lib/auth/codes.ts');
  const { planDemoTimeline, applyDemoTimeline } = await import('../src/lib/db/demo-timeline.ts');

  const nu = () => new Date().toISOString();
  const rad = async (sql, args = []) => (await client.execute({ sql, args })).rows;

  // Ett av demons ingångskonton, som ska få dagens incheckning öppnad igen.
  const ingang = Number(
    (await rad(
      'INSERT INTO users (code_hash, label, role, unit_id, active, created_at) VALUES (?,?,?,?,1,?) RETURNING id',
      [hashCode('P1G1-01'), 'Ingång', 'soldat', org.grupper['Grupp A'], nu()],
    ))[0].id,
  );

  /*
   * Fjorton dagar i följd för alla — varje person har rader på varandra
   * följande datum. Det är exakt det fall som krockar med det unika indexet
   * om allt flyttas i ett enda svep. Varje dag får ett eget värde, så det
   * går att se att värdena följt med sina datum.
   */
  for (let i = 13; i >= 0; i--) {
    const dag = dagFore(HISTORIKENS_SLUT, i);
    const varde = ((13 - i) % 10) + 1;
    for (const id of [...soldater, ingang]) {
      await rad(
        `INSERT INTO check_ins (user_id, service_date, fysisk, psykisk, social, somn, kost, energi, created_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [id, dag, varde, varde, varde, varde, varde, varde, nu()],
      );
    }
  }

  // Två besökare som provat demon dagen efter historiken — långt under gränsen.
  for (const id of soldater.slice(0, 2)) {
    await rad(
      `INSERT INTO check_ins (user_id, service_date, fysisk, psykisk, social, somn, kost, energi, created_at)
       VALUES (?,?,5,5,5,5,5,5,?)`,
      [id, dagFore(HISTORIKENS_SLUT, -1), nu()],
    );
  }

  const tidigare = process.env.PSVI_ENVIRONMENT;
  try {
    await t.test('vägrar utan demons administratörskonto', async () => {
      process.env.PSVI_ENVIRONMENT = 'demo';
      await assert.rejects(planDemoTimeline(IDAG), /administratörskonto/);
    });

    await rad(
      'INSERT INTO users (code_hash, label, role, unit_id, active, created_at) VALUES (?,?,?,?,1,?)',
      [hashCode('ADMIN-01'), 'Administratör', 'admin', org.bataljon, nu()],
    );

    await t.test('vägrar i pilotläge, även mot en demodatabas', async () => {
      process.env.PSVI_ENVIRONMENT = 'pilot';
      await assert.rejects(planDemoTimeline(IDAG), /demo/);
      process.env.PSVI_ENVIRONMENT = 'demo';
    });

    const totaltFore = Number((await rad('SELECT count(*) n FROM check_ins'))[0].n);

    await t.test('planen hittar historikens slut och ignorerar enstaka senare svar', async () => {
      const plan = await planDemoTimeline(IDAG);
      assert.equal(plan.senasteHistorikdag, HISTORIKENS_SLUT, 'två besökare är inte historik');
      assert.equal(plan.dagar, 15);
      assert.equal(plan.efterHistoriken, 2);
      assert.equal(plan.flyttas, totaltFore - 2);

      // Planen ändrar ingenting.
      assert.equal(Number((await rad('SELECT count(*) n FROM check_ins'))[0].n), totaltFore);
    });

    await t.test('historiken slutar idag, med samma form och samma värden', async () => {
      await applyDemoTimeline(IDAG);

      const [{ min, max }] = await rad('SELECT min(service_date) min, max(service_date) max FROM check_ins');
      assert.equal(max, IDAG, 'historiken ska sluta idag');
      assert.equal(min, dagFore(IDAG, 13), 'fjorton dagar, inte fler eller färre');

      // Varje värnpliktig har fortfarande fjorton rader, och värdet som låg
      // på historikens sista dag ligger nu på idag.
      for (const id of soldater) {
        assert.equal(Number((await rad('SELECT count(*) n FROM check_ins WHERE user_id = ?', [id]))[0].n), 14);
      }
      const [senast] = await rad('SELECT fysisk FROM check_ins WHERE user_id = ? AND service_date = ?', [soldater[5], IDAG]);
      assert.equal(Number(senast.fysisk), (13 % 10) + 1, 'värdena ska ha följt med sina datum');

      // Inget i framtiden.
      assert.equal(Number((await rad('SELECT count(*) n FROM check_ins WHERE service_date > ?', [IDAG]))[0].n), 0);
    });

    await t.test('ingångskontot har dagens incheckning öppen igen', async () => {
      const idag = await rad('SELECT count(*) n FROM check_ins WHERE user_id = ? AND service_date = ?', [ingang, IDAG]);
      assert.equal(Number(idag[0].n), 0, 'ska kunna prova incheckningen idag');
      const igar = await rad('SELECT count(*) n FROM check_ins WHERE user_id = ? AND service_date = ?', [ingang, dagFore(IDAG, 1)]);
      assert.equal(Number(igar[0].n), 1, 'historiken bakåt ska vara kvar');
    });

    /*
     * Det farliga fallet. En flytt på femton dagar överlappar aldrig
     * fjortondagarshistoriken, så den kan inte krocka med det unika indexet
     * hur koden än ser ut — ett tidigare utkast av det här testet gick grönt
     * även med tvåstegsflytten borttagen. Dagen efter är flytten EN dag, och
     * då ligger varje persons flyttade rad precis på hennes nästa befintliga.
     */
    await t.test('dagen efter: en flytt på en dag krockar inte med det unika indexet', async () => {
      const imorgon = dagFore(IDAG, -1);
      const plan = await applyDemoTimeline(imorgon);
      assert.equal(plan.dagar, 1);
      const [{ max }] = await rad('SELECT max(service_date) max FROM check_ins');
      assert.equal(max, imorgon);
      for (const id of soldater) {
        assert.equal(Number((await rad('SELECT count(*) n FROM check_ins WHERE user_id = ?', [id]))[0].n), 14);
      }
    });

    await t.test('en andra körning samma dag ändrar ingenting', async () => {
      const fore = (await rad('SELECT user_id, service_date FROM check_ins ORDER BY user_id, service_date')).map((r) => `${r.user_id}:${r.service_date}`);
      const plan = await applyDemoTimeline(dagFore(IDAG, -1));
      assert.equal(plan.dagar, 0);
      const efter = (await rad('SELECT user_id, service_date FROM check_ins ORDER BY user_id, service_date')).map((r) => `${r.user_id}:${r.service_date}`);
      assert.deepEqual(efter, fore);
    });
  } finally {
    if (tidigare === undefined) delete process.env.PSVI_ENVIRONMENT;
    else process.env.PSVI_ENVIRONMENT = tidigare;
  }
});

/**
 * Återställning av demon.
 *
 * Besökare ska kunna radera enheter, spärra konton och byta koder — det är
 * hälften av det appen ska visa. Följden är att demon slits ner, och före en
 * visning måste den gå att ställa i ordning igen. Mot den delade databasen
 * finns ingen terminalväg dit: nycklarna är märkta som känsliga.
 *
 * Det farligaste testet här är det sista. Seedningen avgjorde tidigare på
 * egen hand om demoorganisationen skulle skapas, ur en miljövariabel som inte
 * behöver vara satt där servern kör. Läste återställningen den variabeln
 * skulle den tömma databasen och lägga tillbaka ett ensamt adminkonto med en
 * slumpmässig kod — ingen skulle kunna logga in igen, och demodatan vore
 * borta. Därför skickas valet in uttryckligen.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { database } from './setup.mjs';

test('återställningen bygger upp demon igen, oavsett vad som hänt med den', async (t) => {
  const { client } = await database();

  const { hashCode } = await import('../src/lib/auth/codes.ts');
  const { aterstallDemo } = await import('../src/lib/db/seed.ts');

  const n = async (sql, args = []) => Number((await client.execute({ sql, args })).rows[0].n);
  const tidigare = process.env.PSVI_ENVIRONMENT;
  const tidigareSeed = process.env.SEED_DEMO_DATA;

  try {
    process.env.PSVI_ENVIRONMENT = 'demo';
    // Uttryckligen AV: så ser den delade demons servermiljö ut.
    process.env.SEED_DEMO_DATA = '';

    await t.test('vägrar i pilotläge', async () => {
      process.env.PSVI_ENVIRONMENT = 'pilot';
      await assert.rejects(() => aterstallDemo(), /pilot|demo/i);
      process.env.PSVI_ENVIRONMENT = 'demo';
    });

    await aterstallDemo();

    await t.test('demons publicerade koder fungerar efteråt', async () => {
      for (const kod of ['P1G1-01', 'BEF-P1', 'BEF-KP1', 'BEF-BAT', 'ADMIN-01']) {
        const antal = await n('SELECT count(*) n FROM users WHERE code_hash = ? AND active = 1', [
          hashCode(kod),
        ]);
        assert.equal(antal, 1, `koden ${kod} gick inte att logga in med efter återställning`);
      }
    });

    await t.test('organisationen och historiken är tillbaka', async () => {
      assert.ok((await n('SELECT count(*) n FROM units')) > 30, 'enheterna saknas');
      assert.ok((await n('SELECT count(*) n FROM users')) > 200, 'personerna saknas');
      assert.ok((await n('SELECT count(*) n FROM check_ins')) > 1000, 'rapporterna saknas');
    });

    await t.test('en raderad enhet kommer tillbaka', async () => {
      const fore = await n('SELECT count(*) n FROM units');

      // Radera en hel grupp med sina personer, som en besökare kan göra.
      const grupp = Number(
        (await client.execute("SELECT id FROM units WHERE kind = 'grupp' ORDER BY id DESC LIMIT 1"))
          .rows[0].id,
      );
      await client.execute({ sql: 'DELETE FROM check_ins WHERE user_id IN (SELECT id FROM users WHERE unit_id = ?)', args: [grupp] });
      await client.execute({ sql: 'DELETE FROM users WHERE unit_id = ?', args: [grupp] });
      await client.execute({ sql: 'DELETE FROM units WHERE id = ?', args: [grupp] });
      assert.equal(await n('SELECT count(*) n FROM units'), fore - 1);

      await aterstallDemo();
      assert.equal(await n('SELECT count(*) n FROM units'), fore, 'enheten kom inte tillbaka');
    });

    await t.test('sessioner rensas — den som återställer loggas ut', async () => {
      assert.equal(await n('SELECT count(*) n FROM sessions'), 0);
    });

    await t.test('återställningen antecknas i granskningsloggen', async () => {
      const antal = await n("SELECT count(*) n FROM audit_log WHERE action = 'demo.reset'");
      assert.ok(antal >= 1, 'ingen anteckning om återställningen');
    });
  } finally {
    if (tidigare === undefined) delete process.env.PSVI_ENVIRONMENT;
    else process.env.PSVI_ENVIRONMENT = tidigare;
    if (tidigareSeed === undefined) delete process.env.SEED_DEMO_DATA;
    else process.env.SEED_DEMO_DATA = tidigareSeed;
  }
});

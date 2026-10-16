/**
 * Frågan om hälsa, och anonymitetsgränsen.
 *
 * Kolumnen är tom för rapporter från före frågan. Utan skydd hade snittet för
 * hälsa kunnat bygga på en enda persons svar en dag då fyra checkat in — fyra
 * räknas, men tre av dem saknar värde. Befälet hade då sett en enskilds
 * hälsa. Därför räknar sammanställningarna bara fullständiga rapporter.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildOrg, database } from './setup.mjs';

/** En rapport från före frågan: alla svar utom hälsa. */
async function gammal(client, userIds, date, value) {
  for (const id of userIds) {
    await client.execute({
      sql: `INSERT INTO check_ins (user_id, service_date, fysisk, psykisk, social, somn, kost, energi, created_at)
            VALUES (?,?,?,?,?,?,?,?,?)`,
      args: [id, date, value, value, value, value, value, value, new Date().toISOString()],
    });
  }
}

async function fullstandig(client, userIds, date, value) {
  for (const id of userIds) {
    await client.execute({
      sql: `INSERT INTO check_ins (user_id, service_date, fysisk, halsa, psykisk, social, somn, kost, energi, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)`,
      args: [id, date, value, value, value, value, value, value, value, new Date().toISOString()],
    });
  }
}

test('frågan är påslagen och står direkt efter fysisk form', async () => {
  const { CATEGORIES, HALSA_PA } = await import('../src/lib/data.ts');
  assert.equal(HALSA_PA, true);
  assert.deepEqual(
    CATEGORIES.map((c) => c.key).slice(0, 2),
    ['fysisk', 'halsa'],
  );
});

test('gamla rapporter utan hälsa räknas inte — en persons hälsa visas aldrig', async () => {
  const { client } = await database();
  const org = await buildOrg(client);
  const { getUnitOverview } = await import('../src/lib/db/queries/aggregates.ts');
  const { serviceDateDaysAgo } = await import('../src/lib/date.ts');

  const [a, b, c, d, e] = org.soldater['Grupp A'];
  // Fyra gamla rapporter utan hälsa, och en fullständig med hälsa 2.
  await gammal(client, [a, b, c, d], serviceDateDaysAgo(1), 6);
  await fullstandig(client, [e], serviceDateDaysAgo(1), 2);

  const ov = await getUnitOverview(org.grupper['Grupp A'], 7);
  assert.equal(ov.categories.ok, false, 'en fullständig rapport räcker inte');
});

test('med fyra fullständiga rapporter visas hälsan, som snitt', async () => {
  const { client } = await database();
  const org = await buildOrg(client);
  const { getUnitOverview, getVeckounderlag } = await import('../src/lib/db/queries/aggregates.ts');
  const { serviceDateDaysAgo } = await import('../src/lib/date.ts');

  const [a, b, c, d] = org.soldater['Grupp B'];
  await fullstandig(client, [a, b], serviceDateDaysAgo(2), 4);
  await fullstandig(client, [c, d], serviceDateDaysAgo(2), 8);

  const ov = await getUnitOverview(org.grupper['Grupp B'], 7);
  assert.equal(ov.categories.ok, true);
  assert.equal(ov.categories.data.halsa, 6);
  assert.equal((await getVeckounderlag(org.grupper['Grupp B'])).denna?.halsa, 6);
});

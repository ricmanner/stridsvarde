/**
 * Tester för gallringen.
 *
 * Det farliga med gallring är inte att den inte fungerar — det är att den
 * fungerar när ingen bett om det. Att av misstag radera hälsodata går inte
 * att ångra, så standardläget måste vara avstängt och en felskriven
 * inställning får aldrig tolkas som "radera".
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildOrg, checkIn, database } from './setup.mjs';

const dayOffset = (n) => {
  const t = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Stockholm' });
  const [y, m, d] = t.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - n * 86_400_000).toISOString().slice(0, 10);
};

test('gallring är avstängd som standard', async () => {
  const saved = process.env.RETENTION_DAYS;
  const { retentionDays } = await import('../src/lib/db/retention.ts');

  delete process.env.RETENTION_DAYS;
  assert.equal(retentionDays(), null, 'utan inställning ska inget raderas');

  process.env.RETENTION_DAYS = '';
  assert.equal(retentionDays(), null, 'tom sträng ska inte heller radera');

  process.env.RETENTION_DAYS = saved ?? '';
});

test('orimliga lagringstider tolkas aldrig som "radera"', async () => {
  const saved = process.env.RETENTION_DAYS;
  const { retentionDays } = await import('../src/lib/db/retention.ts');

  // Skulle någon av dessa ge ett tal vore konsekvensen att hälsodata
  // raderades av misstag.
  for (const värde of ['0', '-1', '5', '29', 'ett år', 'NaN', 'null']) {
    process.env.RETENTION_DAYS = värde;
    assert.equal(
      retentionDays(),
      null,
      `RETENTION_DAYS=${JSON.stringify(värde)} ska inte aktivera gallring`,
    );
  }

  // Rimliga värden ska däremot gälla.
  process.env.RETENTION_DAYS = '365';
  assert.equal(retentionDays(), 365);

  process.env.RETENTION_DAYS = saved ?? '';
});

test('gallringen raderar bara det som är äldre än gränsen', async () => {
  const { client } = await database();
  const org = await buildOrg(client);
  const soldat = org.soldater['Grupp A'];

  // Tre dagar: idag, 40 dagar sedan, 400 dagar sedan.
  await checkIn(client, soldat.slice(0, 4), dayOffset(0), 7);
  await checkIn(client, soldat.slice(0, 4), dayOffset(40), 6);
  await checkIn(client, soldat.slice(0, 4), dayOffset(400), 5);

  const räkna = async () => {
    const r = await client.execute({
      sql: 'SELECT COUNT(*) n FROM check_ins WHERE user_id IN (' + soldat.slice(0, 4).map(() => '?').join(',') + ')',
      args: soldat.slice(0, 4),
    });
    return Number(r.rows[0].n);
  };

  assert.equal(await räkna(), 12, 'tre dagar × fyra soldater');

  const saved = process.env.RETENTION_DAYS;
  const { purgeExpiredCheckIns } = await import('../src/lib/db/retention.ts');

  // Avstängd: ingenting får försvinna.
  process.env.RETENTION_DAYS = '';
  await purgeExpiredCheckIns();
  assert.equal(await räkna(), 12, 'avstängd gallring får inte radera något');

  // Ett år: bara de 400 dagar gamla ska bort.
  process.env.RETENTION_DAYS = '365';
  await purgeExpiredCheckIns();
  assert.equal(await räkna(), 8, 'endast det som är äldre än ett år ska raderas');

  process.env.RETENTION_DAYS = saved ?? '';
});

test('en enskild person kan få sina uppgifter raderade', async () => {
  const { client } = await database();
  const org = await buildOrg(client);
  const [a, b] = org.soldater['Grupp B'];

  await checkIn(client, [a, b], dayOffset(1), 7);

  const { erasePersonalData } = await import('../src/lib/db/retention.ts');
  const raderade = await erasePersonalData(a, a);

  assert.equal(raderade, 1, 'personens egna svar ska raderas');

  const kvar = await client.execute({
    sql: 'SELECT user_id FROM check_ins WHERE user_id IN (?, ?)',
    args: [a, b],
  });
  assert.equal(kvar.rows.length, 1, 'bara den andra personens svar ska finnas kvar');
  assert.equal(Number(kvar.rows[0].user_id), b);
});

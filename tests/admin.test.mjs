/**
 * Tester för administrationen.
 *
 * Båda fallen här kommer från fel som upptäcktes under användning, inte från
 * fantasi om vad som kan gå sönder.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildOrg, checkIn, database } from './setup.mjs';

const dayOffset = (n) => {
  const t = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Stockholm' });
  const [y, m, d] = t.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - n * 86_400_000).toISOString().slice(0, 10);
};

test('en ny kod behåller soldatens historik', async () => {
  const { client } = await database();
  const org = await buildOrg(client);
  const soldat = org.soldater['Grupp A'][0];

  await checkIn(client, [soldat], dayOffset(2), 6);
  await checkIn(client, [soldat], dayOffset(1), 7);

  const { reissueCode } = await import('../src/lib/db/queries/admin.ts');
  const { getOwnHistory } = await import('../src/lib/db/queries/checkins.ts');

  const före = await getOwnHistory(soldat, 14);
  assert.equal(före.length, 2);

  const resultat = await reissueCode(soldat, soldat);
  assert.equal(resultat.ok, true);

  // Koden är bara en nyckel till dörren, inte identiteten. Historiken hänger
  // på användarraden, så en ny kod får aldrig innebära att soldaten börjar om.
  const efter = await getOwnHistory(soldat, 14);
  assert.equal(efter.length, 2, 'historiken ska vara oförändrad efter kodbyte');
  assert.deepEqual(
    efter.map((r) => r.serviceDate),
    före.map((r) => r.serviceDate),
  );
});

test('en ny kod loggar ut den gamla, men inte en själv', async () => {
  const { client } = await database();
  const org = await buildOrg(client);
  const [admin, annan] = org.soldater['Grupp B'];

  const sessions = async (userId) => {
    const r = await client.execute({
      sql: 'SELECT COUNT(*) n FROM sessions WHERE user_id = ?',
      args: [userId],
    });
    return Number(r.rows[0].n);
  };
  const skapaSession = (userId) =>
    client.execute({
      sql: 'INSERT INTO sessions (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)',
      args: [`t-${userId}-${Math.random()}`, userId, Date.now() + 3_600_000, Date.now()],
    });

  await skapaSession(admin);
  await skapaSession(annan);

  const { reissueCode } = await import('../src/lib/db/queries/admin.ts');

  // Någon annans kod byts ut -> den personen loggas ut direkt, annars kan
  // den som har den gamla lappen fortsätta vara inloggad.
  await reissueCode(admin, annan);
  assert.equal(await sessions(annan), 0, 'den vars kod byttes ska loggas ut');

  // Den egna koden byts ut -> sessionen behålls, annars hinner man aldrig
  // läsa den nya koden innan man kastas ut, och blir permanent utelåst.
  await reissueCode(admin, admin);
  assert.equal(await sessions(admin), 1, 'den som byter sin egen kod ska förbli inloggad');
});

test('listan byter inte ordning när någon spärras eller aktiveras', async () => {
  const { client } = await database();
  const org = await buildOrg(client);
  const enhet = org.grupper['Grupp A'];

  // Flera personer med IDENTISKT namn — det som utlöste felet.
  const ids = [];
  for (let i = 0; i < 4; i++) {
    const r = await client.execute({
      sql: 'INSERT INTO users (code_hash,label,role,unit_id,active,created_at) VALUES (?,?,?,?,1,?)',
      args: [`dup-${enhet}-${i}`, 'Samma namn', 'soldat', enhet, new Date().toISOString()],
    });
    ids.push(Number(r.lastInsertRowid));
  }

  const { getUsersInUnit, setUserActive } = await import('../src/lib/db/queries/admin.ts');

  const ordning = async () =>
    (await getUsersInUnit(enhet)).filter((u) => ids.includes(u.id)).map((u) => u.id);

  const före = await ordning();

  // Spärra och aktivera om vartannat. Utan en bestämd sorteringsordning
  // hoppar den ändrade raden i listan, och det ser ut som att fel person
  // ändrades — vilket var precis vad som rapporterades.
  await setUserActive(ids[0], ids[2], false);
  assert.deepEqual(await ordning(), före, 'ordningen ska hålla efter spärr');

  await setUserActive(ids[0], ids[2], true);
  assert.deepEqual(await ordning(), före, 'ordningen ska hålla efter aktivering');

  await setUserActive(ids[0], ids[1], false);
  await setUserActive(ids[0], ids[3], false);
  assert.deepEqual(await ordning(), före, 'ordningen ska hålla även efter flera ändringar');

  // Och rätt person ska faktiskt ha ändrats.
  const efter = await getUsersInUnit(enhet);
  assert.equal(efter.find((u) => u.id === ids[2]).active, true);
  assert.equal(efter.find((u) => u.id === ids[1]).active, false);
  assert.equal(efter.find((u) => u.id === ids[3]).active, false);
});

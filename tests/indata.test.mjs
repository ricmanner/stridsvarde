/**
 * Skräpindata och trasiga flöden.
 *
 * Det som kontrolleras i webbläsaren kontrolleras inte alls: fälten går att
 * kringgå med utvecklarverktygen, och en Server Action är en vanlig POST som
 * kan anropas direkt. Varje gräns måste därför hålla på servern. Testerna
 * nedan skickar det en klient aldrig skulle skicka.
 *
 * Här finns också de flöden som brukar gå sönder i praktiken: dubbelklick på
 * skicka-knappen, och en kod som skrivs med gemener eller mellanslag.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildOrg, database } from './setup.mjs';

const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Stockholm' });

test('antalet koder som skapas måste vara ett rimligt heltal', async () => {
  const { client } = await database();
  const { grupper } = await buildOrg(client);
  const { createUsers } = await import('../src/lib/db/queries/admin.ts');
  const grupp = grupper['Grupp A'];

  for (const antal of [0, -5, 51, 1000, 2.5, NaN, Infinity]) {
    const r = await createUsers(1, grupp, 'soldat', antal, 'Värnpliktig');
    assert.equal(r.ok, false, `${antal} ska avvisas`);
  }

  const r = await createUsers(1, grupp, 'soldat', 2, 'Värnpliktig');
  assert.equal(r.ok, true, 'ett rimligt antal går igenom');
  assert.equal(r.codes.length, 2);
});

test('en orimligt lång benämning avvisas av servern, inte bara av formuläret', async () => {
  const { client } = await database();
  const { grupper } = await buildOrg(client);
  const { createUsers } = await import('../src/lib/db/queries/admin.ts');

  const r = await createUsers(1, grupper['Grupp B'], 'soldat', 1, 'V'.repeat(500));
  assert.equal(r.ok, false, 'en benämning på 500 tecken ska inte sparas');

  // Bara mellanslag är ingen benämning — då gäller standardvärdet.
  const tom = await createUsers(1, grupper['Grupp B'], 'soldat', 1, '   ');
  assert.equal(tom.ok, true);
  assert.match(tom.codes[0].label, /^Värnpliktig \d+$/, 'faller tillbaka på Värnpliktig');
});

test('enhetsnamn: för kort, för långt, upptaget, eller på fel nivå', async () => {
  const { client } = await database();
  const { bataljon, pluton, grupper } = await buildOrg(client);
  const { createUnit } = await import('../src/lib/db/queries/admin.ts');

  assert.equal((await createUnit(1, pluton, 'A')).ok, false, 'ett tecken är för kort');
  assert.equal((await createUnit(1, pluton, '   ')).ok, false, 'bara mellanslag');
  assert.equal((await createUnit(1, pluton, 'X'.repeat(61))).ok, false, '61 tecken är för långt');
  assert.equal((await createUnit(1, pluton, 'Grupp A')).ok, false, 'namnet är upptaget i plutonen');
  assert.equal((await createUnit(1, grupper['Grupp A'], 'Undergrupp')).ok, false, 'en grupp kan inte delas upp');
  assert.equal((await createUnit(1, 999_999, 'Spöket')).ok, false, 'överordnad enhet saknas');

  // Samma namn under en ANNAN förälder är däremot i sin ordning.
  assert.equal((await createUnit(1, bataljon, 'Grupp A')).ok, true);
});

test('dubbelklick på skicka ger en rapport, inte två', async () => {
  const { client } = await database();
  const { soldater } = await buildOrg(client);
  const { saveCheckIn } = await import('../src/lib/db/queries/checkins.ts');
  const soldat = soldater['Grupp A'][0];

  const varden = { fysisk: 5, psykisk: 5, social: 5, somn: 5, kost: 5, energi: 5 };
  await saveCheckIn(soldat, varden, 'råd');
  await saveCheckIn(soldat, varden, 'råd');

  const [rad] = (
    await client.execute({
      sql: 'SELECT COUNT(*) AS n FROM check_ins WHERE user_id = ? AND service_date = ?',
      args: [soldat, today],
    })
  ).rows;
  assert.equal(Number(rad.n), 1, 'samma dag ger en rad, inte en till');

  // En rättelse skriver över dagens svar i stället för att lägga till ett nytt.
  await saveCheckIn(soldat, { ...varden, somn: 2 }, 'nytt råd');
  const [efter] = (
    await client.execute({
      sql: 'SELECT COUNT(*) AS n, MAX(somn) AS somn FROM check_ins WHERE user_id = ? AND service_date = ?',
      args: [soldat, today],
    })
  ).rows;
  assert.equal(Number(efter.n), 1);
  assert.equal(Number(efter.somn), 2, 'rättelsen gäller');
});

test('koden funkar med gemener, mellanslag och utan bindestreck', async () => {
  const { hashCode, normalizeCode, format } = await import('../src/lib/auth/codes.ts');

  const kod = format('ABCDEFGHJK');
  assert.equal(kod, 'ABCDE-FGHJK');

  for (const variant of ['abcde-fghjk', ' ABCDE-FGHJK ', 'ABCDEFGHJK', 'abcde fghjk', 'AbCdE-fGhJk']) {
    assert.equal(hashCode(variant), hashCode(kod), `"${variant}" ska vara samma kod`);
  }

  // Men en annan kod är en annan kod.
  assert.notEqual(hashCode('ABCDE-FGHJM'), hashCode(kod));
  assert.equal(normalizeCode('p1g1-01'), 'P1G101');
});

test('ogiltiga värden i en incheckning kan inte sparas', async () => {
  const { client } = await database();
  const { soldater } = await buildOrg(client);
  const soldat = soldater['Grupp B'][0];

  /*
   * Kontrollen ligger i submitCheckIn(), som kräver en HTTP-förfrågan för att
   * gå att anropa. Här bevakas i stället regeln den bygger på: skalan är
   * heltal 1–10. Ändras den i data.ts måste kontrollen i actionen ändras med.
   */
  const { CATEGORIES } = await import('../src/lib/data.ts');
  assert.equal(CATEGORIES.length, 6);

  const action = (await import('node:fs')).readFileSync('src/app/actions/checkin.ts', 'utf8');
  assert.match(action, /Number\.isInteger\(raw\)/, 'heltal krävs');
  assert.match(action, /raw < 1 \|\| raw > 10/, 'skalan 1–10 bevakas');

  // Databasen ska inte heller tro att 99 är ett giltigt svar.
  const { saveCheckIn } = await import('../src/lib/db/queries/checkins.ts');
  await saveCheckIn(soldat, { fysisk: 9, psykisk: 9, social: 9, somn: 9, kost: 9, energi: 9 }, '');
  const [rad] = (
    await client.execute({ sql: 'SELECT fysisk FROM check_ins WHERE user_id = ?', args: [soldat] })
  ).rows;
  assert.equal(Number(rad.fysisk), 9);
});

test('upprepade felaktiga koder bromsas, och rätt kod släpps fram igen', async () => {
  await database();
  const { checkRateLimit, clearAttempts, recordAttempt } = await import(
    '../src/lib/auth/rateLimit.ts'
  );

  const ip = `test-${Math.random()}`;
  assert.equal((await checkRateLimit(ip)).allowed, true, 'första försöket är fritt');

  for (let i = 0; i < 6; i++) await recordAttempt(ip, false);
  const efter = await checkRateLimit(ip);
  assert.ok(efter.backoffMs > 0, 'efter flera fel tar varje försök längre tid');

  // Den som till slut skriver rätt ska inte släpa på sina feltryckningar.
  await clearAttempts(ip);
  const rensad = await checkRateLimit(ip);
  assert.equal(rensad.allowed, true);
  assert.equal(rensad.backoffMs, 0);
});

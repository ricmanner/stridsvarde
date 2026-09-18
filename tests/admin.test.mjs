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
  // Utfärdaren är en annan person — sin egen kod går inte att byta.
  const [soldat, befal] = org.soldater['Grupp A'];

  await checkIn(client, [soldat], dayOffset(2), 6);
  await checkIn(client, [soldat], dayOffset(1), 7);

  const { reissueCode } = await import('../src/lib/db/queries/admin.ts');
  const { getOwnHistory } = await import('../src/lib/db/queries/checkins.ts');

  const före = await getOwnHistory(soldat, 14);
  assert.equal(före.length, 2);

  const resultat = await reissueCode(befal, soldat);
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

test('en ny kod loggar ut den gamla — och den egna går inte att byta', async () => {
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

  /*
   * Sin egen kod går inte att byta.
   *
   * Tidigare gick det, med sessionen bevarad så att man hann läsa den nya
   * koden. Det räckte inte: koden visas en enda gång och lagras bara som
   * hash, och ett felklick låste ute administratören tre gånger under
   * utvecklingen. Varje gång krävdes terminalåtkomst för att komma in igen.
   */
  const svar = await reissueCode(admin, admin);
  assert.equal(svar.ok, false, 'den egna koden ska inte gå att byta');

  // Och ingenting får ha hänt: varken kod eller session.
  assert.equal(await sessions(admin), 1, 'den egna sessionen rörs inte');

  const kvar = await client.execute({
    sql: 'SELECT code_hash FROM users WHERE id = ?',
    args: [admin],
  });
  assert.equal(kvar.rows[0].code_hash, `hash-${org.grupper['Grupp B']}-1`,
    'den egna koden ska vara oförändrad');
});

test('en soldat kan flyttas och behåller kod och historik', async () => {
  const { client } = await database();
  const org = await buildOrg(client);
  const soldat = org.soldater['Grupp A'][0];

  await checkIn(client, [soldat], dayOffset(2), 6);
  await checkIn(client, [soldat], dayOffset(1), 4);

  const kodFöre = (
    await client.execute({ sql: 'SELECT code_hash FROM users WHERE id = ?', args: [soldat] })
  ).rows[0].code_hash;

  const { moveUser } = await import('../src/lib/db/queries/admin.ts');
  const { getOwnHistory } = await import('../src/lib/db/queries/checkins.ts');

  const resultat = await moveUser(soldat, soldat, org.grupper['Grupp B']);
  assert.equal(resultat.ok, true, resultat.ok ? '' : resultat.error);

  const efter = await client.execute({
    sql: 'SELECT unit_id, code_hash FROM users WHERE id = ?',
    args: [soldat],
  });
  assert.equal(Number(efter.rows[0].unit_id), org.grupper['Grupp B'], 'ska tillhöra den nya enheten');
  assert.equal(efter.rows[0].code_hash, kodFöre, 'koden ska inte ändras av en flytt');

  // Poängen med flytten: slippa spärra kontot och kasta historiken.
  const historik = await getOwnHistory(soldat, 14);
  assert.equal(historik.length, 2, 'historiken ska följa med personen');
});

test('en person kan inte placeras på en nivå rollen inte hör hemma på', async () => {
  const { client } = await database();
  const org = await buildOrg(client);

  const plutonchef = Number(
    (
      await client.execute({
        sql: 'INSERT INTO users (code_hash,label,role,unit_id,active,created_at) VALUES (?,?,?,?,1,?)',
        args: [`chef-${org.pluton}`, 'Plutonchef', 'pluton', org.pluton, new Date().toISOString()],
      })
    ).lastInsertRowid,
  );

  const { moveUser } = await import('../src/lib/db/queries/admin.ts');

  // En plutonchef hör hemma på en pluton, inte på en grupp under den.
  const fel = await moveUser(plutonchef, plutonchef, org.grupper['Grupp A']);
  assert.equal(fel.ok, false, 'ska avvisas');

  // Men till en annan pluton går bra.
  const nyPluton = Number(
    (
      await client.execute({
        sql: 'INSERT INTO units (name, kind, parent_id, created_at) VALUES (?,?,?,?)',
        args: ['Pluton 2', 'pluton', org.kompani, new Date().toISOString()],
      })
    ).lastInsertRowid,
  );
  const ok = await moveUser(plutonchef, plutonchef, nyPluton);
  assert.equal(ok.ok, true, 'flytt till rätt nivå ska gå igenom');
});

test('radering av personuppgifter träffar bara den personen', async () => {
  const { client } = await database();
  const org = await buildOrg(client);
  const [a, b] = org.soldater['Grupp A'];

  await checkIn(client, [a, b], dayOffset(1), 5);
  await checkIn(client, [a], dayOffset(2), 5);

  const { erasePersonalData } = await import('../src/lib/db/retention.ts');
  const antal = await erasePersonalData(a, a);

  assert.equal(antal, 2, 'personens alla svar ska raderas');

  // Kontot ska finnas kvar — annars blir svarsfrekvensen fel för enheten.
  const konto = await client.execute({ sql: 'SELECT unit_id, active FROM users WHERE id = ?', args: [a] });
  assert.equal(konto.rows.length, 1, 'kontot ska inte raderas');
  assert.equal(Number(konto.rows[0].active), 1);

  const kvar = await client.execute({
    sql: 'SELECT COUNT(*) n FROM check_ins WHERE user_id = ?',
    args: [b],
  });
  assert.equal(Number(kvar.rows[0].n), 1, 'den andra personens svar ska vara orörda');
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

test('en ny benämning ändrar bara namnet, inte personen', async () => {
  const { client } = await database();
  const org = await buildOrg(client);
  const soldat = org.soldater['Grupp A'][0];

  await checkIn(client, [soldat], dayOffset(2), 6);
  await checkIn(client, [soldat], dayOffset(1), 7);

  const { renameUser, getUsersInUnit } = await import('../src/lib/db/queries/admin.ts');
  const { getOwnHistory } = await import('../src/lib/db/queries/checkins.ts');

  const före = await getOwnHistory(soldat, 14);
  const resultat = await renameUser(soldat, soldat, '  Andersson 3. grp  ');
  assert.equal(resultat.ok, true);

  // Trimmas, inte sparas som den skrevs.
  assert.equal(resultat.label, 'Andersson 3. grp');

  const rader = await getUsersInUnit(org.grupper['Grupp A']);
  const rad = rader.find((r) => r.id === soldat);
  assert.equal(rad.label, 'Andersson 3. grp');

  // Benämningen är en etikett på raden. Den får inte röra vare sig kod,
  // behörighet eller historik — annars vore ett namnbyte ett riskmoment
  // i stället för ett administrativt handgrepp.
  const efter = await getOwnHistory(soldat, 14);
  assert.deepEqual(
    efter.map((r) => r.serviceDate),
    före.map((r) => r.serviceDate),
    'historiken ska vara oförändrad efter namnbyte',
  );
});

test('en tom eller för lång benämning avvisas', async () => {
  const { client } = await database();
  const org = await buildOrg(client);
  const soldat = org.soldater['Grupp A'][1];

  const { renameUser, getUsersInUnit, MAX_LABEL } = await import(
    '../src/lib/db/queries/admin.ts'
  );

  const ursprunglig = (await getUsersInUnit(org.grupper['Grupp A'])).find(
    (r) => r.id === soldat,
  ).label;

  for (const ogiltig of ['', '   ', 'x'.repeat(MAX_LABEL + 1)]) {
    const resultat = await renameUser(soldat, soldat, ogiltig);
    assert.equal(resultat.ok, false, `"${ogiltig.slice(0, 12)}…" borde avvisas`);
  }

  // Ingen av de avvisade försöken får ha hunnit skriva något.
  const efteråt = (await getUsersInUnit(org.grupper['Grupp A'])).find(
    (r) => r.id === soldat,
  ).label;
  assert.equal(efteråt, ursprunglig);

  // Gränsen ska gå precis där den sägs gå, inte en bit därifrån.
  assert.equal((await renameUser(soldat, soldat, 'x'.repeat(MAX_LABEL))).ok, true);
});

test('radering tar bort både kontot och personens rapporter', async () => {
  const { client } = await database();
  const org = await buildOrg(client);
  const [a, b] = org.soldater['Grupp B'];

  await checkIn(client, [a, b], dayOffset(1), 6);
  await checkIn(client, [a, b], dayOffset(2), 5);

  const { deleteUser, getUsersInUnit } = await import('../src/lib/db/queries/admin.ts');
  const { erasePersonalData } = await import('../src/lib/db/retention.ts');

  // Samma ordning som deleteUserAction: hälsodatan först, sedan kontot.
  const raderade = await erasePersonalData(b, a);
  assert.equal(raderade, 2);
  assert.equal((await deleteUser(b, a)).ok, true);

  const kvar = await getUsersInUnit(org.grupper['Grupp B']);
  assert.equal(kvar.find((r) => r.id === a), undefined, 'raden ska vara borta');

  const rader = await client.execute({
    sql: 'SELECT count(*) AS n FROM check_ins WHERE user_id = ?',
    args: [a],
  });
  assert.equal(Number(rader.rows[0].n), 0, 'inga incheckningar får ligga kvar');

  // Grannen rörs inte.
  const grannen = await client.execute({
    sql: 'SELECT count(*) AS n FROM check_ins WHERE user_id = ?',
    args: [b],
  });
  assert.equal(Number(grannen.rows[0].n), 2);
});

test('radering som avvisas hinner inte radera något', async () => {
  const { client } = await database();
  const org = await buildOrg(client);
  const jag = org.soldater['Grupp A'][0];

  await checkIn(client, [jag], dayOffset(1), 6);

  const { canDeleteUser, deleteUser } = await import('../src/lib/db/queries/admin.ts');

  /*
   * Det här är hela poängen med att kontrollen ligger före raderingen i
   * deleteUserAction. Gick den efteråt vore hälsodatan redan borta när vi
   * upptäckte att kontot inte får tas bort — personen skulle stå kvar utan
   * sin historik, och ingenting skulle säga att det hänt.
   */
  const svar = await canDeleteUser(jag, jag);
  assert.equal(svar.ok, false, 'sitt eget konto får inte tas bort');

  assert.equal((await deleteUser(jag, jag)).ok, false);

  const kvar = await client.execute({
    sql: 'SELECT count(*) AS n FROM check_ins WHERE user_id = ?',
    args: [jag],
  });
  assert.equal(Number(kvar.rows[0].n), 1, 'incheckningen ska vara kvar');
});

test('den sista administratören går inte att ta bort', async () => {
  const { client } = await database();
  const org = await buildOrg(client);
  const annan = org.soldater['Grupp A'][2];

  const admin = Number(
    (
      await client.execute({
        sql: 'INSERT INTO users (code_hash, label, role, unit_id, active, created_at) VALUES (?,?,?,?,1,?) RETURNING id',
        args: ['hash-admin', 'Administratör', 'admin', org.bataljon, new Date().toISOString()],
      })
    ).rows[0].id,
  );

  const { canDeleteUser } = await import('../src/lib/db/queries/admin.ts');

  assert.equal((await canDeleteUser(annan, admin)).ok, false, 'ensam admin skyddas');

  // Med en till administratör finns det ingen risk att låsa ute någon.
  await client.execute({
    sql: 'INSERT INTO users (code_hash, label, role, unit_id, active, created_at) VALUES (?,?,?,?,1,?)',
    args: ['hash-admin-2', 'Administratör 2', 'admin', org.bataljon, new Date().toISOString()],
  });

  assert.equal((await canDeleteUser(annan, admin)).ok, true);
});

test('demons publicerade konton går inte att förstöra — men bara i demoläge', async () => {
  const { client } = await database();
  const org = await buildOrg(client);
  const admin = org.soldater['Grupp A'][3];

  const { hashCode } = await import('../src/lib/auth/codes.ts');
  const { PUBLICERADE_DEMOKODER } = await import('../src/lib/demo.ts');
  const { reissueCode, canDeleteUser, canErasePersonalData, setUserActive } = await import(
    '../src/lib/db/queries/admin.ts'
  );

  // Ett konto med en av de publicerade koderna, och ett helt vanligt.
  const skapa = async (codeHash, label) =>
    Number(
      (
        await client.execute({
          sql: 'INSERT INTO users (code_hash, label, role, unit_id, active, created_at) VALUES (?,?,?,?,1,?) RETURNING id',
          args: [codeHash, label, 'soldat', org.grupper['Grupp A'], new Date().toISOString()],
        })
      ).rows[0].id,
    );

  const publicerat = await skapa(hashCode(PUBLICERADE_DEMOKODER[0].kod), 'Demoingång');
  const eget = await skapa(`hash-eget-${Date.now()}`, 'Egen testperson');

  const tidigare = process.env.PSVI_ENVIRONMENT;
  try {
    process.env.PSVI_ENVIRONMENT = 'demo';

    /*
     * Demon publicerar sina koder. Utan det här kan vem som helst logga in
     * som administratör och spärra, byta kod på eller radera just det konto
     * länken bygger på — och då är demonstrationen trasig för alla som
     * kommer efter, tills någon seedar om databasen.
     */
    assert.equal((await reissueCode(admin, publicerat)).ok, false, 'ny kod ska vägras');
    assert.equal((await canDeleteUser(admin, publicerat)).ok, false, 'radering ska vägras');
    assert.equal(
      (await setUserActive(admin, publicerat, false)).ok,
      false,
      'spärr ska vägras',
    );
    assert.equal(
      (await canErasePersonalData(publicerat)).ok,
      false,
      'att nolla hälsodatan ska vägras — annars står demon utan historik',
    );

    // Skyddet gäller de fem, inte administrationen i stort. Ett konto som
    // besökaren skapat själv ska gå att hantera som vanligt — annars går
    // funktionerna inte att visa upp.
    assert.equal((await reissueCode(admin, eget)).ok, true, 'eget konto ska gå att röra');
    assert.equal((await canDeleteUser(admin, eget)).ok, true);

    // I pilotläge finns inga kända koder, och därmed inget att skydda.
    process.env.PSVI_ENVIRONMENT = 'pilot';
    assert.equal(
      (await canDeleteUser(admin, publicerat)).ok,
      true,
      'skyddet hör till demoläget, inte till kontot',
    );
  } finally {
    if (tidigare === undefined) delete process.env.PSVI_ENVIRONMENT;
    else process.env.PSVI_ENVIRONMENT = tidigare;
  }
});

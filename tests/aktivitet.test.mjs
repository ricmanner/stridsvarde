/**
 * Aktivitetsloggen — en sida bara Richard når, med en egen kod.
 *
 * Kollegorna ska kunna utforska demon fritt. ADMIN-01 står på
 * inloggningssidan, så en logg i adminvyn eller på /status hade alla kunnat
 * läsa. Loggen ligger därför bakom en egen kod, satt som hemlighet i Vercel
 * (LOGG_KOD) och inte i databasen — annars hade en återställning tagit den.
 *
 * Loggraderna säger roll och enhet, aldrig benämning. Granskningsloggen
 * sparar med flit inga namn: i skarp drift kan benämningen vara ett namn,
 * och den som raderas via erasePersonalData skulle annars ligga kvar här.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildOrg, checkIn, database } from './setup.mjs';

const idag = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Stockholm' });

test('loggkoden känns igen, och bara när den är satt', async () => {
  const { arLoggkod, loggBiljett } = await import('../src/lib/auth/loggkod.ts');
  const tidigare = process.env.LOGG_KOD;
  try {
    process.env.LOGG_KOD = 'ABCDE-FGHJK';
    assert.equal(arLoggkod('abcde fghjk'), true, 'skrivs som vilken kod som helst');
    assert.equal(arLoggkod('ABCDE-FGHJX'), false);
    assert.equal(arLoggkod(''), false);
    const biljett = loggBiljett();
    assert.ok(biljett && biljett.length >= 32);

    process.env.LOGG_KOD = 'KLMNP-QRSTU';
    assert.notEqual(loggBiljett(), biljett, 'byts koden gäller inte den gamla biljetten');

    // Utan kod — eller med en för kort — finns ingen väg in.
    delete process.env.LOGG_KOD;
    assert.equal(arLoggkod(''), false);
    assert.equal(arLoggkod('ABCDE-FGHJK'), false);
    assert.equal(loggBiljett(), null);
    process.env.LOGG_KOD = 'ABC';
    assert.equal(arLoggkod('ABC'), false, 'en för kort kod stänger loggen i stället för att öppna den');
  } finally {
    if (tidigare === undefined) delete process.env.LOGG_KOD;
    else process.env.LOGG_KOD = tidigare;
  }
});

test('loggraderna säger roll och enhet, aldrig benämning', async () => {
  const { client } = await database();
  const org = await buildOrg(client);
  const [soldat, annan] = org.soldater['Grupp A'];
  const { reissueCode, setUserActive } = await import('../src/lib/db/queries/admin.ts');
  const { beskrivPerson } = await import('../src/lib/db/queries/aktivitet.ts');

  const senaste = async () =>
    (await client.execute('SELECT action, detail FROM audit_log ORDER BY id DESC LIMIT 1')).rows[0];

  assert.equal(await beskrivPerson(soldat), 'värnpliktig i Bataljonen › 1. Kompaniet › Pluton 1 › Grupp A');

  await reissueCode(annan, soldat);
  let rad = await senaste();
  assert.equal(rad.action, 'code.reissue');
  assert.match(String(rad.detail), /värnpliktig i .*Grupp A/);
  assert.doesNotMatch(String(rad.detail), /Soldat \d/, 'benämningen får inte hamna i loggen');

  await setUserActive(annan, soldat, false);
  rad = await senaste();
  assert.equal(rad.action, 'user.deactivate');
  assert.match(String(rad.detail), /värnpliktig i .*Grupp A/);
  await setUserActive(annan, soldat, true);
});

test('loggen överlever en återställning, och återställningen står i den', async () => {
  const { client } = await database();
  const org = await buildOrg(client);
  const { aterstallDemo } = await import('../src/lib/db/seed.ts');
  const { senasteHandelser, sammanfattningSedanAterstallning } = await import('../src/lib/db/queries/aktivitet.ts');

  await client.execute({
    sql: `INSERT INTO audit_log (actor_user_id, action, detail, created_at) VALUES (NULL, 'unit.create', ?, ?)`,
    args: ['grupp "Före" i Bataljonen', new Date(Date.now() - 60_000).toISOString()],
  });

  const tidigare = process.env.PSVI_ENVIRONMENT;
  process.env.PSVI_ENVIRONMENT = 'demo';
  try {
    await aterstallDemo();
  } finally {
    process.env.PSVI_ENVIRONMENT = tidigare;
  }

  const handelser = await senasteHandelser(50);
  const fore = handelser.findIndex((h) => h.detalj?.includes('"Före"'));
  const reset = handelser.findIndex((h) => h.slag === 'demo.reset');
  assert.ok(fore >= 0, 'raden från före återställningen finns kvar');
  assert.ok(reset >= 0, 'återställningen står i loggen');
  assert.ok(reset < fore, 'återställningen står efter det som hände före den (nyast först)');
  assert.equal(handelser[reset].text, 'Demon återställdes');

  // Incheckningar räknas från återställningen, inte med demons historik.
  const fran = await sammanfattningSedanAterstallning();
  assert.equal(fran.incheckningar, 0, 'demons egen historik räknas inte som aktivitet');
  // En som inte redan har dagens incheckning i demons historik (P1G1-serien).
  const [forst] = (
    await client.execute({
      sql: `SELECT id FROM users WHERE role = 'soldat'
               AND id NOT IN (SELECT user_id FROM check_ins WHERE service_date = ?) LIMIT 1`,
      args: [idag()],
    })
  ).rows;
  await checkIn(client, [Number(forst.id)], idag(), 6);
  const efter = await sammanfattningSedanAterstallning();
  assert.equal(efter.incheckningar, 1);
  void org;
});

/*
 * Proxyn skickar varje besök utan sessionskaka till inloggningen. Den som
 * skrivit loggkoden har ingen session — bara loggens egen kaka — och hade
 * aldrig kommit fram. /logg släpps därför igenom och bär sitt eget lås,
 * requireLoggatkomst(), som varje annan öppen väg (se PUBLIC_PATHS).
 */
test('proxyn släpper fram loggen, som bär sitt eget lås', async () => {
  const { proxy } = await import('../src/proxy.ts');
  const { NextRequest } = await import('next/server');
  const { readFileSync } = await import('node:fs');

  const svar = proxy(new NextRequest(new Request('https://exempel.test/logg')));
  assert.equal(svar.status, 200, 'loggen skickades till inloggningen');
  assert.equal(svar.headers.get('location'), null);

  const sida = readFileSync('src/app/logg/page.tsx', 'utf8');
  assert.match(sida, /await requireLoggatkomst\(\)/, 'loggsidan saknar sitt lås');
});

/**
 * Felloggen och hälsokontrollen.
 *
 * Loggen finns för att ett fel som ingen ser aldrig blir rättat. Men den är
 * också en ny plats där uppgifter kan hamna, och den läses av en
 * administratör. Testerna nedan bevakar båda sakerna: att felet fastnar, och
 * att inget mer än felet fastnar.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { database } from './setup.mjs';

test('ett fel sparas med plats och meddelande — och inget mer', async () => {
  const { client } = await database();
  const { logError } = await import('../src/lib/db/queries/health.ts');

  await logError({
    // Frågesträngen kan innehålla vad som helst och ska inte följa med.
    path: '/pluton?period=7&hemligt=abc',
    routeType: 'render',
    digest: '1234567890',
    message: 'Kan inte läsa egenskapen scores\n    at LeaderDashboard (app.js:12:9)',
  });

  const [rad] = (
    await client.execute("SELECT * FROM error_log ORDER BY id DESC LIMIT 1")
  ).rows;

  assert.equal(rad.path, '/pluton', 'sökvägen sparas utan frågesträng');
  assert.equal(rad.route_type, 'render');
  assert.equal(rad.message, 'Kan inte läsa egenskapen scores', 'bara första raden, inget stackspår');
  assert.ok(!String(rad.message).includes('at LeaderDashboard'));

  // Tabellen har inga kolumner för vem som var inloggad eller vad som svarats.
  const kolumner = (await client.execute('PRAGMA table_info(error_log)')).rows.map((r) => r.name);
  assert.deepEqual(kolumner.sort(), ['created_at', 'digest', 'id', 'message', 'path', 'route_type']);
});

test('ett långt felmeddelande kortas', async () => {
  const { client } = await database();
  const { logError } = await import('../src/lib/db/queries/health.ts');

  await logError({ path: '/x', message: 'A'.repeat(5000) });
  const [rad] = (await client.execute('SELECT message FROM error_log ORDER BY id DESC LIMIT 1')).rows;
  assert.ok(String(rad.message).length <= 300, 'meddelandet får inte svälla loggen');
});

test('loggningen kastar aldrig vidare — ett fel i felhanteringen är inte användarens problem', async () => {
  await database();
  const { logError } = await import('../src/lib/db/queries/health.ts');

  // Sökvägen är inte ens en sträng. Funktionen ska ändå inte kasta.
  await logError({ path: '/trasig', message: 'fel', digest: undefined, routeType: undefined });
  await assert.doesNotReject(() => logError({ path: '/trasig', message: '' }));
});

test('sammanställningen räknar rätt och visar de senaste först', async () => {
  const { client } = await database();
  const { errorSummary } = await import('../src/lib/db/queries/health.ts');

  const nu = Date.now();
  const iso = (msTillbaka) => new Date(nu - msTillbaka).toISOString();
  const lagg = (path, when) =>
    client.execute({
      sql: 'INSERT INTO error_log (path, route_type, digest, message, created_at) VALUES (?,?,?,?,?)',
      args: [path, 'render', null, `fel på ${path}`, when],
    });

  // Utgå från ett tomt bord: andra tester i filen har lagt in rader.
  await client.execute('DELETE FROM error_log');

  await lagg('/nyss', iso(60_000));
  await lagg('/igar', iso(30 * 3_600_000));
  await lagg('/forra-veckan', iso(9 * 86_400_000));

  const s = await errorSummary(5);
  assert.equal(s.senaste24h, 1, 'bara felet från i natt räknas som senaste dygnet');
  assert.equal(s.senaste7d, 2, 'det nio dagar gamla ligger utanför veckan');
  assert.equal(s.rader[0].path, '/nyss', 'senaste överst');
});

test('gamla fel gallras bort', async () => {
  const { client } = await database();
  const { purgeOldErrors, ERROR_RETENTION_DAYS } = await import('../src/lib/db/queries/health.ts');

  await client.execute('DELETE FROM error_log');
  const iso = (dagar) => new Date(Date.now() - dagar * 86_400_000).toISOString();
  for (const dagar of [1, 10, ERROR_RETENTION_DAYS + 1, ERROR_RETENTION_DAYS + 40]) {
    await client.execute({
      sql: 'INSERT INTO error_log (path, message, created_at) VALUES (?,?,?)',
      args: ['/x', 'fel', iso(dagar)],
    });
  }

  const raderade = await purgeOldErrors();
  assert.equal(raderade, 2, 'de två äldre än gränsen tas bort');

  const [kvar] = (await client.execute('SELECT COUNT(*) AS n FROM error_log')).rows;
  assert.equal(Number(kvar.n), 2, 'de färska ligger kvar');
});

test('hälsokontrollen svarar utan att avslöja något om innehållet', async () => {
  await database();
  const { health } = await import('../src/lib/db/queries/health.ts');

  const svar = await health();
  assert.equal(svar.ok, true);
  assert.ok(['demo', 'pilot'].includes(svar.miljo));
  assert.match(svar.tid, /^\d{4}-\d{2}-\d{2}T/);

  // Inga antal, inga namn, ingen sökväg till databasen.
  assert.deepEqual(Object.keys(svar).sort(), ['miljo', 'ok', 'tid']);
});

test('knappen på statussidan skapar samma tabell som migrationen', async () => {
  const { createClient } = await import('@libsql/client');
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { readFileSync } = await import('node:fs');
  const path = await import('node:path');

  const { ERROR_LOG_DDL } = await import('../src/lib/db/queries/health.ts');

  /*
   * Satserna i koden och i migrationen måste ge samma tabell. Annars får en
   * databas som satts upp med knappen ett annat schema än en som migrerats,
   * och skillnaden märks först när något går fel.
   */
  const migration = readFileSync(path.join(process.cwd(), 'drizzle', '0002_fellogg.sql'), 'utf8');

  const normalisera = (t) =>
    t.replace(/IF NOT EXISTS /gi, '').replace(/\s+/g, ' ').replace(/;\s*$/, '').trim();

  const franMigration = migration
    .split('--> statement-breakpoint')
    .map(normalisera)
    .filter(Boolean);
  const franKoden = ERROR_LOG_DDL.map(normalisera);

  assert.deepEqual(franKoden, franMigration, 'knappens SQL har glidit isär från migrationen');

  // Och den ska faktiskt gå att köra mot en tom databas, två gånger i rad.
  const dir = mkdtempSync(path.join(tmpdir(), 'psvi-ddl-'));
  const klient = createClient({ url: `file:${path.join(dir, 'tom.db')}` });
  for (const runda of [1, 2]) {
    for (const sats of ERROR_LOG_DDL) {
      await klient.execute(sats);
    }
    assert.ok(runda, 'andra körningen får inte kasta');
  }
  await klient.execute({
    sql: 'INSERT INTO error_log (path, message, created_at) VALUES (?,?,?)',
    args: ['/x', 'fel', new Date().toISOString()],
  });
  const [rad] = (await klient.execute('SELECT COUNT(*) AS n FROM error_log')).rows;
  assert.equal(Number(rad.n), 1, 'tabellen går att skriva till');
});

test('utan tabellen kraschar ingenting — statussidan säger bara att loggen saknas', async () => {
  const { client } = await database();
  const { errorSummary, purgeOldErrors, logError, ERROR_LOG_DDL } = await import(
    '../src/lib/db/queries/health.ts'
  );

  /*
   * Samma läge som mellan en driftsättning och den stund då någon satt upp
   * loggen i den delade databasen. Utan det här testet upptäcktes felet först
   * när servern vägrade starta: databasfelet ligger inbäddat under `cause`,
   * och kontrollen letade bara i det yttersta meddelandet.
   */
  await client.execute('DROP TABLE IF EXISTS error_log');
  try {
    await assert.doesNotReject(() => purgeOldErrors(), 'gallringen körs vid start');
    await assert.doesNotReject(() => logError({ path: '/x', message: 'fel' }));

    const s = await errorSummary(5);
    assert.equal(s.uppsatt, false, 'statussidan får veta att loggen inte är uppsatt');
    assert.deepEqual(s.rader, []);
  } finally {
    for (const sats of ERROR_LOG_DDL) await client.execute(sats);
  }
});

/**
 * Förbereder en databas: kör migrationer och seedar vid behov.
 *
 *   npm run db:setup
 *
 * Läser .env som vanligt, så mot en fjärrdatabas sätter du DATABASE_URL och
 * DATABASE_AUTH_TOKEN där (eller före kommandot) innan du kör.
 *
 * Varför det här behövs: migrationer och seed körs annars vid serverstart.
 * Lokalt mot en fil tar det under en sekund. Mot en fjärrdatabas är det
 * tusentals insättningar över nätet, inne i en serverlös funktion med
 * tidsgräns — första besökaren skulle få vänta ut den, och troligen få en
 * timeout i stället för en inloggningssida.
 *
 * Kör det här en gång innan driftsättning, så är servern klar direkt.
 */
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');

// Läs .env på samma sätt som Next.js gör, utan att dra in ramverket.
for (const file of ['.env', '.env.local']) {
  try {
    for (const line of readFileSync(path.join(ROOT, file), 'utf8').split('\n')) {
      if (!line.includes('=') || line.trimStart().startsWith('#')) continue;
      const i = line.indexOf('=');
      const key = line.slice(0, i).trim();
      if (!process.env[key]) process.env[key] = line.slice(i + 1).trim();
    }
  } catch {
    /* filen behöver inte finnas */
  }
}

// Samma resolver som testerna använder, så appens egen kod kan köras direkt.
register('../tests/ts-resolver.mjs', pathToFileURL(path.join(ROOT, 'scripts/')));

const remote = process.env.DATABASE_URL?.startsWith('libsql://');
console.log(`\n  Mål: ${remote ? process.env.DATABASE_URL : process.env.DATABASE_PATH ?? './data/psvi.db'}`);
console.log(`  Läge: ${process.env.PSVI_ENVIRONMENT === 'demo' ? 'demo' : 'pilot'}`);
console.log(`  Seedar demodata: ${process.env.SEED_DEMO_DATA === 'true' ? 'ja' : 'nej'}\n`);

if (remote && !process.env.DATABASE_AUTH_TOKEN) {
  console.error('  DATABASE_AUTH_TOKEN saknas. En fjärrdatabas kräver den.\n');
  process.exit(1);
}

const started = Date.now();
const { setupDb, dbStatus } = await import('../src/lib/db/index.ts');

await setupDb();
const status = await dbStatus();

console.log(`  Klart på ${((Date.now() - started) / 1000).toFixed(1)} s.\n`);
console.log(`    enheter:        ${status.counts.units}`);
console.log(`    användare:      ${status.counts.users}`);
console.log(`    soldater:       ${status.counts.soldiers}`);
console.log(`    incheckningar:  ${status.counts.checkIns}\n`);

process.exit(0);

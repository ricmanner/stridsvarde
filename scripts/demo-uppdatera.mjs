/**
 * Flyttar fram demodatan så att den slutar idag.
 *
 *   npm run demo:uppdatera            visar vad som skulle hända
 *   npm run demo:uppdatera -- --utfor gör det
 *
 * Demodatan står still medan kalendern går. Efter en vecka är befälsvyns
 * förvalda period tom, efter tre veckor visar varje befälsvy "Underlag
 * saknas". Kör det här före en visning eller inspelning.
 *
 * Mot den driftsatta demon sätts DATABASE_URL, DATABASE_AUTH_TOKEN och
 * PSVI_ENVIRONMENT=demo före kommandot. Vägrar i pilotläge, och vägrar mot en
 * databas som saknar demons konton.
 *
 * Se src/lib/db/demo-timeline.ts för hur och varför.
 */
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');

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

register('../tests/ts-resolver.mjs', pathToFileURL(path.join(ROOT, 'scripts/')));

const utfor = process.argv.includes('--utfor');
const remote = process.env.DATABASE_URL?.startsWith('libsql://');

console.log(`\n  Mål:  ${remote ? process.env.DATABASE_URL : process.env.DATABASE_PATH ?? './data/psvi.db'}`);
console.log(`  Läge: ${process.env.PSVI_ENVIRONMENT === 'demo' ? 'demo' : 'pilot'}\n`);

const { planDemoTimeline, applyDemoTimeline } = await import('../src/lib/db/demo-timeline.ts');

try {
  const plan = utfor ? await applyDemoTimeline() : await planDemoTimeline();

  if (!plan.senasteHistorikdag) {
    console.log('  Ingen seedad historik hittades. Inget att flytta.\n');
    process.exit(0);
  }

  console.log(`  Idag:                 ${plan.idag}`);
  console.log(`  Historiken slutar:    ${plan.senasteHistorikdag}`);

  if (plan.dagar === 0) {
    console.log('\n  Redan aktuell. Ingenting ändrades.\n');
    process.exit(0);
  }

  console.log(`  Flyttas fram:         ${plan.dagar} ${plan.dagar === 1 ? 'dag' : 'dagar'}`);
  console.log(`  Incheckningar:        ${plan.flyttas}`);
  console.log(`  Tas bort (efter historiken): ${plan.efterHistoriken}`);
  console.log(
    utfor
      ? '\n  Klart. Ingångskontona P1G1-01 till P1G1-08 har dagens incheckning öppen.\n'
      : '\n  Ingenting ändrades. Kör med --utfor för att genomföra.\n',
  );
  process.exit(0);
} catch (err) {
  console.error(`  ${err.message}\n`);
  process.exit(1);
}

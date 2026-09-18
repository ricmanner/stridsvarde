import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Tester som öppnar appen i en riktig webbläsare.
 *
 * `npm test` kontrollerar beräkningar, behörigheter och databas — men inte en
 * enda rad gränssnitt. Det som går sönder i en klientkomponent (en graf som
 * kraschar på ett saknat värde, en flik som slutar rendera, en kodlapp som
 * aldrig visas) syns först när någon öppnar sidan. Här öppnas den.
 *
 *   npm run e2e            kör allt
 *   npm run e2e -- --ui    med Playwrights gränssnitt
 *
 * Servern startas av testkörningen, mot en EGEN databas i temp-katalogen.
 * Utvecklarens data/psvi.db rörs aldrig: testerna byter koder och skapar
 * enheter, och det ska inte slå sönder demon man just höll på att visa.
 */

const PORT = 3100;
const DB = path.join(tmpdir(), `psvi-e2e-${process.env.USER ?? 'test'}.db`);

/** Samma miljö för uppsättningen av databasen och för servern. */
export const miljo = {
  DATABASE_PATH: DB,
  SEED_DEMO_DATA: 'true',
  PSVI_ENVIRONMENT: 'demo',
  MIN_RESPONDERS: '4',
  AUTH_PEPPER: 'e2e-pepper-som-ar-tillrackligt-lang-for-att-duga',
  RETENTION_DAYS: '',
};

export default defineConfig({
  testDir: './e2e',
  // Varje fil får sin egen webbläsarkontext men delar server och databas.
  // Testerna skriver i databasen (koder, enheter), så de körs i tur och ordning
  // för att inte trampa på varandra.
  workers: 1,
  fullyParallel: false,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'sv-SE',
    timezoneId: 'Europe/Stockholm',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'dator', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Bygget körs mot samma databas som testerna, och seedas först.
    command: `rm -f "${DB}" "${DB}-wal" "${DB}-shm" && npm run db:setup && npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/halsa`,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    env: miljo,
  },
});

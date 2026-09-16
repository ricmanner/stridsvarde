import 'server-only';

import path from 'node:path';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/libsql/migrator';

import { backupIfNeeded } from './backup';
import { applyPragmas, db, dbPath, environment, isRemote, isSeedDemoData } from './client';
import { purgeExpiredCheckIns } from './retention';
import { seedIfNeeded } from './seed';
import { checkIns, units, users } from './schema';

export { db, dbPath } from './client';
export * from './schema';

let initPromise: Promise<void> | null = null;

/**
 * Förbereder databasen: kör migrationer, sätter pragmas och seedar vid behov.
 *
 * Anropas i början av varje sida och varje Server Action. Arbetet görs bara
 * en gång per serverprocess — resten är en redan löst promise. Poängen är att
 * ingen ska behöva köra ett migrationskommando manuellt.
 */
export function ensureDb(): Promise<void> {
  if (!initPromise) {
    initPromise = init().catch((err) => {
      // Nollställ så att nästa anrop får försöka igen i stället för att
      // fastna på ett gammalt fel för resten av processens livstid.
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

/**
 * Vägrar starta i skarp drift med demodata påslaget.
 *
 * Demokoderna (ADMIN-01, BEF-BAT, P1G1-01 …) är läsbara och gissningsbara.
 * De är helt i sin ordning vid utveckling och demonstration, men skulle bli
 * riktiga konton till riktig hälsodata om flaggan råkade följa med till
 * produktion. Det får inte hänga på att någon kommer ihåg att ändra en rad i
 * en miljöfil, så servern stannar i stället.
 *
 * Kontrollen görs i två steg: dels flaggan, dels om en känd demokod faktiskt
 * finns i databasen — det fångar fallet att en demodatabas flyttas till
 * skarp drift med flaggan avslagen.
 */
async function assertNotDemoInProduction(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') return;

  /*
   * En demo-driftsättning SKA ha seedad data — annars finns inget att visa.
   * Skyddet gäller därför pilotläget, där riktiga soldater rapporterar.
   * Demoläget visar i stället en banner så att ingen kan missta den för skarp.
   */
  if (environment() === 'demo') return;

  if (isSeedDemoData()) {
    throw new Error(
      'SEED_DEMO_DATA=true i produktion. Demokoderna är gissningsbara och får ' +
        'inte användas mot riktig hälsodata. Sätt SEED_DEMO_DATA=false.',
    );
  }

  const { hashCode } = await import('../auth/codes');
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(users)
    .where(sql`code_hash IN (${hashCode('ADMIN-01')}, ${hashCode('BEF-BAT')}, ${hashCode('P1G1-01')})`);

  if (Number(row?.n ?? 0) > 0) {
    throw new Error(
      'Databasen innehåller demokonton med kända koder. En demodatabas får ' +
        'inte användas i produktion — börja från en tom databas.',
    );
  }
}

/**
 * Migrerar, seedar och optimerar. Körs av `npm run db:setup` — aldrig av
 * servern under drift.
 *
 * Skilt från `ensureDb()` eftersom det här arbetet kräver filsystemet och tar
 * tid. Migratorn läser `drizzle/`-mappen från disk, och den mappen följer
 * inte med in i en serverlös funktion. Seedningen tog dessutom 10,8 sekunder
 * mot en fjärrdatabas; det är tusentals insättningar över nätet, och en
 * kallstartande funktion hinner inte igenom dem innan tidsgränsen.
 */
export async function setupDb(): Promise<void> {
  // Migrationerna först — SQLite bygger ibland om tabeller, vilket krockar
  // med påslagna foreign keys.
  await migrate(db, {
    migrationsFolder: path.join(/* turbopackIgnore: true */ process.cwd(), 'drizzle'),
  });
  await applyPragmas();
  await seedIfNeeded();

  // Hjälper SQLites frågeplanerare att välja rätt index för aggregaten.
  await db.run(sql`ANALYZE`);
}

async function init(): Promise<void> {
  /*
   * Mot en lokal fil gör servern allt själv: databasen är utvecklarens egen,
   * och ingen ska behöva köra ett migrationskommando för hand.
   *
   * Mot en fjärrdatabas är den delad och långsammare att nå, och schemat ska
   * ändras som ett beslut — inte som en bieffekt av att en funktion råkade
   * kallstarta. Där gäller `npm run db:setup`, kört före driftsättning.
   */
  if (!isRemote) await setupDb();

  await assertNotDemoInProduction();

  // Säkerhetskopian tas FÖRE gallringen, så att en felaktigt satt
  // lagringstid inte raderar data som inte finns kvar någon annanstans.
  // Gallringen körs i båda lägena — lagringstiden är ett krav, inte en
  // utvecklarbekvämlighet.
  await backupIfNeeded();
  await purgeExpiredCheckIns();
}

export interface DbStatus {
  ok: boolean;
  path: string;
  foreignKeys: boolean;
  counts: { units: number; users: number; soldiers: number; checkIns: number };
}

/** Används av statussidan för att visa att allt hänger ihop. */
export async function dbStatus(): Promise<DbStatus> {
  await ensureDb();

  const one = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0;

  const [fk] = (await db.all(sql`PRAGMA foreign_keys`)) as { foreign_keys: number }[];

  return {
    ok: true,
    path: dbPath,
    foreignKeys: Boolean(fk?.foreign_keys),
    counts: {
      units: await one(db.select({ n: sql<number>`count(*)` }).from(units)),
      users: await one(db.select({ n: sql<number>`count(*)` }).from(users)),
      soldiers: await one(
        db.select({ n: sql<number>`count(*)` }).from(users).where(sql`role = 'soldat'`),
      ),
      checkIns: await one(db.select({ n: sql<number>`count(*)` }).from(checkIns)),
    },
  };
}

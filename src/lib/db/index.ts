import 'server-only';

import path from 'node:path';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/libsql/migrator';

import { backupIfNeeded } from './backup';
import { applyPragmas, db, dbPath } from './client';
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

async function init(): Promise<void> {
  // Migrationerna först — SQLite bygger ibland om tabeller, vilket krockar
  // med påslagna foreign keys.
  await migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') });
  await applyPragmas();
  await seedIfNeeded();

  // Hjälper SQLites frågeplanerare att välja rätt index för aggregaten.
  await db.run(sql`ANALYZE`);

  await backupIfNeeded();
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

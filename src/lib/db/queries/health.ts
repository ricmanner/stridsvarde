import 'server-only';

import { desc, gte, sql } from 'drizzle-orm';

import { db } from '..';
import { auditLog, errorLog } from '../schema';
import { environment } from '../client';

/** Längsta meddelande som sparas. Ett stackspår hör inte hemma i en logg som visas. */
const MAX_MESSAGE = 300;

/** Fel äldre än så här raderas vid gallringen. */
export const ERROR_RETENTION_DAYS = 30;

/**
 * Sparar ett serverfel.
 *
 * Tre regler, alla av samma skäl — loggen läses av en administratör och får
 * aldrig bli en bakväg till hälsodata:
 *  - frågesträngen stryks ur sökvägen
 *  - meddelandet kortas, och bara första raden sparas
 *  - inget om vem som var inloggad sparas
 *
 * Funktionen får aldrig kasta. Ett fel i felloggningen ska inte bli det fel
 * användaren möter.
 */
export async function logError(input: {
  path: string;
  routeType?: string | null;
  digest?: string | null;
  message: string;
}): Promise<void> {
  try {
    await db.insert(errorLog).values({
      path: input.path.split('?')[0].slice(0, 200),
      routeType: input.routeType ?? null,
      digest: input.digest ?? null,
      message: input.message.split('\n')[0].slice(0, MAX_MESSAGE),
      createdAt: new Date().toISOString(),
    });
  } catch {
    // Databasen är nere, vilket i sig är det fel som skulle loggas.
  }
}

export interface ErrorSummary {
  senaste24h: number;
  senaste7d: number;
  rader: Array<{ path: string; message: string; createdAt: string; routeType: string | null }>;
  /** Falskt när tabellen ännu inte finns i databasen — se kommentaren nedan. */
  uppsatt: boolean;
}

/**
 * Loggen kan saknas, och det får inte välta något.
 *
 * Mot en fjärrdatabas körs migrationerna som ett eget beslut, inte vid
 * serverstart. Mellan en driftsättning och den körningen finns koden men inte
 * tabellen. Då ska statussidan säga att loggen inte är uppsatt — inte visa
 * ett rött fel om att databasen är trasig, för det är den inte.
 */
const SAKNAS = /no such table/i;

/**
 * Letar efter "no such table" i hela kedjan av orsaker.
 *
 * Bara det yttersta meddelandet räckte inte: databasklienten och Drizzle
 * lindar in felet i var sitt eget, och det ursprungliga ligger under `cause`.
 * Utan den här genomgången kraschade servern vid start i stället för att
 * konstatera att loggen inte var uppsatt ännu.
 */
function saknarTabell(fel: unknown): boolean {
  let nuvarande: unknown = fel;
  for (let djup = 0; djup < 5 && nuvarande instanceof Error; djup++) {
    if (SAKNAS.test(nuvarande.message)) return true;
    nuvarande = nuvarande.cause;
  }
  return false;
}

/** Felen som administratören ser på statussidan. */
export async function errorSummary(limit = 10): Promise<ErrorSummary> {
  try {
    return await summary(limit);
  } catch (fel) {
    if (saknarTabell(fel)) {
      return { senaste24h: 0, senaste7d: 0, rader: [], uppsatt: false };
    }
    throw fel;
  }
}

async function summary(limit: number): Promise<ErrorSummary> {
  const nu = Date.now();
  const iso = (msTillbaka: number) => new Date(nu - msTillbaka).toISOString();

  const [antal] = await db
    .select({
      dygn: sql<number>`sum(case when created_at >= ${iso(86_400_000)} then 1 else 0 end)`,
      vecka: sql<number>`count(*)`,
    })
    .from(errorLog)
    .where(gte(errorLog.createdAt, iso(7 * 86_400_000)));

  const rader = await db
    .select({
      path: errorLog.path,
      message: errorLog.message,
      createdAt: errorLog.createdAt,
      routeType: errorLog.routeType,
    })
    .from(errorLog)
    .orderBy(desc(errorLog.createdAt))
    .limit(limit);

  return {
    senaste24h: Number(antal?.dygn ?? 0),
    senaste7d: Number(antal?.vecka ?? 0),
    rader,
    uppsatt: true,
  };
}

/** Raderar gamla fel. Anropas från gallringen. */
export async function purgeOldErrors(): Promise<number> {
  try {
    return await purge();
  } catch (fel) {
    // Saknas tabellen finns inget att gallra. Startar servern inte alls går
    // ingenting att rätta, så det här får aldrig kasta vidare.
    if (saknarTabell(fel)) return 0;
    throw fel;
  }
}

async function purge(): Promise<number> {
  const cutoff = new Date(Date.now() - ERROR_RETENTION_DAYS * 86_400_000).toISOString();
  const [before] = await db.select({ n: sql<number>`count(*)` }).from(errorLog);
  await db.delete(errorLog).where(sql`${errorLog.createdAt} < ${cutoff}`);
  const [after] = await db.select({ n: sql<number>`count(*)` }).from(errorLog);
  return Number(before?.n ?? 0) - Number(after?.n ?? 0);
}

/**
 * Schemaändringar som går att lägga till i efterhand, utan risk.
 *
 * Mot en delad databas körs migrationer inte vid serverstart — schemat ska
 * ändras som ett beslut, inte som en bieffekt av att en funktion kallstartade.
 * Men den som bestämmer ska inte behöva ett kommandoradsverktyg. Därför den
 * här listan, som statussidan kan lägga till bakom en knapp.
 *
 * Bara sådant som är ofarligt att köra om och som inte rör befintliga rader:
 * nya tabeller och nya index. Allt annat hör hemma i `npm run db:setup`.
 *
 * Satserna motsvarar migrationerna i drizzle/ ord för ord. Ett test jämför
 * dem, så att en framtida migration inte glöms bort här.
 */
export const SCHEMA_DDL: Array<{ objekt: string; ddl: string }> = [
  {
    objekt: 'error_log',
    ddl: `CREATE TABLE IF NOT EXISTS \`error_log\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`path\` text NOT NULL,
	\`route_type\` text,
	\`digest\` text,
	\`message\` text NOT NULL,
	\`created_at\` text NOT NULL
)`,
  },
  {
    objekt: 'error_created',
    ddl: 'CREATE INDEX IF NOT EXISTS `error_created` ON `error_log` (`created_at`)',
  },
  {
    objekt: 'check_ins_date_user',
    ddl: 'CREATE INDEX IF NOT EXISTS `check_ins_date_user` ON `check_ins` (`service_date`,`user_id`)',
  },
];

/** Vad av ovanstående som ännu inte finns i databasen. */
export async function missingSchema(): Promise<string[]> {
  const rader = (await db.all(
    sql`SELECT name FROM sqlite_master WHERE type IN ('table', 'index')`,
  )) as Array<{ name: string }>;
  const finns = new Set(rader.map((r) => r.name));
  return SCHEMA_DDL.filter((d) => !finns.has(d.objekt)).map((d) => d.objekt);
}

/** Lägger till det som saknas. Går att köra hur många gånger som helst. */
export async function applySchema(actorUserId: number): Promise<string[]> {
  const saknas = await missingSchema();
  for (const d of SCHEMA_DDL) await db.run(sql.raw(d.ddl));

  // Att ändra en delad databas är ett beslut, och beslut loggas.
  await db.insert(auditLog).values({
    actorUserId,
    action: 'schema.apply',
    detail: saknas.length > 0 ? saknas.join(', ') : 'inget saknades',
    createdAt: new Date().toISOString(),
  });

  return saknas;
}

export interface Health {
  ok: boolean;
  miljo: 'demo' | 'pilot';
  tid: string;
}

/**
 * Svarar på frågan "lever appen?" — och inget mer.
 *
 * Svaret är avsiktligt innehållslöst: det är öppet för vem som helst, så att
 * en vaktpost kan fråga utan nyckel. Antal användare, enheter eller fel står
 * på statussidan bakom inloggning, inte här.
 */
export async function health(): Promise<Health> {
  await db.get(sql`SELECT 1`);
  return { ok: true, miljo: environment(), tid: new Date().toISOString() };
}

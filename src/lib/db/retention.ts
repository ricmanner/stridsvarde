import 'server-only';

import { eq, inArray, lt, sql } from 'drizzle-orm';

import { serviceDateDaysAgo } from '../date';
import { db } from '.';
import { auditLog, checkIns } from './schema';

/*
 * Gallring av hälsodata.
 *
 * GDPR tillåter inte att personuppgifter sparas längre än nödvändigt, och
 * hälsodata är särskild kategori — det mest skyddade som finns. Utan en
 * bestämd lagringstid sparas varje incheckning för alltid, vilket ingen
 * beslutat utan är vad som händer när ingen beslutar något alls.
 *
 * Själva beslutet är inte tekniskt. Försvarsmakten är personuppgiftsansvarig
 * och deras dataskyddsombud måste ange tiden. Mekaniken finns här så att
 * beslutet bara blir en siffra i konfigurationen — inget behöver byggas om
 * den dagen svaret kommer.
 *
 * Standard är AVSTÄNGD gallring. Att tyst börja radera hälsodata vore värre
 * än att spara den: det ska vara ett aktivt val, inte en bieffekt.
 */

/** Antal dagar incheckningar sparas. null = ingen gallring (standard). */
export function retentionDays(): number | null {
  const raw = process.env.RETENTION_DAYS;
  if (!raw || raw.trim() === '') return null;

  const n = Number(raw);
  // Under 30 dagar vore verktyget meningslöst — trendvyerna visar 21 dagar.
  if (!Number.isFinite(n) || n < 30) return null;

  return Math.floor(n);
}

export interface RetentionStatus {
  enabled: boolean;
  days: number | null;
  /** Hur många incheckningar som skulle raderas just nu. */
  affected: number;
  oldest: string | null;
}

/**
 * Visar vad en gallring skulle innebära, utan att radera något.
 *
 * Tanken är att man ska kunna se konsekvensen innan man slår på det —
 * radering av hälsodata går inte att ångra.
 */
export async function retentionStatus(): Promise<RetentionStatus> {
  const days = retentionDays();

  /*
   * Äldsta uppgiften och antalet som ska gallras hämtas i SAMMA fråga.
   * Det var två anrop efter varandra över nätet för två tal ur samma tabell.
   */
  const cutoff = days === null ? null : serviceDateDaysAgo(days);

  const [row] = (await db.all(sql`
    SELECT
      min(service_date) AS oldest,
      ${cutoff === null
        ? sql`0`
        : sql`sum(CASE WHEN service_date < ${cutoff} THEN 1 ELSE 0 END)`} AS affected
    FROM check_ins
  `)) as Record<string, string | number | null>[];

  const oldest = (row?.oldest as string | null) ?? null;

  if (days === null) return { enabled: false, days: null, affected: 0, oldest };

  return { enabled: true, days, affected: Number(row?.affected ?? 0), oldest };
}

/**
 * Raderar incheckningar äldre än lagringstiden.
 *
 * Körs vid serverstart. Antalet loggas i granskningsloggen — aldrig vilka
 * värden som raderades, bara att det skedde och hur många rader det gällde.
 */
export async function purgeExpiredCheckIns(): Promise<number> {
  const days = retentionDays();
  if (days === null) return 0;

  const cutoff = serviceDateDaysAgo(days);
  const before = await db
    .select({ n: sql<number>`count(*)` })
    .from(checkIns)
    .where(lt(checkIns.serviceDate, cutoff));

  const count = Number(before[0]?.n ?? 0);
  if (count === 0) return 0;

  await db.delete(checkIns).where(lt(checkIns.serviceDate, cutoff));

  await db.insert(auditLog).values({
    actorUserId: null,
    action: 'retention.purge',
    detail: `${count} incheckningar äldre än ${cutoff} raderade (lagringstid ${days} dagar)`,
    createdAt: new Date().toISOString(),
  });

  console.log('  Gallring: %d incheckningar äldre än %s raderade.', count, cutoff);
  return count;
}

/**
 * Raderar en enskild persons hälsodata.
 *
 * GDPR artikel 17 ger den registrerade rätt att få sina uppgifter raderade.
 * Kontot och enhetstillhörigheten behålls — det är inte hälsodata och behövs
 * för att svarsfrekvensen ska bli rätt — men svaren försvinner.
 */
/**
 * Databasen, eller en pågående transaktion.
 *
 * Raderingen av hälsodata måste kunna ske i SAMMA transaktion som raderingen
 * av kontot eller enheten. Gjordes den i ett eget steg före kunde ett avbrott
 * däremellan lämna ett konto utan sin historik — och felmeddelandet såg ut
 * som att ingenting hänt.
 */
export type Exec = Pick<typeof db, 'select' | 'insert' | 'delete'>;

export async function erasePersonalData(
  actorUserId: number,
  userId: number,
  exec: Exec = db,
): Promise<number> {
  const [row] = await exec
    .select({ n: sql<number>`count(*)` })
    .from(checkIns)
    .where(eq(checkIns.userId, userId));

  const count = Number(row?.n ?? 0);
  await exec.delete(checkIns).where(eq(checkIns.userId, userId));

  await exec.insert(auditLog).values({
    actorUserId,
    action: 'retention.erase_person',
    detail: `${count} incheckningar raderade för användare ${userId}`,
    createdAt: new Date().toISOString(),
  });

  return count;
}

/**
 * Raderar incheckningarna för flera personer på en gång — när en hel enhet
 * tas bort.
 *
 * Samma skäl som erasePersonalData() ovan för att det ligger här och inte i
 * queries/admin.ts: den filen får strukturellt inte röra check_ins. Kontot
 * raderas där, hälsodatan här, och antalet loggas en gång för hela enheten i
 * stället för en rad per person.
 */
export async function eraseCheckInsForUsers(
  actorUserId: number,
  userIds: readonly number[],
  unitName: string,
  exec: Exec = db,
): Promise<number> {
  if (userIds.length === 0) return 0;

  const ids = [...userIds];
  const [row] = await exec
    .select({ n: sql<number>`count(*)` })
    .from(checkIns)
    .where(inArray(checkIns.userId, ids));

  const count = Number(row?.n ?? 0);
  await exec.delete(checkIns).where(inArray(checkIns.userId, ids));

  await exec.insert(auditLog).values({
    actorUserId,
    action: 'retention.erase_unit',
    detail: `${count} incheckningar raderade för ${ids.length} personer i ${unitName}`,
    createdAt: new Date().toISOString(),
  });

  return count;
}

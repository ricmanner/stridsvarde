import 'server-only';

import { eq, lt, sql } from 'drizzle-orm';

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

  const [oldestRow] = await db
    .select({ d: sql<string | null>`min(${checkIns.serviceDate})` })
    .from(checkIns);

  if (days === null) {
    return { enabled: false, days: null, affected: 0, oldest: oldestRow?.d ?? null };
  }

  const cutoff = serviceDateDaysAgo(days);
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(checkIns)
    .where(lt(checkIns.serviceDate, cutoff));

  return {
    enabled: true,
    days,
    affected: Number(row?.n ?? 0),
    oldest: oldestRow?.d ?? null,
  };
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
export async function erasePersonalData(
  actorUserId: number,
  userId: number,
): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(checkIns)
    .where(eq(checkIns.userId, userId));

  const count = Number(row?.n ?? 0);
  await db.delete(checkIns).where(eq(checkIns.userId, userId));

  await db.insert(auditLog).values({
    actorUserId,
    action: 'retention.erase_person',
    detail: `${count} incheckningar raderade för användare ${userId}`,
    createdAt: new Date().toISOString(),
  });

  return count;
}

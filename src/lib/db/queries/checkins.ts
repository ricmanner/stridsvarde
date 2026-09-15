import 'server-only';

import { and, eq, gte, sql } from 'drizzle-orm';

import type { Category } from '../../data';
import { serviceDate, serviceDateDaysAgo } from '../../date';
import { db } from '..';
import { checkIns } from '../schema';

export type Scores = Record<Category, number>;

export interface CheckInRow {
  serviceDate: string;
  fysisk: number;
  psykisk: number;
  social: number;
  somn: number;
  kost: number;
  energi: number;
  advice: string | null;
}

const COLUMNS = {
  serviceDate: checkIns.serviceDate,
  fysisk: checkIns.fysisk,
  psykisk: checkIns.psykisk,
  social: checkIns.social,
  somn: checkIns.somn,
  kost: checkIns.kost,
  energi: checkIns.energi,
  advice: checkIns.advice,
};

/** Dagens incheckning för en soldat, eller null. */
export async function getTodayCheckIn(userId: number): Promise<CheckInRow | null> {
  const [row] = await db
    .select(COLUMNS)
    .from(checkIns)
    .where(and(eq(checkIns.userId, userId), eq(checkIns.serviceDate, serviceDate())))
    .limit(1);

  return row ?? null;
}

/**
 * Sparar dagens incheckning.
 *
 * En atomisk upsert mot unikindexet (user_id, service_date) i stället för
 * demons läs-filtrera-skriv mot localStorage. Checkar en soldat in igen samma
 * dag skrivs svaret över, inte dubbleras.
 */
export async function saveCheckIn(
  userId: number,
  scores: Scores,
  advice: string,
): Promise<void> {
  const now = new Date().toISOString();

  await db
    .insert(checkIns)
    .values({ userId, serviceDate: serviceDate(), ...scores, advice, createdAt: now })
    .onConflictDoUpdate({
      target: [checkIns.userId, checkIns.serviceDate],
      set: { ...scores, advice },
    });
}

/**
 * Soldatens egen historik.
 *
 * Det här är den enda läsvägen i systemet som returnerar enskilda
 * incheckningsrader — och den gör det bara till den som själv skrivit dem.
 * All befälsdata går genom aggregat.
 */
export async function getOwnHistory(userId: number, days: number): Promise<CheckInRow[]> {
  return db
    .select(COLUMNS)
    .from(checkIns)
    .where(
      and(eq(checkIns.userId, userId), gte(checkIns.serviceDate, serviceDateDaysAgo(days - 1))),
    )
    .orderBy(checkIns.serviceDate);
}

/** Hur många av de senaste N dagarna soldaten faktiskt rapporterat. */
export async function getOwnResponseFrequency(
  userId: number,
  days: number,
): Promise<{ checkedIn: number; total: number; pct: number }> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(checkIns)
    .where(
      and(eq(checkIns.userId, userId), gte(checkIns.serviceDate, serviceDateDaysAgo(days - 1))),
    );

  const checkedIn = row?.n ?? 0;
  return { checkedIn, total: days, pct: Math.round((checkedIn / days) * 100) };
}

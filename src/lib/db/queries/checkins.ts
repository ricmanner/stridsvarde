import 'server-only';

import { and, eq, gte, sql } from 'drizzle-orm';

import type { Category } from '../../data';
import { daysBetween, serviceDate, serviceDateDaysAgo } from '../../date';
import { db } from '..';
import { checkIns, users } from '../schema';

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

/**
 * Hur många av de senaste N dagarna soldaten faktiskt rapporterat.
 *
 * Räknas från den dag personen fanns, högst N dagar bakåt. Förut delades
 * alltid med N, så den som skapats idag och checkat in fick "7 % — 1 av 14
 * dagar" och "Lägre närvaro" på sin första dag.
 *
 * Starten är den tidigaste av kontots skapelsedag och första incheckningen.
 * Skapelsedagen ensam räcker inte: demons konton skapas vid en återställning
 * men har historik bakåt, och skulle annars hamna över 100 %.
 */
export async function getOwnResponseFrequency(
  userId: number,
  days: number,
): Promise<{ checkedIn: number; total: number; pct: number }> {
  const fran = serviceDateDaysAgo(days - 1);
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(checkIns)
    .where(and(eq(checkIns.userId, userId), gte(checkIns.serviceDate, fran)));
  const [start] = await db
    .select({
      skapad: users.createdAt,
      forsta: sql<string | null>`(SELECT min(service_date) FROM check_ins WHERE user_id = ${userId})`,
    })
    .from(users)
    .where(eq(users.id, userId));

  const kandidater = [start?.skapad ? serviceDate(new Date(start.skapad)) : fran, start?.forsta ?? fran];
  const borjade = kandidater.sort()[0];
  const total = Math.min(days, Math.max(1, daysBetween(borjade > fran ? borjade : fran, serviceDate()) + 1));

  const checkedIn = row?.n ?? 0;
  return { checkedIn, total, pct: Math.round((checkedIn / total) * 100) };
}

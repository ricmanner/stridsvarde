import 'server-only';

import { and, eq, gte, isNotNull, sql } from 'drizzle-orm';

import { CATEGORIES, type Category, HALSA_PA } from '../../data';
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
  /** Bara när HALSA_PA; annars nämns kolumnen aldrig (se data.ts). */
  halsa?: number | null;
  advice: string | null;
}

/*
 * En rapport räknas bara om alla aktiva frågor är besvarade. När frågan om
 * hälsa slogs på saknade äldre rapporter ett svar på den; de räknas som
 * obesvarade, och den som rapporterat idag får svara igen. Samma regel som i
 * befälsvyerna (KOMPLETTA i aggregates.ts), så att den värnpliktige och
 * befälet räknar på samma rapporter.
 */
const KOMPLETT = HALSA_PA ? isNotNull(checkIns.halsa) : undefined;

/** Svaren i en rapport, för de frågor som är aktiva. */
export function svarIRad(rad: CheckInRow): Record<Category, number> {
  return Object.fromEntries(
    CATEGORIES.map((c) => [c.key, Number(rad[c.key as keyof CheckInRow])]),
  ) as Record<Category, number>;
}

const COLUMNS = {
  serviceDate: checkIns.serviceDate,
  fysisk: checkIns.fysisk,
  psykisk: checkIns.psykisk,
  social: checkIns.social,
  somn: checkIns.somn,
  kost: checkIns.kost,
  energi: checkIns.energi,
  ...(HALSA_PA ? { halsa: checkIns.halsa } : {}),
  advice: checkIns.advice,
};

/** Dagens incheckning för en soldat, eller null. */
export async function getTodayCheckIn(userId: number): Promise<CheckInRow | null> {
  const [row] = await db
    .select(COLUMNS)
    .from(checkIns)
    .where(and(eq(checkIns.userId, userId), eq(checkIns.serviceDate, serviceDate()), KOMPLETT))
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

  /*
   * Uttryckliga kolumner, bara de aktiva frågornas. Drizzles insert(checkIns)
   * tar med ALLA kolumner i schemat — också halsa, som NULL — och då kraschar
   * varje incheckning i en databas där kolumnen ännu inte lagts till, även
   * med frågan avstängd. Upptäckt i ett driftsättningsprov den 16 oktober.
   */
  const kolumner = CATEGORIES.map((c) => c.key);
  await db.run(sql`
    INSERT INTO check_ins (user_id, service_date, ${sql.raw(kolumner.join(', '))}, advice, created_at)
    VALUES (${userId}, ${serviceDate()}, ${sql.join(kolumner.map((k) => sql`${scores[k] ?? null}`), sql`, `)}, ${advice}, ${now})
    ON CONFLICT (user_id, service_date) DO UPDATE SET
      ${sql.raw(kolumner.map((k) => `${k} = excluded.${k}`).join(', '))}, advice = excluded.advice
  `);
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
      and(eq(checkIns.userId, userId), gte(checkIns.serviceDate, serviceDateDaysAgo(days - 1)), KOMPLETT),
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
    .where(and(eq(checkIns.userId, userId), gte(checkIns.serviceDate, fran), KOMPLETT));
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

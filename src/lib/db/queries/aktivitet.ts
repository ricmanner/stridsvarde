import 'server-only';

import { desc, eq, sql } from 'drizzle-orm';

import { ROLE_LABEL, type Role } from '../../roles';
import { db } from '..';
import { auditLog, users } from '../schema';

/**
 * Aktivitetsloggen: vad som hänt i demon, för den som har loggkoden.
 *
 * Två regler styr allt här:
 *
 * 1. Roll och enhet, aldrig benämning. Granskningsloggen sparar med flit inga
 *    namn — i skarp drift kan benämningen vara ett, och den som raderas via
 *    erasePersonalData skulle annars ligga kvar här. "värnpliktig i
 *    1. bataljon › 1. kompani › 1. pluton › 1. grupp" räcker för att se vad
 *    som händer, och pekar inte ut någon.
 *
 * 2. Incheckningar bara som antal. Vem som checkat in, och när, lämnar aldrig
 *    databasen — samma princip som i resten av appen. Räkningen sker i SQL.
 *
 * Beskrivningarna skrivs in när raden skapas, inte när den läses. En
 * återställning av demon tömmer användare och enheter men aldrig loggen, och
 * en rad som bara sa "användare 123" gick inte att förstå efteråt.
 */

/** "1. bataljon › 1. kompani › 1. pluton", vägen ned till enheten. */
export async function beskrivEnhet(unitId: number): Promise<string> {
  const [rad] = (await db.all(sql`
    WITH RECURSIVE upp(id, name, parent_id, djup) AS (
          SELECT id, name, parent_id, 0 FROM units WHERE id = ${unitId}
      UNION ALL
          SELECT u.id, u.name, u.parent_id, upp.djup + 1 FROM units u JOIN upp ON u.id = upp.parent_id
    )
    SELECT group_concat(name, ' › ') AS vag FROM (SELECT name FROM upp ORDER BY djup DESC)
  `)) as { vag: string | null }[];
  return rad?.vag ?? 'okänd enhet';
}

/** "värnpliktig i 1. bataljon › … › 1. grupp" — rollen och var, aldrig vem. */
export async function beskrivPerson(userId: number): Promise<string> {
  const [p] = await db
    .select({ role: users.role, unitId: users.unitId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!p) return 'en person som inte längre finns';
  const roll = ROLE_LABEL[p.role as Role].toLocaleLowerCase('sv-SE');
  return `${roll} i ${await beskrivEnhet(p.unitId)}`;
}

/** Vad varje slags rad heter i loggen. */
const RUBRIK: Record<string, string> = {
  'login.success': 'Inloggning',
  'unit.create': 'Ny enhet',
  'unit.rename': 'Enhet bytte namn',
  'unit.delete': 'Enhet raderad',
  'user.create': 'Nya personer',
  'user.rename': 'Benämning ändrad',
  'user.move': 'Person flyttad',
  'user.activate': 'Person aktiverad',
  'user.deactivate': 'Person spärrad',
  'user.delete': 'Person borttagen',
  'code.reissue': 'Ny kod',
  'export.csv': 'Export',
  'retention.erase_person': 'Hälsodata raderad',
  'retention.erase_unit': 'Hälsodata raderad',
  'retention.purge': 'Gallring',
  'schema.apply': 'Databasens schema uppdaterat',
  'demo.reset': 'Demon återställdes',
  'demo.timeline.auto': 'Nattkörning',
  'demo.timeline': 'Demodatan flyttad fram',
};

/** Rader som följer med varje återställning och bara är brus i loggen. */
const DOLDA = new Set(['bootstrap_admin']);

export interface Handelse {
  tid: string;
  slag: string;
  text: string;
  detalj: string | null;
}

/** De senaste händelserna, nyast först. */
export async function senasteHandelser(antal = 300): Promise<Handelse[]> {
  const rader = await db
    .select({ tid: auditLog.createdAt, slag: auditLog.action, detalj: auditLog.detail })
    .from(auditLog)
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(antal);
  return rader
    .filter((r) => !DOLDA.has(r.slag))
    .map((r) => ({ ...r, text: RUBRIK[r.slag] ?? r.slag }));
}

export interface Sammanfattning {
  /** När demon senast återställdes, eller null om den aldrig gjorts. */
  sedan: string | null;
  inloggningar: number;
  incheckningar: number;
  samtal: number;
  adminatgarder: number;
}

/**
 * Vad som hänt sedan den senaste återställningen.
 *
 * Demons historik skapas vid återställningen och räknas inte: det är bara
 * det som tillkommit efteråt som är någons aktivitet.
 */
export async function sammanfattningSedanAterstallning(): Promise<Sammanfattning> {
  const [senast] = (await db.all(
    sql`SELECT max(created_at) AS t FROM audit_log WHERE action = 'demo.reset'`,
  )) as { t: string | null }[];
  const sedan = senast?.t ?? null;
  const fran = sedan ?? '0000';

  const [r] = (await db.all(sql`
    SELECT
      (SELECT count(*) FROM audit_log WHERE action = 'login.success' AND created_at > ${fran}) AS inloggningar,
      (SELECT count(*) FROM check_ins WHERE created_at > ${fran}) AS incheckningar,
      (SELECT count(*) FROM notifications WHERE kind = 'talk_request' AND created_at > ${fran}) AS samtal,
      (SELECT count(*) FROM audit_log
        WHERE created_at > ${fran}
          AND (action LIKE 'unit.%' OR action LIKE 'user.%' OR action = 'code.reissue'
               OR action LIKE 'retention.erase%')) AS adminatgarder
  `)) as Record<string, number>[];

  return {
    sedan,
    inloggningar: Number(r?.inloggningar ?? 0),
    incheckningar: Number(r?.incheckningar ?? 0),
    samtal: Number(r?.samtal ?? 0),
    adminatgarder: Number(r?.adminatgarder ?? 0),
  };
}

/**
 * Nya incheckningar per timme sedan återställningen — bara antal.
 *
 * Grupperas på UTC-timme i SQL; Stockholms tid ligger en eller två hela
 * timmar därifrån, så timgränserna är desamma och etiketten räknas om vid
 * visningen.
 */
export async function incheckningarPerTimme(): Promise<{ timme: string; antal: number }[]> {
  const { sedan } = await sammanfattningSedanAterstallning();
  const rader = (await db.all(sql`
    SELECT substr(created_at, 1, 13) AS timme, count(*) AS antal
      FROM check_ins
     WHERE created_at > ${sedan ?? '0000'}
     GROUP BY timme
     ORDER BY timme DESC
     LIMIT 48
  `)) as { timme: string; antal: number }[];
  return rader.map((r) => ({ timme: `${r.timme}:00:00.000Z`, antal: Number(r.antal) }));
}

import 'server-only';

import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';

import { serviceDate } from '../../date';
import type { Role } from '../../roles';
import { db } from '..';
import { notifications } from '../schema';

/**
 * Hittar närmaste befäl av en viss nivå ovanför en enhet.
 *
 * En soldat tillhör en grupp; plutonchefen sitter på plutonen ovanför, och
 * kompanichefen ytterligare ett steg upp. Frågan går uppåt i trädet och tar
 * första aktiva befälet av rätt roll.
 */
export async function findLeaderAbove(
  unitId: number,
  role: Role,
): Promise<{ id: number; unitId: number; unitName: string } | null> {
  const rows = await db.all<{ id: number; unit_id: number; name: string }>(sql`
    WITH RECURSIVE chain(id, parent_id, depth) AS (
          SELECT id, parent_id, 0 FROM units WHERE id = ${unitId}
      UNION ALL
          SELECT u.id, u.parent_id, c.depth + 1
            FROM units u JOIN chain c ON u.id = c.parent_id
    )
    SELECT usr.id, usr.unit_id, un.name
      FROM chain c
      JOIN users usr ON usr.unit_id = c.id AND usr.role = ${role} AND usr.active = 1
      JOIN units un   ON un.id = c.id
     ORDER BY c.depth
     LIMIT 1
  `);

  const row = rows[0];
  return row ? { id: row.id, unitId: row.unit_id, unitName: row.name } : null;
}

/**
 * Registrerar att en soldat själv bett om att få prata med någon.
 *
 * Det här är den ENDA vägen i hela systemet där en enskild soldats identitet
 * når ett befäl tillsammans med en hälsosignal. Den kräver att soldaten
 * aktivt trycker på en knapp — systemet gör det aldrig av sig självt, och
 * inga siffror följer med. Befälet får veta att någon vill prata, inte vad
 * personen svarat.
 */
export async function createTalkRequest(params: {
  soldierUserId: number;
  soldierLabel: string;
  soldierUnitName: string;
  recipientUserId: number;
  subjectUnitId: number;
}): Promise<void> {
  const now = new Date().toISOString();

  await db
    .insert(notifications)
    .values({
      recipientUserId: params.recipientUserId,
      subjectUnitId: params.subjectUnitId,
      // Egen sort, inte 'red_values'. Som larm delade den unikhetsvillkor med
      // alla andra i samma grupp samma dag, och den andra begäran slängdes tyst.
      kind: 'talk_request',
      requestedByUserId: params.soldierUserId,
      title: 'En värnpliktig vill prata med dig',
      body: `${params.soldierLabel} i ${params.soldierUnitName} har begärt ett samtal. Ta kontakt så snart du kan.`,
      serviceDate: serviceDate(),
      createdAt: now,
    })
    /*
     * Unikhetsvillkoret gäller per PERSON och dag: trycker samma värnpliktig
     * flera gånger blir det en notis, men två olika personer krockar aldrig.
     *
     * Vid krock väcks raden i stället för att slängas. Tidigare stod det
     * `onConflictDoNothing()`, och eftersom kvitteringen bara sätter read_at
     * låg raden kvar resten av dygnet: den som bad om samtal på morgonen, fick
     * det kvitterat, och bad igen på eftermiddagen för att det blivit sämre
     * försvann spårlöst — medan gränssnittet svarade att begäran skickats.
     * Befälet fick aldrig veta, och personen trodde att hjälp var på väg.
     *
     * Att nolla read_at är hela poängen: notisen dyker upp som oläst igen.
     * Är den förra ännu inte kvitterad händer ingenting synligt, vilket är
     * rätt svar på ett dubbelklick.
     */
    .onConflictDoUpdate({
      target: [
        notifications.recipientUserId,
        notifications.requestedByUserId,
        notifications.serviceDate,
      ],
      targetWhere: sql`kind = 'talk_request'`,
      set: { readAt: null, createdAt: now },
    });
}

export interface NotificationRow {
  id: number;
  title: string;
  body: string;
  serviceDate: string;
  readAt: string | null;
}

export async function getUnreadNotifications(userId: number): Promise<NotificationRow[]> {
  return db
    .select({
      id: notifications.id,
      title: notifications.title,
      body: notifications.body,
      serviceDate: notifications.serviceDate,
      readAt: notifications.readAt,
    })
    .from(notifications)
    .where(and(eq(notifications.recipientUserId, userId), isNull(notifications.readAt)))
    .orderBy(desc(notifications.createdAt));
}

export async function markNotificationRead(userId: number, id: number): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date().toISOString() })
    // Filtrerar på mottagaren också — annars kan ett id från någon annan
    // kvitteras genom att bara gissa numret.
    .where(and(eq(notifications.id, id), eq(notifications.recipientUserId, userId)));
}


export interface SamtalsbegaranStatus {
  /** När begäran skickades, som ISO-tid. */
  skickad: string;
  /** Tjänstedatumet begäran hör till. */
  serviceDate: string;
}

/**
 * Den värnpliktiges egen begäran om samtal, så länge den är aktuell.
 *
 * Bekräftelsen låg tidigare bara i formulärets minne. Laddades sidan om var
 * den borta, och den som bett om samtal möttes av knapparna igen som om
 * ingenting hänt — utan svar på "gick det fram?".
 *
 * "Aktuell" betyder obesvarad, ELLER skickad idag. Frågan gällde tidigare
 * bara dagens datum, och då gick de två vyerna isär: befälets banner
 * filtrerar inte på datum, så en begäran skickad 23.50 försvann ur den
 * värnpliktiges vy tio minuter senare medan den låg kvar obesvarad hos
 * befälet. Fel håll — den som väntar på svar ska inte tappa sitt kvitto
 * medan ärendet lever vidare.
 *
 * Frågar på requested_by_user_id, alltså personens eget id. Det här är den
 * enda vägen där en soldat läser en notisrad, och den läser bara sin egen.
 */
export async function aktivSamtalsbegaran(
  soldierUserId: number,
): Promise<SamtalsbegaranStatus | null> {
  const [rad] = await db
    .select({ createdAt: notifications.createdAt, serviceDate: notifications.serviceDate })
    .from(notifications)
    .where(
      and(
        eq(notifications.kind, 'talk_request'),
        eq(notifications.requestedByUserId, soldierUserId),
        or(isNull(notifications.readAt), eq(notifications.serviceDate, serviceDate())),
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(1);

  if (!rad) return null;
  return { skickad: rad.createdAt, serviceDate: rad.serviceDate };
}

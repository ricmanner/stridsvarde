import 'server-only';

import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import { serviceDate } from '../../date';
import type { Role } from '../../roles';
import { db } from '..';
import { notifications, units, users } from '../schema';

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
      kind: 'red_values',
      title: 'En soldat vill prata med dig',
      body: `${params.soldierLabel} i ${params.soldierUnitName} har begärt ett samtal. Ta kontakt så snart du kan.`,
      serviceDate: serviceDate(),
      createdAt: now,
    })
    // Unikindexet hindrar dubbletter om soldaten trycker flera gånger samma dag.
    .onConflictDoNothing();
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

/** Har soldaten redan begärt ett samtal idag? */
export async function hasPendingTalkRequest(subjectUnitId: number, label: string): Promise<boolean> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(
        eq(notifications.subjectUnitId, subjectUnitId),
        eq(notifications.serviceDate, serviceDate()),
        sql`${notifications.body} LIKE ${label + '%'}`,
      ),
    );

  return (row?.n ?? 0) > 0;
}

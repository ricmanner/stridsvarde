import 'server-only';

import { sql } from 'drizzle-orm';

import { CATEGORIES, getStatus } from '../../data';
import { serviceDate } from '../../date';
import { db } from '..';
import { notifications } from '../schema';
import { getUnitOverview } from './aggregates';

/*
 * Automatiska larm till befäl.
 *
 * Två regler som båda ligger på ENHETSNIVÅ. Systemet larmar aldrig om en
 * enskild soldat — det skulle göra verktyget till övervakning, och det vore
 * dessutom motsägelsefullt att skicka i en notis vad befälsvyn medvetet
 * döljer. Den enda vägen där en individ nämns är den soldaten själv öppnar
 * via "Jag vill prata med någon".
 *
 * Larmen respekterar samma k-anonymitetströskel som vyerna: går aggregatet
 * inte att visa går det inte heller att larma om.
 */

/** Under den här andelen svar idag anses underlaget för tunt. */
const LOW_RESPONSE_PCT = 50;

const ALERT_PERIOD = 7 as const;

interface Ancestor {
  unitId: number;
  unitName: string;
  leaderUserId: number;
}

/**
 * Enheterna uppåt från en soldat som har ett befäl knutet till sig.
 * En grupp har normalt inget eget befäl och hoppas då över.
 */
async function leadersAbove(unitId: number): Promise<Ancestor[]> {
  const rows = (await db.all(sql`
    WITH RECURSIVE chain(id, parent_id, depth) AS (
          SELECT id, parent_id, 0 FROM units WHERE id = ${unitId}
      UNION ALL
          SELECT u.id, u.parent_id, c.depth + 1
            FROM units u JOIN chain c ON u.id = c.parent_id
    )
    SELECT c.id AS unit_id, un.name AS unit_name, usr.id AS leader_id
      FROM chain c
      JOIN units un ON un.id = c.id
      JOIN users usr ON usr.unit_id = c.id AND usr.active = 1
                    AND usr.role IN ('pluton', 'kompani', 'bataljon')
     ORDER BY c.depth
  `)) as Record<string, number | string>[];

  return rows.map((r) => ({
    unitId: Number(r.unit_id),
    unitName: String(r.unit_name),
    leaderUserId: Number(r.leader_id),
  }));
}

async function raise(params: {
  recipientUserId: number;
  subjectUnitId: number;
  kind: 'red_values' | 'low_response';
  title: string;
  body: string;
}): Promise<void> {
  await db
    .insert(notifications)
    .values({
      ...params,
      serviceDate: serviceDate(),
      createdAt: new Date().toISOString(),
    })
    // Unikindexet (mottagare, enhet, typ, dag) gör utvärderingen idempotent —
    // regeln kan köras hur många gånger som helst per dag utan dubbletter.
    .onConflictDoNothing();
}

/**
 * Utvärderar reglerna för varje enhet ovanför en soldat.
 *
 * Anropas efter en incheckning via `after()`, så det aldrig fördröjer svaret
 * till soldaten.
 */
export async function evaluateAlerts(soldierUnitId: number): Promise<void> {
  const chain = await leadersAbove(soldierUnitId);

  for (const node of chain) {
    const overview = await getUnitOverview(node.unitId, ALERT_PERIOD);

    // Går aggregatet inte att visa får det inte heller larmas om.
    if (!overview.categories.ok) continue;

    const scores = overview.categories.data;
    const red = CATEGORIES.filter((c) => getStatus(scores[c.key]) === 'red');

    if (red.length > 0) {
      const names = red.map((c) => c.label.toLowerCase()).join(', ');
      await raise({
        recipientUserId: node.leaderUserId,
        subjectUnitId: node.unitId,
        kind: 'red_values',
        title: `${node.unitName} ligger på kritisk nivå`,
        body:
          red.length === 1
            ? `Snittet för ${names} är ${scores[red[0].key].toFixed(1)} sett över ${ALERT_PERIOD} dagar. Se över belastningen.`
            : `${red.length} kategorier ligger kritiskt: ${names}. Sett över ${ALERT_PERIOD} dagar.`,
      });
    }

    // Lågt underlag är ingen hälsouppgift och kan larmas oavsett tröskel,
    // men bara om enheten är stor nog att siffran ska betyda något.
    if (overview.today.pct < LOW_RESPONSE_PCT && overview.eligible >= 4) {
      await raise({
        recipientUserId: node.leaderUserId,
        subjectUnitId: node.unitId,
        kind: 'low_response',
        title: `Låg svarsfrekvens i ${node.unitName}`,
        body: `Endast ${overview.today.responders} av ${overview.eligible} har rapporterat idag (${overview.today.pct} %). Utan underlag går läget inte att bedöma.`,
      });
    }
  }
}

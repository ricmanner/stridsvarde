import 'server-only';

import { and, eq, isNull, lt, sql } from 'drizzle-orm';

import { CATEGORIES, getStatus } from '../../data';
import { serviceDate, serviceDateDaysAgo } from '../../date';
import { db } from '..';
import { minResponders } from '../client';
import { notifications } from '../schema';
import { getUnitOverview } from './aggregates';
import { formatScore, procent } from '../../format';

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

/** Under den här andelen svar anses underlaget för tunt. */
const LOW_RESPONSE_PCT = 50;

const ALERT_PERIOD = 7 as const;

/**
 * Svarsfrekvensen för en viss dag i en enhets hela subträd.
 *
 * Används för GÅRDAGEN, inte idag. Reglerna körs efter varje incheckning, och
 * vid dagens första svar är dagens svarsfrekvens per definition nära noll —
 * ett larm om det skulle utlösas varje morgon och sedan frysa fast på den
 * siffran medan skärmen visade en helt annan. Gårdagens tal är färdigt,
 * stämmer när befälet läser det, och går faktiskt att agera på.
 */
async function responseRateFor(
  unitId: number,
  date: string,
): Promise<{ responders: number; eligible: number; pct: number }> {
  const [row] = (await db.all(sql`
    WITH RECURSIVE subtree(unit_id) AS (
          SELECT id FROM units WHERE id = ${unitId}
      UNION ALL
          SELECT u.id FROM units u JOIN subtree s ON u.parent_id = s.unit_id
    ),
    member AS (
      SELECT u.id AS user_id FROM users u
       WHERE u.unit_id IN (SELECT unit_id FROM subtree)
         AND u.role = 'soldat' AND u.active = 1
    )
    SELECT (SELECT COUNT(*) FROM member) AS eligible,
           (SELECT COUNT(DISTINCT ci.user_id)
              FROM check_ins ci JOIN member m ON m.user_id = ci.user_id
             WHERE ci.service_date = ${date}) AS responders
  `)) as Record<string, number>[];

  const eligible = Number(row?.eligible ?? 0);
  const responders = Number(row?.responders ?? 0);
  return {
    responders,
    eligible,
    pct: eligible > 0 ? Math.round((responders / eligible) * 100) : 0,
  };
}

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
  serviceDate: string;
}): Promise<void> {
  const now = new Date().toISOString();

  /*
   * Ett nytt larm ersätter äldre olästa om samma enhet och sak.
   *
   * Utan det staplades de: plutonchefen såg "Pluton 1 ligger på kritisk nivå"
   * en gång per dag tills varje notis kvitterats. Det senaste larmet beskriver
   * läget; de tidigare säger samma sak med äldre siffror. Samtalsbegäran rörs
   * aldrig — de är egen sort och handlar om en person, inte ett läge.
   */
  await db
    .update(notifications)
    .set({ readAt: now })
    .where(
      and(
        eq(notifications.recipientUserId, params.recipientUserId),
        eq(notifications.subjectUnitId, params.subjectUnitId),
        eq(notifications.kind, params.kind),
        isNull(notifications.readAt),
        lt(notifications.serviceDate, params.serviceDate),
      ),
    );

  await db
    .insert(notifications)
    .values({
      ...params,
      createdAt: now,
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
        serviceDate: serviceDate(),
        title: `${node.unitName} ligger på kritisk nivå`,
        body:
          red.length === 1
            ? `Snittet för ${names} är ${formatScore(scores[red[0].key])} sett över ${ALERT_PERIOD} dagar. Se över belastningen.`
            : `${red.length} kategorier ligger kritiskt: ${names}. Sett över ${ALERT_PERIOD} dagar.`,
      });
    }

    // Lågt underlag är ingen hälsouppgift och kan larmas oavsett
    // k-anonymitetströskeln, men bara om enheten är stor nog att andelen
    // ska betyda något. Gäller gårdagen — se responseRateFor().
    const igår = serviceDateDaysAgo(1);
    const rate = await responseRateFor(node.unitId, igår);

    /*
     * Samma tröskel som aggregaten, hämtad från samma ställe.
     *
     * Stod tidigare som en fyra inskriven för hand. Den råkade stämma
     * eftersom standardvärdet är fyra — men höjs MIN_RESPONDERS slutar
     * aggregaten visas medan larmen fortsatte gå ut om enheter under den nya
     * gränsen. Integritetströskeln får inte gälla på ett ställe och inte på
     * ett annat.
     */
    if (rate.eligible >= minResponders() && rate.pct < LOW_RESPONSE_PCT) {
      await raise({
        recipientUserId: node.leaderUserId,
        subjectUnitId: node.unitId,
        kind: 'low_response',
        serviceDate: igår,
        title: `Låg svarsfrekvens i ${node.unitName}`,
        body: `Igår rapporterade ${rate.responders} av ${rate.eligible} (${procent(rate.pct)}). Utan underlag går läget inte att bedöma.`,
      });
    }
  }
}

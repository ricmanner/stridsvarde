import 'server-only';

import { cache } from 'react';
import { sql } from 'drizzle-orm';

import { CATEGORIES, type Category, getStatus, type Status } from '../../data';
import { serviceDate, serviceDateDaysAgo, shortLabel } from '../../date';
import { db } from '..';
import { minResponders } from '../client';
import { guard, type Guarded, type Period } from '../../privacy';

/*
 * All befälsdata kommer härifrån.
 *
 * Två principer styr utformningen:
 *
 * 1. Aggregeringen sker i SQL, inte i TypeScript. Skälet är inte prestanda —
 *    några tusen rader går fort hur man än gör — utan skadeverkan. Hämtas
 *    enskilda rader till serverns minne är varje framtida console.log,
 *    felrapport eller RSC-payload en slarvig rad från att läcka en enskild
 *    soldats psykiska hälsa. Filtreras de bort redan i frågan kan de inte
 *    läcka, för de lämnar aldrig databasen.
 *
 * 2. Tröskeln för k-anonymitet ligger i SELECT-satsen, inte i gränssnittet.
 *    Servern skickar NULL, inte ett värde som UI:t sedan låter bli att rita.
 */

const CAT_KEYS = CATEGORIES.map((c) => c.key);

/** "(ci.fysisk + ci.psykisk + ...) / 6.0" — byggs ur CATEGORIES så att en ny
 *  kategori automatiskt räknas med i stället för att glömmas bort i SQL. */
const OVERALL_EXPR = `(${CAT_KEYS.map((k) => `ci.${k}`).join(' + ')}) / ${CAT_KEYS.length}.0`;

/** Rekursiv nedstigning genom enhetsträdet. */
const SUBTREE = (unitId: number) => sql`
  WITH RECURSIVE subtree(unit_id) AS (
        SELECT id FROM units WHERE id = ${unitId}
    UNION ALL
        SELECT u.id FROM units u JOIN subtree s ON u.parent_id = s.unit_id
  )`;

type Row = Record<string, number | string | null>;

// ─────────────────────────────────────────────────────────────────────────────
// Kategoritrend över tid
// ─────────────────────────────────────────────────────────────────────────────

export interface SeriesPoint {
  date: string;
  label: string;
  responders: number;
  eligible: number;
  /** null där tröskeln inte nåtts eller ingen rapporterat. Grafen ritar lucka. */
  scores: Record<Category, number> | null;
  overall: number | null;
}

/**
 * Kategorisnitt per dag för en enhet, oavsett nivå i trädet.
 *
 * Kalendern (`cal`) genereras i frågan så att dagar helt utan svar kommer
 * tillbaka som nollrader i stället för att tyst försvinna ur kurvan. Demons
 * trendfunktioner hittade på ett värde för varje dag; här syns luckan.
 */
export const getUnitCategorySeries = cache(
  async (unitId: number, days: Period): Promise<SeriesPoint[]> => {
    const from = serviceDateDaysAgo(days - 1);
    const to = serviceDate();
    const k = minResponders();

    const avgCols = CAT_KEYS.map((key) => `AVG(ci.${key}) AS ${key}`).join(',\n             ');
    const guardedCols = CAT_KEYS.map(
      (key) => `CASE WHEN COALESCE(r.responders,0) >= ${k} THEN ROUND(r.${key}, 2) END AS ${key}`,
    ).join(',\n           ');

    const rows = (await db.all(sql`
      ${SUBTREE(unitId)},
      cal(d) AS (
            SELECT ${from}
        UNION ALL
            SELECT date(d, '+1 day') FROM cal WHERE d < ${to}
      ),
      member AS (
        SELECT u.id AS user_id FROM users u
         WHERE u.unit_id IN (SELECT unit_id FROM subtree)
           AND u.role = 'soldat' AND u.active = 1
      ),
      r AS (
        SELECT ci.service_date AS d,
               COUNT(*) AS responders,
               ${sql.raw(avgCols)},
               AVG(${sql.raw(OVERALL_EXPR)}) AS overall
          FROM check_ins ci
          JOIN member m ON m.user_id = ci.user_id
         WHERE ci.service_date BETWEEN ${from} AND ${to}
         GROUP BY ci.service_date
      )
      SELECT cal.d                            AS date,
             (SELECT COUNT(*) FROM member)    AS eligible,
             COALESCE(r.responders, 0)        AS responders,
             ${sql.raw(guardedCols)},
             CASE WHEN COALESCE(r.responders,0) >= ${k} THEN ROUND(r.overall, 2) END AS overall
        FROM cal
        LEFT JOIN r ON r.d = cal.d
       ORDER BY cal.d
    `)) as Row[];

    return rows.map((row) => {
      const hasScores = row.overall !== null;
      return {
        date: String(row.date),
        label: shortLabel(String(row.date)),
        responders: Number(row.responders),
        eligible: Number(row.eligible),
        overall: hasScores ? Number(row.overall) : null,
        scores: hasScores
          ? (Object.fromEntries(CAT_KEYS.map((k2) => [k2, Number(row[k2])])) as Record<
              Category,
              number
            >)
          : null,
      };
    });
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Översikt för en enhet
// ─────────────────────────────────────────────────────────────────────────────

export interface UnitOverview {
  eligible: number;
  /** Hur många som rapporterat idag, och andelen av enheten. */
  today: { responders: number; pct: number };
  /** Kategorisnitt över perioden. */
  categories: Guarded<Record<Category, number>>;
  /** Hur många soldater som ligger grönt/gult/rött, sett till sitt eget snitt. */
  soldierStatus: Guarded<Record<Status, number>>;
  /** Per kategori: hur många soldatsvar som är gröna/gula/röda. */
  distribution: Guarded<Record<Category, Record<Status, number>>>;
}

export const getUnitOverview = cache(
  async (unitId: number, days: Period): Promise<UnitOverview> => {
    const from = serviceDateDaysAgo(days - 1);
    const to = serviceDate();

    const avgCols = CAT_KEYS.map((key) => `ROUND(AVG(ci.${key}), 2) AS ${key}`).join(',\n             ');
    // Fördelning per kategori — byggs ur CATEGORIES så SQL:en inte kan glida
    // isär från frågelistan.
    const bucketCols = CAT_KEYS.flatMap((key) => [
      `SUM(CASE WHEN ci.${key} >= 7 THEN 1 ELSE 0 END) AS ${key}_green`,
      `SUM(CASE WHEN ci.${key} >= 4 AND ci.${key} < 7 THEN 1 ELSE 0 END) AS ${key}_yellow`,
      `SUM(CASE WHEN ci.${key} < 4 THEN 1 ELSE 0 END) AS ${key}_red`,
    ]).join(',\n             ');

    const [agg] = (await db.all(sql`
      ${SUBTREE(unitId)},
      member AS (
        SELECT u.id AS user_id FROM users u
         WHERE u.unit_id IN (SELECT unit_id FROM subtree)
           AND u.role = 'soldat' AND u.active = 1
      )
      SELECT (SELECT COUNT(*) FROM member)                        AS eligible,
             COUNT(*)                                             AS answers,
             COUNT(DISTINCT ci.user_id)                           AS responders,
             ${sql.raw(avgCols)},
             ${sql.raw(bucketCols)}
        FROM check_ins ci
        JOIN member m ON m.user_id = ci.user_id
       WHERE ci.service_date BETWEEN ${from} AND ${to}
    `)) as Row[];

    const eligible = Number(agg?.eligible ?? 0);
    const responders = Number(agg?.responders ?? 0);

    // Dagens svarsfrekvens redovisas separat och osuppresserad: ett antal är
    // inte hälsodata, och utan det kan UI:t inte förklara VARFÖR en siffra
    // saknas.
    const [todayRow] = (await db.all(sql`
      ${SUBTREE(unitId)},
      member AS (
        SELECT u.id AS user_id FROM users u
         WHERE u.unit_id IN (SELECT unit_id FROM subtree)
           AND u.role = 'soldat' AND u.active = 1
      )
      SELECT COUNT(DISTINCT ci.user_id) AS n
        FROM check_ins ci JOIN member m ON m.user_id = ci.user_id
       WHERE ci.service_date = ${to}
    `)) as Row[];

    const todayResponders = Number(todayRow?.n ?? 0);

    // Soldater grupperade efter sitt EGET snitt över perioden.
    const statusRows = (await db.all(sql`
      ${SUBTREE(unitId)},
      member AS (
        SELECT u.id AS user_id FROM users u
         WHERE u.unit_id IN (SELECT unit_id FROM subtree)
           AND u.role = 'soldat' AND u.active = 1
      ),
      per_soldier AS (
        SELECT ci.user_id, AVG(${sql.raw(OVERALL_EXPR)}) AS avg_score
          FROM check_ins ci JOIN member m ON m.user_id = ci.user_id
         WHERE ci.service_date BETWEEN ${from} AND ${to}
         GROUP BY ci.user_id
      )
      SELECT SUM(CASE WHEN avg_score >= 7 THEN 1 ELSE 0 END) AS green,
             SUM(CASE WHEN avg_score >= 4 AND avg_score < 7 THEN 1 ELSE 0 END) AS yellow,
             SUM(CASE WHEN avg_score < 4 THEN 1 ELSE 0 END) AS red
        FROM per_soldier
    `)) as Row[];

    const categories =
      Number(agg?.answers ?? 0) > 0
        ? (Object.fromEntries(CAT_KEYS.map((k) => [k, Number(agg[k])])) as Record<Category, number>)
        : null;

    const distribution =
      Number(agg?.answers ?? 0) > 0
        ? (Object.fromEntries(
            CAT_KEYS.map((k) => [
              k,
              {
                green: Number(agg[`${k}_green`]),
                yellow: Number(agg[`${k}_yellow`]),
                red: Number(agg[`${k}_red`]),
              },
            ]),
          ) as Record<Category, Record<Status, number>>)
        : null;

    const st = statusRows[0];
    const soldierStatus = st
      ? {
          green: Number(st.green ?? 0),
          yellow: Number(st.yellow ?? 0),
          red: Number(st.red ?? 0),
        }
      : null;

    return {
      eligible,
      today: {
        responders: todayResponders,
        pct: eligible > 0 ? Math.round((todayResponders / eligible) * 100) : 0,
      },
      categories: guard(categories, responders, eligible, minResponders()),
      soldierStatus: guard(soldierStatus, responders, eligible, minResponders()),
      distribution: guard(distribution, responders, eligible, minResponders()),
    };
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Jämförelse mellan direkta underenheter
// ─────────────────────────────────────────────────────────────────────────────

export interface ChildUnitSummary {
  id: number;
  name: string;
  kind: string;
  eligible: number;
  responders: number;
  overall: number | null;
  scores: Record<Category, number> | null;
  status: Status | null;
  green: number;
  yellow: number;
  red: number;
}

export interface ChildComparison {
  children: ChildUnitSummary[];
  /** En rad per dag, med ett fält per underenhet (null = undanhållet). */
  series: Array<Record<string, string | number | null>>;
}

/**
 * Jämför en enhets direkta underenheter — samma fråga oavsett nivå.
 *
 * Ett kompani jämför sina plutoner, en pluton sina grupper, en bataljon sina
 * kompanier. Knepet är att seeda rekursionen med varje direkt barn och bära
 * med barnets id hela vägen ned, så att varje soldat längst ned vet vilket
 * barns subträd hen tillhör.
 */
export const getChildComparison = cache(
  async (unitId: number, days: Period): Promise<ChildComparison> => {
    const from = serviceDateDaysAgo(days - 1);
    const to = serviceDate();
    const k = minResponders();

    const avgCols = CAT_KEYS.map((key) => `ROUND(AVG(ci.${key}), 2) AS ${key}`).join(',\n             ');

    const childCte = sql`
      WITH RECURSIVE child(child_id, node_id) AS (
            SELECT id, id FROM units WHERE parent_id = ${unitId}
        UNION ALL
            SELECT c.child_id, u.id FROM units u JOIN child c ON u.parent_id = c.node_id
      ),
      member AS (
        SELECT c.child_id, u.id AS user_id
          FROM users u JOIN child c ON c.node_id = u.unit_id
         WHERE u.role = 'soldat' AND u.active = 1
      )`;

    // Sammanfattning per underenhet över hela perioden.
    const summaryRows = (await db.all(sql`
      ${childCte},
      per_soldier AS (
        SELECT m.child_id, ci.user_id, AVG(${sql.raw(OVERALL_EXPR)}) AS avg_score
          FROM check_ins ci JOIN member m ON m.user_id = ci.user_id
         WHERE ci.service_date BETWEEN ${from} AND ${to}
         GROUP BY m.child_id, ci.user_id
      ),
      agg AS (
        SELECT m.child_id,
               COUNT(DISTINCT ci.user_id) AS responders,
               ${sql.raw(avgCols)},
               ROUND(AVG(${sql.raw(OVERALL_EXPR)}), 2) AS overall
          FROM check_ins ci JOIN member m ON m.user_id = ci.user_id
         WHERE ci.service_date BETWEEN ${from} AND ${to}
         GROUP BY m.child_id
      ),
      buckets AS (
        SELECT child_id,
               SUM(CASE WHEN avg_score >= 7 THEN 1 ELSE 0 END) AS green,
               SUM(CASE WHEN avg_score >= 4 AND avg_score < 7 THEN 1 ELSE 0 END) AS yellow,
               SUM(CASE WHEN avg_score < 4 THEN 1 ELSE 0 END) AS red
          FROM per_soldier GROUP BY child_id
      )
      SELECT un.id, un.name, un.kind,
             (SELECT COUNT(*) FROM member mm WHERE mm.child_id = un.id) AS eligible,
             COALESCE(agg.responders, 0) AS responders,
             CASE WHEN COALESCE(agg.responders,0) >= ${k} THEN agg.overall END AS overall,
             ${sql.raw(
               CAT_KEYS.map(
                 (key) => `CASE WHEN COALESCE(agg.responders,0) >= ${k} THEN agg.${key} END AS ${key}`,
               ).join(',\n             '),
             )},
             CASE WHEN COALESCE(agg.responders,0) >= ${k} THEN COALESCE(buckets.green,0)  END AS green,
             CASE WHEN COALESCE(agg.responders,0) >= ${k} THEN COALESCE(buckets.yellow,0) END AS yellow,
             CASE WHEN COALESCE(agg.responders,0) >= ${k} THEN COALESCE(buckets.red,0)    END AS red
        FROM units un
        LEFT JOIN agg     ON agg.child_id = un.id
        LEFT JOIN buckets ON buckets.child_id = un.id
       WHERE un.parent_id = ${unitId}
       ORDER BY un.name
    `)) as Row[];

    const children: ChildUnitSummary[] = summaryRows.map((r) => {
      const overall = r.overall === null ? null : Number(r.overall);
      return {
        id: Number(r.id),
        name: String(r.name),
        kind: String(r.kind),
        eligible: Number(r.eligible),
        responders: Number(r.responders),
        overall,
        status: overall === null ? null : getStatus(overall),
        scores:
          overall === null
            ? null
            : (Object.fromEntries(CAT_KEYS.map((k2) => [k2, Number(r[k2])])) as Record<
                Category,
                number
              >),
        green: r.green === null ? 0 : Number(r.green),
        yellow: r.yellow === null ? 0 : Number(r.yellow),
        red: r.red === null ? 0 : Number(r.red),
      };
    });

    // Daglig kurva per underenhet.
    const seriesRows = (await db.all(sql`
      ${childCte},
      cal(d) AS (
            SELECT ${from}
        UNION ALL
            SELECT date(d, '+1 day') FROM cal WHERE d < ${to}
      ),
      r AS (
        SELECT m.child_id, ci.service_date AS d,
               COUNT(DISTINCT ci.user_id) AS responders,
               AVG(${sql.raw(OVERALL_EXPR)}) AS overall
          FROM check_ins ci JOIN member m ON m.user_id = ci.user_id
         WHERE ci.service_date BETWEEN ${from} AND ${to}
         GROUP BY m.child_id, ci.service_date
      )
      SELECT cal.d AS date, un.id AS child_id, un.name AS child_name,
             CASE WHEN COALESCE(r.responders,0) >= ${k} THEN ROUND(r.overall, 2) END AS overall
        FROM units un
        CROSS JOIN cal
        LEFT JOIN r ON r.child_id = un.id AND r.d = cal.d
       WHERE un.parent_id = ${unitId}
       ORDER BY cal.d, un.name
    `)) as Row[];

    // Pivotera till recharts-format: en rad per dag, ett fält per underenhet.
    const byDate = new Map<string, Record<string, string | number | null>>();
    for (const row of seriesRows) {
      const date = String(row.date);
      if (!byDate.has(date)) byDate.set(date, { date, label: shortLabel(date) });
      byDate.get(date)![String(row.child_name)] =
        row.overall === null ? null : Number(row.overall);
    }

    return { children, series: [...byDate.values()] };
  },
);

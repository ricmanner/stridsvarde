import 'server-only';

import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import { hashCode } from '../auth/codes';
import { daysBetween, serviceDate } from '../date';
import { antal } from '../format';
import { ALLOWED_PERIODS } from '../privacy';
import { db, environment } from './client';
import { auditLog } from './schema';
import { DAGEN_OPPEN } from './seed';

/*
 * Flyttar fram demodatan så att den slutar idag.
 *
 * Demodatan seedas med fjorton dagars historik som slutar den dag den skapas.
 * Sedan står den still medan kalendern går: efter en vecka är befälsvyns
 * förvalda sjudagarsperiod tom, efter tre veckor visar varje befälsvy
 * "Underlag saknas". En demo som ska visas om ett par månader måste därför
 * flyttas fram innan den visas.
 *
 * Kommandot flyttar historiken i stället för att seeda om. En omseedning
 * raderar allt som hänt i demon sedan dess — omdöpta personer, tillagda
 * enheter och samtalsbegäran från Värnpliktig 09 som manuset pekar på.
 *
 * Bara incheckningarnas datum ändras. Notiser visas så länge de är olästa,
 * oavsett datum, och granskningsloggen och inloggningstider är historik som
 * inte ska skrivas om.
 */

/**
 * Andel av de aktiva värnpliktiga som måste ha svarat en dag för att den ska
 * räknas som en del av den seedade historiken.
 *
 * Seeden låter omkring 82 % svara varje dag. Några enstaka incheckningar
 * gjorda efteråt — en besökare som provar demon — når aldrig i närheten. Utan
 * den här gränsen skulle dagens två testincheckningar räknas som "senaste
 * dag", och ingenting skulle flyttas.
 */
const HISTORIK_ANDEL = 0.25;

export interface DemoTimelinePlan {
  idag: string;
  /** Senaste dagen som hör till den seedade historiken, eller null om ingen finns. */
  senasteHistorikdag: string | null;
  /** Hur många dagar historiken flyttas. Noll betyder att den redan är aktuell. */
  dagar: number;
  /** Incheckningar gjorda efter historiken, som tas bort för att inte hamna i framtiden. */
  efterHistoriken: number;
  /** Totalt antal incheckningar som flyttas. */
  flyttas: number;
}

/**
 * Säkerställer att det här är en demodatabas och ingenting annat.
 *
 * Två kontroller, av samma skäl som assertNotDemoInProduction() i index.ts:
 * driftläget kan vara felsatt. Finns inte demons administratörskod i
 * databasen är det inte en seedad demo, oavsett vad miljövariabeln säger.
 */
async function assertDemoDatabase(): Promise<void> {
  if (environment() !== 'demo') {
    throw new Error(
      'Vägrar: PSVI_ENVIRONMENT är inte "demo". Det här kommandot skriver om ' +
        'datum på hälsodata och får aldrig köras mot ett pilottest.',
    );
  }

  const [rad] = (await db.all(
    sql`SELECT count(*) AS n FROM users WHERE code_hash = ${hashCode('ADMIN-01')}`,
  )) as { n: number }[];

  if (Number(rad?.n ?? 0) === 0) {
    throw new Error(
      'Vägrar: databasen saknar demons administratörskonto. Det här ser inte ut ' +
        'som en seedad demodatabas.',
    );
  }
}

export interface DemoTidslinjeBesked {
  /** Sant när ingen åtgärd behövs — då visas ingen knapp. */
  aktuell: boolean;
  rubrik: string;
  /** Vad administratören behöver veta innan hen trycker. */
  text: string;
}

/**
 * Ett glapp som inte syns i någon vy.
 *
 * Befälsvyns kortaste period är sju dagar, så en dags eftersläpning märks
 * ingenstans. En varning som alltid lyser slutar man se, och då missas den
 * dagen den betyder något.
 */
const GLAPP_UTAN_FOLJD = 1;

/**
 * Översätter en plan till det statussidan säger.
 *
 * Skilt från planDemoTimeline() för att bedömningen ska gå att testa utan en
 * databas — och för att texten ska stämma med vad knappen faktiskt gör. Den
 * som trycker ska veta att incheckningar gjorda efter historiken försvinner,
 * innan hen trycker och inte efteråt.
 */
export function beskrivDemoTidslinje(plan: DemoTimelinePlan): DemoTidslinjeBesked {
  if (plan.senasteHistorikdag === null) {
    return {
      aktuell: true,
      rubrik: 'Ingen seedad historik',
      text:
        'Databasen har ingen seedad historik att flytta fram. Det här ser inte ut ' +
        'som demons databas.',
    };
  }

  if (plan.dagar <= GLAPP_UTAN_FOLJD) {
    return {
      aktuell: true,
      rubrik: 'Demodatan är aktuell',
      text:
        `Historiken slutar ${plan.senasteHistorikdag}, alltså är demodatan aktuell ` +
        'och alla befälsvyer visar data.',
    };
  }

  const langsta = Math.max(...ALLOWED_PERIODS);
  const delar = [`Historiken slutar ${plan.senasteHistorikdag}, ${plan.dagar} dagar bakåt.`];

  delar.push(
    plan.dagar > langsta
      ? `Även den längsta befälsvyn — ${langsta} dagar — är tom, så demon är obrukbar tills datan flyttats fram.`
      : 'Befälsvyernas förvalda sjudagarsperiod är därför helt eller delvis tom.',
  );

  if (plan.efterHistoriken > 0) {
    delar.push(
      `${antal(plan.efterHistoriken, 'incheckning gjord', 'incheckningar gjorda')} ` +
        'efter historiken raderas av flytten — annars skulle de hamna i framtiden.',
    );
  }

  return { aktuell: false, rubrik: 'Demodatan har blivit gammal', text: delar.join(' ') };
}

/** Vad kommandot skulle göra, utan att ändra något. */
export async function planDemoTimeline(idag: string = serviceDate()): Promise<DemoTimelinePlan> {
  await assertDemoDatabase();

  const [soldater] = (await db.all(
    sql`SELECT count(*) AS n FROM users WHERE role = 'soldat' AND active = 1`,
  )) as { n: number }[];
  const krav = Math.max(1, Math.ceil(Number(soldater?.n ?? 0) * HISTORIK_ANDEL));

  const dagar = (await db.all(sql`
    SELECT service_date AS d, count(DISTINCT user_id) AS n
      FROM check_ins
     GROUP BY service_date
     ORDER BY service_date DESC
  `)) as { d: string; n: number }[];

  const senaste = dagar.find((r) => Number(r.n) >= krav)?.d ?? null;
  if (!senaste) {
    return { idag, senasteHistorikdag: null, dagar: 0, efterHistoriken: 0, flyttas: 0 };
  }

  const efter = dagar.filter((r) => r.d > senaste).reduce((s, r) => s + Number(r.n), 0);
  const [totalt] = (await db.all(sql`SELECT count(*) AS n FROM check_ins`)) as { n: number }[];

  return {
    idag,
    senasteHistorikdag: senaste,
    dagar: Math.max(0, daysBetween(senaste, idag)),
    efterHistoriken: efter,
    flyttas: Number(totalt?.n ?? 0) - efter,
  };
}

/**
 * Flyttar fram historiken så att den slutar idag, och öppnar dagens
 * incheckning igen för demons ingångskonton.
 *
 * Allt sker i en transaktion. Går något fel mitt i står databasen kvar som
 * den var — en halvt flyttad historik vore värre än en inaktuell.
 */
export async function applyDemoTimeline(idag: string = serviceDate()): Promise<DemoTimelinePlan> {
  const plan = await planDemoTimeline(idag);
  if (!plan.senasteHistorikdag || plan.dagar === 0) return plan;

  const senaste = plan.senasteHistorikdag;
  const oppna = DAGEN_OPPEN.map((kod) => hashCode(kod));

  await db.transaction(async (tx) => {
    // Incheckningar efter historiken skulle hamna i framtiden, eller krocka
    // med en framflyttad dag för samma person.
    await tx.run(sql`DELETE FROM check_ins WHERE service_date > ${senaste}`);

    /*
     * I två steg, via ett datum långt fram i tiden.
     *
     * Det unika indexet på (user_id, service_date) kontrolleras rad för rad
     * medan UPDATE:n pågår. Flyttas allt en dag i ett svep krockar en persons
     * 15:e med hennes 16:e innan 16:e hunnit flytta vidare — i vilken ordning
     * raderna behandlas går inte att styra. Via ett tillfälligt datum tiotusen
     * dagar bort (runt år 2053) finns inga befintliga rader att krocka med, och
     * steget tillbaka flyttar alla lika långt.
     */
    const tillfalligt = plan.dagar + 10_000;
    await tx.run(sql`UPDATE check_ins SET service_date = date(service_date, ${`+${tillfalligt} days`})`);
    await tx.run(sql`UPDATE check_ins SET service_date = date(service_date, '-10000 days')`);

    // Ingångskontona ska kunna prova incheckningen idag, precis som när
    // demon seedades. Se DAGEN_OPPEN i seed.ts.
    await tx.run(sql`
      DELETE FROM check_ins
       WHERE service_date = ${plan.idag}
         AND user_id IN (SELECT id FROM users WHERE code_hash IN ${oppna})
    `);
  });

  return plan;
}

/**
 * Vad den automatiska nattkörningen heter i granskningsloggen.
 *
 * Skild från en knapptryckning med flit: raden ska gå att räkna och visa upp
 * som svar på frågan "går klockan?". En administratörs manuella tryck svarar
 * inte på den frågan.
 */
export const AUTOMATISK_KORNING = 'demo.timeline.auto';

/**
 * Antecknar att nattkörningen varit här.
 *
 * Skrivs ÄVEN när ingenting behövde flyttas, och det är hela poängen. Utan en
 * rad vid varje körning går det inte att skilja "klockan ringde, allt var
 * redan aktuellt" från "klockan ringde aldrig" — och det var precis den
 * skillnaden som gjorde att GitHubs schemalagda körning kunde vara ur funktion
 * i ett halvt dygn utan att någon märkte det.
 *
 * `actor_user_id` är null eftersom ingen människa tryckte. Kolumnen tillåter
 * det, och en påhittad avsändare vore sämre än ingen.
 */
export async function antecknaAutomatiskKorning(dagar: number): Promise<void> {
  await db.insert(auditLog).values({
    actorUserId: null,
    action: AUTOMATISK_KORNING,
    detail: dagar === 0 ? 'inget att flytta' : `historiken flyttad ${dagar} dagar fram`,
    createdAt: new Date().toISOString(),
  });
}

/** Senaste automatiska körningen, för statussidan. Null om ingen ägt rum. */
export async function senasteAutomatiskaKorning(): Promise<{
  tid: string;
  detalj: string | null;
} | null> {
  const [rad] = await db
    .select({ tid: auditLog.createdAt, detalj: auditLog.detail })
    .from(auditLog)
    .where(and(eq(auditLog.action, AUTOMATISK_KORNING), isNull(auditLog.actorUserId)))
    .orderBy(desc(auditLog.createdAt))
    .limit(1);

  return rad ?? null;
}

export interface Nattbesked {
  /** Sant när något behöver åtgärdas — klockan går inte som den ska. */
  varning: boolean;
  text: string;
}

/**
 * Längsta normala avstånd mellan två nattkörningar, i timmar.
 *
 * Klockan är ställd på 02:00 UTC, men Vercel får dröja upp till en timme för
 * att sprida belastningen. Kör den 02:00 en natt och 02:59 nästa är avståndet
 * knappt 25 timmar. 26 ger marginal utan att dölja en natt som uteblivit —
 * och en varning som lyser i onödan är en varning man slutar se.
 */
const LANGSTA_NORMALA_GLAPP_H = 26;

/**
 * Vad statussidan säger om den automatiska framflyttningen.
 *
 * Skild från databasfrågan så att bedömningen går att pröva utan databas, av
 * samma skäl som beskrivDemoTidslinje() är det.
 *
 * Den viktigaste raden är den om en hemlighet som saknas. Då är rutten
 * avstängd — den vägrar hellre än faller öppen — och demodatan slutar tyst
 * att flyttas fram. Utan det här beskedet skulle det upptäckas först framför
 * en publik.
 */
export function beskrivNattkorning(läge: {
  hemlighetSatt: boolean;
  senaste: { tid: string; detalj: string | null } | null;
}): Nattbesked {
  if (!läge.hemlighetSatt) {
    return {
      varning: true,
      text:
        'Den automatiska framflyttningen är avstängd: hemligheten CRON_SECRET ' +
        'saknas i inställningarna. Demodatan måste flyttas fram för hand.',
    };
  }

  if (!läge.senaste) {
    return {
      varning: true,
      text:
        'Den automatiska framflyttningen har inte kört ännu. Är den nyss ' +
        'driftsatt är det väntat — kontrollera igen efter natten.',
    };
  }

  const timmar = (Date.now() - Date.parse(läge.senaste.tid)) / 3_600_000;
  // Tiden visas som den står i loggen, alltså UTC, precis som fellistan intill.
  // Ordet UTC står med för att 02:00 där är 04:00 på en svensk klocka.
  const när = `${läge.senaste.tid.slice(0, 16).replace('T', ' ')} UTC`;
  const vad = läge.senaste.detalj ?? 'körd';

  if (timmar > LANGSTA_NORMALA_GLAPP_H) {
    return {
      varning: true,
      text: `Senaste automatiska körningen var ${när} (${vad}) — mer än ett dygn sedan. Klockan kan ha slutat gå.`,
    };
  }

  return { varning: false, text: `Senaste automatiska körningen: ${när} (${vad}).` };
}

import Link from 'next/link';

import AppHeader from '@/components/AppHeader';
import SkickaKnapp from '@/components/SkickaKnapp';
import { requireRole } from '@/lib/auth/guard';
import { dbStatus } from '@/lib/db';
import { dbAdressFörVisning, environment } from '@/lib/db/client';
import {
  beskrivDemoTidslinje,
  beskrivNattkorning,
  planDemoTimeline,
  senasteAutomatiskaKorning,
  type DemoTidslinjeBesked,
  type Nattbesked,
} from '@/lib/db/demo-timeline';
import { errorSummary, ERROR_RETENTION_DAYS, missingSchema } from '@/lib/db/queries/health';
import { aterstallDemoAction, applyDemoTimelineAction, applySchemaAction } from '@/app/actions/admin';
import { ATERSTALL_ORD } from '@/lib/demo';

// Statussidan ska alltid visa verkligt läge, aldrig ett cachat.
export const dynamic = 'force-dynamic';

export default async function StatusPage({
  searchParams,
}: {
  searchParams: Promise<{ aterstallning?: string }>;
}) {
  // Teknisk sida: avslöjar organisationens storlek och databasens tillstånd.
  // Inget hälsodata, men inget som ska vara läsbart för omvärlden heller.
  const session = await requireRole('admin');

  const aterstallningFel = (await searchParams).aterstallning === 'fel';

  let status: Awaited<ReturnType<typeof dbStatus>> | null = null;
  let error: string | null = null;

  let fel: Awaited<ReturnType<typeof errorSummary>> | null = null;
  let saknas: string[] = [];

  try {
    status = await dbStatus();
    fel = await errorSummary(8);
    saknas = await missingSchema();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  /*
   * Demodatans ålder. Bara i demoläge — i ett pilottest är incheckningarna
   * verkliga och får aldrig flyttas.
   *
   * Egen try: planDemoTimeline() vägrar mot en databas som inte ser ut som
   * demons, och det får inte fälla hela statussidan. Kan den inte svara
   * visas ingen ruta alls.
   */
  let demotid: DemoTidslinjeBesked | null = null;
  let natt: Nattbesked | null = null;
  if (environment() === 'demo' && !error) {
    try {
      demotid = beskrivDemoTidslinje(await planDemoTimeline());

      /*
       * Går klockan?
       *
       * Rutan ovanför säger om datan är aktuell just nu. Den säger ingenting
       * om VARFÖR — och en nattkörning som slutat fungera syns därför inte
       * förrän datan hunnit bli gammal igen, alltså en vecka för sent.
       * Hemligheten läses här och inte i rutten: den som anropar rutten utan
       * att vara inbjuden får inget veta, men administratören ska få det.
       */
      natt = beskrivNattkorning({
        hemlighetSatt: Boolean(process.env.CRON_SECRET?.trim()),
        senaste: await senasteAutomatiskaKorning(),
      });
    } catch {
      demotid = null;
      natt = null;
    }
  }

  return (
    /*
     * Sidhuvudet fanns inte här: den som hamnade på statussidan kunde varken
     * gå tillbaka eller logga ut, och sidan gick bara att nå genom att kunna
     * adressen utantill. Nu finns en länk hit från adminvyn.
     */
    <div className="flex min-h-dvh flex-col">
      <AppHeader unit="Administration" label={session.label} role={session.role} />
      <main id="innehall" className="mx-auto w-full max-w-2xl px-5 py-10">
        <p className="mb-6 text-sm">
          <Link href="/admin" className="text-slate-500 underline underline-offset-2 hover:text-slate-900">
            ← Tillbaka till administrationen
          </Link>
        </p>
      <header className="mb-8">
        <p className="text-etikett font-bold uppercase tracking-[0.1em] text-slate-500">
          FM – PSVI
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Systemstatus</h1>
        <p className="mt-1 text-sm text-slate-500">
          Teknisk kontrollsida. Visar att databasen är uppsatt och innehåller data.
        </p>
      </header>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-5">
          <p className="text-sm font-bold text-red-700">Databasen kunde inte startas</p>
          <pre className="mt-2 overflow-x-auto text-xs text-red-900">{error}</pre>
        </div>
      ) : status ? (
        <>
          <div className="mb-4 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
            <span className="size-2 rounded-full bg-emerald-600" />
            <span className="text-sm font-semibold text-emerald-800">
              Databasen svarar
            </span>
          </div>

          <dl className="overflow-hidden rounded-md border border-slate-200 bg-white">
            <Row label="Enheter" value={status.counts.units} hint="bataljon, kompanier, plutoner, grupper" />
            <Row label="Användare" value={status.counts.users} hint="värnpliktiga, befäl och admin" />
            <Row label="Värnpliktiga" value={status.counts.soldiers} />
            <Row label="Incheckningar" value={status.counts.checkIns} hint="verklig historik i databasen" />
            <Row
              label="Foreign keys"
              value={status.foreignKeys ? 'PÅ' : 'AV'}
              hint={status.foreignKeys ? undefined : 'Varning: referensintegritet är inte aktiv'}
            />
          </dl>

          <p className="mt-4 break-all text-xs text-slate-500">
            Databas: {dbAdressFörVisning(status.path, environment() === 'demo')}
          </p>

          {/*
            Demodatan åldras av sig själv. Utan den här rutan upptäcks det
            först när någon står framför en publik med tomma befälsvyer.
          */}
          {demotid && (
            <>
              <h2 className="mb-2 mt-8 text-etikett font-bold uppercase tracking-[0.1em] text-slate-500">
                Demodata
              </h2>
              <div
                className={`rounded-md border px-4 py-3 ${
                  demotid.aktuell
                    ? 'border-slate-200 bg-white'
                    : 'border-amber-200 bg-amber-50'
                }`}
              >
                <p
                  className={`text-sm font-semibold ${
                    demotid.aktuell ? 'text-slate-800' : 'text-amber-900'
                  }`}
                >
                  {demotid.rubrik}
                </p>
                <p
                  className={`mt-1 text-xs ${
                    demotid.aktuell ? 'text-slate-500' : 'text-amber-800'
                  }`}
                >
                  {demotid.text}
                </p>
                {!demotid.aktuell && (
                  <form action={applyDemoTimelineAction} className="mt-3">
                    <SkickaKnapp
                      vantetext="Flyttar…"
                      className="cursor-pointer rounded-md bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white disabled:bg-slate-300"
                    >
                      Flytta fram demodatan
                    </SkickaKnapp>
                  </form>
                )}
              </div>

              {natt && (
                <p
                  className={`mt-2 text-xs ${
                    natt.varning ? 'font-semibold text-amber-900' : 'text-slate-500'
                  }`}
                >
                  {natt.text}
                </p>
              )}

              {/*
                Återställningen står för sig, under tidslinjen: den flyttar
                inte datum utan bygger om allt, och är den enda vägen tillbaka
                när en besökare raderat något.
              */}
              <div className="mt-3 rounded-md border border-slate-200 bg-white px-4 py-3">
                <p className="text-sm font-semibold text-slate-800">Återställ demon</p>
                <p className="mt-1 text-xs text-slate-500">
                  Bygger upp demon från grunden: enheter, personer och fjorton dagars
                  historik som slutar idag. Allt någon ändrat försvinner — raderade
                  enheter kommer tillbaka, tillagda försvinner. Demokoderna blir
                  desamma och står kvar på inloggningssidan.{' '}
                  <strong className="font-semibold text-slate-700">
                    Du loggas ut och får logga in igen.
                  </strong>
                </p>

                {aterstallningFel && (
                  <p role="alert" className="mt-2 text-xs font-semibold text-red-700">
                    Fel bekräftelseord — ingenting har ändrats. Skriv {ATERSTALL_ORD} för att
                    fortsätta.
                  </p>
                )}

                <form action={aterstallDemoAction} className="mt-3 flex flex-wrap items-center gap-2">
                  <label htmlFor="bekraftelse" className="sr-only">
                    Skriv {ATERSTALL_ORD} för att bekräfta
                  </label>
                  <input
                    id="bekraftelse"
                    name="bekraftelse"
                    type="text"
                    autoComplete="off"
                    placeholder={ATERSTALL_ORD}
                    className="w-40 rounded-md border border-slate-300 px-2.5 py-2 text-xs text-slate-900 placeholder:text-slate-400"
                  />
                  <SkickaKnapp
                    vantetext="Återställer…"
                    className="cursor-pointer rounded-md border border-red-300 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
                  >
                    Återställ demon
                  </SkickaKnapp>
                </form>
              </div>
            </>
          )}

          {/*
            Fel som servern fångat. Utan den här listan syns ett fel bara för
            den som råkade stå framför skärmen när det hände.
          */}
          <h2 className="mb-2 mt-8 text-etikett font-bold uppercase tracking-[0.1em] text-slate-500">
            Fel som servern fångat
          </h2>
          {saknas.length > 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm font-semibold text-amber-900">
                Databasen saknar {saknas.length === 1 ? 'en del' : 'delar'} av schemat
              </p>
              <p className="mt-1 text-xs text-amber-800">
                Saknas: {saknas.join(', ')}.{' '}
                {saknas.includes('error_log')
                  ? 'Utan felloggen sparas fel som servern fångar ingenstans. '
                  : ''}
                {saknas.some((x) => x.startsWith('check_ins'))
                  ? 'Utan indexet blir befälsvyerna långsammare när datamängden växer. '
                  : ''}
                Knappen lägger till det som fattas. Ingenting befintligt ändras, och den går att
                trycka på flera gånger utan att något händer en andra gång.
              </p>
              <form action={applySchemaAction} className="mt-3">
                <SkickaKnapp
                  vantetext="Uppdaterar…"
                  className="cursor-pointer rounded-md bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white disabled:bg-slate-300"
                >
                  Uppdatera schemat
                </SkickaKnapp>
              </form>
            </div>
          ) : fel && fel.senaste7d > 0 ? (
            <>
              <div
                className={`mb-3 flex items-center gap-2 rounded-md border px-4 py-3 ${
                  fel.senaste24h > 0
                    ? 'border-amber-200 bg-amber-50'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <span className="text-sm text-slate-700">
                  <strong className="tabular-nums">{fel.senaste24h}</strong> senaste dygnet,{' '}
                  <strong className="tabular-nums">{fel.senaste7d}</strong> senaste veckan
                </span>
              </div>
              <ul className="overflow-hidden rounded-md border border-slate-200 bg-white">
                {fel.rader.map((rad, i) => (
                  <li key={i} className="border-b border-slate-100 px-5 py-3 last:border-b-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-slate-800">{rad.path}</span>
                      <span className="text-xs tabular-nums text-slate-500">
                        {rad.createdAt.slice(0, 16).replace('T', ' ')}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-600">{rad.message}</p>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
              <span className="size-2 rounded-full bg-emerald-600" />
              <span className="text-sm font-semibold text-emerald-800">
                Inga fel den senaste veckan
              </span>
            </div>
          )}
          <p className="mt-2 text-xs text-slate-500">
            Loggen sparar var felet inträffade och vad det stod — aldrig någons svar eller vem
            som var inloggad. Rader äldre än {ERROR_RETENTION_DAYS} dagar raderas.
          </p>
        </>
      ) : null}
      </main>
    </div>
  );
}

function Row({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    // En rad i en beskrivningslista ska vara term och värde, inte två span:ar
    // i en div — annars är listan inte en lista för den som lyssnar på den.
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-3.5 last:border-b-0">
      <dt>
        <span className="text-sm text-slate-700">{label}</span>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </dt>
      <dd className="m-0 text-xl font-bold tabular-nums text-slate-900">{value}</dd>
    </div>
  );
}

import Link from 'next/link';

import AppHeader from '@/components/AppHeader';
import { requireRole } from '@/lib/auth/guard';
import { dbStatus } from '@/lib/db';
import { dbAdressFörVisning, environment } from '@/lib/db/client';
import { beskrivDemoTidslinje, planDemoTimeline, type DemoTidslinjeBesked } from '@/lib/db/demo-timeline';
import { errorSummary, ERROR_RETENTION_DAYS, missingSchema } from '@/lib/db/queries/health';
import { applyDemoTimelineAction, applySchemaAction } from '@/app/actions/admin';

// Statussidan ska alltid visa verkligt läge, aldrig ett cachat.
export const dynamic = 'force-dynamic';

export default async function StatusPage() {
  // Teknisk sida: avslöjar organisationens storlek och databasens sökväg på
  // disk. Inget hälsodata, men inget som ska vara läsbart för omvärlden heller.
  const session = await requireRole('admin');

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
  if (environment() === 'demo' && !error) {
    try {
      demotid = beskrivDemoTidslinje(await planDemoTimeline());
    } catch {
      demotid = null;
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
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
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
              <h2 className="mb-2 mt-8 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
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
                    <button
                      type="submit"
                      className="cursor-pointer rounded-md bg-slate-900 px-3.5 py-2 text-[13px] font-semibold text-white"
                    >
                      Flytta fram demodatan
                    </button>
                  </form>
                )}
              </div>
            </>
          )}

          {/*
            Fel som servern fångat. Utan den här listan syns ett fel bara för
            den som råkade stå framför skärmen när det hände.
          */}
          <h2 className="mb-2 mt-8 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
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
                <button
                  type="submit"
                  className="cursor-pointer rounded-md bg-slate-900 px-3.5 py-2 text-[13px] font-semibold text-white"
                >
                  Uppdatera schemat
                </button>
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
      <dd className="m-0 text-lg font-bold tabular-nums text-slate-900">{value}</dd>
    </div>
  );
}

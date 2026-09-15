import { dbStatus } from '@/lib/db';

// Statussidan ska alltid visa verkligt läge, aldrig ett cachat.
export const dynamic = 'force-dynamic';

export default async function StatusPage() {
  let status: Awaited<ReturnType<typeof dbStatus>> | null = null;
  let error: string | null = null;

  try {
    status = await dbStatus();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <header className="mb-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
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
            <Row label="Användare" value={status.counts.users} hint="soldater, befäl och admin" />
            <Row label="Soldater" value={status.counts.soldiers} />
            <Row label="Incheckningar" value={status.counts.checkIns} hint="verklig historik i databasen" />
            <Row
              label="Foreign keys"
              value={status.foreignKeys ? 'PÅ' : 'AV'}
              hint={status.foreignKeys ? undefined : 'Varning: referensintegritet är inte aktiv'}
            />
          </dl>

          <p className="mt-4 break-all text-xs text-slate-400">
            Databasfil: {status.path}
          </p>
        </>
      ) : null}
    </main>
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
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-3.5 last:border-b-0">
      <div>
        <span className="text-sm text-slate-700">{label}</span>
        {hint && <p className="text-xs text-slate-400">{hint}</p>}
      </div>
      <span className="text-lg font-bold tabular-nums text-slate-900">{value}</span>
    </div>
  );
}

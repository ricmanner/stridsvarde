import { Shield } from 'lucide-react';

import { stangLoggAction } from '@/app/actions/logg';
import { requireLoggatkomst } from '@/lib/auth/logg';
import { klockslagLabel, longDateLabel, serviceDate } from '@/lib/date';
import {
  incheckningarPerTimme,
  sammanfattningSedanAterstallning,
  senasteHandelser,
  type Handelse,
} from '@/lib/db/queries/aktivitet';

// Loggen ska alltid visa läget nu, aldrig en cachad bild.
export const dynamic = 'force-dynamic';

/**
 * Aktivitetsloggen — bara för den som skrivit loggkoden.
 *
 * Varför den ligger här och inte i adminvyn står i lib/auth/logg.ts. Den
 * visar roll och enhet, aldrig benämning, kod eller svar; incheckningar bara
 * som antal. Se lib/db/queries/aktivitet.ts.
 */
export default async function LoggPage() {
  await requireLoggatkomst();

  const [handelser, summa, perTimme] = await Promise.all([
    senasteHandelser(300),
    sammanfattningSedanAterstallning(),
    incheckningarPerTimme(),
  ]);

  // Dag för dag, nyast först — tjänstedatum i Stockholm, inte UTC.
  const dagar = new Map<string, Handelse[]>();
  for (const h of handelser) {
    const dag = serviceDate(new Date(h.tid));
    dagar.set(dag, [...(dagar.get(dag) ?? []), h]);
  }

  const sedan = summa.sedan
    ? `sedan demon återställdes ${longDateLabel(serviceDate(new Date(summa.sedan)))} klockan ${klockslagLabel(summa.sedan)}`
    : 'sedan starten';

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-13 shrink-0 items-center gap-3 bg-slate-900 px-4 py-3 sm:px-6">
        <Shield size={16} className="shrink-0 text-slate-500" strokeWidth={1.5} aria-hidden />
        <span className="shrink-0 text-xs font-bold tracking-[1.5px] text-white">FM – PSVI</span>
        <span className="truncate text-xs text-slate-400">Aktivitetslogg</span>
        <form action={stangLoggAction} className="ml-auto">
          <button
            type="submit"
            className="cursor-pointer rounded px-2 py-1.5 text-etikett font-semibold text-slate-300 transition-colors hover:text-white"
          >
            Stäng loggen
          </button>
        </form>
      </header>

      <main id="innehall" className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
        <h1 className="text-xl font-bold text-slate-900">Aktivitetslogg</h1>
        <p className="mt-1 mb-5 max-w-2xl text-xs leading-relaxed text-slate-500">
          Bara den som har loggkoden ser den här sidan — inte administratören. Loggen
          visar roll och enhet, aldrig koder, benämningar eller svar. Incheckningar
          syns bara som antal.
        </p>

        <h2 className="mb-2 text-etikett font-bold uppercase tracking-[0.1em] text-balance text-slate-500">
          {`Aktivitet ${sedan}`}
        </h2>
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Siffra etikett="Inloggningar" varde={summa.inloggningar} />
          <Siffra etikett="Nya incheckningar" varde={summa.incheckningar} />
          <Siffra etikett="Samtalsbegäranden" varde={summa.samtal} />
          <Siffra etikett="Adminåtgärder" varde={summa.adminatgarder} />
        </div>

        {perTimme.length > 0 && (
          <>
            <h2 className="mb-2 text-etikett font-bold uppercase tracking-[0.1em] text-balance text-slate-500">
              Nya incheckningar per timme
            </h2>
            <ul className="mb-6 overflow-hidden rounded-md border border-slate-200 bg-white">
              {perTimme.map((t, i) => (
                <li
                  key={t.timme}
                  className={`flex justify-between px-4 py-2 text-sm ${i > 0 ? 'border-t border-slate-100' : ''}`}
                >
                  <span className="text-slate-600">
                    {longDateLabel(serviceDate(new Date(t.timme)))}, {klockslagLabel(t.timme)}
                  </span>
                  <span className="font-semibold tabular-nums text-slate-900">{t.antal}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        <h2 className="mb-2 text-etikett font-bold uppercase tracking-[0.1em] text-balance text-slate-500">
          Händelser, nyast först
        </h2>
        {handelser.length === 0 ? (
          <p className="text-sm text-slate-500">Inget har hänt ännu.</p>
        ) : (
          [...dagar.entries()].map(([dag, rader]) => (
            <section key={dag} className="mb-5">
              <h3 className="mb-1.5 text-sm font-semibold text-slate-800">{longDateLabel(dag)}</h3>
              <ul className="overflow-hidden rounded-md border border-slate-200 bg-white">
                {rader.map((h, i) =>
                  h.slag === 'demo.reset' ? (
                    // Återställningen är en gräns i loggen, inte en rad bland andra.
                    <li
                      key={`${h.tid}-${i}`}
                      className={`bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 ${i > 0 ? 'border-t border-slate-200' : ''}`}
                    >
                      {klockslagLabel(h.tid)} — Demon återställdes. Allt före den här raden gällde den förra demon.
                    </li>
                  ) : (
                    <li
                      key={`${h.tid}-${i}`}
                      className={`flex gap-3 px-4 py-2 text-sm ${i > 0 ? 'border-t border-slate-100' : ''}`}
                    >
                      <span className="w-11 shrink-0 tabular-nums text-slate-500">{klockslagLabel(h.tid)}</span>
                      <span className="min-w-0">
                        <span className="font-semibold text-slate-900">{h.text}</span>
                        {h.detalj && <span className="text-slate-600"> — {h.detalj}</span>}
                      </span>
                    </li>
                  ),
                )}
              </ul>
            </section>
          ))
        )}
      </main>
    </div>
  );
}

function Siffra({ etikett, varde }: { etikett: string; varde: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-4 py-3">
      <p className="text-etikett font-bold uppercase tracking-[0.08em] text-slate-500">{etikett}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{varde}</p>
    </div>
  );
}

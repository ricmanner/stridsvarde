import Link from 'next/link';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

import PrintButton from '@/app/rapport/PrintButton';
import Veckosammanfattning from '@/components/leader/Veckosammanfattning';
import { requireRole } from '@/lib/auth/guard';
import { CELL_TINT } from '@/components/charts/chart-theme';
import { CATEGORIES, getStatus, personfordelning, roundScore, statusLabel } from '@/lib/data';
import { serviceDate, serviceDateDaysAgo } from '@/lib/date';
import {
  getChildComparison,
  getKategorilage,
  getUnitCategorySeries,
  getUnitOverview,
  getVeckounderlag,
} from '@/lib/db/queries/aggregates';
import { parsePeriod } from '@/lib/privacy';
import { veckokort } from '@/lib/veckosammanfattning';
import { homeFor } from '@/lib/roles';
import { formatScore, forandring, procent, uppräkningSamt } from '@/lib/format';

export const dynamic = 'force-dynamic';

/**
 * Rutan "Senaste veckan" överst i rapporten. Gömd den 17 oktober: den var
 * alltid sju dagar medan resten av rapporten följde den valda perioden, och
 * med 7 dagar upprepade den kategoritabellen. Samma beslut som på skärmen
 * (VISA_VECKAN i LeaderDashboard.tsx). Rapporten med 7 dagar är veckorapporten.
 */
const VISA_VECKAN = false;

/**
 * Hur ett rött värde syns i underenhetstabellen. Båda har varningstriangeln
 * från skärmen, som syns också i en svartvit utskrift. 'text': fet röd text,
 * ingen bakgrund. 'tonade': tonade rutor som på skärmen, tvingade att skrivas
 * ut i färg. TILLFÄLLIG — Richard väljer (17 oktober).
 *
 * Först stod ▲ framför de röda talen. Richard: det ser ut som att värdet gått
 * upp, inte som en varning.
 */
const RODA_RUTOR: 'text' | 'tonade' = 'text';

/**
 * Utskriftsvänlig sammanställning.
 *
 * Medvetet utan diagram: recharts ResponsiveContainer mäter sin bredd till
 * noll under utskrift i Chrome och Safari, och skulle ge tomma rutor i PDF:en.
 * Tabeller skrivs dessutom ut bättre och går att läsa i en pärm.
 */
export default async function RapportPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const session = await requireRole('pluton', 'kompani', 'bataljon');
  const period = parsePeriod((await searchParams).period);

  const [overview, series, comparison, veckounderlag, lage] = await Promise.all([
    getUnitOverview(session.unitId, period),
    getUnitCategorySeries(session.unitId, period),
    getChildComparison(session.unitId, period),
    VISA_VECKAN ? getVeckounderlag(session.unitId) : null,
    getKategorilage(session.unitId, period),
  ]);

  /*
   * Hur många som svarat i snitt per dag under perioden, i hela procent. Ett
   * antal, inte hälsodata. Ersätter "Svarat idag" i rapporten: på ett papper
   * som läses på veckomötet säger ögonblicket då det skrevs ut inget, men
   * snittet säger om talen går att lita på.
   */
  const svarIPerioden = series.reduce((summa, p) => summa + p.responders, 0);
  const svarsprocent =
    overview.eligible > 0 ? Math.round((svarIPerioden / (overview.eligible * period)) * 100) : 0;

  const cats = overview.categories;
  const overall = cats.ok
    ? Object.values(cats.data).reduce((a, b) => a + b, 0) / CATEGORIES.length
    : null;

  // Som befälsvyn: sämst först, och de kategorier som ligger i rött.
  const rader = cats.ok
    ? [...CATEGORIES].sort((a, b) => roundScore(cats.data[a.key]) - roundScore(cats.data[b.key]))
    : [];
  const roda = cats.ok ? CATEGORIES.filter((c) => getStatus(cats.data[c.key]) === 'red') : [];
  const harForra = lage.ok && CATEGORIES.some((c) => lage.data[c.key].forra !== null);
  const visaIRott = comparison.children.some((c) => c.overall !== null && c.red !== null);

  const from = serviceDateDaysAgo(period - 1);
  const to = serviceDate();

  return (
    <main id="innehall" className="mx-auto max-w-4xl px-5 py-8 print:px-0 print:py-0">
      <div className="no-print mb-6 flex flex-wrap items-center gap-3">
        <Link
          href={homeFor(session.role)}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft size={15} aria-hidden /> Tillbaka
        </Link>
        <div className="ml-auto flex items-center gap-2">
          {[7, 14, 21].map((d) => (
            <Link
              key={d}
              href={`/rapport?period=${d}`}
              className={`rounded border-[1.5px] px-2.5 py-1 text-etikett font-bold ${
                period === d
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 text-slate-500'
              }`}
            >
              {d}d
            </Link>
          ))}
          <PrintButton />
        </div>
      </div>

      {/* ── Rubrik ── */}
      <header className="mb-6 border-b-2 border-slate-900 pb-4">
        <p className="text-etikett font-bold uppercase tracking-[0.12em] text-slate-500">
          FM – PSVI · Försvarsmaktens Personliga Stridsvärdesindikator
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">{session.unitName}</h1>
        <p className="mt-1 text-sm text-slate-600">
          Sammanställning {from} – {to} ({period} dagar) · {overview.eligible} värnpliktiga
        </p>
      </header>

      {/* Veckan i fyra fält. Gömd, se VISA_VECKAN. */}
      {veckounderlag && (
        <div style={{ breakInside: 'avoid' }}>
          <Veckosammanfattning kort={veckokort(veckounderlag)} />
        </div>
      )}

      {/* ── Sammanfattning ── */}
      <section className="mb-7">
        <h2 className="mb-2 text-etikett font-bold uppercase tracking-[0.1em] text-slate-500">
          Sammanfattning
        </h2>
        {cats.ok && overall !== null ? (
          // Samma fyra nyckeltal som överst i befälsvyn (16 oktober). Förut
          // "Gröna värnpliktiga" och "Röda värnpliktiga", som skärmen inte
          // längre säger.
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Box
              label="Samlat mående"
              value={formatScore(overall)}
              sub={`${statusLabel(getStatus(overall))} · snitt ${period} dagar`}
            />
            <Box label="Svarade i snitt" value={procent(svarsprocent)} sub={`av ${overview.eligible} varje dag`} />
            {(() => {
              if (!overview.soldierStatus.ok) return <Box label="Personer i rött" value="—" sub="underlag saknas" />;
              const f = personfordelning(overview.soldierStatus.data, overview.eligible);
              return (
                <Box
                  label="Personer i rött"
                  value={String(f.red)}
                  sub={`av ${f.total}, på samlat snitt${f.utanSvar > 0 ? ` · ${f.utanSvar} utan svar` : ''}`}
                />
              );
            })()}
            <Box
              label="Kategorier i rött"
              value={String(roda.length)}
              sub={roda.length === 0 ? `av ${CATEGORIES.length}` : uppräkningSamt(roda.map((c) => c.label.toLowerCase()))}
            />
          </div>
        ) : (
          <p className="rounded border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            {cats.ok ? '' : cats.message}
          </p>
        )}
      </section>

      {/* ── Kategorier ── */}
      {cats.ok && (
        <section className="mb-7" style={{ breakInside: 'avoid' }}>
          <h2 className="mb-2 text-etikett font-bold uppercase tracking-[0.1em] text-slate-500">
            Kategorier — de senaste {period} dagarna, sämst först
          </h2>
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-etikett uppercase tracking-wide text-slate-500">
                <th className="py-1.5 font-bold">Kategori</th>
                <th className="py-1.5 text-right font-bold">Snitt</th>
                <th className="py-1.5 text-right font-bold">Status</th>
                <th className="py-1.5 text-right font-bold">Mot perioden före</th>
                <th className="py-1.5 text-right font-bold">I rött</th>
              </tr>
            </thead>
            <tbody>
              {rader.map((c) => {
                const s = cats.data[c.key];
                const l = lage.ok ? lage.data[c.key] : null;
                const f = l?.forra != null ? forandring(s, l.forra) : null;
                return (
                  <tr key={c.key} className="border-b border-slate-100">
                    <td className="py-1.5 text-slate-700">{c.label}</td>
                    <td className="py-1.5 text-right font-bold tabular-nums text-slate-900">{formatScore(s)}</td>
                    <td className="py-1.5 text-right text-slate-600">{statusLabel(getStatus(s))}</td>
                    <td className="py-1.5 text-right tabular-nums text-slate-600">
                      {f && l?.forra != null ? (
                        <>
                          <span
                            className={
                              f.riktning === 'ned'
                                ? 'font-semibold text-red-700'
                                : f.riktning === 'upp'
                                  ? 'font-semibold text-emerald-700'
                                  : ''
                            }
                          >
                            {f.text}
                          </span>{' '}
                          <span className="text-slate-500">från {formatScore(l.forra)}</span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-slate-600">
                      {l ? `${l.iRott} av ${cats.responders}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-1.5 text-xs text-slate-500">
            {harForra
              ? `Mot perioden före: de ${period} dagarna innan. `
              : `Ingen jämförelse: för få svar under de ${period} dagarna före. `}
            I rött: personer vars eget snitt ligger under 4, av dem som svarat.
          </p>
        </section>
      )}

      {/* ── Underenheter ── */}
      {/*
        Samma tabell som Jämförelse på skärmen: underenheterna som rader,
        kategorierna som kolumner (17 oktober). "3. grupp, sömn" stod förut
        bara på skärmen; rapporten hade snittet per grupp. Befälen ska ha gott
        om användbar information på sina möten.

        "I rött" bara när den har något att visa, som på skärmen: så länge en
        underenhet är dold håller databasen inne antalen för alla
        (SKYDDA_DOLDA_SYSKON i queries/aggregates.ts).
      */}
      {comparison.children.length > 0 && (
        <section className="mb-7" style={{ breakInside: 'avoid' }}>
          <h2 className="mb-2 text-etikett font-bold uppercase tracking-[0.1em] text-slate-500">
            Underenheter — de senaste {period} dagarna
          </h2>
          <table aria-label="Underenheter per kategori" className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-300 text-etikett uppercase tracking-wide text-slate-500">
                <th className="py-1.5 pr-2 align-bottom font-bold">Enhet</th>
                <th className="px-1 py-1.5 text-right align-bottom font-bold">Svarande</th>
                <th className="px-1 py-1.5 text-right align-bottom font-bold">Snitt</th>
                {visaIRott && <th className="px-1 py-1.5 text-right align-bottom font-bold">I rött</th>}
                {/* Lika breda, som i jämförelsen på skärmen: annars blev SÖMN
                    smal och varningstriangeln bröts ovanför talet. */}
                {CATEGORIES.map((k) => (
                  <th key={k.key} className="w-16 px-1 py-1.5 text-right align-bottom font-bold">
                    {k.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparison.children.map((c) => (
                <tr key={c.id} className="border-b border-slate-100">
                  <td className="whitespace-nowrap py-1.5 pr-2 text-sm text-slate-700">{c.name}</td>
                  <td className="px-1 py-1.5 text-right tabular-nums text-slate-600">
                    {c.responders}/{c.eligible}
                  </td>
                  {c.overall === null || c.scores === null ? (
                    <td colSpan={CATEGORIES.length + (visaIRott ? 2 : 1)} className="px-1 py-1.5 text-right text-slate-500">
                      {c.eligible === 0 ? 'Inga värnpliktiga placerade här ännu' : 'Underlag saknas'}
                    </td>
                  ) : (
                    <>
                      <Varde v={c.overall} fet />
                      {visaIRott && (
                        <td className="whitespace-nowrap px-1 py-1.5 text-right tabular-nums text-slate-600">
                          {c.red === null ? '—' : `${c.red} av ${c.responders}`}
                        </td>
                      )}
                      {CATEGORIES.map((k) => (
                        <Varde key={k.key} v={c.scores![k.key]} />
                      ))}
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1.5 text-xs text-slate-500">
            {RODA_RUTOR === 'text'
              ? 'Varningstriangel och fet röd text: under 4.'
              : 'Varningstriangel och röd ruta: under 4. Gul: 4–6,9. Grön: från 7.'}
          </p>
        </section>
      )}

      {/* ── Dag för dag ── */}
      <section className="mb-7" style={{ breakInside: 'avoid' }}>
        <h2 className="mb-2 text-etikett font-bold uppercase tracking-[0.1em] text-slate-500">
          Dag för dag
        </h2>
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-etikett uppercase tracking-wide text-slate-500">
              <th className="py-1.5 font-bold">Datum</th>
              <th className="py-1.5 text-right font-bold">Svarande</th>
              <th className="py-1.5 text-right font-bold">Snitt</th>
            </tr>
          </thead>
          <tbody>
            {[...series].reverse().map((p) => (
              <tr key={p.date} className="border-b border-slate-100">
                <td className="py-1.5 text-slate-700">{p.date}</td>
                <td className="py-1.5 text-right tabular-nums text-slate-600">
                  {p.responders}/{p.eligible}
                </td>
                <td className="py-1.5 text-right font-bold tabular-nums text-slate-900">
                  {p.overall !== null ? formatScore(p.overall) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer className="border-t border-slate-300 pt-3 text-xs leading-relaxed text-slate-500">
        <p>
          Rapporten innehåller endast sammanställd data. Enskilda värnpliktigas svar
          redovisas aldrig. Värden markerade &quot;—&quot; har undanhållits för att
          underlaget varit för litet för att kunna redovisas utan att röja enskilda.
        </p>
        {/* Här stod "Gränserna för grönt, gult och rött är preliminära."
            Borttagen 17 oktober (Richard), som på skärmen. */}
        <p className="mt-1">
          Enhetstillhörighet visas enligt nuvarande organisation. Utskriven {to}.
        </p>
      </footer>
    </main>
  );
}

function Box({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded border border-slate-300 px-3 py-2.5">
      <p className="text-etikett font-bold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className="text-xl font-bold tabular-nums text-slate-900">{value}</p>
      {sub && <p className="text-etikett text-slate-500">{sub}</p>}
    </div>
  );
}

/** Ett snitt i underenhetstabellen, med status som tecken eller ton. */
function Varde({ v, fet = false }: { v: number; fet?: boolean }) {
  const status = getStatus(v);
  if (RODA_RUTOR === 'tonade') {
    return (
      <td className="px-0.5 py-1">
        <span
          className={`block whitespace-nowrap rounded px-1 py-1 text-right tabular-nums text-slate-900 ${fet ? 'font-bold' : ''}`}
          style={{ background: CELL_TINT[status], printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
        >
          {status === 'red' && <Varning />}
          {formatScore(v)}
        </span>
      </td>
    );
  }
  return (
    <td
      className={`whitespace-nowrap px-1 py-1.5 text-right tabular-nums ${
        status === 'red' ? 'font-bold text-red-700' : fet ? 'font-bold text-slate-900' : 'text-slate-700'
      }`}
    >
      {status === 'red' && <Varning />}
      {formatScore(v)}
    </td>
  );
}

/** Varningstriangeln från jämförelsen på skärmen, framför ett rött värde. */
function Varning() {
  return (
    <>
      <AlertTriangle size={11} className="mr-1 inline-block -translate-y-px text-red-700" aria-hidden />
      <span className="sr-only">röd: </span>
    </>
  );
}

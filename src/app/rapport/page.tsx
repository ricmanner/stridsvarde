import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import PrintButton from '@/app/rapport/PrintButton';
import { requireRole } from '@/lib/auth/guard';
import { CATEGORIES, getStatus, statusLabel } from '@/lib/data';
import { serviceDate, serviceDateDaysAgo } from '@/lib/date';
import {
  getChildComparison,
  getUnitCategorySeries,
  getUnitOverview,
} from '@/lib/db/queries/aggregates';
import { parsePeriod } from '@/lib/privacy';
import { homeFor } from '@/lib/roles';
import { formatScore } from '@/lib/format';

export const dynamic = 'force-dynamic';

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

  const [overview, series, comparison] = await Promise.all([
    getUnitOverview(session.unitId, period),
    getUnitCategorySeries(session.unitId, period),
    getChildComparison(session.unitId, period),
  ]);

  const cats = overview.categories;
  const overall = cats.ok
    ? Object.values(cats.data).reduce((a, b) => a + b, 0) / CATEGORIES.length
    : null;

  const from = serviceDateDaysAgo(period - 1);
  const to = serviceDate();

  return (
    <main className="mx-auto max-w-4xl px-5 py-8 print:px-0 print:py-0">
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
              className={`rounded border-[1.5px] px-2.5 py-1 text-[11px] font-bold ${
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
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
          FM – PSVI · Försvarsmaktens Personliga Stridsvärdesindikator
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">{session.unitName}</h1>
        <p className="mt-1 text-sm text-slate-600">
          Sammanställning {from} – {to} ({period} dagar) · {overview.eligible} värnpliktiga
        </p>
      </header>

      {/* ── Sammanfattning ── */}
      <section className="mb-7">
        <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
          Sammanfattning
        </h2>
        {cats.ok && overall !== null ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Box label="Samlat mående" value={formatScore(overall)} sub={statusLabel(getStatus(overall))} />
            <Box label="Svarat idag" value={`${overview.today.pct} %`} sub={`${overview.today.responders} av ${overview.eligible}`} />
            {overview.soldierStatus.ok && (
              <>
                <Box label="Gröna värnpliktiga" value={String(overview.soldierStatus.data.green)} />
                <Box label="Röda värnpliktiga" value={String(overview.soldierStatus.data.red)} />
              </>
            )}
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
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
            Kategorier
          </h2>
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="py-1.5 font-bold">Kategori</th>
                <th className="py-1.5 text-right font-bold">Snitt</th>
                <th className="py-1.5 text-right font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((c) => {
                const s = cats.data[c.key];
                return (
                  <tr key={c.key} className="border-b border-slate-100">
                    <td className="py-1.5 text-slate-700">{c.label}</td>
                    <td className="py-1.5 text-right font-bold tabular-nums text-slate-900">{formatScore(s)}</td>
                    <td className="py-1.5 text-right text-slate-600">{statusLabel(getStatus(s))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* ── Underenheter ── */}
      {comparison.children.length > 0 && (
        <section className="mb-7" style={{ breakInside: 'avoid' }}>
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
            Underenheter
          </h2>
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="py-1.5 font-bold">Enhet</th>
                <th className="py-1.5 text-right font-bold">Svarande</th>
                <th className="py-1.5 text-right font-bold">Snitt</th>
                <th className="py-1.5 text-right font-bold">Grön/Gul/Röd</th>
              </tr>
            </thead>
            <tbody>
              {comparison.children.map((c) => (
                <tr key={c.id} className="border-b border-slate-100">
                  <td className="py-1.5 text-slate-700">{c.name}</td>
                  <td className="py-1.5 text-right tabular-nums text-slate-600">
                    {c.responders}/{c.eligible}
                  </td>
                  <td className="py-1.5 text-right font-bold tabular-nums text-slate-900">
                    {c.overall !== null ? formatScore(c.overall) : '—'}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-slate-600">
                    {c.overall !== null ? `${c.green} / ${c.yellow} / ${c.red}` : 'underlag saknas'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* ── Dag för dag ── */}
      <section className="mb-7" style={{ breakInside: 'avoid' }}>
        <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
          Dag för dag
        </h2>
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-[11px] uppercase tracking-wide text-slate-500">
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
        {/*
          En utskrift lämnar appen och vandrar vidare, utan sammanhang. Just här
          måste det stå att indelningen i grön, gul och röd inte är fastställd.
        */}
        <p className="mt-1">
          Gränserna för grön, gul och röd är preliminära och ska fastställas
          tillsammans med Försvarshälsan.
        </p>
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
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className="text-xl font-bold tabular-nums text-slate-900">{value}</p>
      {sub && <p className="text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}

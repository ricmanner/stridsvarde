'use client';

import { useState } from 'react';
import Link, { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, AlertTriangle, Brain, Download, FileText, Moon, Users, Utensils, Zap } from 'lucide-react';

import CategoryTrendGrid from '@/components/charts/CategoryTrendGrid';
import StatusBadge from '@/components/StatusBadge';
import Tabs, { Panel } from '@/components/Tabs';
import ChildFocus from '@/components/leader/ChildFocus';
import ComparisonGrid from '@/components/leader/ComparisonGrid';
import Suppressed from '@/components/leader/Suppressed';
import { CATEGORIES, getStatus, statusOrd, statusSvar, type Status } from '@/lib/data';
import type { ChildComparison, SeriesPoint, UnitOverview } from '@/lib/db/queries/aggregates';
import { ALLOWED_PERIODS, type Period } from '@/lib/privacy';
import { ordformer, type ChildKind } from '@/lib/unit-names';
import { formatScore, procent } from '@/lib/format';

const FLIKAR = [
  { id: 'overview', etikett: 'Översikt' },
  { id: 'trends', etikett: 'Trender' },
  { id: 'compare', etikett: 'Jämförelse' },
] as const;

const ICONS: Record<string, React.ReactNode> = {
  Activity: <Activity size={15} strokeWidth={1.5} />,
  Brain: <Brain size={15} strokeWidth={1.5} />,
  Users: <Users size={15} strokeWidth={1.5} />,
  Moon: <Moon size={15} strokeWidth={1.5} />,
  Utensils: <Utensils size={15} strokeWidth={1.5} />,
  Zap: <Zap size={15} strokeWidth={1.5} />,
};

export interface LeaderDashboardProps {
  levelLabel: string;
  /** Underenheterna i plural, för rubriker: "plutoner". */
  childLabel: string;
  /** Underenheternas sort i singular. Bär genus — ett kompani, en pluton. */
  childKind: ChildKind;
  period: Period;
  overview: UnitOverview;
  series: SeriesPoint[];
  comparison: ChildComparison;
  advice: string | null;
}

/**
 * En enda vy för alla befälsnivåer.
 *
 * Demon hade tre nästan identiska sidor på sammanlagt 1234 rader som skilde
 * sig i vilken mockdata de läste. Eftersom aggregeringsfrågorna nu är
 * desamma oavsett nivå i trädet behövs bara den här — plutonchefen jämför
 * grupper, kompanichefen plutoner, bataljonschefen kompanier, med samma kod.
 */
export default function LeaderDashboard({
  levelLabel, childLabel, childKind, period, overview, series, comparison, advice,
}: LeaderDashboardProps) {
  const pathname = usePathname();
  const [tab, setTab] = useState<'overview' | 'trends' | 'compare'>('overview');
  // Lokala konstanter så att TypeScript kan smalna av unionen korrekt —
  // narrowing på en egenskap (overview.distribution.ok) håller inte genom JSX.
  const cats = overview.categories;
  const dist = overview.distribution;

  const overall = cats.ok
    ? Object.values(cats.data).reduce((a, b) => a + b, 0) / CATEGORIES.length
    : null;

  const alerts = cats.ok
    ? CATEGORIES.filter(c => getStatus(cats.data[c.key]) === 'red')
    : [];

  const visibleChildren = comparison.children.filter(c => c.scores !== null);

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      {/* ── Sammanfattningsrad ── */}
      <div className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-3">
          <div>
            <p className="text-etikett font-bold uppercase tracking-[0.08em] text-slate-500">
              {levelLabel} · {period} dagar
            </p>
            <div className="flex items-baseline gap-2">
              {overall !== null ? (
                <>
                  <span className="text-2xl font-extrabold tabular-nums text-slate-900">
                    {formatScore(overall)}
                  </span>
                  <StatusBadge status={getStatus(overall)} />
                </>
              ) : (
                <span className="text-sm text-slate-500">Underlag saknas</span>
              )}
            </div>
          </div>

          <div className="hidden h-9 w-px bg-slate-200 sm:block" />

          {overview.soldierStatus.ok ? (
            <>
              {/* "1 Grön", inte "1 Gröna" — se statusOrd() i lib/data.ts. */}
              <Stat n={overview.soldierStatus.data.green} status="green" color="#059669" />
              <Stat n={overview.soldierStatus.data.yellow} status="yellow" color="#D97706" />
              <Stat n={overview.soldierStatus.data.red} status="red" color="#DC2626" />
            </>
          ) : null}

          <span className="text-xs text-slate-500">{overview.eligible} värnpliktiga</span>
          <span className="text-xs text-slate-500">
            {procent(overview.today.pct)} svarat idag ({overview.today.responders}/{overview.eligible})
          </span>

          {alerts.length > 0 && (
            <div className="flex items-center gap-1.5 rounded border border-red-200 bg-red-50 px-2.5 py-1 sm:ml-auto">
              <AlertTriangle size={13} className="text-red-700" aria-hidden />
              <span className="text-etikett font-bold text-red-700">
                {alerts.length} kategori{alerts.length > 1 ? 'er' : ''} i rött
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Flikar ── */}
      <div className="no-print flex border-b border-slate-200 bg-white">
        <Tabs
          flikar={FLIKAR}
          vald={tab}
          onValj={setTab}
          etikett="Vyer för enheten"
          className="mx-auto flex w-full max-w-5xl"
          knappklass={(aktiv) =>
            `flex-1 cursor-pointer border-b-2 px-2 py-3.5 text-etikett font-bold uppercase tracking-[0.08em] transition-colors ${
              aktiv ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500'
            }`
          }
        />
      </div>

      <div className="mx-auto w-full max-w-5xl flex-1 px-4 pb-12 pt-5 sm:px-6">
        {/* ── ÖVERSIKT ── */}
        {tab === 'overview' && (
          <Panel id="overview">
            {/*
              Väljaren stod bara på de två andra flikarna, trots att rubriken
              här är den första som nämner en period. Den som läste "över 7
              dagar" hade ingenstans att ändra det.
            */}
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <SL inline>Kategorier — snitt och fördelning över {period} dagar</SL>
              <PeriodPicker current={period} pathname={pathname} />
            </div>
            {cats.ok && dist.ok ? (
              <div className="mb-4 overflow-hidden rounded-md border border-slate-200 bg-white">
                {CATEGORIES.map((cat, i) => {
                  const score = cats.data[cat.key];
                  const d = dist.data[cat.key];
                  const total = d.green + d.yellow + d.red || 1;
                  return (
                    <div
                      key={cat.key}
                      className={`px-4 py-3.5 sm:px-5 ${i < CATEGORIES.length - 1 ? 'border-b border-slate-100' : ''}`}
                    >
                      <div className="mb-2 flex items-center gap-2.5">
                        <span className="text-slate-400">{ICONS[cat.icon]}</span>
                        <span className="flex-1 text-xs text-slate-600">{cat.label}</span>
                        <span className="mr-1.5 text-sm font-bold tabular-nums text-slate-900">
                          {formatScore(score)}
                        </span>
                        <StatusBadge status={getStatus(score)} size="sm" />
                      </div>
                      <div className="mb-1.5 flex h-1.5 overflow-hidden rounded-full">
                        <div style={{ width: `${(d.green / total) * 100}%`, background: '#059669' }} />
                        <div style={{ width: `${(d.yellow / total) * 100}%`, background: '#D97706' }} />
                        <div style={{ width: `${(d.red / total) * 100}%`, background: '#DC2626' }} />
                      </div>
                      <div className="flex gap-3 text-etikett">
                        <span className="font-semibold text-emerald-700">{d.green} <span className="font-normal text-slate-500">{statusSvar('green', d.green)}</span></span>
                        <span className="font-semibold text-amber-700">{d.yellow} <span className="font-normal text-slate-500">{statusSvar('yellow', d.yellow)}</span></span>
                        <span className="font-semibold text-red-700">{d.red} <span className="font-normal text-slate-500">{statusSvar('red', d.red)}</span></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mb-4">
                {(() => {
                  const blocked = !cats.ok ? cats : dist.ok ? null : dist;
                  return blocked ? (
                    <Suppressed text={blocked.message} />
                  ) : null;
                })()}
              </div>
            )}

            {alerts.length > 0 && cats.ok && (
              <>
                <SL>Tröskelvärden — kräver åtgärd</SL>
                <div className="mb-4">
                  <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3.5 sm:px-5">
                    {alerts.map((cat, i) => (
                      <div key={cat.key} className={`flex items-center gap-2.5 ${i > 0 ? 'mt-2' : ''}`}>
                        <AlertTriangle size={14} className="shrink-0 text-red-700" aria-hidden />
                        <span className="text-xs text-red-900">
                          <strong>{cat.label}</strong> understiger kritisk nivå — snitt{' '}
                          {formatScore(cats.data[cat.key])}
                        </span>
                      </div>
                    ))}
                  </div>
                  <Preliminary>
                    Gränserna är preliminära och ska fastställas tillsammans med Försvarshälsan.
                  </Preliminary>
                </div>
              </>
            )}

            {advice && (
              <>
                <SL>Befälsråd</SL>
                <div className="rounded-md border border-slate-200 bg-white p-5">
                  <div className="mb-2.5 flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-amber-500" />
                    <span className="text-etikett font-bold uppercase tracking-[0.08em] text-slate-500">
                      Baserat på enhetens egna värden
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-700">{advice}</p>
                </div>
                <Preliminary>
                  Råden är preliminära och ska fastställas tillsammans med Försvarshälsan.
                </Preliminary>
              </>
            )}

            <PrivacyFooter />
            <ExportBar period={period} childLabel={childLabel} />
          </Panel>
        )}

        {/* ── TRENDER ── */}
        {tab === 'trends' && (
          <Panel id="trends">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <SL inline>Kategoritrender — {period} dagar</SL>
              <PeriodPicker current={period} pathname={pathname} />
            </div>

            <div className="mb-6">
              <CategoryTrendGrid
                rows={series.map(p => ({ key: p.date, label: p.label, scores: p.scores }))}
                ariaPrefix="Trend för enheten"
                summary={cats.ok ? cats.data : null}
                summaryLabel={`snitt ${period} d`}
              />
            </div>

            <SL>Svarsunderlag per dag</SL>
            {/*
              Rullningsbar yta = tangentbordsåtkomst. I telefonbredd blir
              tabellen bredare än skärmen och får en egen vågrät rullning; utan
              tabIndex går den bara att rulla med finger eller mus, vilket axe
              underkänner (WCAG 2.1.1). Rollen och namnet gör dessutom att en
              skärmläsare kan hoppa till den.
            */}
            <div
              tabIndex={0}
              role="region"
              aria-label="Svarsunderlag per dag"
              className="mb-4 overflow-x-auto rounded-md border border-slate-200 bg-white"
            >
              <table className="w-full min-w-[420px] text-left">
                <thead className="bg-slate-50">
                  <tr className="text-etikett font-bold uppercase tracking-[0.08em] text-slate-500">
                    <th className="px-4 py-2.5 font-bold">Dag</th>
                    <th className="px-4 py-2.5 text-center font-bold">Svar</th>
                    <th className="px-4 py-2.5 text-center font-bold">Andel</th>
                    <th className="px-4 py-2.5 text-right font-bold">Snitt</th>
                  </tr>
                </thead>
                <tbody>
                  {[...series].reverse().map(p => (
                    <tr key={p.date} className="border-t border-slate-100">
                      <td className="px-4 py-2.5 text-xs text-slate-600">{p.label}</td>
                      <td className="px-4 py-2.5 text-center text-xs tabular-nums text-slate-500">
                        {p.responders}/{p.eligible}
                      </td>
                      <td className="px-4 py-2.5 text-center text-xs tabular-nums text-slate-500">
                        {procent(p.eligible ? Math.round((p.responders / p.eligible) * 100) : 0)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs font-bold tabular-nums text-slate-900">
                        {p.overall !== null ? formatScore(p.overall) : (
                          <span className="font-normal text-slate-400" title="För få svar för att visa">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PrivacyFooter />
            <ExportBar period={period} childLabel={childLabel} />
          </Panel>
        )}

        {/* ── JÄMFÖRELSE ── */}
        {tab === 'compare' && (
          <Panel id="compare">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <SL inline>Jämförelse mellan {childLabel} — {period} dagar</SL>
              <PeriodPicker current={period} pathname={pathname} />
            </div>

            {visibleChildren.length === 0 ? (
              <Suppressed
                text={`Ingen av enhetens ${childLabel} har tillräckligt underlag för att visas.`}
              />
            ) : (
              <>
                <div className="mb-6">
                  <ComparisonGrid items={comparison.children} childLabel={childLabel} />
                </div>

                {/* "ett kompani", "en pluton" — artikeln kommer ur ordformer(),
                    inte ur ett fast "en". Se lib/unit-names.ts. */}
                <SL>Jämför {ordformer(childKind).artikel} {childKind} med hela enheten</SL>
                <div className="mb-6">
                  <ChildFocus
                    items={comparison.children}
                    childLabel={childLabel}
                    comparisonSeries={comparison.series}
                    unitSeries={series}
                    unitCategories={cats}
                  />
                </div>

                <SL>Rangordning</SL>
                {/* Samma sak som tabellen på Trender — se kommentaren där. */}
                <div
                  tabIndex={0}
                  role="region"
                  aria-label="Rangordning"
                  className="overflow-x-auto rounded-md border border-slate-200 bg-white"
                >
                  <table className="w-full min-w-[480px] text-left">
                    <thead className="bg-slate-50">
                      <tr className="text-etikett font-bold uppercase tracking-[0.08em] text-slate-500">
                        <th className="px-4 py-2.5 font-bold">Enhet</th>
                        <th className="px-4 py-2.5 text-center font-bold">Svar</th>
                        <th className="px-4 py-2.5 text-center font-bold">Gröna</th>
                        <th className="px-4 py-2.5 text-center font-bold">Gula</th>
                        <th className="px-4 py-2.5 text-center font-bold">Röda</th>
                        <th className="px-4 py-2.5 text-right font-bold">Snitt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...comparison.children]
                        .sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1))
                        .map(child => {
                          return (
                            <tr key={child.id} className="border-t border-slate-100">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-slate-600">{child.name}</span>
                                  {child.isDirect && (
                                    <span
                                      className="rounded bg-slate-100 px-1.5 py-0.5 text-etikett text-slate-500"
                                      title={`Personer som tillhör enheten direkt, utan ${childLabel.replace(/er$/, '')}. Ingen egen enhet.`}
                                    >
                                      utan {childLabel.replace(/er$/, '')}
                                    </span>
                                  )}
                                  {child.status && <StatusBadge status={child.status} size="sm" />}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center text-xs tabular-nums text-slate-500">
                                {child.responders}/{child.eligible}
                              </td>
                              {child.overall === null ? (
                                <td colSpan={4} className="px-4 py-3 text-right text-xs text-slate-500">
                                  Underlag saknas
                                </td>
                              ) : (
                                <>
                                  <td className="px-4 py-3 text-center text-xs font-semibold text-emerald-700">{child.green}</td>
                                  <td className="px-4 py-3 text-center text-xs font-semibold text-amber-700">{child.yellow}</td>
                                  <td className="px-4 py-3 text-center text-xs font-semibold text-red-700">{child.red}</td>
                                  <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-slate-900">
                                    {formatScore(child.overall)}
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <PrivacyFooter />
            <ExportBar period={period} childLabel={childLabel} />
          </Panel>
        )}
      </div>
    </div>
  );
}

function Stat({ n, status, color }: { n: number; status: Status; color: string }) {
  // Ordet böjs efter talet och får versal här, eftersom det står som etikett.
  const ord = statusOrd(status, n);

  return (
    <div className="flex items-center gap-1.5">
      <span className="size-2 rounded-full" style={{ background: color }} />
      <span className="text-base font-bold tabular-nums text-slate-900">{n}</span>
      <span className="text-xs text-slate-500">{ord.charAt(0).toUpperCase() + ord.slice(1)}</span>
    </div>
  );
}

/**
 * Säger rakt ut att gränser och råd inte är fastställda.
 *
 * Problemanalysen från Skövde konstaterar att det saknas vetenskapligt
 * fastställda gränser för röd, gul och grön. Appens gränser (7 och 4 på en
 * tiogradig skala) och befälsråden sattes i prototypen. På en storskärm framför
 * befäl ser "kräver åtgärd" och "samtal inom 48 timmar" ut som fakta; det ska
 * framgå att de inte är det än. Innehållet ändras inte här — det är
 * Försvarshälsans och fysioterapeuternas att fastställa.
 */
function Preliminary({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-etikett leading-relaxed text-slate-500">{children}</p>;
}

function SL({ children, inline = false }: { children: React.ReactNode; inline?: boolean }) {
  return (
    <h2 className={`text-etikett font-bold uppercase tracking-[0.1em] text-slate-500 ${inline ? '' : 'mb-2'}`}>
      {children}
    </h2>
  );
}

/**
 * Visar att länken man tryckt på håller på att hämtas.
 *
 * Måste ligga INNE i en <Link> — useLinkStatus gäller den länk den står i.
 *
 * Fyller luckan som `loading.tsx` inte når. Den visas när man byter vy, men
 * ett periodbyte är samma vy med en ny parameter, och då slår den aldrig
 * till. Ändå är periodbytet det tyngsta appen gör: hela underenhetsträdet
 * räknas om. Utan det här står sidan helt stilla, och den som tror att
 * klicket missade klickar igen — vilket startar om omräkningen.
 *
 * Texten är för skärmläsaren, pricken för ögat. Pricken slutar blinka för
 * den som bett systemet om mindre rörelse; texten finns kvar.
 */
function Väntan() {
  const { pending } = useLinkStatus();
  if (!pending) return null;

  return (
    <>
      <span
        aria-hidden
        className="ml-1 inline-block size-1.5 rounded-full bg-current motion-safe:animate-pulse"
      />
      <span className="sr-only">Hämtar…</span>
    </>
  );
}

/**
 * Periodväljaren är länkar, inte klientstate: intervallen är vitlistade på
 * servern. Kan ett befäl begära godtyckliga datum går det att räkna fram en
 * enskild dag ur skillnaden mellan två perioder och kringgå k-anonymiteten.
 */
function PeriodPicker({ current, pathname }: { current: Period; pathname: string }) {
  return (
    <div className="no-print flex gap-1">
      {ALLOWED_PERIODS.map(d => (
        <Link
          key={d}
          href={`${pathname}?period=${d}`}
          scroll={false}
          className={`rounded border-[1.5px] px-2.5 py-1 text-etikett font-bold transition-colors ${
            current === d
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
          }`}
        >
          {d}d
          <Väntan />
        </Link>
      ))}
    </div>
  );
}

function PrivacyFooter() {
  return (
    <p className="mt-6 text-center text-xs leading-relaxed text-slate-500">
      Du ser endast sammanställd data. Enskilda värnpliktigas svar visas aldrig för befäl.
    </p>
  );
}

/**
 * Export. CSV:en innehåller samma aggregat som skärmen — undanhållna värden
 * kommer ut som tomma fält, inte som siffror.
 */
function ExportBar({ period, childLabel }: { period: Period; childLabel: string }) {
  return (
    <div className="no-print mt-5 flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-3">
      <span className="mr-1 text-etikett font-bold uppercase tracking-[0.08em] text-slate-500">
        Exportera
      </span>
      <a
        href={`/api/export?period=${period}&typ=dagar`}
        className="flex items-center gap-1.5 rounded border-[1.5px] border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-900 hover:text-slate-900"
      >
        <Download size={13} aria-hidden /> Dag för dag (CSV)
      </a>
      <a
        href={`/api/export?period=${period}&typ=enheter`}
        className="flex items-center gap-1.5 rounded border-[1.5px] border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-900 hover:text-slate-900"
      >
        <Download size={13} aria-hidden /> Per {childLabel} (CSV)
      </a>
      <Link
        href={`/rapport?period=${period}`}
        className="flex items-center gap-1.5 rounded border-[1.5px] border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-900 hover:text-slate-900"
      >
        <FileText size={13} aria-hidden /> Rapport för utskrift
        {/* Ligger ofta under skärmkanten och hinner då aldrig förhämtas, så
            laddningsvyn kan inte visas direkt. Då får länken säga det själv. */}
        <Väntan />
      </Link>
    </div>
  );
}

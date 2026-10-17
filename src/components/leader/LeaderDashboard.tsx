'use client';

import { useState } from 'react';
import Link, { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertTriangle, Download, FileText } from 'lucide-react';

import CategoryTrendGrid from '@/components/charts/CategoryTrendGrid';
import StatusBadge from '@/components/StatusBadge';
import Kategoritabell from '@/components/leader/Kategoritabell';
import RaknaUpp from '@/components/leader/RaknaUpp';
import Veckosammanfattning from '@/components/leader/Veckosammanfattning';
import { VISA_TROSKELRUTA } from '@/lib/varningar';
import type { Veckokort } from '@/lib/veckosammanfattning';
import Tabs, { Panel } from '@/components/Tabs';
import ChildFocus from '@/components/leader/ChildFocus';
import ComparisonGrid from '@/components/leader/ComparisonGrid';
import Suppressed from '@/components/leader/Suppressed';
import {
  CATEGORIES,
  type Category,
  getStatus,
  personfordelning,
} from '@/lib/data';
import type { ChildComparison, Kategorilage, SeriesPoint, UnitOverview } from '@/lib/db/queries/aggregates';
import { ALLOWED_PERIODS, type Guarded, type Period } from '@/lib/privacy';
import { ordformer, type ChildKind } from '@/lib/unit-names';
import { antal, formatScore, procent, uppräkningSamt } from '@/lib/format';

/** Rangordningen under Jämförelse. Gömd den 16 oktober, se där. */
const VISA_RANGORDNING = false;

/**
 * "Senaste veckan" överst i Översikt. Gömd den 17 oktober (paket 1): rutan
 * var alltid sju dagar medan resten av fliken följde periodväljaren. Med
 * 7 dagar upprepade den tabellen ("Hälsa ↓ 0,7" två gånger), med 21 stod två
 * perioder bredvid varandra. Den står kvar i utskriftsrapporten, som är det
 * som tas med till veckomötet.
 */
const VISA_VECKAN = false;

const FLIKAR = [
  { id: 'overview', etikett: 'Översikt' },
  { id: 'trends', etikett: 'Trender' },
  { id: 'compare', etikett: 'Jämförelse' },
] as const;

export interface LeaderDashboardProps {
  /** Enhetens namn, ur sessionen: "1. pluton". Sidans titel. */
  unitName: string;
  levelLabel: string;
  /** Underenheterna i plural, för rubriker: "plutoner". */
  childLabel: string;
  /** Underenheternas sort i singular. Bär genus — ett kompani, en pluton. */
  childKind: ChildKind;
  period: Period;
  overview: UnitOverview;
  series: SeriesPoint[];
  comparison: ChildComparison;
  /** Förra periodens snitt och personer i rött, per kategori. */
  lage: Guarded<Record<Category, Kategorilage>>;
  advice: string | null;
  /** Veckan i korthet (lib/veckosammanfattning.ts). */
  vecka: Veckokort;
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
  unitName, levelLabel, childLabel, childKind, period, overview, series, comparison, lage, advice, vecka,
}: LeaderDashboardProps) {
  const pathname = usePathname();
  const [tab, setTab] = useState<'overview' | 'trends' | 'compare'>('overview');
  // Lokala konstanter så att TypeScript kan smalna av unionen korrekt —
  // narrowing på en egenskap (overview.distribution.ok) håller inte genom JSX.
  const cats = overview.categories;

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
        {/*
          Perioden väljs här, ovanför allt den styr. Den stod förut inne i
          varje flik och räknade om talen ovanför sig — se testet i
          tests/tillganglighet.test.mjs.
        */}
        {/*
          Sidans titel: enhetens namn, och nivån med antalet under (paket 1,
          17 oktober). Förut stod enheten bara litet i sidhuvudet och nivån
          som en versal etikett. I telefonen hamnar perioden på egen rad.
        */}
        <div
          className={`mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-x-3 gap-y-3 ${tab === 'overview' ? 'mb-3' : ''}`}
        >
          <div className="basis-full sm:basis-auto">
            <h1 className="text-xl font-bold leading-tight text-slate-900">{unitName}</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {levelLabel} · {antal(overview.eligible, 'värnpliktig', 'värnpliktiga')}
              {/* Väljaren skrivs inte ut, så på papper står perioden i text. */}
              <span className="hidden print:inline"> · {period} dagar</span>
            </p>
          </div>
          <div className="no-print flex items-center gap-2">
            <span aria-hidden className="text-etikett font-bold uppercase tracking-[0.08em] text-slate-500">
              Period
            </span>
            <PeriodPicker current={period} pathname={pathname} />
          </div>
        </div>
        {/*
          Fyra nyckeltal. Ersätter en rad med snittet, en liten stapel över
          personerna och rubriken "27 VÄRNPLIKTIGA · EGET SNITT", som ingen
          förstod (16 oktober). Siffror rakt på sak; färg bara där talet är
          rött.

          Bara på Översikt (paket 1, 17 oktober): i telefonen tog de halva
          skärmen på varje flik. De GÖMS på de andra flikarna, tas inte bort —
          monteras de om räknas talen upp från noll varje gång man går
          tillbaka, och uppräkningen ska bara ske vid inloggning (RaknaUpp).
        */}
        <dl
          className={`mx-auto grid max-w-5xl grid-cols-2 overflow-hidden rounded-md border border-slate-200 lg:grid-cols-4 ${
            tab === 'overview' ? '' : 'hidden'
          }`}
        >
          <Nyckeltal
            etikett="Samlat mående"
            varde={
              overall !== null ? (
                <span className="flex items-center gap-2">
                  <RaknaUpp varde={overall} decimaler={1} visa={formatScore} /> <StatusBadge status={getStatus(overall)} />
                </span>
              ) : (
                '–'
              )
            }
            under={overall !== null ? `snitt ${period} dagar` : cats.ok ? '' : 'underlag saknas'}
          />
          <Nyckeltal
            etikett="Svarat idag"
            varde={<RaknaUpp varde={overview.today.pct} visa={procent} />}
            under={`${overview.today.responders} av ${overview.eligible}`}
          />
          {(() => {
            /*
              Undanhållen fördelning ger inget antal, inte heller hur många som
              saknar svar — se personfordelning().
            */
            if (!overview.soldierStatus.ok) {
              return <Nyckeltal etikett="Personer i rött" varde="–" under="underlag saknas" />;
            }
            const f = personfordelning(overview.soldierStatus.data, overview.eligible);
            return (
              <Nyckeltal
                etikett="Personer i rött"
                varde={<span className={f.red > 0 ? 'text-red-700' : ''}><RaknaUpp varde={f.red} visa={String} /></span>}
                // "På samlat snitt": tabellen nedan räknar per kategori, och
                // utan det ser 3 här och 20 under sömn ut att säga emot varandra.
                // Antalet utan svar står kvar: utan det ser en enhet där hälften
                // tystnat lika frisk ut som en där alla svarat.
                under={`av ${f.total}, på samlat snitt${f.utanSvar > 0 ? ` · ${f.utanSvar} utan svar` : ''}`}
              />
            );
          })()}
          <Nyckeltal
            etikett="Kategorier i rött"
            varde={
              cats.ok ? (
                <span className={`flex items-center gap-1.5 ${alerts.length > 0 ? 'text-red-700' : ''}`}>
                  {alerts.length > 0 && <AlertTriangle size={18} aria-hidden />}
                  <RaknaUpp varde={alerts.length} visa={String} />
                </span>
              ) : (
                '–'
              )
            }
            under={
              !cats.ok
                ? 'underlag saknas'
                : alerts.length === 0
                  ? `av ${CATEGORIES.length}`
                  : uppräkningSamt(alerts.map((c) => c.label.toLowerCase()))
            }
          />
        </dl>
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
              aktiv ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900'
            }`
          }
        />
      </div>

      <div className="mx-auto w-full max-w-5xl flex-1 px-4 pb-12 pt-5 sm:px-6">
        {/* ── ÖVERSIKT ── */}
        {tab === 'overview' && (
          <Panel id="overview">
            {/* Det plutonchefen tar med till kompaniets veckomöte. Alltid sju
                dagar, oavsett vald period. Gömd på skärmen, se VISA_VECKAN. */}
            {VISA_VECKAN && <Veckosammanfattning kort={vecka} />}

            {/* Perioden står kvar i rubriken, så att en skärmdump säger vad den visar. */}
            <SL>Kategorier — de senaste {period} dagarna, sämst först</SL>
            {cats.ok ? (
              <div className="mb-4">
                <Kategoritabell
                  snitt={cats.data}
                  lage={lage.ok ? lage.data : null}
                  svarande={cats.responders}
                  period={period}
                />
              </div>
            ) : (
              <div className="mb-4">
                <Suppressed text={cats.message} />
              </div>
            )}

            {/* Här stod "Gränserna för grönt, gult och rött är preliminära", och
                under befälsrådet "Råden är preliminära". Borttagna 17 oktober
                (Richard). Utskriftsrapporten säger det fortfarande, eftersom
                ett papper vandrar vidare utan sammanhang. */}

            {VISA_TROSKELRUTA && alerts.length > 0 && cats.ok && (
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
              </>
            )}

            <PrivacyFooter />
            <ExportBar period={period} childKind={childKind} />
          </Panel>
        )}

        {/* ── TRENDER ── */}
        {tab === 'trends' && (
          <Panel id="trends">
            <SL>Utvecklingen dag för dag — de senaste {period} dagarna</SL>

            <div className="mb-6">
              <CategoryTrendGrid
                rows={series.map(p => ({ key: p.date, label: p.label, scores: p.scores, overall: p.overall }))}
                ariaPrefix="Trend för enheten"
                samlat
                summary={cats.ok ? cats.data : null}
                summaryLabel={`snitt ${period} d`}
              />
            </div>

            <SL>Hur många som svarade, dag för dag</SL>
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
              aria-label="Hur många som svarade, dag för dag"
              className="mb-4 overflow-x-auto rounded-md border border-slate-200 bg-white"
            >
              <table className="w-full min-w-[420px] text-left">
                <thead className="bg-slate-50">
                  <tr className="text-etikett font-bold uppercase tracking-[0.08em] text-slate-500">
                    <th className="px-4 py-2.5 font-bold">Dag</th>
                    <th className="px-4 py-2.5 text-center font-bold">Svarade</th>
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
            <ExportBar period={period} childKind={childKind} />
          </Panel>
        )}

        {/* ── JÄMFÖRELSE ── */}
        {tab === 'compare' && (
          <Panel id="compare">
            <SL>{childLabel.charAt(0).toUpperCase() + childLabel.slice(1)} jämförda — de senaste {period} dagarna</SL>

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

                {/*
                  Rangordningen är gömd (16 oktober): den visade samma snitt
                  som tabellen ovanför, sorterade från bäst till sämst, och
                  bjöd in till tävling eller skuld. Dess enda egna uppgift,
                  hur många i varje enhet som ligger i rött, står nu som en
                  kolumn i tabellen. VISA_RANGORDNING = true tar fram den igen.
                */}
                {VISA_RANGORDNING && (
                  <>
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
                        <th className="px-4 py-2.5 text-center font-bold">Svarade</th>
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
              </>
            )}
            <PrivacyFooter />
            <ExportBar period={period} childKind={childKind} />
          </Panel>
        )}
      </div>
    </div>
  );
}


/** Ett nyckeltal i rubrikraden. Ramas in av rutnätet, som veckans fält. */
function Nyckeltal({ etikett, varde, under }: { etikett: string; varde: React.ReactNode; under: string }) {
  return (
    <div className="flex flex-col gap-1 border-slate-100 px-4 py-3 sm:px-5 [&:nth-child(odd)]:border-r [&:nth-child(-n+2)]:border-b lg:[&:nth-child(-n+2)]:border-b-0 lg:[&:not(:last-child)]:border-r">
      <dt className="text-etikett font-bold uppercase tracking-[0.08em] text-slate-500">{etikett}</dt>
      <dd className="text-2xl font-extrabold leading-tight tabular-nums text-slate-900">{varde}</dd>
      <dd className="min-h-4 text-xs text-slate-500">{under}</dd>
    </div>
  );
}

/**
 * Rubrik för ett avsnitt i en flik.
 *
 * Mörk, halvfet, vanlig skrift — rubrikstil A, Richards val 17 oktober. Den
 * var en grå versal etikett, precis som kolumnrubrikerna och nyckeltalens
 * namn, och försvann bland dem: elva sådana på Översikt, och ögat hittade
 * ingen startpunkt. Versalerna är nu kvar för etiketter, inte för rubriker.
 */
function SL({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2.5 text-sm font-semibold text-balance text-slate-900">{children}</h2>;
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
    // Den enda väljaren för hela sidan: namngiven, och den valda märkt, så att
    // den som lyssnar hör vilken period talen gäller.
    <div role="group" aria-label="Period" className="flex gap-1">
      {ALLOWED_PERIODS.map(d => (
        <Link
          key={d}
          href={`${pathname}?period=${d}`}
          scroll={false}
          aria-current={current === d ? 'true' : undefined}
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
function ExportBar({ period, childKind }: { period: Period; childKind: ChildKind }) {
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
        {/* Singular efter "per": per grupp, inte per grupper. */}
        <Download size={13} aria-hidden /> Per {childKind} (CSV)
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

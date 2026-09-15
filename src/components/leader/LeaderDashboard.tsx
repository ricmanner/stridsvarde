'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, AlertTriangle, Brain, Download, FileText, Moon, Users, Utensils, Zap } from 'lucide-react';
import {
  Legend, Line, LineChart, PolarAngleAxis, PolarGrid, Radar, RadarChart,
  ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

import StatusBadge from '@/components/StatusBadge';
import Suppressed from '@/components/leader/Suppressed';
import { CATEGORIES, getStatus } from '@/lib/data';
import type { ChildComparison, SeriesPoint, UnitOverview } from '@/lib/db/queries/aggregates';
import { ALLOWED_PERIODS, type Period } from '@/lib/privacy';

const ICONS: Record<string, React.ReactNode> = {
  Activity: <Activity size={15} strokeWidth={1.5} />,
  Brain: <Brain size={15} strokeWidth={1.5} />,
  Users: <Users size={15} strokeWidth={1.5} />,
  Moon: <Moon size={15} strokeWidth={1.5} />,
  Utensils: <Utensils size={15} strokeWidth={1.5} />,
  Zap: <Zap size={15} strokeWidth={1.5} />,
};

const CAT_COLORS: Record<string, string> = {
  fysisk: '#2563EB', psykisk: '#7C3AED', social: '#DB2777',
  somn: '#0891B2', kost: '#059669', energi: '#D97706',
};

const CHILD_COLORS = ['#2563EB', '#059669', '#D97706', '#7C3AED', '#DC2626', '#0891B2'];

export interface LeaderDashboardProps {
  levelLabel: string;
  childLabel: string;
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
  levelLabel, childLabel, period, overview, series, comparison, advice,
}: LeaderDashboardProps) {
  const pathname = usePathname();
  const [tab, setTab] = useState<'overview' | 'trends' | 'compare'>('overview');
  const [activeCats, setActiveCats] = useState<Set<string>>(new Set(CATEGORIES.map(c => c.key)));
  const [activeRadarCats, setActiveRadarCats] = useState<Set<string>>(new Set(CATEGORIES.map(c => c.key)));

  function toggle(setter: typeof setActiveCats, min: number) {
    return (key: string) =>
      setter(prev => {
        const next = new Set(prev);
        if (next.size <= min && next.has(key)) return prev;
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
  }
  const toggleCat = toggle(setActiveCats, 1);
  const toggleRadarCat = toggle(setActiveRadarCats, 2);

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

  // Kurvan ritas ur riktiga data — dagar utan tillräckligt underlag blir
  // luckor, inte nollor.
  const chartData = series.map(p => ({
    label: p.label,
    ...(p.scores ?? {}),
  }));

  const visibleChildren = comparison.children.filter(c => c.scores !== null);

  const radarData = CATEGORIES
    .filter(c => activeRadarCats.has(c.key))
    .map(cat => {
      const entry: Record<string, string | number> = { subject: cat.label.split(' ')[0] };
      for (const child of visibleChildren) entry[child.name] = child.scores![cat.key];
      return entry;
    });

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      {/* ── Sammanfattningsrad ── */}
      <div className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
              {levelLabel} · {period} dagar
            </p>
            <div className="flex items-baseline gap-2">
              {overall !== null ? (
                <>
                  <span className="text-2xl font-extrabold tabular-nums text-slate-900">
                    {overall.toFixed(1)}
                  </span>
                  <StatusBadge status={getStatus(overall)} />
                </>
              ) : (
                <span className="text-sm text-slate-400">Underlag saknas</span>
              )}
            </div>
          </div>

          <div className="hidden h-9 w-px bg-slate-200 sm:block" />

          {overview.soldierStatus.ok ? (
            <>
              <Stat n={overview.soldierStatus.data.green} label="Gröna" color="#059669" />
              <Stat n={overview.soldierStatus.data.yellow} label="Gula" color="#D97706" />
              <Stat n={overview.soldierStatus.data.red} label="Röda" color="#DC2626" />
            </>
          ) : null}

          <span className="text-xs text-slate-400">{overview.eligible} soldater</span>
          <span className="text-xs text-slate-400">
            {overview.today.pct}% svarat idag ({overview.today.responders}/{overview.eligible})
          </span>

          {alerts.length > 0 && (
            <div className="flex items-center gap-1.5 rounded border border-red-200 bg-red-50 px-2.5 py-1 sm:ml-auto">
              <AlertTriangle size={13} className="text-red-600" aria-hidden />
              <span className="text-[11px] font-bold text-red-600">
                {alerts.length} kategori{alerts.length > 1 ? 'er' : ''} i rött
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Flikar ── */}
      <div className="no-print flex border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl">
          {(['overview', 'trends', 'compare'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 cursor-pointer border-b-2 px-2 py-3.5 text-[11px] font-bold uppercase tracking-[0.08em] transition-colors ${
                tab === t ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400'
              }`}
            >
              {t === 'overview' ? 'Översikt' : t === 'trends' ? 'Trender' : 'Jämförelse'}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl flex-1 px-4 pb-12 pt-5 sm:px-6">
        {/* ── ÖVERSIKT ── */}
        {tab === 'overview' && (
          <>
            <SL>Kategorier — snitt och fördelning över {period} dagar</SL>
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
                        <span className="flex-1 text-[13px] text-slate-600">{cat.label}</span>
                        <span className="mr-1.5 text-[15px] font-bold tabular-nums text-slate-900">
                          {score.toFixed(1)}
                        </span>
                        <StatusBadge status={getStatus(score)} size="sm" />
                      </div>
                      <div className="mb-1.5 flex h-1.5 overflow-hidden rounded-full">
                        <div style={{ width: `${(d.green / total) * 100}%`, background: '#059669' }} />
                        <div style={{ width: `${(d.yellow / total) * 100}%`, background: '#D97706' }} />
                        <div style={{ width: `${(d.red / total) * 100}%`, background: '#DC2626' }} />
                      </div>
                      <div className="flex gap-3 text-[11px]">
                        <span className="font-semibold text-emerald-600">{d.green} <span className="font-normal text-slate-400">gröna</span></span>
                        <span className="font-semibold text-amber-600">{d.yellow} <span className="font-normal text-slate-400">gula</span></span>
                        <span className="font-semibold text-red-600">{d.red} <span className="font-normal text-slate-400">röda</span></span>
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
                <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3.5 sm:px-5">
                  {alerts.map((cat, i) => (
                    <div key={cat.key} className={`flex items-center gap-2.5 ${i > 0 ? 'mt-2' : ''}`}>
                      <AlertTriangle size={14} className="shrink-0 text-red-600" aria-hidden />
                      <span className="text-[13px] text-red-900">
                        <strong>{cat.label}</strong> understiger kritisk nivå — snitt{' '}
                        {cats.data[cat.key].toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {advice && (
              <>
                <SL>Befälsråd</SL>
                <div className="rounded-md border border-slate-200 bg-white p-5">
                  <div className="mb-2.5 flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-amber-500" />
                    <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                      Baserat på enhetens egna värden
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-700">{advice}</p>
                </div>
              </>
            )}

            <PrivacyFooter />
            <ExportBar period={period} childLabel={childLabel} />
          </>
        )}

        {/* ── TRENDER ── */}
        {tab === 'trends' && (
          <>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <SL inline>Kategoritrender — {period} dagar</SL>
              <PeriodPicker current={period} pathname={pathname} />
            </div>

            <div className="mb-4 rounded-md border border-slate-200 bg-white px-3 pb-3 pt-4">
              <div className="mb-3 flex flex-wrap gap-1.5 pl-2">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.key}
                    onClick={() => toggleCat(cat.key)}
                    aria-pressed={activeCats.has(cat.key)}
                    className="cursor-pointer rounded border-[1.5px] px-2.5 py-1 text-[11px] font-semibold transition-colors"
                    style={{
                      borderColor: activeCats.has(cat.key) ? CAT_COLORS[cat.key] : '#E2E8F0',
                      background: activeCats.has(cat.key) ? CAT_COLORS[cat.key] + '20' : 'white',
                      color: activeCats.has(cat.key) ? CAT_COLORS[cat.key] : '#94A3B8',
                    }}
                  >
                    {cat.label.split(' ')[0]}
                  </button>
                ))}
              </div>

              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                  <ReferenceArea y1={7} y2={10} fill="#059669" fillOpacity={0.05} />
                  <ReferenceArea y1={4} y2={7} fill="#D97706" fillOpacity={0.05} />
                  <ReferenceArea y1={1} y2={4} fill="#DC2626" fillOpacity={0.05} />
                  <XAxis dataKey="label" tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} interval={period === 7 ? 0 : period === 14 ? 1 : 2} />
                  <YAxis domain={[1, 10]} ticks={[1, 4, 7, 10]} tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <ReferenceLine y={7} stroke="#059669" strokeDasharray="3 3" strokeOpacity={0.35} />
                  <ReferenceLine y={4} stroke="#DC2626" strokeDasharray="3 3" strokeOpacity={0.35} />
                  <Tooltip
                    contentStyle={{ background: '#0F172A', border: 'none', borderRadius: 6, color: 'white', fontSize: 11, padding: '8px 12px' }}
                    formatter={(v, name) => [typeof v === 'number' ? v.toFixed(1) : v, CATEGORIES.find(c => c.key === name)?.label ?? name]}
                  />
                  {CATEGORIES.filter(c => activeCats.has(c.key)).map(cat => (
                    <Line key={cat.key} dataKey={cat.key} stroke={CAT_COLORS[cat.key]} strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} connectNulls={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <SL>Svarsunderlag per dag</SL>
            <div className="mb-4 overflow-x-auto rounded-md border border-slate-200 bg-white">
              <table className="w-full min-w-[420px] text-left">
                <thead className="bg-slate-50">
                  <tr className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                    <th className="px-4 py-2.5 font-bold">Dag</th>
                    <th className="px-4 py-2.5 text-center font-bold">Svar</th>
                    <th className="px-4 py-2.5 text-center font-bold">Andel</th>
                    <th className="px-4 py-2.5 text-right font-bold">Snitt</th>
                  </tr>
                </thead>
                <tbody>
                  {[...series].reverse().map(p => (
                    <tr key={p.date} className="border-t border-slate-100">
                      <td className="px-4 py-2.5 text-[13px] text-slate-600">{p.label}</td>
                      <td className="px-4 py-2.5 text-center text-[13px] tabular-nums text-slate-500">
                        {p.responders}/{p.eligible}
                      </td>
                      <td className="px-4 py-2.5 text-center text-[13px] tabular-nums text-slate-500">
                        {p.eligible ? Math.round((p.responders / p.eligible) * 100) : 0}%
                      </td>
                      <td className="px-4 py-2.5 text-right text-[13px] font-bold tabular-nums text-slate-900">
                        {p.overall !== null ? p.overall.toFixed(1) : (
                          <span className="font-normal text-slate-300" title="För få svar för att visa">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PrivacyFooter />
            <ExportBar period={period} childLabel={childLabel} />
          </>
        )}

        {/* ── JÄMFÖRELSE ── */}
        {tab === 'compare' && (
          <>
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
                <div className="mb-4 rounded-md border border-slate-200 bg-white px-3 pb-3 pt-5">
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={comparison.series} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                      <ReferenceArea y1={7} y2={10} fill="#059669" fillOpacity={0.05} />
                      <ReferenceArea y1={4} y2={7} fill="#D97706" fillOpacity={0.05} />
                      <ReferenceArea y1={1} y2={4} fill="#DC2626" fillOpacity={0.05} />
                      <XAxis dataKey="label" tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} interval={period === 7 ? 0 : period === 14 ? 1 : 2} />
                      <YAxis domain={[1, 10]} ticks={[1, 4, 7, 10]} tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <ReferenceLine y={7} stroke="#059669" strokeDasharray="3 3" strokeOpacity={0.35} />
                      <ReferenceLine y={4} stroke="#DC2626" strokeDasharray="3 3" strokeOpacity={0.35} />
                      <Tooltip contentStyle={{ background: '#0F172A', border: 'none', borderRadius: 6, color: 'white', fontSize: 11, padding: '8px 12px' }} />
                      {comparison.children.map((child, i) => (
                        <Line key={child.id} dataKey={child.name} stroke={CHILD_COLORS[i % CHILD_COLORS.length]} strokeWidth={2} dot={false} activeDot={{ r: 3 }} connectNulls={false} />
                      ))}
                      <Legend wrapperStyle={{ fontSize: 11, color: '#64748B' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <SL>Profilanalys</SL>
                <div className="mb-4 rounded-md border border-slate-200 bg-white px-3 pb-3 pt-4">
                  <div className="mb-3 flex flex-wrap gap-1.5 pl-2">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat.key}
                        onClick={() => toggleRadarCat(cat.key)}
                        aria-pressed={activeRadarCats.has(cat.key)}
                        className="cursor-pointer rounded border-[1.5px] px-2.5 py-1 text-[11px] font-semibold transition-colors"
                        style={{
                          borderColor: activeRadarCats.has(cat.key) ? CAT_COLORS[cat.key] : '#E2E8F0',
                          background: activeRadarCats.has(cat.key) ? CAT_COLORS[cat.key] + '20' : 'white',
                          color: activeRadarCats.has(cat.key) ? CAT_COLORS[cat.key] : '#94A3B8',
                        }}
                      >
                        {cat.label.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                  <ResponsiveContainer width="100%" height={260}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="#E2E8F0" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748B', fontSize: 10 }} />
                      {visibleChildren.map((child, i) => (
                        <Radar key={child.id} name={child.name} dataKey={child.name}
                          stroke={CHILD_COLORS[i % CHILD_COLORS.length]}
                          fill={CHILD_COLORS[i % CHILD_COLORS.length]}
                          fillOpacity={0.1} strokeWidth={1.5} />
                      ))}
                      <Tooltip contentStyle={{ background: '#0F172A', border: 'none', borderRadius: 6, color: 'white', fontSize: 11 }} />
                      <Legend wrapperStyle={{ fontSize: 11, color: '#64748B' }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                <SL>Rangordning</SL>
                <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
                  <table className="w-full min-w-[480px] text-left">
                    <thead className="bg-slate-50">
                      <tr className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
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
                          const idx = comparison.children.findIndex(c => c.id === child.id);
                          return (
                            <tr key={child.id} className="border-t border-slate-100">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className="h-5 w-[3px] shrink-0 rounded" style={{ background: CHILD_COLORS[idx % CHILD_COLORS.length] }} />
                                  <span className="text-[14px] text-slate-600">{child.name}</span>
                                  {child.isDirect && (
                                    <span
                                      className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500"
                                      title={`Personer som tillhör enheten direkt, utan ${childLabel.replace(/er$/, '')}. Ingen egen enhet.`}
                                    >
                                      utan {childLabel.replace(/er$/, '')}
                                    </span>
                                  )}
                                  {child.status && <StatusBadge status={child.status} size="sm" />}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center text-[13px] tabular-nums text-slate-500">
                                {child.responders}/{child.eligible}
                              </td>
                              {child.overall === null ? (
                                <td colSpan={4} className="px-4 py-3 text-right text-xs text-slate-400">
                                  Underlag saknas
                                </td>
                              ) : (
                                <>
                                  <td className="px-4 py-3 text-center text-[13px] font-semibold text-emerald-600">{child.green}</td>
                                  <td className="px-4 py-3 text-center text-[13px] font-semibold text-amber-600">{child.yellow}</td>
                                  <td className="px-4 py-3 text-center text-[13px] font-semibold text-red-600">{child.red}</td>
                                  <td className="px-4 py-3 text-right text-[14px] font-bold tabular-nums text-slate-900">
                                    {child.overall.toFixed(1)}
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
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="size-2 rounded-full" style={{ background: color }} />
      <span className="text-base font-bold tabular-nums text-slate-900">{n}</span>
      <span className="text-xs text-slate-400">{label}</span>
    </div>
  );
}

function SL({ children, inline = false }: { children: React.ReactNode; inline?: boolean }) {
  return (
    <p className={`text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500 ${inline ? '' : 'mb-2'}`}>
      {children}
    </p>
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
          className={`rounded border-[1.5px] px-2.5 py-1 text-[11px] font-bold transition-colors ${
            current === d
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'
          }`}
        >
          {d}d
        </Link>
      ))}
    </div>
  );
}

function PrivacyFooter() {
  return (
    <p className="mt-6 text-center text-xs leading-relaxed text-slate-400">
      Du ser endast sammanställd data. Enskilda soldaters svar visas aldrig för befäl.
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
      <span className="mr-1 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
        Exportera
      </span>
      <a
        href={`/api/export?period=${period}&typ=dagar`}
        className="flex items-center gap-1.5 rounded border-[1.5px] border-slate-200 px-2.5 py-1.5 text-[12px] font-semibold text-slate-600 transition-colors hover:border-slate-900 hover:text-slate-900"
      >
        <Download size={13} aria-hidden /> Dag för dag (CSV)
      </a>
      <a
        href={`/api/export?period=${period}&typ=enheter`}
        className="flex items-center gap-1.5 rounded border-[1.5px] border-slate-200 px-2.5 py-1.5 text-[12px] font-semibold text-slate-600 transition-colors hover:border-slate-900 hover:text-slate-900"
      >
        <Download size={13} aria-hidden /> Per {childLabel} (CSV)
      </a>
      <Link
        href={`/rapport?period=${period}`}
        className="flex items-center gap-1.5 rounded border-[1.5px] border-slate-200 px-2.5 py-1.5 text-[12px] font-semibold text-slate-600 transition-colors hover:border-slate-900 hover:text-slate-900"
      >
        <FileText size={13} aria-hidden /> Rapport för utskrift
      </Link>
    </div>
  );
}

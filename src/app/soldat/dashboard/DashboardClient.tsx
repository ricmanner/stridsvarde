'use client';

import { useState } from 'react';
import Link from 'next/link';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import CategoryIcon from '@/components/CategoryIcon';
import CategoryTrendGrid from '@/components/charts/CategoryTrendGrid';
import ScoreTrendChart from '@/components/charts/ScoreTrendChart';
import StatusBandLegend from '@/components/charts/StatusBandLegend';
import StatusBadge from '@/components/StatusBadge';
import Tabs, { Panel } from '@/components/Tabs';
import { CATEGORIES, type Category, getStatus, statusColor, avgScore } from '@/lib/data';
import { ownTrend } from '@/lib/own-trend';
import { getSoldierTips } from '@/lib/advice';
import SupportBlock from './SupportBlock';
import { shortLabel } from '@/lib/date';
import { formatScore } from '@/lib/format';

export interface DashboardProps {
  scores: Record<Category, number>;
  advice: string;
  /** En rad per dag de senaste fjorton dagarna, äldst först. Tom dag = null. */
  chartData: Array<{ date: string; day: string; score: number | null; scores: Record<Category, number> | null }>;
  freq: { checkedIn: number; total: number; pct: number };
}

const FLIKAR = [
  { id: 'overview', etikett: 'Översikt' },
  { id: 'history', etikett: 'Historia' },
] as const;

/** Den lilla versala etiketten över ett tal, som i incheckningen. */
const NYCKELTALSETIKETT = 'mb-0.5 text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500';

/** Behörigheten kontrolleras på servern i page.tsx innan detta renderas. */
export default function SoldatDashboard({ scores, advice, chartData, freq }: DashboardProps) {
  const [tab, setTab] = useState<'overview' | 'history'>('overview');

  const overall = avgScore(scores);
  const overallStatus = getStatus(overall);
  const tips = getSoldierTips(scores);

  const svar = chartData.filter((d): d is typeof d & { score: number; scores: Record<Category, number> } => d.scores !== null);
  const trend = ownTrend(svar.map(d => d.scores));

  // Sort categories worst first
  const sortedCats = [...CATEGORIES].sort((a, b) => scores[a.key] - scores[b.key]);

  // Minst ett rött värde → visa stödvägar högst upp, före allt annat. Vilka
  // värden som är röda styr vilka kontakter som står först.
  const redCategories = CATEGORIES.filter(cat => getStatus(scores[cat.key]) === 'red').map(cat => cat.key);

  return (
    <div className="flex flex-1 flex-col bg-slate-50">

      {/* Flikar — beteendet ligger i Tabs, utseendet här. */}
      <Tabs
        flikar={FLIKAR}
        vald={tab}
        onValj={setTab}
        etikett="Dina vyer"
        className="flex border-b border-slate-200 bg-white"
        knappklass={(aktiv) =>
          `flex-1 cursor-pointer border-b-2 bg-transparent py-3.5 text-[12px] font-bold uppercase tracking-[0.08em] transition-colors ${
            aktiv ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500'
          }`
        }
      />

      <div className="flex-1 overflow-y-auto px-5 pb-10 pt-5">

        {tab === 'overview' && (
          <Panel id="overview">
            {redCategories.length > 0 && <SupportBlock red={redCategories} />}

            {/* Dagens två nyckeltal */}
            <div className="mb-4 grid grid-cols-2 gap-2.5">
              <MetricCard
                label="Hälsostatus idag"
                value={formatScore(overall)}
                sub={<StatusBadge status={overallStatus} />}
                trend={trend}
              />
              <MetricCard
                label="Svarsfrekvens (14 dagar)"
                value={`${freq.pct}%`}
                sub={<span className="text-xs text-slate-500">{freq.checkedIn} av {freq.total} dagar</span>}
              />
            </div>

            {/* Dagens sex kategorier, sämst först */}
            <SectionHeader label="Kategorier — dagens rapport" />
            <div className="mb-4 overflow-hidden rounded-md border border-slate-200 bg-white">
              {sortedCats.map((cat, i) => {
                const s = scores[cat.key];
                const st = getStatus(s);
                const col = statusColor(st);
                /*
                 * Andel av skalan, inte plats mellan lägsta och högsta värdet.
                 * Räknat som (värdet − 1) / 9 blev en etta en HELT tom stapel,
                 * omöjlig att skilja från en rad utan svar — och det är det
                 * värsta värdet, det som minst av allt ska se ut som ingenting.
                 */
                const pct = (s / 10) * 100;
                return (
                  <div
                    key={cat.key}
                    className={`px-5 py-3.5 ${i < CATEGORIES.length - 1 ? 'border-b border-slate-100' : ''}`}
                  >
                    <div className="mb-2 flex items-center gap-2.5">
                      <span className="text-slate-500">
                        <CategoryIcon namn={cat.icon} size={16} />
                      </span>
                      <span className="flex-1 text-[13px] text-slate-600">{cat.label}</span>
                      <span className="mr-2 text-base font-bold tabular-nums text-slate-900">{s}</span>
                      <StatusBadge status={st} size="sm" />
                    </div>
                    <div className="h-[3px] rounded-xs bg-slate-100">
                      {/* Bredden och färgen kommer ur värdet, därför inline. */}
                      <div className="h-full rounded-xs" style={{ width: `${pct}%`, background: col }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Vägledningen för helheten */}
            <SectionHeader label="Personlig vägledning" />
            <div className={`rounded-md border border-slate-200 bg-white p-5 ${tips.length > 0 ? 'mb-2.5' : 'mb-4'}`}>
              <div className="mb-2.5 flex items-center gap-2">
                <div className="size-1.5 rounded-full bg-blue-600" />
                <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">Baserat på dagens rapport</span>
              </div>
              <p className="text-sm leading-[1.7] text-slate-700">{advice}</p>
            </div>

            {/* Ett kort per svagaste kategori, sämst först */}
            {tips.map((tip, ti) => (
              <div
                key={tip.category}
                /*
                 * Kantens färg säger hur allvarligt det är: det första kortet
                 * är det sämsta värdet. Den räknas fram, alltså inline —
                 * bredden och de tre andra sidorna gör den inte.
                 */
                className={`rounded-md border-y border-r border-l-[3px] border-slate-200 bg-white px-5 py-3.5 ${
                  ti < tips.length - 1 ? 'mb-2' : 'mb-4'
                }`}
                style={{ borderLeftColor: ti === 0 ? '#DC2626' : '#D97706' }}
              >
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-slate-600">{tip.title}</p>
                {/* Vad värdet betyder. Punkterna under säger vad man gör. */}
                <p className="mb-2.5 text-[13px] leading-[1.6] text-slate-700">{tip.why}</p>
                <ul className="pl-4">
                  {tip.tips.map((t, i) => (
                    <li
                      key={i}
                      className={`text-[13px] leading-[1.6] text-slate-700 ${i < tip.tips.length - 1 ? 'mb-1' : ''}`}
                    >
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <Link
              href="/soldat?redigera=1"
              className="mb-4 block rounded-md border border-slate-200 bg-white px-4 py-3 text-center text-[13px] text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700"
            >
              Blev något fel? Korrigera dagens rapport
            </Link>

            {/* Kurvan över fjorton dagar */}
            {svar.length >= 3 && (
              <>
                <SectionHeader label="Trend — 14 dagar" />
                <div className="mb-4 rounded-md border border-slate-200 bg-white px-4 pb-4 pt-5">
                  <div className="mb-4 flex gap-5">
                    <div>
                      <p className={NYCKELTALSETIKETT}>Senaste värde</p>
                      <span className="text-xl font-bold text-slate-900">{svar.length > 0 ? formatScore(svar[svar.length - 1].score) : ''}</span>
                    </div>
                    <div>
                      <p className={NYCKELTALSETIKETT}>Riktning</p>
                      <div className="flex items-center gap-1">
                        <TrendIkon trend={trend} size={18} />
                        {/*
                          Den mörkare tonen, inte pilens: texten behöver 4,5:1
                          och ytfärgen klarar bara 3:1. Den räknas fram ur
                          riktningen och stannar därför inline.
                        */}
                        <span
                          className="text-[13px] font-semibold"
                          style={{ color: trend === 'up' ? '#047857' : trend === 'down' ? '#B91C1C' : '#B45309' }}
                        >
                          {trend === 'up' ? 'Stigande' : trend === 'down' ? 'Sjunkande' : 'Stabil'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <ScoreTrendChart
                    data={chartData.map(d => ({ key: d.date, label: d.day, value: d.score }))}
                    height={150}
                    ariaLabel="Ditt mående de senaste fjorton dagarna"
                  />
                  <div className="mt-1.5">
                    <StatusBandLegend />
                  </div>
                </div>
              </>
            )}

          </Panel>
        )}

        {tab === 'history' && (
          <Panel id="history">
            <SectionHeader label={`Din närvaro — senaste 14 dagarna`} />
            <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 6, padding: 20, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ color: '#64748B', fontSize: 13 }}>Registrerade incheckningar</span>
                <span style={{ color: '#0F172A', fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                  {freq.checkedIn}<span style={{ color: '#64748B', fontSize: 13, fontWeight: 400 }}> / {freq.total}</span>
                </span>
              </div>
              <div style={{ height: 6, background: '#F1F5F9', borderRadius: 3, marginTop: 10 }}>
                <div style={{ height: '100%', width: `${freq.pct}%`, background: freq.pct >= 70 ? '#059669' : freq.pct >= 40 ? '#D97706' : '#DC2626', borderRadius: 3, transition: 'width 0.3s' }} />
              </div>
              <p style={{ color: '#64748B', fontSize: 12, marginTop: 8, marginBottom: 0 }}>
                {freq.pct >= 70 ? 'Bra närvaro — fortsätt så.' : freq.pct >= 40 ? 'Försök checka in dagligen.' : 'Lägre närvaro — befälet ser inga data.'}
              </p>
            </div>

            {/*
              Här låg tidigare exakt samma kurva som på översikten. Nu visas
              varje kategori för sig — det är den bilden som saknades: att det
              är sömnen som dragit ner, inte allt.
            */}
            <SectionHeader label="Per kategori — 14 dagar" />
            {svar.length >= 2 ? (
              <div style={{ marginBottom: 16 }}>
                <CategoryTrendGrid
                  /* Datum, inte veckodagar: i de små graferna hamnar etiketterna
                     en vecka isär, och "tors … tors" säger ingenting. */
                  rows={chartData.map(d => ({ key: d.date, label: shortLabel(d.date), scores: d.scores }))}
                  ariaPrefix="Din utveckling"
                />
              </div>
            ) : (
              <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 6, padding: '20px 16px', marginBottom: 16 }}>
                <p style={{ color: '#64748B', fontSize: 13, margin: 0, textAlign: 'center' }}>
                  Fler incheckningar behövs för att visa utvecklingen.
                </p>
              </div>
            )}
          </Panel>
        )}
      </div>
    </div>
  );
}

/**
 * Riktningspilen, på ett ställe.
 *
 * Samma trestegsval låg i två kopior med olika storlek som enda skillnad —
 * samma sorts duplicering som kategoriikonen hade innan den blev en komponent.
 * Färgen räknas fram ur riktningen, därav ett attribut och ingen klass.
 */
function TrendIkon({ trend, size }: { trend: string; size: number }) {
  if (trend === 'up') return <TrendingUp size={size} color="#059669" aria-hidden />;
  if (trend === 'down') return <TrendingDown size={size} color="#DC2626" aria-hidden />;
  return <Minus size={size} color="#D97706" aria-hidden />;
}

function MetricCard({ label, value, sub, trend }: { label: string; value: string; sub: React.ReactNode; trend?: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-5 py-4">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <div className="mb-1.5 flex items-baseline gap-1.5">
        <span className="text-[28px] font-extrabold tabular-nums text-slate-900">{value}</span>
        {trend && (
          <span className="ml-1">
            <TrendIkon trend={trend} size={14} />
          </span>
        )}
      </div>
      {sub}
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <h2 className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
      {label}
    </h2>
  );
}

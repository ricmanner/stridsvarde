'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Activity, Brain, Users, Moon, Utensils, Zap, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import CategoryTrendGrid from '@/components/charts/CategoryTrendGrid';
import ScoreTrendChart from '@/components/charts/ScoreTrendChart';
import StatusBandLegend from '@/components/charts/StatusBandLegend';
import StatusBadge from '@/components/StatusBadge';
import { CATEGORIES, type Category, getStatus, statusColor, avgScore } from '@/lib/data';
import { ownTrend } from '@/lib/own-trend';
import { getSoldierTips } from '@/lib/advice';
import SupportBlock from './SupportBlock';
import { shortLabel } from '@/lib/date';
import { formatScore } from '@/lib/format';

const ICONS: Record<string, React.ReactNode> = {
  Activity: <Activity size={16} strokeWidth={1.5} />,
  Brain: <Brain size={16} strokeWidth={1.5} />,
  Users: <Users size={16} strokeWidth={1.5} />,
  Moon: <Moon size={16} strokeWidth={1.5} />,
  Utensils: <Utensils size={16} strokeWidth={1.5} />,
  Zap: <Zap size={16} strokeWidth={1.5} />,
};

export interface DashboardProps {
  scores: Record<Category, number>;
  advice: string;
  /** En rad per dag de senaste fjorton dagarna, äldst först. Tom dag = null. */
  chartData: Array<{ date: string; day: string; score: number | null; scores: Record<Category, number> | null }>;
  freq: { checkedIn: number; total: number; pct: number };
}

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
    <div style={{ flex: 1, background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>

      {/* Tab bar */}
      <div style={{ background: 'white', borderBottom: '1px solid #E2E8F0', display: 'flex' }}>
        {(['overview', 'history'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '14px 0', background: 'none', border: 'none',
              borderBottom: tab === t ? '2px solid #0F172A' : '2px solid transparent',
              color: tab === t ? '#0F172A' : '#64748B',
              fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              cursor: 'pointer', transition: 'color 0.15s',
            }}
          >
            {t === 'overview' ? 'Översikt' : 'Historia'}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 40px' }}>

        {tab === 'overview' && (
          <>
            {redCategories.length > 0 && <SupportBlock red={redCategories} />}

            {/* Top metrics row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <MetricCard
                label="Hälsostatus idag"
                value={formatScore(overall)}
                sub={<StatusBadge status={overallStatus} />}
                trend={trend}
              />
              <MetricCard
                label="Svarsfrekvens (14 dagar)"
                value={`${freq.pct}%`}
                sub={<span style={{ color: '#64748B', fontSize: 12 }}>{freq.checkedIn} av {freq.total} dagar</span>}
              />
            </div>

            {/* Category breakdown */}
            <SectionHeader label="Kategorier — dagens rapport" />
            <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
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
                  <div key={cat.key} style={{
                    padding: '14px 20px',
                    borderBottom: i < CATEGORIES.length - 1 ? '1px solid #F1F5F9' : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{ color: '#94A3B8' }}>{ICONS[cat.icon]}</div>
                      <span style={{ color: '#475569', fontSize: 13, flex: 1 }}>{cat.label}</span>
                      <span style={{ color: '#0F172A', fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginRight: 8 }}>{s}</span>
                      <StatusBadge status={st} size="sm" />
                    </div>
                    <div style={{ height: 3, background: '#F1F5F9', borderRadius: 2 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: col, borderRadius: 2 }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Advice */}
            <SectionHeader label="Personlig vägledning" />
            <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 6, padding: 20, marginBottom: tips.length > 0 ? 10 : 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#2563EB' }} />
                <span style={{ color: '#64748B', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Baserat på dagens rapport</span>
              </div>
              <p style={{ color: '#334155', fontSize: 14, lineHeight: 1.7, margin: 0 }}>{advice}</p>
            </div>

            {/* Tip cards — for weakest categories */}
            {tips.map((tip, ti) => (
              <div key={tip.category} style={{
                background: 'white', border: '1px solid #E2E8F0', borderLeft: `3px solid ${ti === 0 ? '#DC2626' : '#D97706'}`,
                borderRadius: 6, padding: '14px 20px', marginBottom: ti < tips.length - 1 ? 8 : 16,
              }}>
                <p style={{ color: '#475569', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 6px' }}>{tip.title}</p>
                {/* Vad värdet betyder. Punkterna under säger vad man gör. */}
                <p style={{ color: '#334155', fontSize: 13, lineHeight: 1.6, margin: '0 0 10px' }}>{tip.why}</p>
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {tip.tips.map((t, i) => (
                    <li key={i} style={{ color: '#334155', fontSize: 13, lineHeight: 1.6, marginBottom: i < tip.tips.length - 1 ? 4 : 0 }}>{t}</li>
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

            {/* 14-day trend */}
            {svar.length >= 3 && (
              <>
                <SectionHeader label="Trend — 14 dagar" />
                <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 6, padding: '20px 16px 16px', marginBottom: 16 }}>
                  <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
                    <div>
                      <p style={{ color: '#64748B', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0, marginBottom: 2 }}>Senaste värde</p>
                      <span style={{ color: '#0F172A', fontSize: 20, fontWeight: 700 }}>{svar.length > 0 ? formatScore(svar[svar.length - 1].score) : ''}</span>
                    </div>
                    <div>
                      <p style={{ color: '#64748B', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0, marginBottom: 2 }}>Riktning</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {trend === 'up' ? <TrendingUp size={18} color="#059669" /> : trend === 'down' ? <TrendingDown size={18} color="#DC2626" /> : <Minus size={18} color="#D97706" />}
                        <span style={{ fontSize: 13, color: trend === 'up' ? '#059669' : trend === 'down' ? '#DC2626' : '#D97706', fontWeight: 600 }}>
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
                  <div style={{ marginTop: 6 }}>
                    <StatusBandLegend />
                  </div>
                </div>
              </>
            )}

          </>
        )}

        {tab === 'history' && (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, trend }: { label: string; value: string; sub: React.ReactNode; trend?: string }) {
  return (
    <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 6, padding: '16px 20px' }}>
      <p style={{ color: '#64748B', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0, marginBottom: 8 }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
        <span style={{ color: '#0F172A', fontSize: 28, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        {trend && (
          <span style={{ marginLeft: 4 }}>
            {trend === 'up' ? <TrendingUp size={14} color="#059669" /> : trend === 'down' ? <TrendingDown size={14} color="#DC2626" /> : <Minus size={14} color="#D97706" />}
          </span>
        )}
      </div>
      {sub}
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <p style={{ color: '#64748B', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 8px 0' }}>
      {label}
    </p>
  );
}

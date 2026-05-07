'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, Brain, Users, Moon, Utensils, Zap, TrendingUp, TrendingDown, Minus, RotateCcw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea } from 'recharts';
import AppHeader from '@/components/AppHeader';
import StatusBadge from '@/components/StatusBadge';
import { CATEGORIES, Category, CheckIn, getStatus, statusColor, avgScore } from '@/lib/data';
import { getCheckIns, getTodayCheckIn, getResponseFrequency, saveCheckIn, seedMockHistory } from '@/lib/storage';
import { getSession } from '@/lib/auth';
import { generateSoldierAdvice, getSoldierTips } from '@/lib/advice';
import { getScoresForSoldierCode } from '@/lib/mockData';

const ICONS: Record<string, React.ReactNode> = {
  Activity: <Activity size={16} strokeWidth={1.5} />,
  Brain: <Brain size={16} strokeWidth={1.5} />,
  Users: <Users size={16} strokeWidth={1.5} />,
  Moon: <Moon size={16} strokeWidth={1.5} />,
  Utensils: <Utensils size={16} strokeWidth={1.5} />,
  Zap: <Zap size={16} strokeWidth={1.5} />,
};

const DAY_LABELS = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];

export default function SoldatDashboard() {
  const router = useRouter();
  const [session, setSession] = useState<ReturnType<typeof getSession>>(null);
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null);
  const [history, setHistory] = useState<CheckIn[]>([]);
  const [tab, setTab] = useState<'overview' | 'history'>('overview');

  useEffect(() => {
    const s = getSession();
    if (!s || s.role !== 'soldat') { router.replace('/'); return; }
    setSession(s);

    const mockScores = getScoresForSoldierCode(s.code);
    if (mockScores) seedMockHistory(s.code, mockScores);

    const today = getTodayCheckIn(s.code);
    if (!today) { router.replace('/soldat'); return; }
    setCheckIn(today);
    setHistory(getCheckIns(s.code));
  }, [router]);

  if (!session || !checkIn) {
    return (
      <div style={{ minHeight: '100dvh', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 24, height: 24, border: '2px solid #334155', borderTop: '2px solid #94A3B8', borderRadius: '50%' }} />
      </div>
    );
  }

  const overall = avgScore(checkIn.scores);
  const overallStatus = getStatus(Math.round(overall));
  const freq = getResponseFrequency(session.code, 14);
  const advice = checkIn.advice || generateSoldierAdvice(checkIn.scores);
  const tips = getSoldierTips(checkIn.scores);

  // Build chart data from history (oldest first)
  const chartData = [...history].reverse().slice(-14).map(c => ({
    day: DAY_LABELS[new Date(c.date + 'T12:00:00').getDay() === 0 ? 6 : new Date(c.date + 'T12:00:00').getDay() - 1],
    score: avgScore(c.scores),
    date: c.date,
  }));

  // Trend: compare last 3 avg to previous 3 avg
  const trend = (() => {
    if (chartData.length < 4) return 'neutral';
    const recent = chartData.slice(-3).reduce((a, b) => a + b.score, 0) / 3;
    const prev = chartData.slice(-6, -3).reduce((a, b) => a + b.score, 0) / Math.max(1, Math.min(3, chartData.length - 3));
    if (recent > prev + 0.3) return 'up';
    if (recent < prev - 0.3) return 'down';
    return 'neutral';
  })();

  // Sort categories worst first
  const sortedCats = [...CATEGORIES].sort((a, b) => checkIn.scores[a.key] - checkIn.scores[b.key]);

  function resetForDemo() {
    if (!session) return;
    const stored = getCheckIns(session.code).filter(c => c.date !== checkIn?.date);
    localStorage.setItem(`sv_checkins_${session.code}`, JSON.stringify(stored));
    router.replace('/soldat');
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
      <AppHeader unit={session.unit} code={session.code} />

      {/* Tab bar */}
      <div style={{ background: 'white', borderBottom: '1px solid #E2E8F0', display: 'flex' }}>
        {(['overview', 'history'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '14px 0', background: 'none', border: 'none',
              borderBottom: tab === t ? '2px solid #0F172A' : '2px solid transparent',
              color: tab === t ? '#0F172A' : '#94A3B8',
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
            {/* Top metrics row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <MetricCard
                label="Hälsostatus idag"
                value={overall.toFixed(1)}
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
                const s = checkIn.scores[cat.key];
                const st = getStatus(s);
                const col = statusColor(st);
                const pct = ((s - 1) / 9) * 100;
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
                <p style={{ color: '#475569', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 8px' }}>{tip.title}</p>
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {tip.tips.map((t, i) => (
                    <li key={i} style={{ color: '#334155', fontSize: 13, lineHeight: 1.6, marginBottom: i < tip.tips.length - 1 ? 4 : 0 }}>{t}</li>
                  ))}
                </ul>
              </div>
            ))}

            {/* 14-day trend */}
            {chartData.length >= 3 && (
              <>
                <SectionHeader label="Trend — 14 dagar" />
                <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 6, padding: '20px 16px 16px', marginBottom: 16 }}>
                  <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
                    <div>
                      <p style={{ color: '#94A3B8', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0, marginBottom: 2 }}>Senaste värde</p>
                      <span style={{ color: '#0F172A', fontSize: 20, fontWeight: 700 }}>{chartData[chartData.length - 1]?.score.toFixed(1)}</span>
                    </div>
                    <div>
                      <p style={{ color: '#94A3B8', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0, marginBottom: 2 }}>Riktning</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {trend === 'up' ? <TrendingUp size={18} color="#059669" /> : trend === 'down' ? <TrendingDown size={18} color="#DC2626" /> : <Minus size={18} color="#D97706" />}
                        <span style={{ fontSize: 13, color: trend === 'up' ? '#059669' : trend === 'down' ? '#DC2626' : '#D97706', fontWeight: 600 }}>
                          {trend === 'up' ? 'Stigande' : trend === 'down' ? 'Sjunkande' : 'Stabil'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <ZoneChart data={chartData} />
                </div>
              </>
            )}

            {/* Demo reset */}
            <button
              onClick={resetForDemo}
              style={{ width: '100%', background: 'none', border: '1px solid #E2E8F0', borderRadius: 6, padding: '12px', color: '#94A3B8', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <RotateCcw size={13} /> Återställ för ny incheckning (demo)
            </button>
          </>
        )}

        {tab === 'history' && (
          <>
            <SectionHeader label={`Din närvaro — senaste 14 dagarna`} />
            <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 6, padding: 20, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ color: '#64748B', fontSize: 13 }}>Registrerade incheckningar</span>
                <span style={{ color: '#0F172A', fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                  {freq.checkedIn}<span style={{ color: '#94A3B8', fontSize: 13, fontWeight: 400 }}> / {freq.total}</span>
                </span>
              </div>
              <div style={{ height: 6, background: '#F1F5F9', borderRadius: 3, marginTop: 10 }}>
                <div style={{ height: '100%', width: `${freq.pct}%`, background: freq.pct >= 70 ? '#059669' : freq.pct >= 40 ? '#D97706' : '#DC2626', borderRadius: 3, transition: 'width 0.3s' }} />
              </div>
              <p style={{ color: '#94A3B8', fontSize: 12, marginTop: 8, marginBottom: 0 }}>
                {freq.pct >= 70 ? 'Bra närvaro — fortsätt så.' : freq.pct >= 40 ? 'Försök checka in dagligen.' : 'Lägre närvaro — befälet ser inga data.'}
              </p>
            </div>

            <SectionHeader label="Mående över tid" />
            <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 6, padding: '20px 16px 16px', marginBottom: 16 }}>
              {chartData.length >= 2 ? (
                <>
                  <ZoneChart data={chartData} />
                </>
              ) : (
                <p style={{ color: '#94A3B8', fontSize: 13, margin: 0, textAlign: 'center', padding: '20px 0' }}>
                  Fler incheckningar behövs för att visa trend.
                </p>
              )}
            </div>
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

function ZoneChart({ data }: { data: Array<{ day: string; score: number }> }) {
  return (
    <>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
          <ReferenceArea y1={7} y2={10} fill="#059669" fillOpacity={0.07} />
          <ReferenceArea y1={4} y2={7}  fill="#D97706" fillOpacity={0.07} />
          <ReferenceArea y1={1} y2={4}  fill="#DC2626" fillOpacity={0.07} />
          <XAxis dataKey="day" tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis domain={[1, 10]} tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} ticks={[1, 4, 7, 10]} />
          <ReferenceLine y={7} stroke="#059669" strokeDasharray="3 3" strokeOpacity={0.5} label={{ value: 'GRÖNT', position: 'insideTopRight', fontSize: 8, fill: '#059669', fontWeight: 700 }} />
          <ReferenceLine y={4} stroke="#DC2626" strokeDasharray="3 3" strokeOpacity={0.5} label={{ value: 'RÖTT', position: 'insideBottomRight', fontSize: 8, fill: '#DC2626', fontWeight: 700 }} />
          <Tooltip
            contentStyle={{ background: '#0F172A', border: 'none', borderRadius: 6, color: 'white', fontSize: 12, padding: '8px 12px' }}
            formatter={(val) => [typeof val === 'number' ? val.toFixed(1) : val, 'Mående']}
          />
          <Line dataKey="score" stroke="#0F172A" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#0F172A' }} />
        </LineChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
        {[['#059669', 'Grön ≥ 7'], ['#D97706', 'Gul 4–6'], ['#DC2626', 'Röd ≤ 3']].map(([color, label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: color, opacity: 0.5 }} />
            <span style={{ color: '#94A3B8', fontSize: 10 }}>{label}</span>
          </div>
        ))}
      </div>
    </>
  );
}

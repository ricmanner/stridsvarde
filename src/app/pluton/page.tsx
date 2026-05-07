'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, Brain, Users, Moon, Utensils, Zap, AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, RadarChart, Radar, PolarGrid, PolarAngleAxis, Legend } from 'recharts';
import AppHeader from '@/components/AppHeader';
import StatusBadge from '@/components/StatusBadge';
import { CATEGORIES, getStatus, statusColor, avgScore } from '@/lib/data';
import { getPlatonSoldiers, avgScoresFor, categoryTrendData, groupTrendData, getEffectiveSoldiers, getResponseRate } from '@/lib/mockData';
import { generateLeaderAdvice } from '@/lib/advice';
import { getSession } from '@/lib/auth';

const ICONS: Record<string, React.ReactNode> = {
  Activity:  <Activity  size={15} strokeWidth={1.5} />,
  Brain:     <Brain     size={15} strokeWidth={1.5} />,
  Users:     <Users     size={15} strokeWidth={1.5} />,
  Moon:      <Moon      size={15} strokeWidth={1.5} />,
  Utensils:  <Utensils  size={15} strokeWidth={1.5} />,
  Zap:       <Zap       size={15} strokeWidth={1.5} />,
};

const CAT_COLORS: Record<string, string> = {
  fysisk:  '#2563EB',
  psykisk: '#7C3AED',
  social:  '#DB2777',
  somn:    '#0891B2',
  kost:    '#059669',
  energi:  '#D97706',
};

const SQUAD_COLORS = ['#2563EB', '#059669', '#D97706'];

// Soldiers 1-3 → Grupp 1, 4-7 → Grupp 2, 8-10 → Grupp 3
const SQUADS = [
  { name: 'Grupp 1', min: 1, max: 3 },
  { name: 'Grupp 2', min: 4, max: 7 },
  { name: 'Grupp 3', min: 8, max: 10 },
];

export default function PlutonDashboard() {
  const router = useRouter();
  const [session, setSession] = useState<ReturnType<typeof getSession>>(null);
  const [tab, setTab] = useState<'overview' | 'trends' | 'compare'>('overview');
  const [period, setPeriod] = useState<7 | 14 | 21>(7);
  const [activeCats, setActiveCats] = useState<Set<string>>(new Set(CATEGORIES.map(c => c.key)));
  const [activeRadarCats, setActiveRadarCats] = useState<Set<string>>(new Set(CATEGORIES.map(c => c.key)));

  useEffect(() => {
    const s = getSession();
    if (!s || s.role !== 'pluton') { router.replace('/'); return; }
    setSession(s);
  }, [router]);

  if (!session) return <div style={{ minHeight: '100dvh', background: '#0F172A' }} />;

  const unit = session.unit;
  const soldiers = getPlatonSoldiers(unit, getEffectiveSoldiers());
  const avgScores = avgScoresFor(soldiers);
  const overall = avgScore(avgScores);
  const overallStatus = getStatus(Math.round(overall));
  const advice = generateLeaderAdvice(avgScores);
  const catTrend = categoryTrendData(unit, period);
  const responseRate = getResponseRate(soldiers);

  function toggleRadarCat(key: string) {
    setActiveRadarCats(prev => {
      const next = new Set(prev);
      if (next.size <= 2 && next.has(key)) return prev;
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleCat(key: string) {
    setActiveCats(prev => {
      const next = new Set(prev);
      if (next.size === 1 && next.has(key)) return prev;
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const total = soldiers.length;
  const redCount    = soldiers.filter(s => avgScore(s.scores) < 4).length;
  const yellowCount = soldiers.filter(s => { const a = avgScore(s.scores); return a >= 4 && a < 7; }).length;
  const greenCount  = soldiers.filter(s => avgScore(s.scores) >= 7).length;

  const alerts = CATEGORIES.filter(cat => getStatus(Math.round(avgScores[cat.key])) === 'red');

  // Squad data
  const squadData = SQUADS.map(({ name, min, max }) => {
    const sq = soldiers.filter(s => {
      const idx = parseInt(s.code.split('-')[1], 10);
      return idx >= min && idx <= max;
    });
    const scores = avgScoresFor(sq);
    const ov = avgScore(scores);
    const status = getStatus(Math.round(ov));
    const red    = sq.filter(s => avgScore(s.scores) < 4).length;
    const yellow = sq.filter(s => { const a = avgScore(s.scores); return a >= 4 && a < 7; }).length;
    const green  = sq.filter(s => avgScore(s.scores) >= 7).length;
    const trend  = groupTrendData(sq, name, period);
    return { name, soldiers: sq, scores, overall: ov, status, red, yellow, green, trend };
  });

  const radarData = CATEGORIES.map(cat => {
    const entry: Record<string, string | number> = { subject: cat.label.split(' ')[0], _key: cat.key };
    squadData.forEach(sq => { entry[sq.name] = sq.scores[cat.key]; });
    return entry;
  });
  const filteredRadarData = radarData.filter(d => activeRadarCats.has(d._key as string));

  const trendCompare = squadData[0].trend.map((d, i) => {
    const entry: Record<string, string | number> = { day: d.day };
    squadData.forEach(sq => { entry[sq.name] = sq.trend[i]?.score ?? d.score; });
    return entry;
  });

  return (
    <div style={{ minHeight: '100dvh', background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
      <AppHeader unit={unit} code={session.code} />

      {/* Summary bar */}
      <div style={{ background: 'white', borderBottom: '1px solid #E2E8F0', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <p style={{ color: '#94A3B8', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0, marginBottom: 2 }}>
              Samlat mående
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ color: '#0F172A', fontSize: 24, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{overall.toFixed(1)}</span>
              <StatusBadge status={overallStatus} />
            </div>
          </div>
          <div style={{ height: 36, width: 1, background: '#E2E8F0' }} />
          <StatDot count={greenCount}  label="Gröna"  color="#059669" />
          <StatDot count={yellowCount} label="Gula"   color="#D97706" />
          <StatDot count={redCount}    label="Röda"   color="#DC2626" />
          <span style={{ color: '#CBD5E1', fontSize: 13 }}>|</span>
          <span style={{ color: '#94A3B8', fontSize: 12 }}>{total} soldater</span>
          <span style={{ color: '#94A3B8', fontSize: 12 }}>{responseRate.pct}% svarat</span>
          {alerts.length > 0 && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 4, padding: '4px 10px' }}>
              <AlertTriangle size={13} color="#DC2626" />
              <span style={{ color: '#DC2626', fontSize: 11, fontWeight: 700 }}>
                {alerts.length} kategori{alerts.length > 1 ? 'er' : ''} i rött
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: 'white', borderBottom: '1px solid #E2E8F0', display: 'flex' }}>
        {(['overview', 'trends', 'compare'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '13px 0', background: 'none', border: 'none',
            borderBottom: tab === t ? '2px solid #0F172A' : '2px solid transparent',
            color: tab === t ? '#0F172A' : '#94A3B8',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            cursor: 'pointer',
          }}>
            {t === 'overview' ? 'Översikt' : t === 'trends' ? 'Trender' : 'Jämförelse'}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 40px' }}>

        {/* ── ÖVERSIKT ── */}
        {tab === 'overview' && (
          <>
            <div style={{ marginBottom: 8 }}><SL label="Kategorier — gruppsnitt och fördelning" /></div>
            <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
              {CATEGORIES.map((cat, i) => {
                const s = avgScores[cat.key];
                const st = getStatus(Math.round(s));
                const g = soldiers.filter(sol => getStatus(sol.scores[cat.key]) === 'green').length;
                const y = soldiers.filter(sol => getStatus(sol.scores[cat.key]) === 'yellow').length;
                const r = soldiers.filter(sol => getStatus(sol.scores[cat.key]) === 'red').length;
                return (
                  <div key={cat.key} style={{ padding: '14px 20px', borderBottom: i < CATEGORIES.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{ color: '#94A3B8' }}>{ICONS[cat.icon]}</div>
                      <span style={{ color: '#475569', fontSize: 13, flex: 1 }}>{cat.label}</span>
                      <span style={{ color: '#0F172A', fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginRight: 6 }}>{s.toFixed(1)}</span>
                      <StatusBadge status={st} size="sm" />
                    </div>
                    <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 5 }}>
                      <div style={{ flex: g, background: '#059669' }} />
                      <div style={{ flex: y, background: '#D97706' }} />
                      <div style={{ flex: r, background: '#DC2626' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <Count n={g} color="#059669" label="grön" />
                      <Count n={y} color="#D97706" label="gul" />
                      <Count n={r} color="#DC2626" label="röd" />
                    </div>
                  </div>
                );
              })}
            </div>

            {alerts.length > 0 && (
              <>
                <div style={{ marginBottom: 8 }}><SL label="Tröskelvärden — kräver åtgärd" /></div>
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, padding: '14px 20px', marginBottom: 16 }}>
                  {alerts.map((cat, i) => (
                    <div key={cat.key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: i > 0 ? 8 : 0 }}>
                      <AlertTriangle size={14} color="#DC2626" />
                      <span style={{ color: '#7F1D1D', fontSize: 13 }}>
                        <strong>{cat.label}</strong> understiger kritisk nivå — snitt {avgScores[cat.key].toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div style={{ marginBottom: 8 }}><SL label="Befälsråd — gruppperspektiv" /></div>
            <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 6, padding: 20, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#D97706' }} />
                <span style={{ color: '#64748B', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Datadrivet råd</span>
              </div>
              <p style={{ color: '#334155', fontSize: 14, lineHeight: 1.7, margin: 0 }}>{advice}</p>
            </div>
          </>
        )}

        {/* ── TRENDER ── */}
        {tab === 'trends' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <SL label={`Kategoritrender — ${period} dagar (plutonsnitt)`} />
              <PeriodPicker value={period} onChange={setPeriod} />
            </div>
            <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 6, padding: '16px 12px 12px', marginBottom: 16 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12, paddingLeft: 8 }}>
                {CATEGORIES.map(cat => (
                  <button key={cat.key} onClick={() => toggleCat(cat.key)} style={{
                    padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                    border: `1.5px solid ${activeCats.has(cat.key) ? CAT_COLORS[cat.key] : '#E2E8F0'}`,
                    background: activeCats.has(cat.key) ? CAT_COLORS[cat.key] + '20' : 'white',
                    color: activeCats.has(cat.key) ? CAT_COLORS[cat.key] : '#94A3B8',
                  }}>
                    {cat.label.split(' ')[0]}
                  </button>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={catTrend} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <ReferenceArea y1={7} y2={10} fill="#059669" fillOpacity={0.05} />
                  <ReferenceArea y1={4} y2={7}  fill="#D97706" fillOpacity={0.05} />
                  <ReferenceArea y1={1} y2={4}  fill="#DC2626" fillOpacity={0.05} />
                  <XAxis dataKey="day" tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} interval={period === 7 ? 0 : period === 14 ? 1 : 2} />
                  <YAxis domain={[1, 10]} tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} ticks={[1, 4, 7, 10]} />
                  <ReferenceLine y={7} stroke="#059669" strokeDasharray="3 3" strokeOpacity={0.35} label={{ value: '7', position: 'right', fontSize: 9, fill: '#059669' }} />
                  <ReferenceLine y={4} stroke="#DC2626" strokeDasharray="3 3" strokeOpacity={0.35} label={{ value: '4', position: 'right', fontSize: 9, fill: '#DC2626' }} />
                  <Tooltip
                    contentStyle={{ background: '#0F172A', border: 'none', borderRadius: 6, color: 'white', fontSize: 11, padding: '8px 12px' }}
                    formatter={(v, name) => [typeof v === 'number' ? v.toFixed(1) : v, CATEGORIES.find(c => c.key === name)?.label ?? name]}
                  />
                  {CATEGORIES.filter(cat => activeCats.has(cat.key)).map(cat => (
                    <Line key={cat.key} dataKey={cat.key} stroke={CAT_COLORS[cat.key]} strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div style={{ marginBottom: 8 }}><SL label="Dagsläge per kategori" /></div>
            <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 52px 72px', padding: '9px 20px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <span style={{ color: '#94A3B8', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Kategori</span>
                <span style={{ color: '#94A3B8', fontSize: 10, fontWeight: 700, textAlign: 'center' }}>Snitt</span>
                <span style={{ color: '#94A3B8', fontSize: 10, fontWeight: 700, textAlign: 'right' }}>Status</span>
              </div>
              {CATEGORIES.map((cat, i) => {
                const s = avgScores[cat.key];
                const st = getStatus(Math.round(s));
                const col = statusColor(st);
                return (
                  <div key={cat.key} style={{ display: 'grid', gridTemplateColumns: '1fr 52px 72px', padding: '12px 20px', alignItems: 'center', borderBottom: i < CATEGORIES.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 3, height: 16, background: CAT_COLORS[cat.key], borderRadius: 2, flexShrink: 0 }} />
                      <div style={{ color: '#94A3B8' }}>{ICONS[cat.icon]}</div>
                      <span style={{ color: '#475569', fontSize: 13 }}>{cat.label}</span>
                    </div>
                    <span style={{ color: col, fontSize: 15, fontWeight: 700, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{s.toFixed(1)}</span>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <StatusBadge status={st} size="sm" />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── JÄMFÖRELSE ── */}
        {tab === 'compare' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <SL label={`Grupptrendöversikt — ${period} dagar`} />
              <PeriodPicker value={period} onChange={setPeriod} />
            </div>
            <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 6, padding: '20px 12px 16px', marginBottom: 16 }}>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={trendCompare} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                  <ReferenceArea y1={7} y2={10} fill="#059669" fillOpacity={0.05} />
                  <ReferenceArea y1={4} y2={7}  fill="#D97706" fillOpacity={0.05} />
                  <ReferenceArea y1={1} y2={4}  fill="#DC2626" fillOpacity={0.05} />
                  <XAxis dataKey="day" tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} interval={period === 7 ? 0 : period === 14 ? 1 : 2} />
                  <YAxis domain={[1, 10]} tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} ticks={[1, 4, 7, 10]} />
                  <ReferenceLine y={7} stroke="#059669" strokeDasharray="3 3" strokeOpacity={0.35} />
                  <ReferenceLine y={4} stroke="#DC2626" strokeDasharray="3 3" strokeOpacity={0.35} />
                  <Tooltip contentStyle={{ background: '#0F172A', border: 'none', borderRadius: 6, color: 'white', fontSize: 11, padding: '8px 12px' }} />
                  {squadData.map((sq, qi) => (
                    <Line key={sq.name} dataKey={sq.name} stroke={SQUAD_COLORS[qi]} strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                  ))}
                  <Legend wrapperStyle={{ fontSize: 11, color: '#64748B' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div style={{ marginBottom: 8 }}><SL label="Profilanalys — grupper" /></div>
            <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 6, padding: '16px 12px', marginBottom: 16 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12, paddingLeft: 8 }}>
                {CATEGORIES.map(cat => (
                  <button key={cat.key} onClick={() => toggleRadarCat(cat.key)} style={{
                    padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                    border: `1.5px solid ${activeRadarCats.has(cat.key) ? CAT_COLORS[cat.key] : '#E2E8F0'}`,
                    background: activeRadarCats.has(cat.key) ? CAT_COLORS[cat.key] + '20' : 'white',
                    color: activeRadarCats.has(cat.key) ? CAT_COLORS[cat.key] : '#94A3B8',
                  }}>
                    {cat.label.split(' ')[0]}
                  </button>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart data={filteredRadarData}>
                  <PolarGrid stroke="#E2E8F0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748B', fontSize: 10 }} />
                  {squadData.map((sq, qi) => (
                    <Radar key={sq.name} name={sq.name} dataKey={sq.name} stroke={SQUAD_COLORS[qi]} fill={SQUAD_COLORS[qi]} fillOpacity={0.1} strokeWidth={1.5} />
                  ))}
                  <Tooltip contentStyle={{ background: '#0F172A', border: 'none', borderRadius: 6, color: 'white', fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#64748B' }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ marginBottom: 8 }}><SL label="Rangordning efter hälsostatus" /></div>
            <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 48px 48px 48px 60px', padding: '10px 20px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <span style={{ color: '#94A3B8', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Grupp</span>
                <span style={{ color: '#94A3B8', fontSize: 10, fontWeight: 700, textAlign: 'center' }}>Gröna</span>
                <span style={{ color: '#94A3B8', fontSize: 10, fontWeight: 700, textAlign: 'center' }}>Gula</span>
                <span style={{ color: '#94A3B8', fontSize: 10, fontWeight: 700, textAlign: 'center' }}>Röda</span>
                <span style={{ color: '#94A3B8', fontSize: 10, fontWeight: 700, textAlign: 'right' }}>Snitt</span>
              </div>
              {[...squadData].sort((a, b) => b.overall - a.overall).map((sq, i) => {
                const qi = squadData.indexOf(sq);
                return (
                  <div key={sq.name} style={{ display: 'grid', gridTemplateColumns: '1fr 48px 48px 48px 60px', padding: '13px 20px', alignItems: 'center', borderBottom: i < squadData.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 3, height: 20, background: SQUAD_COLORS[qi], borderRadius: 2 }} />
                      <span style={{ color: '#475569', fontSize: 14 }}>{sq.name}</span>
                      <StatusBadge status={sq.status} size="sm" />
                    </div>
                    <span style={{ color: '#059669', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>{sq.green}</span>
                    <span style={{ color: '#D97706', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>{sq.yellow}</span>
                    <span style={{ color: '#DC2626', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>{sq.red}</span>
                    <span style={{ color: '#0F172A', fontSize: 14, fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{sq.overall.toFixed(1)}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatDot({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
      <span style={{ color: '#0F172A', fontWeight: 700, fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
      <span style={{ color: '#94A3B8', fontSize: 12 }}>{label}</span>
    </div>
  );
}

function Count({ n, color, label }: { n: number; color: string; label: string }) {
  return (
    <span style={{ color, fontSize: 11, fontWeight: 600 }}>
      {n} <span style={{ fontWeight: 400, color: '#94A3B8' }}>{label}</span>
    </span>
  );
}

function SL({ label }: { label: string }) {
  return <p style={{ color: '#64748B', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>{label}</p>;
}

function PeriodPicker({ value, onChange }: { value: 7 | 14 | 21; onChange: (v: 7 | 14 | 21) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {([7, 14, 21] as const).map(d => (
        <button key={d} onClick={() => onChange(d)} style={{
          padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 700,
          border: value === d ? '1.5px solid #0F172A' : '1.5px solid #E2E8F0',
          background: value === d ? '#0F172A' : 'white',
          color: value === d ? 'white' : '#94A3B8',
        }}>
          {d}d
        </button>
      ))}
    </div>
  );
}

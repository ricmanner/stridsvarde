'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, ReferenceLine, ReferenceArea, Legend } from 'recharts';
import StatusBadge from '@/components/StatusBadge';
import { CATEGORIES, getStatus, statusColor, statusBg, avgScore } from '@/lib/data';
import { avgScoresFor, getKompaniSoldiers, kompaniTrendData, getEffectiveSoldiers, categoryTrendDataForSoldiers, getResponseRate } from '@/lib/mockData';
import { generateLeaderAdvice } from '@/lib/advice';
import { ALL_COMPANIES } from '@/lib/codes';

const CAT_COLORS: Record<string, string> = {
  fysisk:  '#2563EB',
  psykisk: '#7C3AED',
  social:  '#DB2777',
  somn:    '#0891B2',
  kost:    '#059669',
  energi:  '#D97706',
};

const KOMPANI_COLORS: Record<string, string> = {
  '1. Kompaniet': '#2563EB',
  '2. Kompaniet': '#059669',
  '3. Kompaniet': '#7C3AED',
};

const KOMPANI_SHORT: Record<string, string> = {
  '1. Kompaniet': '1. Kp',
  '2. Kompaniet': '2. Kp',
  '3. Kompaniet': '3. Kp',
};

/** Behörigheten kontrolleras på servern i page.tsx innan detta renderas. */
export default function BataljonDashboard({ unit }: { unit: string }) {
  const [tab, setTab] = useState<'overview' | 'trends' | 'compare'>('overview');
  const [period, setPeriod] = useState<7 | 14 | 21>(7);
  const [activeCats, setActiveCats] = useState<Set<string>>(new Set(CATEGORIES.map(c => c.key)));
  const [activeRadarCats, setActiveRadarCats] = useState<Set<string>>(new Set(CATEGORIES.map(c => c.key)));

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

  const liveSoldiers = getEffectiveSoldiers();

  const kompaniData = ALL_COMPANIES.map(name => {
    const soldiers = getKompaniSoldiers(name, liveSoldiers);
    const scores = avgScoresFor(soldiers);
    const overall = avgScore(scores);
    const status = getStatus(Math.round(overall));
    const red    = soldiers.filter(s => avgScore(s.scores) < 4).length;
    const yellow = soldiers.filter(s => { const a = avgScore(s.scores); return a >= 4 && a < 7; }).length;
    const green  = soldiers.filter(s => avgScore(s.scores) >= 7).length;
    const trend  = kompaniTrendData(name, period);
    return { name, soldiers, scores, overall, status, red, yellow, green, trend };
  });

  const battalionScores = avgScoresFor(liveSoldiers);
  const battalionOverall = avgScore(battalionScores);
  const battalionStatus = getStatus(Math.round(battalionOverall));

  const totalSoldiers = liveSoldiers.length;
  const totalRed    = liveSoldiers.filter(s => avgScore(s.scores) < 4).length;
  const totalYellow = liveSoldiers.filter(s => { const a = avgScore(s.scores); return a >= 4 && a < 7; }).length;
  const totalGreen  = liveSoldiers.filter(s => avgScore(s.scores) >= 7).length;

  const alerts = CATEGORIES.filter(cat => getStatus(Math.round(battalionScores[cat.key])) === 'red');
  const advice = generateLeaderAdvice(battalionScores);
  const responseRate = getResponseRate(liveSoldiers);
  const catTrend = categoryTrendDataForSoldiers(liveSoldiers, 'bataljonen', period);

  const radarData = CATEGORIES.map(cat => {
    const entry: Record<string, string | number> = { subject: cat.label.split(' ')[0], _key: cat.key };
    for (const k of kompaniData) entry[k.name] = k.scores[cat.key];
    return entry;
  });
  const filteredRadarData = radarData.filter(d => activeRadarCats.has(d._key as string));

  const trendCompare = kompaniData[0].trend.map((d, i) => {
    const entry: Record<string, string | number> = { day: d.day };
    kompaniData.forEach(k => { entry[k.name] = k.trend[i]?.score ?? d.score; });
    return entry;
  });

  const alertKompani = kompaniData.filter(k => k.status === 'red');

  return (
    <div style={{ flex: 1, background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>

      {/* Summary bar */}
      <div style={{ background: 'white', borderBottom: '1px solid #E2E8F0', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <p style={{ color: '#94A3B8', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0, marginBottom: 2 }}>
              Bataljonsnivå
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ color: '#0F172A', fontSize: 24, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{battalionOverall.toFixed(1)}</span>
              <StatusBadge status={battalionStatus} />
            </div>
          </div>
          <div style={{ height: 36, width: 1, background: '#E2E8F0' }} />
          <StatDot count={totalGreen}  label="Gröna"  color="#059669" />
          <StatDot count={totalYellow} label="Gula"   color="#D97706" />
          <StatDot count={totalRed}    label="Röda"   color="#DC2626" />
          <span style={{ color: '#CBD5E1', fontSize: 13 }}>|</span>
          <span style={{ color: '#94A3B8', fontSize: 12 }}>{totalSoldiers} soldater · {ALL_COMPANIES.length} kompanier</span>
          <span style={{ color: '#94A3B8', fontSize: 12 }}>{responseRate.pct}% svarat</span>
          {alertKompani.length > 0 && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 4, padding: '4px 10px' }}>
              <AlertTriangle size={13} color="#DC2626" />
              <span style={{ color: '#DC2626', fontSize: 11, fontWeight: 700 }}>
                {alertKompani.length} kompani{alertKompani.length > 1 ? 'er' : ''} i rött
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
            <SL label="Kategoriöversikt — bataljonen" />
            <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 68px 68px 68px 68px', padding: '10px 20px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <span style={{ color: '#94A3B8', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Kategori</span>
                {ALL_COMPANIES.map(k => (
                  <span key={k} style={{ color: '#94A3B8', fontSize: 10, fontWeight: 700, textAlign: 'center' }}>{KOMPANI_SHORT[k]}</span>
                ))}
                <span style={{ color: '#94A3B8', fontSize: 10, fontWeight: 700, textAlign: 'right' }}>Bat.</span>
              </div>
              {CATEGORIES.map((cat, i) => {
                const bs = getStatus(Math.round(battalionScores[cat.key]));
                return (
                  <div key={cat.key} style={{ display: 'grid', gridTemplateColumns: '1fr 68px 68px 68px 68px', padding: '13px 20px', alignItems: 'center', borderBottom: i < CATEGORIES.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                    <span style={{ color: '#475569', fontSize: 13 }}>{cat.label}</span>
                    {kompaniData.map(k => {
                      const s = k.scores[cat.key];
                      const st = getStatus(Math.round(s));
                      return (
                        <div key={k.name} style={{ display: 'flex', justifyContent: 'center' }}>
                          <span style={{ background: statusBg(st), color: statusColor(st), fontSize: 12, fontWeight: 700, padding: '2px 6px', borderRadius: 3, fontVariantNumeric: 'tabular-nums' }}>
                            {s.toFixed(1)}
                          </span>
                        </div>
                      );
                    })}
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <StatusBadge status={bs} size="sm" />
                    </div>
                  </div>
                );
              })}
            </div>

            {alerts.length > 0 && (
              <>
                <SL label="Tröskelvärden — kräver åtgärd" />
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, padding: '14px 20px', marginBottom: 16 }}>
                  {alerts.map((cat, i) => (
                    <div key={cat.key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: i > 0 ? 8 : 0 }}>
                      <AlertTriangle size={14} color="#DC2626" />
                      <span style={{ color: '#7F1D1D', fontSize: 13 }}>
                        <strong>{cat.label}</strong> understiger kritisk nivå — snitt {battalionScores[cat.key].toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <SL label="Befälsråd — bataljonsnivå" />
            <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 6, padding: 20 }}>
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
              <SL label={`Kategoritrender — ${period} dagar (bataljonen)`} />
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

            <SL label="Dagsläge per kategori" />
            <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 52px 72px', padding: '9px 20px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <span style={{ color: '#94A3B8', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Kategori</span>
                <span style={{ color: '#94A3B8', fontSize: 10, fontWeight: 700, textAlign: 'center' }}>Snitt</span>
                <span style={{ color: '#94A3B8', fontSize: 10, fontWeight: 700, textAlign: 'right' }}>Status</span>
              </div>
              {CATEGORIES.map((cat, i) => {
                const s = battalionScores[cat.key];
                const st = getStatus(Math.round(s));
                const col = statusColor(st);
                return (
                  <div key={cat.key} style={{ display: 'grid', gridTemplateColumns: '1fr 52px 72px', padding: '12px 20px', alignItems: 'center', borderBottom: i < CATEGORIES.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 3, height: 16, background: CAT_COLORS[cat.key], borderRadius: 2, flexShrink: 0 }} />
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
              <SL label={`Kompanitrend — ${period} dagar`} />
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
                  {ALL_COMPANIES.map(name => (
                    <Line key={name} dataKey={name} stroke={KOMPANI_COLORS[name]} strokeWidth={2} dot={false} activeDot={{ r: 3 }} name={KOMPANI_SHORT[name]} />
                  ))}
                  <Legend wrapperStyle={{ fontSize: 11, color: '#64748B' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <SL label="Profilanalys — kompanier" />
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
                  {ALL_COMPANIES.map(name => (
                    <Radar key={name} name={KOMPANI_SHORT[name]} dataKey={name} stroke={KOMPANI_COLORS[name]} fill={KOMPANI_COLORS[name]} fillOpacity={0.1} strokeWidth={1.5} />
                  ))}
                  <Tooltip contentStyle={{ background: '#0F172A', border: 'none', borderRadius: 6, color: 'white', fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#64748B' }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <SL label="Rangordning efter hälsostatus" />
            <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 56px 56px 56px 60px', padding: '10px 20px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <span style={{ color: '#94A3B8', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Kompani</span>
                <span style={{ color: '#94A3B8', fontSize: 10, fontWeight: 700, textAlign: 'center' }}>Gröna</span>
                <span style={{ color: '#94A3B8', fontSize: 10, fontWeight: 700, textAlign: 'center' }}>Gula</span>
                <span style={{ color: '#94A3B8', fontSize: 10, fontWeight: 700, textAlign: 'center' }}>Röda</span>
                <span style={{ color: '#94A3B8', fontSize: 10, fontWeight: 700, textAlign: 'right' }}>Snitt</span>
              </div>
              {[...kompaniData].sort((a, b) => b.overall - a.overall).map((k, i) => (
                <div key={k.name} style={{ display: 'grid', gridTemplateColumns: '1fr 56px 56px 56px 60px', padding: '13px 20px', alignItems: 'center', borderBottom: i < kompaniData.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 3, height: 20, background: KOMPANI_COLORS[k.name], borderRadius: 2 }} />
                    <span style={{ color: '#475569', fontSize: 14 }}>{k.name}</span>
                    <StatusBadge status={k.status} size="sm" />
                  </div>
                  <span style={{ color: '#059669', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>{k.green}</span>
                  <span style={{ color: '#D97706', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>{k.yellow}</span>
                  <span style={{ color: '#DC2626', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>{k.red}</span>
                  <span style={{ color: '#0F172A', fontSize: 14, fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{k.overall.toFixed(1)}</span>
                </div>
              ))}
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

function SL({ label }: { label: string }) {
  return <p style={{ color: '#64748B', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 8px 0' }}>{label}</p>;
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

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, Brain, Users, Moon, Utensils, Zap, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import ScoreSlider from '@/components/ScoreSlider';
import { CATEGORIES, Category, CheckIn, getStatus, statusColor } from '@/lib/data';
import { saveCheckIn, getTodayCheckIn, seedMockHistory } from '@/lib/storage';
import { getSession } from '@/lib/auth';
import { generateSoldierAdvice } from '@/lib/advice';
import { getScoresForSoldierCode } from '@/lib/mockData';

const ICONS: Record<string, React.ReactNode> = {
  Activity: <Activity size={20} strokeWidth={1.5} />,
  Brain: <Brain size={20} strokeWidth={1.5} />,
  Users: <Users size={20} strokeWidth={1.5} />,
  Moon: <Moon size={20} strokeWidth={1.5} />,
  Utensils: <Utensils size={20} strokeWidth={1.5} />,
  Zap: <Zap size={20} strokeWidth={1.5} />,
};

const EMPTY: Record<Category, number> = { fysisk: 5, psykisk: 5, social: 5, somn: 5, kost: 5, energi: 5 };

export default function SoldatCheckin() {
  const router = useRouter();
  const [session, setSession] = useState<ReturnType<typeof getSession>>(null);
  const [step, setStep] = useState(-1);
  const [scores, setScores] = useState<Record<Category, number>>(EMPTY);

  useEffect(() => {
    const s = getSession();
    if (!s || s.role !== 'soldat') { router.replace('/'); return; }
    setSession(s);

    // Seed mock history if first visit
    const mockScores = getScoresForSoldierCode(s.code);
    if (mockScores) seedMockHistory(s.code, mockScores);

    const today = getTodayCheckIn(s.code);
    if (today) { router.replace('/soldat/dashboard'); return; }
    setStep(0);
  }, [router]);

  if (!session || step === -1) return <Loading />;

  if (step === 0) {
    return (
      <div style={{ minHeight: '100dvh', background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
        <AppHeader unit={session.unit} code={session.code} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '40px 24px' }}>
          <div style={{ marginBottom: 40 }}>
            <p style={{ color: '#64748B', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0, marginBottom: 8 }}>
              Daglig rapportering
            </p>
            <h1 style={{ color: '#0F172A', fontSize: 22, fontWeight: 700, margin: 0, marginBottom: 12 }}>
              {new Date().toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h1>
            <p style={{ color: '#64748B', fontSize: 14, margin: 0, lineHeight: 1.6 }}>
              Besvara 6 frågor om ditt mående. Tar ungefär 2 minuter.
              Dina svar är anonyma och bidrar till plutonens hälsobild.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 40 }}>
            {CATEGORIES.map((cat, i) => (
              <div key={cat.key} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', background: 'white',
                border: '1px solid #E2E8F0', borderRadius: 6,
              }}>
                <div style={{ color: '#94A3B8' }}>{ICONS[cat.icon]}</div>
                <span style={{ color: '#475569', fontSize: 14 }}>{cat.label}</span>
                <div style={{ marginLeft: 'auto', width: 20, height: 20, borderRadius: '50%', border: '1.5px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#CBD5E1', fontSize: 11 }}>{i + 1}</span>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => setStep(1)}
            style={{
              background: '#0F172A', color: 'white', border: 'none',
              borderRadius: 6, padding: '14px', fontSize: 14,
              fontWeight: 600, cursor: 'pointer', letterSpacing: '0.04em',
            }}
          >
            Starta incheckning
          </button>
        </div>
      </div>
    );
  }

  if (step >= 1 && step <= CATEGORIES.length) {
    const cat = CATEGORIES[step - 1];
    const score = scores[cat.key];
    const status = getStatus(score);
    const color = statusColor(status);
    const progress = step / CATEGORIES.length;

    return (
      <div style={{ minHeight: '100dvh', background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
        <AppHeader unit={session.unit} code={session.code} />

        {/* Progress */}
        <div style={{ background: 'white', padding: '16px 24px', borderBottom: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ color: '#64748B', fontSize: 12, fontWeight: 600 }}>
              Fråga {step} av {CATEGORIES.length}
            </span>
            <span style={{ color: '#94A3B8', fontSize: 12 }}>{Math.round(progress * 100)}%</span>
          </div>
          <div style={{ height: 3, background: '#F1F5F9', borderRadius: 2 }}>
            <div style={{ height: '100%', width: `${progress * 100}%`, background: '#0F172A', borderRadius: 2, transition: 'width 0.25s' }} />
          </div>
        </div>

        <div style={{ flex: 1, padding: '32px 24px', display: 'flex', flexDirection: 'column' }}>
          {/* Category label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ color: '#64748B' }}>{ICONS[cat.icon]}</div>
            <span style={{ color: '#64748B', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {cat.label}
            </span>
          </div>
          <h2 style={{ color: '#0F172A', fontSize: 20, fontWeight: 700, margin: 0, marginBottom: 40 }}>
            {cat.question}
          </h2>

          {/* Score display */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 32 }}>
            <span style={{ color: color, fontSize: 64, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {score}
            </span>
            <span style={{ color: '#94A3B8', fontSize: 20 }}>/10</span>
            <div style={{
              marginLeft: 12,
              background: status === 'green' ? '#ECFDF5' : status === 'yellow' ? '#FFFBEB' : '#FEF2F2',
              color,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.06em',
              padding: '4px 10px',
              borderRadius: 3,
            }}>
              {status === 'green' ? 'GRÖN' : status === 'yellow' ? 'GUL' : 'RÖD'}
            </div>
          </div>

          {/* Slider */}
          <div style={{ marginBottom: 12 }}>
            <ScoreSlider
              value={score}
              color={color}
              onChange={v => setScores(prev => ({ ...prev, [cat.key]: v }))}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
              <span style={{ color: '#DC2626', fontSize: 11, fontWeight: 600 }}>1 — Kritiskt</span>
              <span style={{ color: '#059669', fontSize: 11, fontWeight: 600 }}>10 — Utmärkt</span>
            </div>
          </div>

          {/* Scale markers */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'auto', paddingTop: 4 }}>
            {[1,2,3,4,5,6,7,8,9,10].map(n => (
              <span key={n} style={{
                color: n === score ? '#0F172A' : '#CBD5E1',
                fontSize: 11, fontWeight: n === score ? 700 : 400,
                transition: 'color 0.1s',
              }}>
                {n}
              </span>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div style={{ padding: '16px 24px 32px', display: 'flex', gap: 12 }}>
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            style={{ flex: 1, background: 'white', color: '#475569', border: '1px solid #E2E8F0', borderRadius: 6, padding: '13px', fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <ChevronLeft size={16} /> Tillbaka
          </button>
          <button
            onClick={() => setStep(s => s + 1)}
            style={{ flex: 2, background: '#0F172A', color: 'white', border: 'none', borderRadius: 6, padding: '13px', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, letterSpacing: '0.04em' }}
          >
            {step === CATEGORIES.length ? 'Sammanfattning' : 'Nästa'} <ChevronRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // Summary
  const overallScore = Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length;
  const overallStatus = getStatus(Math.round(overallScore));

  function handleSubmit() {
    const checkIn: CheckIn = {
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      soldierCode: session!.code,
      scores,
      advice: generateSoldierAdvice(scores),
    };
    saveCheckIn(checkIn);
    router.push('/soldat/dashboard');
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
      <AppHeader unit={session.unit} code={session.code} />

      <div style={{ padding: '24px', borderBottom: '1px solid #E2E8F0', background: 'white' }}>
        <p style={{ color: '#64748B', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0, marginBottom: 4 }}>Sammanfattning</p>
        <h2 style={{ color: '#0F172A', fontSize: 20, fontWeight: 700, margin: 0 }}>Bekräfta din incheckning</h2>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {/* Overall */}
        <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 6, padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ color: '#64748B', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0, marginBottom: 4 }}>Samlat mående</p>
              <span style={{ color: '#0F172A', fontSize: 36, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                {overallScore.toFixed(1)}
              </span>
              <span style={{ color: '#94A3B8', fontSize: 16 }}> /10</span>
            </div>
            <div style={{
              background: statusBg2(overallStatus),
              color: statusColor(overallStatus),
              fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
              padding: '6px 14px', borderRadius: 4,
            }}>
              {overallStatus === 'green' ? 'GRÖN' : overallStatus === 'yellow' ? 'GUL' : 'RÖD'}
            </div>
          </div>
        </div>

        {/* Category table */}
        <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 6, overflow: 'hidden', marginBottom: 24 }}>
          {CATEGORIES.map((cat, i) => {
            const s = scores[cat.key];
            const st = getStatus(s);
            return (
              <div
                key={cat.key}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 20px',
                  borderBottom: i < CATEGORIES.length - 1 ? '1px solid #F1F5F9' : 'none',
                  cursor: 'pointer',
                }}
                onClick={() => setStep(i + 1)}
              >
                <div style={{ color: '#94A3B8' }}>{ICONS[cat.icon]}</div>
                <span style={{ color: '#475569', fontSize: 14, flex: 1 }}>{cat.label}</span>
                <span style={{ color: '#0F172A', fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: 28, textAlign: 'right' }}>{s}</span>
                <div style={{
                  background: st === 'green' ? '#ECFDF5' : st === 'yellow' ? '#FFFBEB' : '#FEF2F2',
                  color: statusColor(st),
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                  padding: '2px 7px', borderRadius: 3, minWidth: 40, textAlign: 'center',
                }}>
                  {st === 'green' ? 'GRÖN' : st === 'yellow' ? 'GUL' : 'RÖD'}
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={handleSubmit}
          style={{
            width: '100%', background: '#0F172A', color: 'white', border: 'none',
            borderRadius: 6, padding: '14px', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', letterSpacing: '0.04em',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <Check size={16} /> Bekräfta och skicka
        </button>
        <p style={{ color: '#94A3B8', fontSize: 12, textAlign: 'center', marginTop: 10 }}>
          Dina svar registreras anonymt.
        </p>
      </div>
    </div>
  );
}

function statusBg2(s: ReturnType<typeof getStatus>) {
  return s === 'green' ? '#ECFDF5' : s === 'yellow' ? '#FFFBEB' : '#FEF2F2';
}

function Loading() {
  return (
    <div style={{ minHeight: '100dvh', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 24, height: 24, border: '2px solid #334155', borderTop: '2px solid #94A3B8', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );
}

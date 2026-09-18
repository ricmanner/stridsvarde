'use client';

import { useActionState, useState } from 'react';
import { Activity, Brain, Users, Moon, Utensils, Zap, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import ScoreSlider from '@/components/ScoreSlider';
import { CATEGORIES, type Category, getStatus, statusTextColor } from '@/lib/data';
import { submitCheckIn, type CheckInState } from '@/app/actions/checkin';
import { formatScore } from '@/lib/format';

const ICONS: Record<string, React.ReactNode> = {
  Activity: <Activity size={20} strokeWidth={1.5} />,
  Brain: <Brain size={20} strokeWidth={1.5} />,
  Users: <Users size={20} strokeWidth={1.5} />,
  Moon: <Moon size={20} strokeWidth={1.5} />,
  Utensils: <Utensils size={20} strokeWidth={1.5} />,
  Zap: <Zap size={20} strokeWidth={1.5} />,
};

const EMPTY: Record<Category, number> = { fysisk: 5, psykisk: 5, social: 5, somn: 5, kost: 5, energi: 5 };

interface Props {
  /** Dagens redan sparade svar, när soldaten korrigerar en rapport. */
  initial?: Record<Category, number>;
  editing?: boolean;
  /**
   * Dagens datum som text, färdigformaterat av servern.
   *
   * Räknades tidigare ut här med `new Date().toLocaleDateString('sv-SE', …)`.
   * Det här är en klientkomponent, så den formaterade i WEBBLÄSARENS tidszon:
   * en soldat i en annan zon såg en dag i rubriken medan servern sparade en
   * annan som tjänstedatum. Exakt det fel kodbasen i övrigt är byggd för att
   * omöjliggöra, men flyttat till klienten.
   */
  dateLabel: string;
}

/**
 * Behörighet och "har redan checkat in idag" kontrolleras på servern i
 * page.tsx. Wizarden håller bara svaren medan de fylls i — de sparas till
 * databasen via en Server Action, inte till localStorage.
 */
export default function SoldatCheckin({ initial, editing = false, dateLabel }: Props) {
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState<Record<Category, number>>(initial ?? EMPTY);
  const [state, formAction, pending] = useActionState<CheckInState, FormData>(
    submitCheckIn,
    {},
  );

  if (step === 0) {
    return (
      <div style={{ flex: 1, background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '40px 24px' }}>
          <div style={{ marginBottom: 40 }}>
            <p style={{ color: '#64748B', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0, marginBottom: 8 }}>
              {editing ? 'Korrigera dagens rapport' : 'Daglig rapportering'}
            </p>
            <h1 style={{ color: '#0F172A', fontSize: 22, fontWeight: 700, margin: 0, marginBottom: 12 }}>
              {dateLabel}
            </h1>
            <p style={{ color: '#64748B', fontSize: 14, margin: 0, lineHeight: 1.6 }}>
              {editing
                ? 'Dina tidigare svar är förifyllda. Ändra det som blivit fel — den gamla rapporten skrivs över.'
                : 'Besvara 6 frågor om ditt mående. Tar ungefär 2 minuter. Ditt befäl ser bara sammanställd data för hela gruppen.'}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 40 }}>
            {CATEGORIES.map((cat, i) => (
              <div key={cat.key} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', background: 'white',
                border: '1px solid #E2E8F0', borderRadius: 6,
              }}>
                <div style={{ color: '#64748B' }}>{ICONS[cat.icon]}</div>
                <span style={{ color: '#475569', fontSize: 14 }}>{cat.label}</span>
                <div style={{ marginLeft: 'auto', width: 20, height: 20, borderRadius: '50%', border: '1.5px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#64748B', fontSize: 11 }}>{i + 1}</span>
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
            {editing ? 'Fortsätt' : 'Starta incheckning'}
          </button>
        </div>
      </div>
    );
  }

  if (step >= 1 && step <= CATEGORIES.length) {
    const cat = CATEGORIES[step - 1];
    const score = scores[cat.key];
    const status = getStatus(score);
    const color = statusTextColor(status);
    const progress = step / CATEGORIES.length;

    return (
      <div style={{ flex: 1, background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>

        {/* Progress */}
        <div style={{ background: 'white', padding: '16px 24px', borderBottom: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ color: '#64748B', fontSize: 12, fontWeight: 600 }}>
              Fråga {step} av {CATEGORIES.length}
            </span>
            <span style={{ color: '#64748B', fontSize: 12 }}>{Math.round(progress * 100)}%</span>
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
            <span style={{ color: '#64748B', fontSize: 20 }}>/10</span>
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
              label={cat.question}
              onChange={v => setScores(prev => ({ ...prev, [cat.key]: v }))}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
              <span style={{ color: '#B91C1C', fontSize: 11, fontWeight: 600 }}>1 — Kritiskt</span>
              <span style={{ color: '#047857', fontSize: 11, fontWeight: 600 }}>10 — Utmärkt</span>
            </div>
          </div>

          {/* Scale markers */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'auto', paddingTop: 4 }}>
            {[1,2,3,4,5,6,7,8,9,10].map(n => (
              <span key={n} style={{
                color: n === score ? '#0F172A' : '#64748B',
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
  const overallStatus = getStatus(overallScore);

  return (
    <div style={{ flex: 1, background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>

      <div style={{ padding: '24px', borderBottom: '1px solid #E2E8F0', background: 'white' }}>
        <p style={{ color: '#64748B', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0, marginBottom: 4 }}>Sammanfattning</p>
        <h2 style={{ color: '#0F172A', fontSize: 20, fontWeight: 700, margin: 0 }}>{editing ? 'Bekräfta ändringen' : 'Bekräfta din incheckning'}</h2>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {/* Overall */}
        <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 6, padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ color: '#64748B', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0, marginBottom: 4 }}>Samlat mående</p>
              <span style={{ color: '#0F172A', fontSize: 36, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                {formatScore(overallScore)}
              </span>
              <span style={{ color: '#64748B', fontSize: 16 }}> /10</span>
            </div>
            <div style={{
              background: statusBg2(overallStatus),
              color: statusTextColor(overallStatus),
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
              /*
               * En knapp, inte en div med onClick. Raden gick tidigare bara
               * att nå med mus: den som rättar ett svar med tangentbordet
               * kom inte åt den alls, och en skärmläsare berättade inte att
               * den gick att trycka på.
               */
              <button
                key={cat.key}
                type="button"
                onClick={() => setStep(i + 1)}
                aria-label={`Ändra ${cat.label}, nu ${s} av 10`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  width: '100%', textAlign: 'left',
                  background: 'none', border: 'none',
                  padding: '14px 20px',
                  borderBottom: i < CATEGORIES.length - 1 ? '1px solid #F1F5F9' : 'none',
                  cursor: 'pointer',
                }}
              >
                <div style={{ color: '#64748B' }}>{ICONS[cat.icon]}</div>
                <span style={{ color: '#475569', fontSize: 14, flex: 1 }}>{cat.label}</span>
                <span style={{ color: '#0F172A', fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: 28, textAlign: 'right' }}>{s}</span>
                <div style={{
                  background: st === 'green' ? '#ECFDF5' : st === 'yellow' ? '#FFFBEB' : '#FEF2F2',
                  color: statusTextColor(st),
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                  padding: '2px 7px', borderRadius: 3, minWidth: 40, textAlign: 'center',
                }}>
                  {st === 'green' ? 'GRÖN' : st === 'yellow' ? 'GUL' : 'RÖD'}
                </div>
              </button>
            );
          })}
        </div>

        {/*
          Svaren skickas som ett vanligt formulär till en Server Action.
          Servern validerar varje värde på nytt — klienten är inte betrodd.
        */}
        <form action={formAction}>
          {CATEGORIES.map(cat => (
            <input key={cat.key} type="hidden" name={cat.key} value={scores[cat.key]} />
          ))}

          {state.error && (
            <p role="alert" style={{ color: '#B91C1C', fontSize: 13, marginTop: 0, marginBottom: 12, textAlign: 'center' }}>
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            style={{
              width: '100%', background: pending ? '#CBD5E1' : '#0F172A', color: 'white', border: 'none',
              borderRadius: 6, padding: '14px', fontSize: 14, fontWeight: 600,
              cursor: pending ? 'not-allowed' : 'pointer', letterSpacing: '0.04em',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Check size={16} aria-hidden /> {pending ? 'Sparar…' : editing ? 'Spara ändringen' : 'Bekräfta och skicka'}
          </button>
        </form>
        <p style={{ color: '#64748B', fontSize: 12, textAlign: 'center', marginTop: 10 }}>
          Ditt befäl ser bara sammanställd data för hela gruppen, aldrig dina enskilda svar.
        </p>
      </div>
    </div>
  );
}

function statusBg2(s: ReturnType<typeof getStatus>) {
  return s === 'green' ? '#ECFDF5' : s === 'yellow' ? '#FFFBEB' : '#FEF2F2';
}


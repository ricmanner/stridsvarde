'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, AlertCircle } from 'lucide-react';
import { login, getSession } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (session) {
      redirect(router, session.role);
    }
  }, [router]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const profile = login(code);
    if (!profile) {
      setError('Ogiltig kod. Kontrollera din kod och försök igen.');
      setLoading(false);
      return;
    }
    redirect(router, profile.role);
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ background: '#0F172A', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Shield size={18} color="#94A3B8" strokeWidth={1.5} />
        <span style={{ color: 'white', fontWeight: 700, fontSize: 14, letterSpacing: 1.5 }}>FM – PSVI</span>
      </div>

      {/* Login form */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ width: '100%', maxWidth: 360 }}>

          <div style={{ marginBottom: 40 }}>
            <h1 style={{ color: '#0F172A', fontSize: 24, fontWeight: 700, margin: 0, marginBottom: 8 }}>
              Inloggning
            </h1>
            <p style={{ color: '#64748B', fontSize: 14, margin: 0 }}>
              Ange din personalidentifieringskod för att logga in.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', color: '#475569', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                Personalidentifieringskod
              </label>
              <input
                className="code-input"
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="P1-001"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  border: error ? '1.5px solid #DC2626' : '1.5px solid #E2E8F0',
                  borderRadius: 6,
                  background: 'white',
                  color: '#0F172A',
                  outline: 'none',
                }}
              />
              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <AlertCircle size={14} color="#DC2626" />
                  <span style={{ color: '#DC2626', fontSize: 13 }}>{error}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !code.trim()}
              style={{
                width: '100%',
                background: loading || !code.trim() ? '#CBD5E1' : '#0F172A',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                padding: '14px',
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: '0.04em',
                cursor: loading || !code.trim() ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
              }}
            >
              {loading ? 'Loggar in...' : 'Logga in'}
            </button>
          </form>

          <p style={{ color: '#94A3B8', fontSize: 12, marginTop: 32, textAlign: 'center', lineHeight: 1.6 }}>
            Din kod tillhandahålls av ditt befäl.<br />
            Kontakta plutonsbefälet vid problem.
          </p>

          {/* Demo hint */}
          <div style={{ marginTop: 32, padding: 16, background: '#F1F5F9', borderRadius: 6, border: '1px solid #E2E8F0' }}>
            <p style={{ color: '#64748B', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0, marginBottom: 8 }}>Demokoder</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <DemoRow label="Soldat (Pluton 1–9)" codes="P1-001 · P5-001 · P9-001" />
              <DemoRow label="Plutonsbefäl" codes="BF-P1 · BF-P4 · BF-P7" />
              <DemoRow label="Kompanibefäl" codes="BF-KP · BF-KP2 · BF-KP3" />
              <DemoRow label="Bataljonschef" codes="BF-BAT" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DemoRow({ label, codes }: { label: string; codes: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <span style={{ color: '#64748B', fontSize: 12 }}>{label}</span>
      <span style={{ fontFamily: 'monospace', color: '#0F172A', fontSize: 12 }}>{codes}</span>
    </div>
  );
}

function redirect(router: ReturnType<typeof useRouter>, role: string) {
  if (role === 'soldat') router.replace('/soldat');
  else if (role === 'pluton') router.replace('/pluton');
  else if (role === 'kompani') router.replace('/kompani');
  else router.replace('/bataljon');
}

'use client';

import { useRouter } from 'next/navigation';
import { Shield, LogOut } from 'lucide-react';
import { logout } from '@/lib/auth';

interface Props {
  unit: string;
  code: string;
}

export default function AppHeader({ unit, code }: Props) {
  const router = useRouter();

  function handleLogout() {
    logout();
    router.replace('/');
  }

  return (
    <div style={{
      background: '#0F172A',
      padding: '0 20px',
      height: 52,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexShrink: 0,
    }}>
      <Shield size={16} color="#64748B" strokeWidth={1.5} />
      <span style={{ color: 'white', fontWeight: 700, fontSize: 13, letterSpacing: 1.5, marginRight: 4 }}>FM – PSVI</span>
      <span style={{ color: '#334155', fontSize: 13 }}>|</span>
      <span style={{ color: '#94A3B8', fontSize: 13 }}>{unit}</span>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ color: '#475569', fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.1em' }}>{code}</span>
        <button
          onClick={handleLogout}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: '#64748B', padding: 4 }}
          title="Logga ut"
        >
          <LogOut size={15} />
        </button>
      </div>
    </div>
  );
}

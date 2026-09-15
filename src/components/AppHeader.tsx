import { Shield, LogOut } from 'lucide-react';

import { logoutAction } from '@/app/actions/auth';
import { ROLE_LABEL, type Role } from '@/lib/roles';

interface Props {
  unit: string;
  /** Visningsnamn, t.ex. "Soldat 03". Inloggningskoden visas aldrig — vi
   *  lagrar bara dess hash och kan alltså inte återskapa den. */
  label: string;
  role: Role;
}

/**
 * Server-komponent. Utloggning sker via ett formulär som postar till en
 * Server Action i stället för en onClick-hanterare: det fungerar utan
 * JavaScript och blir en POST, vilket en utloggning måste vara för att inte
 * kunna triggas av en främmande sida.
 */
export default function AppHeader({ unit, label, role }: Props) {
  return (
    <header className="no-print flex h-13 shrink-0 items-center gap-3 bg-slate-900 px-4 py-3 sm:px-6">
      <Shield size={16} className="shrink-0 text-slate-500" strokeWidth={1.5} aria-hidden />
      <span className="shrink-0 text-[13px] font-bold tracking-[1.5px] text-white">
        FM – PSVI
      </span>
      <span className="hidden text-[13px] text-slate-700 sm:inline" aria-hidden>|</span>
      <span className="truncate text-[13px] text-slate-400">{unit}</span>

      <div className="ml-auto flex shrink-0 items-center gap-3">
        <span className="hidden text-[11px] text-slate-500 sm:inline">
          {ROLE_LABEL[role]} · {label}
        </span>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex cursor-pointer items-center gap-1.5 rounded p-1.5 text-slate-500 transition-colors hover:text-slate-300"
            aria-label="Logga ut"
          >
            <LogOut size={15} aria-hidden />
          </button>
        </form>
      </div>
    </header>
  );
}

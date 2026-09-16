import { redirect } from 'next/navigation';
import { Shield } from 'lucide-react';

import LoginForm from '@/app/_components/LoginForm';
import { getSessionUser } from '@/lib/auth/session';
import { environment } from '@/lib/db/client';
import { homeFor } from '@/lib/roles';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  // I Next 16 är searchParams en Promise.
  searchParams: Promise<{ utgangen?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect(homeFor(user.role));

  const { utgangen } = await searchParams;

  /*
   * Demokoderna avgörs på SERVERN och följer bara med till webbläsaren i
   * demoläge. I den gamla demon låg listan hårdkodad i sidan och skickades
   * alltid med — alltså publicerades en lista över giltiga
   * inloggningsuppgifter oavsett vad appen användes till.
   *
   * Villkoret är driftläget, inte NODE_ENV. En demo ÄR driftsatt i
   * produktionsläge; hade vi låst listan till utvecklingsläge hade den aldrig
   * synts för den som fick länken, vilket var hela poängen. Och i pilotläge,
   * där riktiga soldater rapporterar, finns blocket inte alls.
   */
  const demo = environment() === 'demo';

  const demoCodes = demo
    ? [
        { roll: 'Värnpliktig', kod: 'P1G1-01' },
        { roll: 'Plutonchef', kod: 'BEF-P1' },
        { roll: 'Kompanichef', kod: 'BEF-KP1' },
        { roll: 'Bataljonschef', kod: 'BEF-BAT' },
        { roll: 'Administratör', kod: 'ADMIN-01' },
      ]
    : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-3 bg-slate-900 px-5 py-4 sm:px-8">
        <Shield size={18} className="text-slate-400" strokeWidth={1.5} aria-hidden />
        <span className="text-sm font-bold tracking-[1.5px] text-white">FM – PSVI</span>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-10 sm:py-16">
        <div className="w-full max-w-sm">
          <div className="mb-9">
            <h1 className="text-2xl font-bold text-slate-900">Inloggning</h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Ange koden du fått av ditt befäl.
            </p>
          </div>

          <LoginForm expired={utgangen === '1'} />

          <p className="mt-8 text-center text-xs leading-relaxed text-slate-400">
            Din kod tillhandahålls av ditt befäl.
            <br />
            Kontakta plutonsbefälet om du tappat bort den.
          </p>

          {demoCodes && (
            <div className="mt-8 rounded-md border border-slate-200 bg-slate-100 p-4">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                Demokoder
              </p>
              <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
                Logga in med vilken som helst för att se appen ur den rollens
                perspektiv.
              </p>
              <div className="flex flex-col gap-1">
                {demoCodes.map(({ roll, kod }) => (
                  <div key={kod} className="flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-500">{roll}</span>
                    <span className="font-mono text-xs font-semibold text-slate-900">{kod}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 border-t border-slate-200 pt-3 text-[11px] leading-relaxed text-slate-500">
                Dagens rapport är obesvarad för{' '}
                <span className="font-mono text-slate-700">P1G1-01</span> till{' '}
                <span className="font-mono text-slate-700">P1G1-08</span>, så flera
                kan prova incheckningen samtidigt utan att krocka. Övriga soldater
                har redan svarat idag och visar översikten i stället.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

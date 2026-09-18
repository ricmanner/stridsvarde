import { redirect } from 'next/navigation';
import { Shield } from 'lucide-react';

import LoginForm from '@/app/_components/LoginForm';
import { getSessionUser } from '@/lib/auth/session';
import { environment } from '@/lib/db/client';
import { PUBLICERADE_DEMOKODER } from '@/lib/demo';
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
  const demoCodes = environment() === 'demo' ? PUBLICERADE_DEMOKODER : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-3 bg-slate-900 px-5 py-4 sm:px-8">
        <Shield size={18} className="text-slate-400" strokeWidth={1.5} aria-hidden />
        <span className="text-sm font-bold tracking-[1.5px] text-white">FM – PSVI</span>
      </header>

      <main id="innehall" className="flex flex-1 items-center justify-center px-5 py-10 sm:py-16">
        <div className="w-full max-w-sm">
          <div className="mb-9">
            <h1 className="text-2xl font-bold text-slate-900">Inloggning</h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Ange koden du fått av ditt befäl.
            </p>
          </div>

          <LoginForm expired={utgangen === '1'} />

          <p className="mt-8 text-center text-xs leading-relaxed text-slate-500">
            Din kod tillhandahålls av ditt befäl.
            <br />
            Kontakta plutonsbefälet om du tappat bort den.
          </p>

          {demoCodes && (
            <div className="mt-8 rounded-md border border-slate-200 bg-slate-100 p-4">
              {/* Mörkare grå än annars: på den tonade plattan ger slate-500 bara
                  4,34 mot kravet 4,5 — uppmätt av axe. */}
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-600">
                Demokoder
              </p>
              <p className="mb-3 text-[11px] leading-relaxed text-slate-600">
                Logga in med vilken som helst för att se appen ur den rollens
                perspektiv.
              </p>
              <div className="flex flex-col gap-1">
                {demoCodes.map(({ roll, kod }) => (
                  <div key={kod} className="flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-600">{roll}</span>
                    <span className="font-mono text-xs font-semibold text-slate-900">{kod}</span>
                  </div>
                ))}
              </div>
              {/*
                Ingen uppräkning av vilka koder som råkar vara obesvarade. Vilka
                det är ändras så fort någon provar demon, och en sida som lovar
                fel sak är sämre än en som säger hur det fungerar.
              */}
              <p className="mt-3 border-t border-slate-200 pt-3 text-[11px] leading-relaxed text-slate-600">
                Vill du prova själva incheckningen, använd en kod i serien{' '}
                <span className="font-mono text-slate-700">P1G1-01</span> till{' '}
                <span className="font-mono text-slate-700">P1G1-08</span>. Har den
                koden redan rapporterat idag visas översikten i stället — ta då
                nästa kod i ordningen.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

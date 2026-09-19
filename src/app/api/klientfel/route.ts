import type { NextRequest } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import { logError } from '@/lib/db/queries/health';

/**
 * Tar emot fel som inträffat i webbläsaren.
 *
 * `onRequestError` i instrumentation.ts fångar bara serverfel. Kraschade en
 * klientkomponent — en graf på ett oväntat värde, en flik som slutar rendera —
 * fick användaren felrutan medan statussidan fortsatte säga att inga fel
 * inträffat. Administratören såg alltså ingenting medan appen var trasig, och
 * det är precis den sortens fel rundturen finns för att hitta.
 *
 * Kräver inloggning: slutpunkten skriver till databasen, och utan spärr kan
 * vem som helst fylla felloggen med skräp tills den riktiga informationen
 * drunknar.
 *
 * Meddelandet kortas och saneras av logError(). Sidans adress skickas med men
 * frågesträngen kapas där, av samma skäl som för serverfel.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return new Response(null, { status: 204 });

  try {
    const data = (await request.json()) as { path?: unknown; message?: unknown; digest?: unknown };

    await logError({
      path: typeof data.path === 'string' ? data.path : 'okänd sida',
      routeType: 'klient',
      digest: typeof data.digest === 'string' ? data.digest : null,
      message: typeof data.message === 'string' ? data.message : 'okänt klientfel',
    });
  } catch {
    /*
     * Trasig JSON eller en otillgänglig logg. Rapporteringen av ett fel får
     * aldrig bli ett eget fel — sidan som anropar oss visar redan felrutan
     * för användaren och har inget att göra med svaret.
     */
  }

  return new Response(null, { status: 204 });
}

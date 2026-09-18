import { NextResponse, type NextRequest } from 'next/server';

import { SESSION_COOKIE } from '@/lib/auth/constants';

/**
 * Hette `middleware.ts` i tidigare Next-versioner. I Next 16 är filen
 * omdöpt till `proxy.ts` och körs alltid i Node-runtime.
 *
 * VIKTIGT: det här är en bekvämlighet, inte ett säkerhetsskydd.
 *
 * Proxyn tittar bara efter om en sessionscookie *finns* — den läser aldrig
 * databasen. Vem som helst kan sätta `psvi_session=skräp` och ta sig förbi.
 * Varje verklig kontroll sker i `requireRole()` inne i sidan eller
 * Server Action:en, intill datan.
 *
 * Den får inte slå mot databasen heller: proxyn körs på varje request,
 * inklusive förladdningar, och skulle serialisera hela appen mot vår enda
 * databasanslutning.
 */
/*
 * '/api/halsa' är öppen med avsikt: vaktposten som frågar var femtonde minut
 * om appen lever ska inte behöva en nyckel, och svaret innehåller ingenting
 * värt att skydda. Utan undantaget svarade den med en omdirigering till
 * inloggningen, vilket vaktposten läste som "allt är bra".
 */
const PUBLIC_PATHS = new Set(['/', '/ingen-behorighet', '/api/halsa']);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  if (!request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL('/?utgangen=1', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico)$).*)'],
};

import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { LOGG_COOKIE, lika, loggBiljett } from './loggkod';

/**
 * Aktivitetsloggens lås — skilt från inloggningen med flit.
 *
 * Loggen är till för Richard, inte för kollegorna som provar demon. ADMIN-01
 * står på inloggningssidan, så en logg bakom administratörsrollen hade alla
 * kunnat läsa, och den hade känts som övervakning. Nyckeln är därför en egen
 * kod i miljövariabeln LOGG_KOD, satt som hemlighet i Vercel.
 *
 * Inte i databasen: "Återställ demon" tömmer användartabellen, och ett konto
 * där hade försvunnit med den. Inte heller en roll: den som har koden ser
 * loggen och ingenting annat — ingen hälsodata, ingen adminvy.
 *
 * Koden skrivs i det vanliga inloggningsfältet. Är LOGG_KOD inte satt, eller
 * kortare än tio tecken, finns ingen väg in alls.
 */

const TOLV_TIMMAR = 12 * 60 * 60;

export async function oppnaLogg(): Promise<void> {
  const biljett = loggBiljett();
  if (!biljett) return;
  (await cookies()).set(LOGG_COOKIE, biljett, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/logg',
    maxAge: TOLV_TIMMAR,
  });
}

export async function stangLogg(): Promise<void> {
  (await cookies()).delete({ name: LOGG_COOKIE, path: '/logg' });
}

/** Släpper bara fram den som skrivit loggkoden. Alla andra: inloggningen. */
export async function requireLoggatkomst(): Promise<void> {
  const biljett = loggBiljett();
  const kaka = (await cookies()).get(LOGG_COOKIE)?.value ?? '';
  if (!biljett || !lika(kaka, biljett)) redirect('/');
}

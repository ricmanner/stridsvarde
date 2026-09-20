'use server';

import { after } from 'next/server';
import { redirect } from 'next/navigation';

import { generateSoldierAdvice } from '@/lib/advice';
import { requireRole } from '@/lib/auth/guard';
import { CATEGORIES, type Category } from '@/lib/data';
import { evaluateAlerts } from '@/lib/db/queries/alerts';
import { logError } from '@/lib/db/queries/health';
import { saveCheckIn, type Scores } from '@/lib/db/queries/checkins';
import { medTidsgräns, Tidsgränsfel, TIDSGRÄNS_SERVER_MS } from '@/lib/tidsgrans';

export interface CheckInState {
  error?: string;
}

/**
 * Tar emot en incheckning.
 *
 * Börjar med requireRole() — inte för att sidan redan kontrollerat, utan för
 * att Server Actions är POST till den route de används på och kan nås direkt.
 * Enligt Next.js egen dokumentation kan en proxy-matcher tyst hoppa över dem,
 * så varje action måste stå på egna ben.
 */
export async function submitCheckIn(
  _prev: CheckInState,
  formData: FormData,
): Promise<CheckInState> {
  const user = await requireRole('soldat');

  // Värdena kommer från klienten och får aldrig litas på.
  const scores = {} as Scores;
  for (const { key } of CATEGORIES) {
    const raw = Number(formData.get(key));
    if (!Number.isInteger(raw) || raw < 1 || raw > 10) {
      return { error: 'Ogiltigt svar. Ladda om sidan och försök igen.' };
    }
    scores[key as Category] = raw;
  }

  /*
   * Sparandet får en bortre gräns.
   *
   * Utan den väntar servern hur länge som helst på en databas som inte
   * svarar, och den värnpliktige ser "Sparar…" tills hen ger upp och laddar
   * om — varpå sex ifyllda svar är borta. Ett ärligt besked är sämre än ett
   * sparat svar, men vida bättre än ingenting.
   *
   * Bara tidsgränsen fångas här. Ett annat fel, till exempel en trasig
   * SQL-fråga, ska fortsätta upp och bli en riktig felsida: det är ett fel i
   * appen, inte i nätet, och ska inte döljas bakom "försök igen".
   */
  try {
    await medTidsgräns(
      saveCheckIn(user.id, scores, generateSoldierAdvice(scores)),
      TIDSGRÄNS_SERVER_MS,
      'sparandet av incheckningen',
    );
  } catch (fel) {
    if (!(fel instanceof Tidsgränsfel)) throw fel;

    /*
     * Loggas EFTER svaret, inte före. logError() sväljer fel, men den skriver
     * till samma databas som just visat sig hänga — och en try/catch hjälper
     * inte mot något som aldrig svarar. Väntade vi på loggningen skulle den
     * värnpliktige få vänta ytterligare en tidsgräns på att få veta att det
     * inte gick.
     */
    after(async () => {
      await logError({
        path: '/soldat (incheckning)',
        routeType: 'action',
        message: fel.message,
      });
    });

    return {
      error:
        'Det gick inte att spara just nu — servern svarar inte. ' +
        'Dina svar finns kvar. Försök igen om en stund.',
    };
  }

  /*
   * Larmreglerna körs efter att svaret skickats, så soldaten aldrig får vänta
   * på dem. Registreras före redirect() — den kastar, och då hinner inget
   * efter den köras.
   *
   * Egen try/catch: går utvärderingen sönder kan den värnpliktige ändå inte
   * göra något åt det, men befälet får inget larm — och utan raden nedan syns
   * det ingenstans. Ett larm som uteblir tyst är sämre än inget larmsystem,
   * eftersom ingen vet att det inte fungerar.
   */
  after(async () => {
    try {
      await evaluateAlerts(user.unitId);
    } catch (fel) {
      await logError({
        path: '/soldat (larmutvärdering)',
        routeType: 'action',
        message: fel instanceof Error ? fel.message : String(fel),
      });
    }
  });

  redirect('/soldat/dashboard');
}

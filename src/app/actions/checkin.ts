'use server';

import { after } from 'next/server';
import { redirect } from 'next/navigation';

import { generateSoldierAdvice } from '@/lib/advice';
import { requireRole } from '@/lib/auth/guard';
import { CATEGORIES, type Category } from '@/lib/data';
import { evaluateAlerts } from '@/lib/db/queries/alerts';
import { logError } from '@/lib/db/queries/health';
import { saveCheckIn, type Scores } from '@/lib/db/queries/checkins';

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

  await saveCheckIn(user.id, scores, generateSoldierAdvice(scores));

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

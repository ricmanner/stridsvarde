import { halsaFelsvar, health, logError } from '@/lib/db/queries/health';

/**
 * Öppen hälsokontroll: svarar 200 när appen och databasen lever, annars 503.
 *
 * Utan inloggning, med avsikt. En vaktpost ska kunna fråga var femtonde minut
 * utan att någon nyckel behöver ligga i ett schemalagt jobb, och svaret
 * innehåller ingenting värt att skydda — bara att appen svarar.
 *
 * Det gäller också när svaret är nej: se halsaFelsvar() för varför felet
 * stannar i loggen i stället för att följa med ut.
 */
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const svar = await health();
    return Response.json(svar, { headers: { 'Cache-Control': 'no-store' } });
  } catch (fel) {
    /*
     * Loggningen kastar aldrig vidare, men databasen är ju redan trasig — och
     * en hälsokontroll som själv går sönder är värdelös just när den behövs.
     */
    try {
      await logError({
        path: '/api/halsa',
        routeType: 'route',
        message: fel instanceof Error ? fel.message : String(fel),
      });
    } catch {
      /* loggen är otillgänglig av samma skäl som kontrollen misslyckades */
    }

    return Response.json(halsaFelsvar(), {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}

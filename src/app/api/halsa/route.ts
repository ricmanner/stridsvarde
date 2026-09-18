import { health } from '@/lib/db/queries/health';

/**
 * Öppen hälsokontroll: svarar 200 när appen och databasen lever, annars 503.
 *
 * Utan inloggning, med avsikt. En vaktpost ska kunna fråga var femtonde minut
 * utan att någon nyckel behöver ligga i ett schemalagt jobb, och svaret
 * innehåller ingenting värt att skydda — bara att appen svarar.
 */
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const svar = await health();
    return Response.json(svar, { headers: { 'Cache-Control': 'no-store' } });
  } catch (fel) {
    return Response.json(
      { ok: false, fel: fel instanceof Error ? fel.message.slice(0, 120) : 'okänt fel' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

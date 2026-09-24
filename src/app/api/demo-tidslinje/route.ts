import { environment } from '@/lib/db/client';
import { antecknaAutomatiskKorning, applyDemoTimeline } from '@/lib/db/demo-timeline';
import { logError } from '@/lib/db/queries/health';
import { hemligheterLika } from '@/lib/hemlighet';

/**
 * Nattkörningen: flyttar fram demodatans historik så att den slutar idag.
 *
 * Gör exakt det knappen på statussidan gör. Skälet att den också finns som en
 * adress är att demodatan åldras även de dagar ingen loggar in: efter en vecka
 * är befälsvyns förvalda period tom, och den som öppnar länken möter en app som
 * ser trasig ut fast ingenting är fel. Knappen kräver att någon minns.
 *
 * Vercel knackar på adressen varje natt (se `vercel.json`) och skickar då med
 * hemligheten i `CRON_SECRET` som auktorisationsrubrik. Adressen är öppen mot
 * internet — vem som helst kan skriva in den — så den bärs av tre lås:
 *
 *   1. Hemligheten måste finnas. Saknas den STÄNGER dörren i stället för att
 *      falla öppen. En bortglömd inställning ska ge ett nej, aldrig ett ja.
 *   2. Hemligheten måste stämma, jämförd på ett sätt som inte går att gissa
 *      sig fram till tecken för tecken (se lib/hemlighet.ts).
 *   3. Appen måste stå i demoläge. I ett pilottest är incheckningarna riktiga
 *      värnpliktigas och får aldrig få nya datum, hur giltig hemligheten än är.
 *
 * Svaren är avsiktligt ordknappa. Den som knackar utan att vara inbjuden ska
 * inte få veta mer än att det inte gick.
 */
export const dynamic = 'force-dynamic';

/** Kort svar utan detaljer, och utan att hamna i någon cache på vägen. */
function svar(status: number, besked: string): Response {
  return Response.json({ ok: status === 200, besked }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function GET(request: Request): Promise<Response> {
  const hemlighet = process.env.CRON_SECRET ?? '';

  // Lås 1. Loggas inte: adressen är öppen, och den som vill kunde annars fylla
  // felloggen genom att anropa den om och om igen. Statussidan säger i stället
  // till administratören när inställningen saknas.
  if (hemlighet.trim() === '') {
    return svar(503, 'Avstängd.');
  }

  // Lås 2. Vercel skickar värdet med prefixet "Bearer ".
  if (!hemligheterLika(request.headers.get('authorization') ?? '', `Bearer ${hemlighet}`)) {
    return svar(401, 'Obehörig.');
  }

  // Lås 3. Kontrolleras här och inte bara inne i applyDemoTimeline(), som
  // vägrar genom att kasta — ett nej ska vara ett svar, inte ett haveri.
  if (environment() !== 'demo') {
    return svar(403, 'Bara i demoläge.');
  }

  try {
    /*
     * Ofarlig att köra två gånger: har datan redan flyttats idag returnerar
     * applyDemoTimeline() utan att skriva något. Det är ett krav och inte en
     * lyckträff — Vercel lovar inte att en klocka ringer exakt en gång.
     */
    const plan = await applyDemoTimeline();

    // Antecknas även när ingenting behövde göras. Se antecknaAutomatiskKorning().
    await antecknaAutomatiskKorning(plan.dagar);

    return Response.json(
      { ok: true, flyttadeDagar: plan.dagar, historikenSlutar: plan.idag },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (fel) {
    /*
     * Felet stannar i loggen. Här loggas det trots resonemanget vid lås 1 —
     * hit kommer bara den som redan visat rätt hemlighet, så vägen går inte
     * att spamma utifrån.
     */
    await logError({
      path: '/api/demo-tidslinje',
      routeType: 'route',
      message: fel instanceof Error ? fel.message : String(fel),
    });

    return svar(500, 'Framflyttningen misslyckades.');
  }
}

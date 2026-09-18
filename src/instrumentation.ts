import type { Instrumentation } from 'next';

/**
 * Körs en gång när servern startar, innan den tar emot några anrop.
 *
 * Här sker migrationer, pragmas, seed och säkerhetskopiering. Poängen är att
 * ingen request ska behöva betala för uppstarten, och att det inte kan uppstå
 * en kapplöpning där två samtidiga anrop försöker migrera samma databas.
 */
export async function register(): Promise<void> {
  // register() anropas även för andra runtimes; databasen finns bara i Node.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { ensureDb } = await import('./lib/db');
  await ensureDb();

  // Koder lagras bara som hash och kan aldrig läsas ut igen. Blir
  // administratören utelåst är skriptet enda vägen tillbaka — då ska man
  // inte behöva leta efter det.
  if (process.env.NODE_ENV !== 'production') {
    console.log('  Utelåst som admin?  npm run aterstall-admin\n');
  }
}

/**
 * Fångar serverfel och skriver dem till appens egen databas.
 *
 * Utan det här märks ett fel bara av den som råkar stå framför skärmen. Med
 * det kan en administratör se på statussidan att något gått sönder, och
 * vaktposten i GitHub kan larma när appen slutar svara.
 *
 * Loggen får bara veta VAR felet inträffade och vad det stod. Inga rubriker,
 * inga parametrar, ingenting om vem som var inloggad — se logError().
 */
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context,
) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { logError } = await import('./lib/db/queries/health');
  await logError({
    path: request.path,
    routeType: context.routeType,
    digest: typeof err === 'object' && err && 'digest' in err ? String(err.digest) : null,
    message: err instanceof Error ? err.message : String(err),
  });
};

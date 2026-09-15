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

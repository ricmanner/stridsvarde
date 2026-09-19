/**
 * Ingen väg in i appen utan behörighetskontroll.
 *
 * Kontrollerna finns i dag på varje sida, varje server action och exporten.
 * Det här testet läser koden och kräver att det förblir så. Skälet är att en
 * glömd kontroll inte går sönder på något synligt sätt: sidan fungerar, den
 * visar bara data för fel person. Ett nytt filnamn i app-katalogen utan
 * kontroll ska stoppa bygget i stället för att upptäckas av en utomstående.
 *
 * Undantagen nedan är medvetna och få: inloggningssidan, sidan som säger att
 * man saknar behörighet, och inloggningens egna actions.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const APP = path.resolve(import.meta.dirname, '..', 'src', 'app');

const UTAN_KRAV = new Set([
  'page.tsx', // inloggningen
  'layout.tsx',
  path.join('ingen-behorighet', 'page.tsx'),
  path.join('actions', 'auth.ts'), // logga in och logga ut
  // Felsidorna visar ingen data alls — bara ett besked och en väg vidare.
  // Kräver de inloggning möter en utloggad användare en tom skärm.
  'error.tsx',
  'global-error.tsx',
  'not-found.tsx',
  // Hälsokontrollen är öppen med avsikt: en vaktpost ska kunna fråga om
  // appen lever utan nyckel, och svaret innehåller inget att skydda.
  path.join('api', 'halsa', 'route.ts'),
]);

/**
 * En kontroll räknas om filen kräver roll, kräver inloggning, ärver skalet,
 * eller läser sessionen själv.
 *
 * Det sista gäller `api/klientfel`: den tar emot felrapporter från
 * webbläsaren och svarar 204 för den som inte är inloggad, i stället för att
 * skicka vidare till inloggningen. En sida som redan visar felrutan ska inte
 * få en omdirigering tillbaka i ansiktet — men obehöriga får fortfarande
 * ingenting skrivet till loggen.
 */
const KONTROLL = /requireRole\(|requireUser\(|getSessionUser\(|LeaderPageShell/;

function filer(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? filer(p) : [p];
  });
}

test('varje sida och varje route kräver inloggning', () => {
  const sidor = filer(APP).filter((f) => /(page|route|layout)\.tsx?$/.test(f));
  assert.ok(sidor.length >= 10, 'hittade sidorna att granska');

  const oskyddade = sidor.filter((f) => {
    const rel = path.relative(APP, f);
    return !UTAN_KRAV.has(rel) && !KONTROLL.test(readFileSync(f, 'utf8'));
  });

  assert.deepEqual(oskyddade.map((f) => path.relative(APP, f)), [], 'sidor utan behörighetskontroll');
});

test('varje server action börjar med en behörighetskontroll', () => {
  const actionFiler = filer(path.join(APP, 'actions')).filter((f) => f.endsWith('.ts'));
  assert.ok(actionFiler.length >= 3);

  const brister = [];
  for (const fil of actionFiler) {
    if (UTAN_KRAV.has(path.relative(APP, fil))) continue;
    const kod = readFileSync(fil, 'utf8');

    // Dela upp filen vid varje exporterad funktion och granska varje kropp
    // för sig — en kontroll i den första funktionen skyddar inte den andra.
    const delar = kod.split(/(?=export async function )/).slice(1);
    for (const del of delar) {
      const namn = del.match(/export async function (\w+)/)?.[1];
      if (!KONTROLL.test(del)) brister.push(`${path.basename(fil)}: ${namn}`);
    }
  }

  assert.deepEqual(brister, [], 'server actions utan behörighetskontroll');
});

test('befälsvyerna hämtar enheten ur sessionen, inte ur adressfältet', () => {
  /*
   * Den vanligaste läckan i den här sortens system: ett id i URL:en som ingen
   * kontrollerar, så att ett befäl kan byta siffra och läsa en annan enhets
   * hälsodata. Angreppsytan ska inte finnas alls.
   */
  const shell = readFileSync(
    path.join(APP, '..', 'components', 'leader', 'LeaderPageShell.tsx'),
    'utf8',
  );
  assert.ok(/session\.unitId/.test(shell), 'enheten kommer ur sessionen');
  assert.ok(!/searchParams.*unit|params\.unit/.test(shell), 'ingen enhet ur adressfältet');

  const exportRoute = readFileSync(path.join(APP, 'api', 'export', 'route.ts'), 'utf8');
  assert.ok(/session\.unitId/.test(exportRoute), 'exporten utgår från sessionens enhet');
  assert.ok(
    !/searchParams\.get\('enhet'\)|searchParams\.get\("unit"\)/.test(exportRoute),
    'exporten tar inte emot en enhet utifrån',
  );
});

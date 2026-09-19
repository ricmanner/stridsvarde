import 'server-only';

import fs from 'node:fs';
import path from 'node:path';

import * as schema from './schema';

/*
 * Databasanslutning — lokal fil eller fjärrdatabas, samma frågor.
 *
 * libSQL valdes framför better-sqlite3 just för det här: en fjärrdatabas
 * (Turso) talar samma protokoll, så inte en enda SQL-fråga i appen behöver
 * skrivas om när den flyttar ut. Det som skiljer är anslutningen och några
 * saker som bara är meningsfulla mot en fil på disk.
 *
 * Varför en fjärrdatabas alls behövs: Netlify och liknande kör serverlöst med
 * ett flyktigt filsystem. En SQLite-fil där töms mellan anrop och delas inte
 * mellan dem — varje förfrågan skulle i praktiken få en egen tom databas,
 * utan att något ser trasigt ut förrän någon försöker logga in.
 */

/** Sant när vi kör mot en fjärrdatabas i stället för en fil på disk. */
export const isRemote = Boolean(process.env.DATABASE_URL?.startsWith('libsql://'));

function resolveDbPath(): string {
  const configured = process.env.DATABASE_PATH ?? './data/psvi.db';
  return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
}

export const dbPath = isRemote ? (process.env.DATABASE_URL as string) : resolveDbPath();

if (!isRemote) fs.mkdirSync(path.dirname(dbPath), { recursive: true });

/*
 * Klient och drivrutin väljs vid körning i stället för med vanliga importer.
 *
 * Standardingången till `@libsql/client` importerar `libsql` — ett
 * native-bibliotek för inbäddad SQLite som finns i en variant per plattform.
 * Vi bygger på macOS och Netlify kör Linux, så binären som följer med bygget
 * är fel plattform. Funktionen dog på `Cannot find module
 * '@libsql/linux-x64-gnu'` redan när modulen laddades, långt innan någon av
 * våra rader kördes.
 *
 * Mot en fjärrdatabas behövs den binären aldrig: där talar vi bara HTTP.
 * `/web`-ingångarna är samma klient och samma drivrutin utan native-delen,
 * och de klarar även transaktioner.
 *
 * Båda måste bytas, inte bara klienten: `drizzle-orm/libsql` importerar
 * `@libsql/client` på sin första rad. Att bara byta vår egen import räckte
 * inte — drivrutinen drog in native-varianten ändå.
 *
 * Importerna måste vara dynamiska. En vanlig `import` körs alltid, oavsett
 * vilken gren koden sedan tar, och det är själva laddningen som kraschar.
 */
type ClientModule = typeof import('@libsql/client');
type DriverModule = typeof import('drizzle-orm/libsql');

const [{ createClient }, { drizzle }] = isRemote
  ? ((await Promise.all([
      import('@libsql/client/web'),
      import('drizzle-orm/libsql/web'),
    ])) as unknown as [ClientModule, DriverModule])
  : ((await Promise.all([
      import('@libsql/client'),
      import('drizzle-orm/libsql'),
    ])) as unknown as [ClientModule, DriverModule]);

export const client = isRemote
  ? createClient({
      url: process.env.DATABASE_URL as string,
      authToken: process.env.DATABASE_AUTH_TOKEN,
    })
  : createClient({
      url: `file:${dbPath}`,
      /**
       * EN anslutning, inte den förvalda poolen om 20.
       *
       * Gäller bara lokal fil. libSQL öppnar annars flera oberoende
       * anslutningar, och pragmas som `foreign_keys` gäller *per anslutning*.
       * Ett `PRAGMA foreign_keys = ON` skulle då träffa en enda slumpmässig
       * anslutning medan resten körde utan referensintegritet — tyst, och
       * omöjligt att upptäcka i efterhand.
       *
       * Mot en fjärrdatabas vore samma inställning bara en flaskhals: där
       * sköts både integritet och samtidighet på serversidan.
       */
      concurrency: 1,
    });

export const db = drizzle(client, { schema });

/**
 * Pragmas som bara är meningsfulla mot en lokal fil.
 *
 * WAL och journalläge är egenskaper hos filen; foreign_keys sätts per
 * anslutning. En fjärrdatabas sköter båda själv, och att skicka dit dem vore
 * i bästa fall verkningslöst.
 *
 * Kastar om referensintegriteten inte gick att slå på. Att starta en server
 * med hälsodata och tyst avstängda foreign keys är inte acceptabelt.
 */
export async function applyPragmas(): Promise<void> {
  if (isRemote) return;

  await client.execute('PRAGMA journal_mode = WAL'); // sparas i filen
  await client.execute('PRAGMA foreign_keys = ON'); // per anslutning
  await client.execute('PRAGMA busy_timeout = 5000');
  await client.execute('PRAGMA synchronous = NORMAL');

  const check = await client.execute('PRAGMA foreign_keys');
  const on = Number((check.rows[0] as Record<string, unknown>)?.foreign_keys) === 1;
  if (!on) {
    throw new Error(
      'Kunde inte aktivera foreign keys. Startar inte med oskyddad referensintegritet.',
    );
  }
}

/*
 * Driftläge.
 *
 * En DEMO och ett PILOTTEST är inte samma sak och får inte behandlas lika.
 *
 *   demo   — seedad organisation, kända koder, ingen verklig person berörs.
 *            Visar en tydlig banner så att ingen kan missta den för skarp.
 *   pilot  — riktiga soldater. Ingen demodata, inga kända koder, gallring
 *            och lagringstid enligt beslut.
 *
 * Skyddet mot att råka köra demodata skarpt finns kvar: `pilot` vägrar starta
 * om seedning är påslagen eller om en känd demokod ligger i databasen.
 */
export type Environment = 'demo' | 'pilot';

export function environment(): Environment {
  return process.env.PSVI_ENVIRONMENT === 'demo' ? 'demo' : 'pilot';
}

/** Seedar demodata (organisation + påhittad historik) endast när påslaget. */
export function isSeedDemoData(): boolean {
  return process.env.SEED_DEMO_DATA === 'true';
}

/**
 * Minsta antal svar innan ett aggregat får visas för befäl.
 *
 * Har en grupp bara ett svar *är* gruppens medelvärde den individens
 * hälsodata. Tröskeln tillämpas i SQL, inte i gränssnittet — servern skickar
 * aldrig ut siffran.
 *
 * Standard 4 snarare än 3: vid tre svar avslöjar färgräkningen i praktiken
 * allt. "0 gröna, 0 gula, 3 röda" talar om exakt hur var och en mår, och ett
 * befäl känner sin egen grupp. Golvet på 3 går inte att konfigurera bort.
 */
export function minResponders(): number {
  const raw = Number(process.env.MIN_RESPONDERS);
  return Number.isFinite(raw) ? Math.max(3, Math.floor(raw)) : 4;
}

/**
 * Databasens adress, så som statussidan får visa den.
 *
 * I demoläge står administratörskoden på inloggningssidan — med flit, vem som
 * helst ska kunna prova appen som administratör. Följden är att statussidan i
 * praktiken är offentlig, och där stod hela adressen till fjärrdatabasen:
 * värdnamn, region och kontonamn. Det är färdig spaning åt den som vill
 * angripa databasen; bara nyckeln återstår. En lokal sökväg är inte bättre —
 * den bär användarnamnet på maskinen.
 *
 * Sorten syns fortfarande, för det är den som betyder något vid felsökning:
 * kör appen mot den delade databasen eller mot en fil? I pilotläge finns
 * ingen publicerad kod och administratören är en betrodd person — då visas
 * adressen som den är.
 */
export function dbAdressFörVisning(path: string, demo: boolean): string {
  if (!demo) return path;
  return path.startsWith('libsql://') ? 'Fjärrdatabas (adressen dold i demoläge)' : 'Lokal fil';
}

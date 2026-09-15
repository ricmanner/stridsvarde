import 'server-only';

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

import * as schema from './schema';

/**
 * Lokal SQLite-fil via libSQL.
 *
 * libSQL används framför better-sqlite3 för att samma kod ska kunna peka mot
 * en fjärrdatabas (Turso) senare genom att bara byta URL — utan att någon
 * fråga i appen skrivs om.
 */
function resolveDbPath(): string {
  const configured = process.env.DATABASE_PATH ?? './data/psvi.db';
  return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
}

export const dbPath = resolveDbPath();

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const client = createClient({
  url: `file:${dbPath}`,
  /**
   * EN anslutning, inte den förvalda poolen om 20.
   *
   * libSQL öppnar annars flera oberoende anslutningar, och pragmas som
   * `foreign_keys` gäller *per anslutning*. Ett `PRAGMA foreign_keys = ON`
   * skulle då träffa en enda slumpmässig anslutning medan resten körde utan
   * referensintegritet — tyst, och omöjligt att upptäcka i efterhand.
   *
   * Med en anslutning blir pragmas deterministiska och SQLITE_BUSY
   * strukturellt omöjligt. För ett par hundra användare mot en lokal fil är
   * varje fråga ändå en bråkdel av en millisekund. Det här är raden att ändra
   * den dag databasen flyttar till en riktig server.
   */
  concurrency: 1,
});

export const db = drizzle(client, { schema });

/**
 * SQLite har foreign keys AVSTÄNGDA som standard (libSQL har dem på, men det
 * är inget vi vill förlita oss på). WAL ger samtidiga läsare medan någon
 * skriver — precis vad en pluton som checkar in samtidigt behöver.
 *
 * Kastar om referensintegriteten inte gick att slå på. Att starta en server
 * med hälsodata och tyst avstängda foreign keys är inte acceptabelt.
 */
export async function applyPragmas(): Promise<void> {
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

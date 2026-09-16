import 'server-only';

import fs from 'node:fs';
import path from 'node:path';

import { serviceDate } from '../date';
import { client, dbPath, isRemote } from './client';

const KEEP_DAYS = 14;

/**
 * Daglig säkerhetskopia via `VACUUM INTO`.
 *
 * Hela systemet är en enda fil. Ett felaktigt `rm` raderar varenda
 * hälsorapport utan möjlighet till återställning. `VACUUM INTO` är atomiskt
 * och säkert att köra mot en databas som används, till skillnad från att
 * kopiera filen medan WAL-loggen skrivs.
 */
export async function backupIfNeeded(): Promise<void> {
  /*
   * Bara mot en lokal fil. `VACUUM INTO` skriver till serverns eget
   * filsystem — på en serverlös värd är det flyktigt, och mot en
   * fjärrdatabas finns ingen disk att skriva till. Den som driver en
   * fjärrdatabas sköter säkerhetskopiorna där i stället, och det är ett
   * krav att kontrollera innan skarp drift.
   */
  if (isRemote) return;

  const dir = path.join(path.dirname(dbPath), 'backups');
  fs.mkdirSync(dir, { recursive: true });

  const target = path.join(dir, `psvi-${serviceDate()}.db`);
  if (fs.existsSync(target)) return; // redan säkerhetskopierad idag

  try {
    // VACUUM INTO tar ett uttryck; enkelfnuttar escapas genom fördubbling.
    await client.execute(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
    prune(dir);
  } catch (err) {
    // En misslyckad säkerhetskopia får aldrig hindra servern från att starta.
    console.warn('[db] Säkerhetskopiering misslyckades:', err);
  }
}

function prune(dir: string): void {
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^psvi-\d{4}-\d{2}-\d{2}\.db$/.test(f))
    .sort()
    .reverse();

  for (const stale of files.slice(KEEP_DAYS)) {
    fs.rmSync(path.join(dir, stale), { force: true });
  }
}

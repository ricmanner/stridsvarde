import 'server-only';

import { timingSafeEqual } from 'node:crypto';

import { hashCode, normalizeCode } from './codes';

/**
 * Loggkoden känns igen här, utan Next-importer — så att testerna kan köra
 * den. Kakan och omdirigeringen ligger i logg.ts. Varför loggen har ett eget
 * lås står där.
 */

export const LOGG_COOKIE = 'psvi_logg';

function loggkod(): string | null {
  const kod = normalizeCode(process.env.LOGG_KOD ?? '');
  return kod.length >= 10 ? kod : null;
}

export function lika(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Om det inskrivna är loggkoden. Jämförs som hash, på konstant tid. */
export function arLoggkod(inskrivet: string): boolean {
  const kod = loggkod();
  if (!kod || normalizeCode(inskrivet).length === 0) return false;
  return lika(hashCode(inskrivet), hashCode(kod));
}

/**
 * Det kakan bär: en hash av koden, inte koden. Byts LOGG_KOD i Vercel slutar
 * alla gamla kakor gälla direkt, utan någon lista att rensa.
 */
export function loggBiljett(): string | null {
  const kod = loggkod();
  return kod ? hashCode(`LOGGBILJETT${kod}`) : null;
}


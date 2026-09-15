import 'server-only';

import { createHmac, randomInt } from 'node:crypto';

/**
 * Inloggningskoder.
 *
 * Demon använde koder som `P1-001` och `BF-BAT`. De var läsbara men också
 * trivialt gissningsbara — vem som helst kunde skriva `BF-BAT` och bli
 * bataljonschef. För riktig hälsodata duger det inte.
 *
 * Här genereras koderna slumpmässigt ur ett alfabet utan tecken som kan
 * förväxlas när någon läser en utskriven lapp: inga I, L, O, 0 eller 1.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 31 tecken
const CODE_LENGTH = 10; // 31^10 ≈ 8,2 × 10^14 möjliga koder

/** Genererar en ny kod, formaterad som ABCDE-FGHJK. */
export function generateCode(): string {
  let raw = '';
  // randomInt är kryptografiskt säker och fri från modulo-bias.
  for (let i = 0; i < CODE_LENGTH; i++) raw += ALPHABET[randomInt(ALPHABET.length)];
  return format(raw);
}

/** ABCDEFGHJK → ABCDE-FGHJK */
export function format(raw: string): string {
  const half = Math.ceil(raw.length / 2);
  return `${raw.slice(0, half)}-${raw.slice(half)}`;
}

/**
 * Normaliserar användarens inmatning så att bindestreck, mellanslag och
 * gemener inte spelar någon roll. "abcde-fghjk" och "ABCDEFGHJK" är samma kod.
 */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Hemlig serversträng som blandas in i hashen.
 *
 * Utan den skulle någon som kommer över databasfilen kunna förberäkna
 * hasharna för alla möjliga koder. Pepparn ligger bara i .env, så en stulen
 * databasfil är ensam värdelös.
 */
function pepper(): string {
  const p = process.env.AUTH_PEPPER;
  if (p && p.length >= 32) return p;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'AUTH_PEPPER saknas eller är för kort. Generera en med: openssl rand -hex 32',
    );
  }
  console.warn('[auth] AUTH_PEPPER saknas — använder utvecklingsvärde. Sätt den i .env.');
  return 'utveckling-endast-inte-for-skarp-drift';
}

/**
 * HMAC-SHA256 med pepparn som nyckel. Koden i klartext lagras aldrig.
 *
 * HMAC framför `sha256(peppar + kod)`: den senare är en "prefix-MAC" som är
 * sårbar för längdförlängning. Inte utnyttjbart här, men HMAC är den korrekta
 * konstruktionen för en nycklad hash och kostar ingenting extra.
 *
 * Deterministisk (ingen slumpsalt) så att inloggning blir en enda indexsökning
 * i stället för en genomsökning av alla användare. Det är tryggt eftersom
 * koderna har hög entropi — det finns ingen ordlista att angripa med.
 */
export function hashCode(code: string): string {
  return createHmac('sha256', pepper()).update(normalizeCode(code)).digest('hex');
}

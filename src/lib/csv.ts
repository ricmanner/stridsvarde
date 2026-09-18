/**
 * CSV för svenska Excel.
 *
 * Tre saker måste stämma, annars blir filen oanvändbar:
 *  - BOM först, annars tolkas UTF-8 som Latin-1 och varje å, ä och ö blir skräp
 *  - semikolon som avgränsare, eftersom svensk Excel använder komma som
 *    decimaltecken och därför inte kan använda det för att skilja kolumner
 *  - CRLF som radbrytning
 */

import { formatScore } from './format';

const BOM = '﻿';
const SEP = ';';
const EOL = '\r\n';

/**
 * Escapar ett fält.
 *
 * Fält som börjar med =, +, - eller @ prefixas med apostrof. Excel tolkar
 * annars innehållet som en formel, vilket är en känd angreppsväg (CSV
 * injection) — ett enhetsnamn som någon döpt till "=HYPERLINK(...)" ska inte
 * kunna köras när befälet öppnar filen.
 */
function cell(value: string | number | null): string {
  if (value === null) return '';

  let s = String(value);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;

  // Decimalkomma, inte punkt.
  if (typeof value === 'number') s = s.replace('.', ',');

  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(
  headers: string[],
  rows: Array<Array<string | number | null>>,
): string {
  const lines = [headers.map(cell).join(SEP), ...rows.map((r) => r.map(cell).join(SEP))];
  return BOM + lines.join(EOL) + EOL;
}

/**
 * Ett poängvärde till en cell.
 *
 * Aggregaten räknas med full precision — rätt för beräkningen, men i filen
 * blev ett snitt "6,043478260869565". Befälet som öppnar den i Excel ska se
 * samma siffra som i vyn: 6,0. Undanhållna värden blir tomma fält, inte
 * nollor, eftersom en nolla skulle läsas som ett uselt resultat.
 */
export function scoreCell(value: number | null | undefined): string | null {
  return value === null || value === undefined ? null : formatScore(value);
}

/** Filnamn utan tecken som strular i Windows eller macOS. */
export function safeFilename(parts: string[]): string {
  return parts
    .join('-')
    .replace(/[^\p{L}\p{N}\-_.]/gu, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}

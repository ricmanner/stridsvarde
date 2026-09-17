/**
 * Förslag på namn för en ny underenhet i adminvyn.
 *
 * Klientsäker och ren — inga serverimporter, ingen databas — så den kan
 * användas direkt i formuläret och testas utan uppsättning.
 *
 * Tidigare var förslaget hårdkodat: alltid "Pluton 10", "Grupp 4" och
 * "4. Kompaniet", oavsett vad som redan fanns. Ett kompani med tre plutoner
 * föreslog Pluton 10, och en nyskapad tom pluton föreslog Grupp 4.
 */

export type ChildKind = 'kompani' | 'pluton' | 'grupp';

function format(kind: ChildKind, n: number): string {
  if (kind === 'kompani') return `${n}. Kompaniet`;
  return `${kind === 'pluton' ? 'Pluton' : 'Grupp'} ${n}`;
}

/**
 * Nästa nummer efter det högsta som redan finns bland syskonen.
 *
 * Utgår från syskonens namn, inte deras antal. Demon numrerar plutonerna över
 * hela bataljonen — 2. Kompaniet har Pluton 4, 5 och 6 — så "antal plus ett"
 * hade föreslagit Pluton 4 där, ett namn som redan finns. Nästa efter det
 * högsta ger Pluton 4 i ett kompani med 1–3, Pluton 7 i ett med 4–6, och
 * Pluton 1 eller Grupp 1 i en helt tom enhet.
 *
 * Föreslår aldrig ett namn som redan är taget. Jämförelsen struntar i stora
 * och små bokstäver: "pluton 4" och "Pluton 4" är samma sak för den som läser
 * listan, även om databasen skulle godta båda.
 */
export function suggestChildName(kind: ChildKind, siblingNames: readonly string[]): string {
  const taget = new Set(siblingNames.map((n) => n.trim().toLocaleLowerCase('sv-SE')));

  const nummer = siblingNames
    .map((n) => n.match(/\d+/)?.[0])
    .filter((n): n is string => n !== undefined)
    .map(Number);

  let n = nummer.length > 0 ? Math.max(...nummer) + 1 : 1;
  while (taget.has(format(kind, n).toLocaleLowerCase('sv-SE'))) n++;

  return format(kind, n);
}

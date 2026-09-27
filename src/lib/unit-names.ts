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

import type { UnitKind } from './db/queries/admin';

export type ChildKind = 'kompani' | 'pluton' | 'grupp';

/*
 * Som Försvarsmakten skriver förband: siffra med punkt före ordet, numrerat
 * inom närmast högre förband — "1. plut/1. komp", "1. grp/1. plut" (FAL-A,
 * FM2019-26245:1, 2020-04-22). Obestämd form — "1. pluton", inte
 * "1. plutonen" — på Richards beslut; beslutet självt visar bara förkortningar.
 * Appen skrev tidigare "Pluton 4" och "Grupp 1" men "1. Kompaniet".
 */
const ORD: Record<ChildKind, string> = { kompani: 'kompani', pluton: 'pluton', grupp: 'grupp' };

function format(kind: ChildKind, n: number): string {
  return `${n}. ${ORD[kind]}`;
}

/**
 * Nästa nummer efter det högsta som redan finns bland syskonen.
 *
 * Utgår från syskonens namn, inte deras antal: har någon raderat 2. pluton
 * i ett kompani med tre, hade "antal plus ett" föreslagit 3. pluton — ett
 * namn som redan finns. Nästa efter det högsta ger 4. pluton där, och
 * 1. pluton eller 1. grupp i en helt tom enhet. Namn i det äldre
 * skrivsättet ("Pluton 3") räknas också, eftersom bara siffran läses.
 *
 * Föreslår aldrig ett namn som redan är taget. Jämförelsen struntar i stora
 * och små bokstäver: "4. Pluton" och "4. pluton" är samma sak för den som läser
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

/**
 * Ordet för en nivå: "kompaninivå", inte "kompanisnivå".
 *
 * Orden stod tidigare inte någonstans — de byggdes av enhetens sort plus
 * "snivå" där de behövdes. Det blir rätt för bataljon och pluton och fel för
 * de andra två: svenskan tar inget foge-s i kompaninivå eller gruppnivå, lika
 * lite som i kompanichef eller gruppchef.
 *
 * Följden var att appen motsade sig själv. Kompanichefens egen vy hade
 * rubriken "Kompaninivå" medan adminvyn skrev "kompanisnivå" om samma enhet.
 * Därför hämtar båda numera ordet härifrån — en stavning som bara finns på
 * ett ställe kan inte glida isär.
 *
 * Typen importeras bara som typ, så den här filen förblir klientsäker:
 * `import type` finns inte kvar efter kompileringen och drar alltså inte in
 * någon serverkod.
 */
export const NIVÅORD: Record<UnitKind, string> = {
  bataljon: 'bataljonsnivå',
  kompani: 'kompaninivå',
  pluton: 'plutonsnivå',
  grupp: 'gruppnivå',
};

/**
 * Böjda ordformer per enhetssort.
 *
 * Kompani är ett neutrum bland tre utrum: ett kompani, kompaniet är tomt, det
 * raderas — medan bataljon, pluton och grupp tar en, tom och den. Byggs en
 * mening av sorten plus ett böjt ord blir den alltså fel för kompani var gång.
 * Det hände på tre ställen: "Ny kompani under Bataljonen" i adminvyn, "Jämför
 * en kompani med hela enheten" i bataljonschefens vy, och "Kompaniet är tom.
 * Den tas bort permanent." i raderingsrutan.
 *
 * Samma fel och samma lösning som NIVÅORD ovan: formerna står på ett ställe,
 * och en ny enhetssort tvingas fylla i sina av TypeScript.
 */
const NEUTRUM: Record<UnitKind, boolean> = {
  bataljon: false,
  kompani: true,
  pluton: false,
  grupp: false,
};

export interface Ordformer {
  /** Obestämd artikel: "en pluton", "ett kompani". */
  artikel: 'en' | 'ett';
  /** Adjektivet ny, som rubrik: "Ny grupp", "Nytt kompani". */
  ny: 'Ny' | 'Nytt';
  /** "enheten är tom", "kompaniet är tomt". */
  tom: 'tom' | 'tomt';
  /** "allt som ligger under den", "allt som ligger under det". */
  pronomen: 'den' | 'det';
}

export function ordformer(sort: UnitKind): Ordformer {
  return NEUTRUM[sort]
    ? { artikel: 'ett', ny: 'Nytt', tom: 'tomt', pronomen: 'det' }
    : { artikel: 'en', ny: 'Ny', tom: 'tom', pronomen: 'den' };
}

/** Samma ord med versal, som rubrik: "Kompaninivå". */
export function nivåRubrik(sort: UnitKind): string {
  const ord = NIVÅORD[sort];
  return ord.charAt(0).toUpperCase() + ord.slice(1);
}

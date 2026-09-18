/**
 * Vilken kodlapp som ska visas i adminvyn — och när den ska försvinna.
 *
 * Ligger här, utanför komponenten, för att kunna testas. Utan test smög sig
 * följande fel in och överlevde: lappen identifierades med LÄNGDEN på den
 * sammanslagna kodsträngen i stället för strängen själv. Varje kod är exakt
 * elva tecken och "byt kod" ger alltid precis en, så två utfärdanden i rad i
 * samma enhet gav samma längd. Den andra lappen visades därför aldrig —
 * medan servern redan hade bytt kod. Personen blev utelåst, och koden går
 * inte att återskapa, eftersom bara hashen sparas.
 */

export interface UtfardadKod {
  label: string;
  code: string;
}

/** Identiteten på en uppsättning nyutfärdade koder. */
export function kodnyckel(koder: readonly UtfardadKod[] | null | undefined): string {
  return (koder ?? []).map((k) => k.code).join('|');
}

/**
 * Ska lappen visas?
 *
 * `stangd` är nyckeln för den lapp administratören senast stängde. Nya koder
 * ger en ny nyckel, och lappen visas igen — även om antalet koder råkar vara
 * detsamma som förra gången.
 */
export function visaKodlapp(
  koder: readonly UtfardadKod[] | null | undefined,
  stangd: string,
): boolean {
  const nyckel = kodnyckel(koder);
  return nyckel !== '' && nyckel !== stangd;
}

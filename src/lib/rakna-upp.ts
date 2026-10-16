/**
 * Värdet vid tiden `t` (0–1) när ett nyckeltal räknas upp från noll.
 *
 * Kurvan bromsar in mot slutet (ease-out, kubisk), så att det sista ögat
 * ser före vila är talet självt. Värdet avrundas till lika många decimaler
 * som det färdiga talet: 4,7 räknas 0,0 … 4,7, aldrig 4,6999.
 *
 * Används av befälsvyns nyckeltal (RaknaUpp i LeaderDashboard), Richards
 * val A den 16 oktober.
 */
export function uppraknat(t: number, slut: number, decimaler: number): number {
  const tid = Math.min(1, Math.max(0, t));
  const andel = 1 - (1 - tid) ** 3;
  const faktor = 10 ** decimaler;
  return Math.round(slut * andel * faktor) / faktor;
}

/**
 * Talformat för allt som visas.
 *
 * Klientsäker — inga serverimporter — så samma funktion används i
 * serverkomponenter, klientkomponenter och notistexter.
 *
 * `toFixed(1)` skrev "5.0" med punkt. För svenska läsare ser det ut som en
 * felöversättning, och appen visas för befäl som inte har anledning att
 * förlåta det. Svensk standard är decimalkomma: "5,0".
 */
import { roundScore } from './data';

/*
 * Avrundningen görs av roundScore(), inte av toLocaleString. Den senare
 * avrundar det binära flyttalet och kan därför visa 6,05 som "6,0" — medan
 * färgen, som bedöms på roundScore(), räknar med 6,1.
 */
export function formatScore(n: number): string {
  return roundScore(n).toLocaleString('sv-SE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

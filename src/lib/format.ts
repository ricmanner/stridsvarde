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

/**
 * Räknar upp led på svenskt sätt: komma mellan, "och" före det sista.
 *
 * Raderingsrutan byggde tidigare sin mening genom att lägga till
 * ", och alla deras rapporter" efter en lista som redan kunde innehålla ett
 * "och". Resultatet var antingen ett komma före "och" mellan två led — vilket
 * svensk kommatering inte gör — eller två "och" tätt intill varandra:
 * "med 1 underenhet och 2 personer, och alla deras rapporter".
 */
export function uppräkning(delar: string[]): string {
  if (delar.length === 0) return '';
  if (delar.length === 1) return delar[0];
  return `${delar.slice(0, -1).join(', ')} och ${delar[delar.length - 1]}`;
}

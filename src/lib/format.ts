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
 * Ett procenttal som det skrivs på svenska: mellanslag före tecknet.
 *
 * Regeln följdes på två ställen av sex. Utskriftsrapporten och larmtexten
 * skrev "78 %", medan befälsvyn, den värnpliktiges vy och incheckningens
 * framstegsrad skrev "78%" — samma tal, två sätt, ibland på samma skärm.
 * Tecknet sätts därför på ett ställe.
 *
 * Gäller text. I formatmallar är procent en enhet och skrivs ihop, som
 * `width: 82%`.
 */
export function procent(n: number): string {
  return `${n} %`;
}

/**
 * Ett antal med orden böjda efter talet.
 *
 * Fyra ställen satte ihop en siffra med ett plural och lät participet stå
 * kvar: "1 incheckning raderade", "1 rapporter raderade", "1 poster är äldre
 * än så". Ettan är inte ett undantagsfall — en administratör som raderar en
 * persons svar ser den nästan varje gång.
 *
 * Tar hela ledet, inte bara substantivet, eftersom det som ska böjas ofta är
 * participet intill: "incheckning raderad" mot "incheckningar raderade".
 * Noll tar plural på svenska: "0 uppgifter".
 *
 * Fanns tidigare som en egen liten funktion i raderingsrutan. Den låg där
 * ensam tills tre andra ställen behövde samma sak.
 */
export function antal(n: number, ental: string, flertal: string): string {
  return `${n} ${n === 1 ? ental : flertal}`;
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

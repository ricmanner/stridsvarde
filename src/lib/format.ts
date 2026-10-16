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

/**
 * Förändringen mot perioden före, som den skrivs: "↓ 0,7", "↑ 0,6", "+0,1".
 *
 * Räknas på de avrundade tal som visas, så att "från 4,5 till 5,0" aldrig
 * kallas en förändring på 0,4. Pil och färg först från ett halvt steg; under
 * det står talet med tecken, utan pil.
 *
 * Fanns i befälsvyns kategoritabell. Flyttad hit när utskriftsrapporten fick
 * samma kolumn (16 oktober), så att skärm och papper räknar likadant.
 */
export function forandring(
  nu: number,
  forra: number,
): { steg: number; riktning: 'ned' | 'upp' | 'liten'; text: string } {
  const steg = Math.round((roundScore(nu) - roundScore(forra)) * 10) / 10;
  if (steg <= -0.5) return { steg, riktning: 'ned', text: `↓ ${formatScore(-steg)}` };
  if (steg >= 0.5) return { steg, riktning: 'upp', text: `↑ ${formatScore(steg)}` };
  const tecken = steg === 0 ? '±' : steg > 0 ? '+' : '−';
  return { steg, riktning: 'liten', text: `${tecken}${formatScore(Math.abs(steg))}` };
}

/**
 * Som uppräkning(), men "samt" före det sista ledet när ett namn själv
 * innehåller "och": "sömn samt kost och näring". Annars blir det oklart var
 * gränsen mellan namnen går.
 *
 * Fanns i befälsvyn. Flyttad hit när rapporten fick samma nyckeltal.
 */
export function uppräkningSamt(namn: string[]): string {
  if (namn.length <= 1) return namn[0] ?? '';
  const binde = namn.some((n) => n.includes(' och ')) ? ' samt ' : ' och ';
  return `${namn.slice(0, -1).join(', ')}${binde}${namn.at(-1)}`;
}

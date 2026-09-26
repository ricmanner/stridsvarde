export type Category = 'fysisk' | 'psykisk' | 'social' | 'somn' | 'kost' | 'energi';

export const CATEGORIES: Array<{
  key: Category;
  label: string;
  icon: string; // Lucide icon name
  question: string;
}> = [
  { key: 'fysisk',  label: 'Fysisk form',      icon: 'Activity',  question: 'Hur mår din kropp idag?' },
  { key: 'psykisk', label: 'Psykiskt mående',   icon: 'Brain',     question: 'Hur mår du mentalt?' },
  { key: 'social',  label: 'Social trivsel',    icon: 'Users',     question: 'Hur trivs du i gruppen?' },
  { key: 'somn',    label: 'Sömn',              icon: 'Moon',      question: 'Hur sov du i natt?' },
  { key: 'kost',    label: 'Kost och näring',   icon: 'Utensils',  question: 'Hur äter du under tjänsten?' },
  { key: 'energi',  label: 'Energinivå',        icon: 'Zap',       question: 'Hur är din energi just nu?' },
];

export interface CheckIn {
  id: string;
  date: string; // YYYY-MM-DD
  soldierCode: string;
  scores: Record<Category, number>;
  advice?: string;
}

export type Status = 'green' | 'yellow' | 'red';

/*
 * Gränserna mellan grönt, gult och rött — definierade en enda gång.
 *
 * Siffrorna upprepades tidigare i rå SQL på åtta ställen i aggregates.ts.
 * Ändrades getStatus slutade färgräkningarna stämma med märkena som ritades
 * bredvid dem: en enhet kunde visa "3 gröna" med ett gult märke intill, utan
 * att något gick sönder. Frågorna bygger redan sina kolumner ur CATEGORIES
 * för att SQL:en inte ska kunna glida isär — samma resonemang gäller här.
 */
export const GREEN_MIN = 7;
export const YELLOW_MIN = 4;

/**
 * Ett snitt avrundat till en decimal — det tal som visas.
 *
 * Status bedöms på samma avrundade tal. Annars kan ett snitt på 6,96 visas
 * som "7,0" med gult märke, trots att förklaringen under grafen säger
 * "Grön från 7". Den som läser siffran och färgen ska få samma svar.
 *
 * Den lilla tillsatsen skyddar mot flyttal: 6,05 lagras som 6,0499999… och
 * skulle annars avrundas nedåt. Verkliga snitt ligger aldrig så nära en
 * avrundningsgräns utan att ligga exakt på den.
 */
export function roundScore(n: number): number {
  return Math.round(n * 10 + 1e-9) / 10;
}

/** SQL-motsvarigheten till roundScore(), för färgräkningar i databasen. */
export const roundScoreSql = (expr: string) => `ROUND((${expr}) + 1e-9, 1)`;

export function getStatus(score: number): Status {
  const shown = roundScore(score);
  if (shown >= GREEN_MIN) return 'green';
  if (shown >= YELLOW_MIN) return 'yellow';
  return 'red';
}

/**
 * Statusfärgen för ytor: prickar, staplar, band bakom en kurva.
 *
 * Grafiska element behöver 3:1 mot sin omgivning. Text behöver 4,5:1, och de
 * här tonerna klarar inte det — se statusTextColor().
 */
export function statusColor(s: Status): string {
  return s === 'green' ? '#059669' : s === 'yellow' ? '#D97706' : '#DC2626';
}

/**
 * Statusfärgen för TEXT, mörkare än ytfärgen.
 *
 * Uppmätt av axe: gul text i #D97706 på sitt eget tonade fält gav 3,07 mot
 * kravet 4,5, och grön 3,58. De här tonerna ligger mellan 4,6 och 6,5 mot vitt
 * och mot alla tre tonade bakgrunder. Färgen är ändå aldrig ensam bärare av
 * budskapet — märket innehåller ordet GRÖN, GUL eller RÖD.
 */
export function statusTextColor(s: Status): string {
  return s === 'green' ? '#047857' : s === 'yellow' ? '#B45309' : '#B91C1C';
}

export function statusBg(s: Status): string {
  return s === 'green' ? '#ECFDF5' : s === 'yellow' ? '#FFFBEB' : '#FEF2F2';
}

/**
 * Färgordet böjt efter antalet: "1 röd", "3 röda".
 *
 * Befälsvyn hade plural inskrivet på två ställen — sammanfattningsraden
 * ("1 Gröna") och fördelningen under varje kategori ("1 röda"). En pluton med
 * en enda röd värnpliktig är inget undantagsfall; det är den raden ett befäl
 * tittar på först.
 *
 * Versalen är anroparens sak — orden ska inte finnas i två uppsättningar för
 * att en rubrik någon gång vill ha stor bokstav.
 */
const STATUSORD: Record<Status, { ental: string; neutrum: string; flertal: string }> = {
  green: { ental: 'grön', neutrum: 'grönt', flertal: 'gröna' },
  yellow: { ental: 'gul', neutrum: 'gult', flertal: 'gula' },
  red: { ental: 'röd', neutrum: 'rött', flertal: 'röda' },
};

export function statusOrd(s: Status, antal: number): string {
  // Noll tar plural på svenska: "0 röda".
  return antal === 1 ? STATUSORD[s].ental : STATUSORD[s].flertal;
}

/**
 * Färgordet med "svar" efter: "1 grönt svar", "60 röda svar".
 *
 * Befälsvyn räknar två saker med samma färgord. Raden överst räknar personer,
 * var och en en gång efter sitt eget snitt; fördelningen under varje kategori
 * räknar svar, och en person svarar upp till en gång om dagen. Utan ordet
 * stod "60 röda" under Sömn i en pluton på 40, med "1 Röd" överst på samma
 * skärm — båda rätt, men ingen kunde se att de räknade olika saker.
 */
export function statusSvar(s: Status, antal: number): string {
  return `${antal === 1 ? STATUSORD[s].neutrum : STATUSORD[s].flertal} svar`;
}

export interface Personfordelning extends Record<Status, number> {
  utanSvar: number;
  total: number;
}

/**
 * Hela enheten, fördelad efter var och ens eget snitt — plus dem som inte svarat.
 *
 * Grön/gul/röd räknar bara den som svarat under perioden. Utan en egen del för
 * resten ser en pluton där hälften tystnat lika frisk ut som en där alla
 * svarat, och "40 värnpliktiga" står bredvid tal som tillsammans blir 24.
 *
 * Anroparen visar det här bara när fördelningen själv får visas: är
 * soldierStatus undanhållen ska antalet utan svar också vara det, annars blir
 * det en väg runt k-anonymiteten.
 */
export function personfordelning(status: Record<Status, number>, eligible: number): Personfordelning {
  const svarat = status.green + status.yellow + status.red;
  const total = Math.max(eligible, svarat);
  return { ...status, utanSvar: total - svarat, total };
}

export function statusLabel(s: Status): string {
  return s === 'green' ? 'GRÖN' : s === 'yellow' ? 'GUL' : 'RÖD';
}

export function avgScore(scores: Record<Category, number>): number {
  const vals = Object.values(scores) as number[];
  return roundScore(vals.reduce((a, b) => a + b, 0) / vals.length);
}

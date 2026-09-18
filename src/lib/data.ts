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
  { key: 'somn',    label: 'Sömn',              icon: 'Moon',      question: 'Hur sov du igår natt?' },
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

export function statusLabel(s: Status): string {
  return s === 'green' ? 'GRÖN' : s === 'yellow' ? 'GUL' : 'RÖD';
}

export function avgScore(scores: Record<Category, number>): number {
  const vals = Object.values(scores) as number[];
  return roundScore(vals.reduce((a, b) => a + b, 0) / vals.length);
}

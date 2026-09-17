/**
 * Gemensamma val för alla grafer — ett ställe, så att de ser ut som en familj.
 *
 * GRÖNT, GULT OCH RÖTT BETYDER STATUS, OCH BARA STATUS. Tidigare hade Kost
 * exakt samma grön som "bra", Energi samma gul som "varning", och i
 * jämförelsen ritades en grupp i "bra"-grönt och en annan i "kritiskt"-rött.
 * En grön linje läses som att något är bra, oavsett vad den visar. Linjer
 * ritas därför i neutralt bläck eller i en blå accent; statusfärgerna finns
 * bara i bakgrundsfälten och i rutornas tonade bakgrund.
 *
 * Det löser också färgblindheten. De sex kategorifärgerna underkändes av
 * validatorn: Fysisk (blå) och Psykiskt (lila) var i praktiken identiska för
 * rödgrön färgblindhet, och Kost och Sömn var svåra att skilja åt även med
 * full färgsyn. Utan kategorifärger finns inget att förväxla.
 */

import { GREEN_MIN, YELLOW_MIN, type Status } from '@/lib/data';

/** Linjen i en graf med en serie. */
export const INK = '#1E293B';
/** Den valda enheten när en jämförs mot helheten. */
export const ACCENT = '#2563EB';
/** Helheten i en jämförelse — medveten nedtoning, inte en färg att läsa. */
export const REFERENCE = '#64748B';

export const AXIS_TEXT = '#64748B';
export const GRID = '#E2E8F0';
export const AXIS_TICK = { fill: AXIS_TEXT, fontSize: 10 } as const;

/** Skalan är 1–10 överallt. */
export const SCALE_MIN = 1;
export const SCALE_MAX = 10;
export const SCALE_TICKS = [1, YELLOW_MIN, GREEN_MIN, 10];

/** Statusfälten bakom en kurva. Svaga nog att linjen alltid är det man läser. */
export const BANDS: Array<{ from: number; to: number; color: string; opacity: number }> = [
  { from: GREEN_MIN, to: SCALE_MAX, color: '#059669', opacity: 0.07 },
  { from: YELLOW_MIN, to: GREEN_MIN, color: '#D97706', opacity: 0.07 },
  { from: SCALE_MIN, to: YELLOW_MIN, color: '#DC2626', opacity: 0.06 },
];

/**
 * Tonad bakgrund för en ruta med ett värde. Starkare än statusBg() i
 * lib/data.ts: de ljusaste nyanserna försvinner helt på en projektor.
 */
export const CELL_TINT: Record<Status, string> = {
  green: '#D1FAE5',
  yellow: '#FEF3C7',
  red: '#FEE2E2',
};

/**
 * Glesa etiketter på x-axeln: sista dagen och jämnt utspridda bakåt.
 *
 * Diagrambiblioteket plockade annars bort etiketter som inte fick plats, och
 * resultatet blev oregelbundna luckor — "sön, ons, tors" — som ser ut som att
 * dagar saknas. Här bestäms vilka som visas, och de ligger jämnt.
 */
export function sparseTicks<T>(keys: readonly T[], max: number): T[] {
  if (keys.length <= max) return [...keys];
  /*
   * Jämna steg räknade bakifrån, så att sista dagen — idag — alltid har en
   * etikett. Att avrunda jämnt fördelade positioner gav ojämna avstånd:
   * sju dagar blev 11, 13, 14, 16, 17.
   */
  const steg = Math.ceil((keys.length - 1) / (max - 1));
  const ut: T[] = [];
  for (let i = keys.length - 1; i >= 0; i -= steg) ut.unshift(keys[i]);
  return ut;
}

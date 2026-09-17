import type { Category } from './data';

export type Trend = 'up' | 'down' | 'neutral';

/**
 * Riktningen på den värnpliktiges egen sida.
 *
 * Jämför snittet av de tre senaste incheckningarna mot de tre dessförinnan.
 * Räknas på incheckningar, inte kalenderdagar: tomma dagar hoppas över.
 * Ligger här i stället för i komponenten så att testerna kör samma kod.
 *
 * Räknas på exakta dagssnitt, inte på de avrundade som visas. Avrundades
 * dagarna först blev en verklig uppgång på 0,33 (6,33 mot 6,0) till exakt
 * 0,3 — och visades som "Stabil".
 */
export function ownTrend(checkIns: Array<Record<Category, number>>): Trend {
  const svar = checkIns.map((s) => {
    const v = Object.values(s);
    return v.reduce((a, b) => a + b, 0) / v.length;
  });
  const recent = svar.slice(-3);
  const prev = svar.slice(-6, -3);
  if (recent.length < 2 || prev.length < 2) return 'neutral';

  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const diff = mean(recent) - mean(prev);
  if (diff > 0.3) return 'up';
  if (diff < -0.3) return 'down';
  return 'neutral';
}

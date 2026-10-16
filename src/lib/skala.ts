import { type Category, GREEN_MIN, getStatus, type Status, YELLOW_MIN } from './data';

/*
 * Vad en siffra BETYDER, per fråga — visas under reglaget och i listan
 * bakom info-knappen.
 *
 * Fysioterapeuterna bad om det den 14 oktober och visade appen Readiness
 * Advisor, som har en sådan lista för varje fråga. Skälet är underlaget: menar
 * alla samma sak med en femma blir varje snitt i befälsvyn mer värt.
 *
 * En text per FÄRG, inte per siffra. Readiness Advisor har sex nivåer, men en
 * egen indelning ("1–2", "3–5") skulle ge en text som säger emot färgen på
 * samma skärm — en fyra är gul, och då ska texten för en fyra vara den gula.
 * Gränserna kommer därför ur GREEN_MIN och YELLOW_MIN.
 *
 * Texterna beskriver hur det känns, inte vad man ska göra; råden kommer
 * efter incheckningen (lib/advice.ts). Korta beskrivningar som i Readiness
 * Advisor, utan "du" och utan omdöme om tjänsten: om någon kan tjänstgöra
 * avgör befälet och sjukvården, inte den värnpliktige (Richard, 16 oktober).
 * Fysioterapeuterna bör läsa dem innan skarp drift.
 */
export const SKALA: Record<Category, Record<Status, string>> = {
  fysisk: {
    red: 'Smärta eller skada som begränsar rörelse.',
    yellow: 'Stel, öm eller sliten. Känns i kroppen.',
    green: 'Kroppen känns bra. Inga besvär.',
  },
  halsa: {
    red: 'Sjuk. Feber, infektion eller tydliga sjukdomssymtom.',
    yellow: 'Krasslig. Förkylning eller lättare symtom.',
    green: 'Frisk. Inga sjukdomssymtom.',
  },
  psykisk: {
    red: 'Tungt. Oro, nedstämdhet eller stress som tar mycket kraft.',
    yellow: 'Mer pressad än vanligt. Tankarna tar energi.',
    green: 'Mår bra. Stressen är hanterbar.',
  },
  social: {
    red: 'Utanför, eller svårt med någon i gruppen.',
    yellow: 'Fungerar, men inte riktigt en del av gruppen.',
    green: 'Trivs och hör till.',
  },
  somn: {
    red: 'Lite eller ingen sömn, eller så avbruten att vilan uteblev.',
    yellow: 'Sov, men för kort eller oroligt.',
    green: 'Tillräckligt med sömn. Utvilad.',
  },
  kost: {
    red: 'Missade måltider, eller betydligt mindre mat än kroppen behöver.',
    yellow: 'Oregelbundet, eller för lite för belastningen.',
    green: 'Ordentliga måltider. Orkar hela dagen.',
  },
  energi: {
    red: 'Helt slut. Svårt att ta sig igenom dagen.',
    yellow: 'Tröttare än vanligt, men kommer igång.',
    green: 'Gott om ork.',
  },
};

/** Texten för den siffra reglaget står på. */
export function skaltext(cat: Category, score: number): string {
  return SKALA[cat][getStatus(score)];
}

export interface Skalniva {
  status: Status;
  fran: number;
  till: number;
  text: string;
}

/** Hela listan, i reglagets ordning: från vänster, alltså lägst först. */
export function skalnivaer(cat: Category): Skalniva[] {
  return [
    { status: 'red', fran: 1, till: YELLOW_MIN - 1, text: SKALA[cat].red },
    { status: 'yellow', fran: YELLOW_MIN, till: GREEN_MIN - 1, text: SKALA[cat].yellow },
    { status: 'green', fran: GREEN_MIN, till: 10, text: SKALA[cat].green },
  ];
}

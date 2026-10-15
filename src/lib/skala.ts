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
 * efter incheckningen (lib/advice.ts). Utkast av Claude, godkända av Richard
 * den 15 oktober — fysioterapeuterna bör läsa dem innan skarp drift.
 */
export const SKALA: Record<Category, Record<Status, string>> = {
  fysisk: {
    red: 'Ont eller skadad. Smärta som begränsar det du ska göra.',
    yellow: 'Stel, öm eller sliten. Du klarar tjänsten men känner av kroppen.',
    green: 'Kroppen känns bra. Inget som hindrar dig.',
  },
  psykisk: {
    red: 'Det känns tungt. Oro, nedstämdhet eller stress tar mycket kraft.',
    yellow: 'Mer pressad än vanligt. Det går, men tankarna tar energi.',
    green: 'Du mår bra. Stressen är hanterbar.',
  },
  social: {
    red: 'Du känner dig utanför, eller har det svårt med någon i gruppen.',
    yellow: 'Det fungerar, men du känner dig inte riktigt som en del av gruppen.',
    green: 'Du trivs och känner att du hör till.',
  },
  somn: {
    red: 'Lite eller ingen sömn, eller så störd att du inte vilat alls.',
    yellow: 'Du sov, men för kort eller oroligt.',
    green: 'Du sov tillräckligt och vaknade utvilad.',
  },
  kost: {
    red: 'Du har missat måltider eller ätit långt mindre än du behöver.',
    yellow: 'Du äter, men oregelbundet eller för lite för belastningen.',
    green: 'Du får i dig ordentliga måltider och orkar hela dagen.',
  },
  energi: {
    red: 'Helt slut. Det är svårt att ta sig igenom dagen.',
    yellow: 'Tröttare än vanligt, men du kommer igång.',
    green: 'Du har gott om ork för det dagen kräver.',
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

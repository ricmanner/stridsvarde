import type { Category } from './data';

/*
 * Vad varje pluton i demon har varit med om de senaste tre veckorna.
 *
 * Fysioterapeuterna sa den 14 oktober att befälsvyns kurvor var "raka
 * sträck" och att jämförelserna mellan plutoner och kompanier var för vaga.
 * Uppmätt dagen efter: varje plutons dagliga snitt rörde sig 0,4–0,6 på två
 * veckor och kompaniernas 0,3–0,4. Seeden gav varje person ett fast
 * grundvärde plus brus, och bruset tar ut sig när tjugofyra personer läggs
 * ihop. Ingenting hände över tid, så demon kunde inte visa det appen är till
 * för — att fånga när något förändras.
 *
 * Här får varje pluton en historia som går att berätta för en chef. Funktionen
 * ger plutonens förväntade snitt för en kategori en viss dag. Varje
 * värnpliktig hamnar sedan runt det, med sin egen avvikelse och dagsform
 * (seed.ts), så fördelningarna ser ut som riktiga svar.
 *
 * Nattkörningen flyttar alla datum lika långt, så fältövningen ligger kvar
 * "för en vecka sedan". Därför ingen veckorytm: helgerna hade hamnat på fel
 * dagar efter första framflyttningen.
 *
 * Plutonens nummer räknas över hela bataljonen (se KOMPANIER i seed.ts):
 * 1–3 är 1. kompani, 4–6 är 2. kompani, 7–9 är 3. kompani.
 */

/** Tre veckor, så att 21-dagarsperioden i befälsvyn är fylld. */
export const HISTORIK_DAGAR = 21;

/** En sänkning som är djupast `mitt` dagar sedan och klingar av åt båda håll. */
function dipp(d: number, mitt: number, bredd: number, djup: number): number {
  return djup * Math.exp(-(((d - mitt) / bredd) ** 2));
}

/** Rak linje från `fore` för tre veckor sedan till `idag`. */
function linje(d: number, fore: number, idag: number): number {
  return idag + ((fore - idag) * d) / (HISTORIK_DAGAR - 1);
}

/** 0 långt bakåt, 1 nära idag, med övergången kring `mitt` dagar sedan. */
function skifte(d: number, mitt: number, branthet: number): number {
  return 1 / (1 + Math.exp((d - mitt) / branthet));
}

function mellan(v: number, lag: number, hog: number): number {
  return Math.min(hog, Math.max(lag, v));
}

type Forlopp = (d: number) => Partial<Record<Category, number>> & { ovriga: number };

const PLUTONER: Record<number, Forlopp> = {
  /*
   * 1. kompani, 1. pluton — fältövning för en vecka sedan. Sömn och energi
   * rasar under några dagar och kommer delvis tillbaka. Kosten är låg hela
   * tiden. Sömn och kost ligger i rött den senaste veckan, vilket är det
   * larmet i befälsvyn visar.
   */
  1: (d) => ({
    ovriga: 5.8,
    fysisk: 5.6 - dipp(d, 7, 2, 1.5),
    psykisk: 5.4 - dipp(d, 7, 2.5, 0.8),
    somn: 3.6 + mellan((d - 5) / 5, 0, 1) - dipp(d, 7, 1.8, 1.8),
    kost: 3.9 - dipp(d, 7, 2, 1.0),
    energi: 5.2 - dipp(d, 7, 2, 2.4),
  }),
  /*
   * 1. kompani, 2. pluton — psykiskt mående och trivsel sjunker sakta under
   * tre veckor, från gult mot rött. Det appen ska fånga: en trend innan den
   * blir en kris.
   */
  2: (d) => ({
    ovriga: linje(d, 5.6, 5.0),
    psykisk: linje(d, 6.2, 3.6),
    social: linje(d, 6.4, 3.9),
  }),
  /* 1. kompani, 3. pluton — stabilt bra. Visar att det inte är hela kompaniet. */
  3: () => ({ ovriga: 7.1 }),

  /* 2. kompani, 1. pluton — en tung period för två–tre veckor sedan, nu på väg upp. */
  4: (d) => ({ ovriga: 4.2 + 2.8 * skifte(d, 10, 2) }),
  /* 2. kompani, 2. pluton — stabilt. */
  5: () => ({ ovriga: 7.0 }),
  /*
   * 2. kompani, 3. pluton — marsch för tre dagar sedan. Kroppen och orken
   * har inte hämtat sig, sömnen något.
   */
  6: (d) => {
    const efter = skifte(d, 3.5, 0.5);
    return {
      ovriga: 6.4,
      fysisk: 6.6 - 2.8 * efter,
      energi: 6.6 - 2.4 * efter,
      somn: 6.4 - 1.2 * efter,
      psykisk: 6.4 - 0.6 * efter,
    };
  },

  /* 3. kompani — genomgående bäst, med 1. pluton något lägre i kost. */
  7: () => ({ ovriga: 7.2, kost: 5.8 }),
  8: () => ({ ovriga: 7.5 }),
  9: () => ({ ovriga: 7.2 }),
};

/*
 * Hela bataljonen: skjutvecka för två veckor sedan — tidiga morgnar och långa
 * dagar på skjutfältet. Lagt ovanpå plutonernas historier.
 *
 * Utan den var bataljonschefens egna kurvor nästan raka, eftersom
 * plutonernas historier tar ut varandra när 219 personer läggs ihop. Richard
 * ville ha rörelse även där (15 oktober). Det gör visningen bättre, inte
 * appen.
 */
const SKJUTVECKA: Partial<Record<Category, number>> = { somn: 1.5, energi: 1.1, fysisk: 0.6 };

/**
 * Plutonens förväntade snitt för en kategori, `dagarSedan` dagar bakåt
 * (0 är idag). Ett tal på skalan 1–10, inte avrundat.
 */
export function forlopp(plutonNr: number, kategori: Category, dagarSedan: number): number {
  const p = PLUTONER[plutonNr]?.(dagarSedan) ?? { ovriga: 6.5 };
  const gemensamt = dipp(dagarSedan, 14, 1.8, SKJUTVECKA[kategori] ?? 0);
  return mellan((p[kategori] ?? p.ovriga) - gemensamt, 1, 10);
}

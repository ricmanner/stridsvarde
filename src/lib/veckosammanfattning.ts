import { CATEGORIES, type Category, roundScore } from './data';

/*
 * Veckan i korthet: fyra fält om senaste veckan, överst i befälsvyn och i
 * utskriftsrapporten.
 *
 * Fysioterapeuterna bad den 14 oktober om en kort text som plutonchefen kan
 * ta med till kompaniets veckomöte. De föreslog AI. Den här skrivs i stället
 * ur siffrorna, med fasta regler: ingenting skickas till någon utomstående
 * tjänst, och texten kan aldrig säga något som siffrorna bredvid inte säger.
 *
 * Talen avrundas en gång, med roundScore() — samma som färgerna. Annars kan
 * texten säga "sjunkit från 4,8 till 4,8", eller kalla en fyra röd.
 */

/**
 * Meningen om vilken underenhet som ligger lägst. `false` tar bort den.
 *
 * Med tills vidare, men omdiskuterad: den pekar ut en grupp, och det kan
 * bjuda in till skuld — samma invändning som mot rangordningen. Jämförelsen
 * visar redan samma sak. En fråga till chefsmötet den 19 oktober.
 */
export const VISA_LAGST = true;

/** En förändring under ett halvt steg räknas inte. */
const STOR_FORANDRING = 0.5;

export interface Veckounderlag {
  /** Aktiva värnpliktiga i enheten idag. */
  eligible: number;
  /** Svar senaste sju dagarna delat med eligible × 7, alltså 0–1. */
  svarsandel: number;
  /** Kategorisnitt senaste sju dagarna. null: för få svar. */
  denna: Record<Category, number> | null;
  /** Kategorisnitt de sju dagarna före. null: för få svar. */
  forra: Record<Category, number> | null;
  /** Underenheten med lägst snitt senaste veckan, om jämförelsen går. */
  lagst: { namn: string; snitt: number } | null;
}

const etikett = (k: Category) => CATEGORIES.find((c) => c.key === k)!.label;

export interface Forandring {
  kategori: string;
  /** Avrundade, som de visas. */
  fran: number;
  till: number;
}

export interface Veckokort {
  eligible: number;
  /** Hela procent, som de visas. */
  svarsprocent: number;
  /** Finns underlag för den här veckan? Annars visas inga tal. */
  underlag: boolean;
  /** Finns underlag för veckan innan att jämföra med? */
  jamforbar: boolean;
  /** Största nedgången, om någon är minst ett halvt steg. */
  forsamring: Forandring | null;
  /** Största uppgången, om någon är minst ett halvt steg. */
  forbattring: Forandring | null;
  lagst: { namn: string; snitt: number } | null;
}

/**
 * Veckan i fyra rutor: svarsfrekvens, störst försämring, störst förbättring
 * och lägst enhet.
 *
 * Det var först fyra meningar. Richard, 16 oktober: befälen vill ha siffror
 * rakt på sak, och jämförelsen med förra veckan syntes inte i texten. Nu är
 * jämförelsen själva innehållet i två av rutorna.
 *
 * Förändringen räknas på de avrundade tal som visas, så att rutan aldrig
 * säger "från 4,8 till 4,8".
 */
export function veckokort(u: Veckounderlag): Veckokort {
  const bas = {
    eligible: u.eligible,
    svarsprocent: Math.round(u.svarsandel * 100),
    underlag: u.denna !== null,
    jamforbar: u.denna !== null && u.forra !== null,
    lagst: VISA_LAGST && u.lagst ? { namn: u.lagst.namn, snitt: roundScore(u.lagst.snitt) } : null,
  };
  if (!u.denna || !u.forra) return { ...bas, forsamring: null, forbattring: null };

  const alla = CATEGORIES.map((c) => ({
    kategori: etikett(c.key),
    fran: roundScore(u.forra![c.key]),
    till: roundScore(u.denna![c.key]),
  }));
  const steg = (f: Forandring) => Math.round((f.till - f.fran) * 10) / 10;
  const ned = alla.filter((f) => steg(f) <= -STOR_FORANDRING).sort((a, b) => steg(a) - steg(b));
  const upp = alla.filter((f) => steg(f) >= STOR_FORANDRING).sort((a, b) => steg(b) - steg(a));

  return { ...bas, forsamring: ned[0] ?? null, forbattring: upp[0] ?? null };
}

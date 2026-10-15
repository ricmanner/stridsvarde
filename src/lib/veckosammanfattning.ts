import { CATEGORIES, type Category, getStatus, roundScore, type Status } from './data';
import { formatScore, procent } from './format';

/*
 * Veckosammanfattningen: några meningar om senaste veckan, överst i
 * befälsvyn och i utskriftsrapporten.
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
const versal = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * "Sömn och energinivå", men "Sömn samt kost och näring": när ett namn
 * själv innehåller "och" blir det annars oklart var gränsen går.
 */
function lista(namn: string[]): string {
  if (namn.length === 1) return namn[0];
  const binde = namn.some((n) => n.includes(' och ')) ? ' samt ' : ' och ';
  return `${namn.slice(0, -1).join(', ')}${binde}${namn.at(-1)}`;
}

function iStatus(cats: Record<Category, number>, status: Status): string[] {
  return CATEGORIES.filter((c) => getStatus(cats[c.key]) === status).map((c, i) =>
    i === 0 ? c.label : c.label.toLowerCase(),
  );
}

/** Meningarna, i ordning. Varje element är en rad i rutan. */
export function veckotext(u: Veckounderlag): string[] {
  if (u.eligible === 0) return ['Enheten har inga värnpliktiga.'];

  const ut = [
    // Inte "Senaste veckan …": det står redan i rubriken och raden under.
    `I snitt svarade ${procent(Math.round(u.svarsandel * 100))} av de ${u.eligible} värnpliktiga varje dag.`,
  ];

  if (!u.denna) {
    ut.push('Underlag saknas — för få svar för att sammanfatta veckan.');
    return ut;
  }

  const roda = iStatus(u.denna, 'red');
  const gula = iStatus(u.denna, 'yellow');
  if (roda.length > 0) {
    ut.push(`${lista(roda)} ligger på röd nivå.`);
  } else if (gula.length === CATEGORIES.length) {
    // Alla sex gula — vanligt på kompani- och bataljonsnivå. En uppräkning av
    // alla säger ingenting; den lägsta ger chefen något att gå på.
    const lagstKat = CATEGORIES.reduce((a, b) => (u.denna![b.key] < u.denna![a.key] ? b : a));
    ut.push(
      `Ingen kategori ligger på röd nivå. Alla ligger på gul nivå, lägst ` +
        `${lagstKat.label.toLowerCase()} med ${formatScore(u.denna[lagstKat.key])}.`,
    );
  } else if (gula.length > 0) {
    ut.push(`Ingen kategori ligger på röd nivå. ${lista(gula)} ligger på gul nivå.`);
  } else {
    ut.push('Alla kategorier ligger på grön nivå.');
  }

  if (!u.forra) {
    ut.push('Veckan innan har för få svar för att jämföra.');
  } else {
    // Jämför de tal som visas, inte de oavrundade.
    const forandringar = CATEGORIES.map((c) => ({
      k: c.key,
      fran: roundScore(u.forra![c.key]),
      till: roundScore(u.denna![c.key]),
    })).sort((x, y) => Math.abs(y.till - y.fran) - Math.abs(x.till - x.fran));
    const storst = forandringar[0];
    if (Math.abs(storst.till - storst.fran) >= STOR_FORANDRING) {
      ut.push(
        `Störst förändring mot veckan innan: ${etikett(storst.k).toLowerCase()}, som ` +
          `${storst.till > storst.fran ? 'stigit' : 'sjunkit'} från ${formatScore(storst.fran)} ` +
          `till ${formatScore(storst.till)}.`,
      );
    } else {
      ut.push('Inga stora förändringar mot veckan innan.');
    }
  }

  if (VISA_LAGST && u.lagst) {
    ut.push(`Lägst ligger ${u.lagst.namn}, med ${formatScore(u.lagst.snitt)}.`);
  }

  return ut.map(versal);
}

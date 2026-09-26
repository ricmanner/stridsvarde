/**
 * Vad en graf visar, i ord.
 *
 * Graferna var märkta `role="img"` med en etikett som sa vad de HETER — "Ditt
 * mående de senaste fjorton dagarna" — och ingenting om innehållet. Den som
 * lyssnar fick alltså veta att det finns en graf, och fick sedan gå vidare.
 * Det är appens största tillgänglighetslucka, och den enda som handlar om
 * information i stället för om hantering.
 *
 * Texten säger bara det grafen faktiskt visar: senaste värdet, lägsta och
 * högsta med dag, och hur många dagar som saknar svar. Ingen riktning, inget
 * omdöme. Skälet är att båda redan står som text intill grafen där de hör
 * hemma — och två påståenden om samma sak är precis så de börjar säga emot
 * varandra.
 *
 * Talen skrivs med siffror, till skillnad från i löpande text i
 * gränssnittet. Den här texten läses upp av en talsyntes, som säger "fem
 * komma noll" om "5,0" — att stava ut små tal skulle bara göra strängen
 * längre utan att någon hör skillnaden.
 *
 * Klientsäker: inga serverimporter, så den kan användas i graferna, som är
 * klientkomponenter.
 */
import { formatScore } from './format';

export interface Seriepunkt {
  /** Datum som 'YYYY-MM-DD' när serien är daterad, annars vad som helst unikt. */
  key: string;
  /** Etiketten på x-axeln, t.ex. 'mån' eller '15/9'. */
  label: string;
  /** null för en dag utan svar, eller utan tillräckligt underlag. */
  value: number | null;
}

/**
 * Dagens namn i beskrivningen.
 *
 * Hellre datum än veckodag: den värnpliktiges översiktsgraf har veckodagar på
 * axeln, och över fjorton dagar finns varje veckodag två gånger. "Lägst på
 * måndag" pekar alltså på två dagar. Nyckeln är datumet, så det används när
 * det är ett datum — annars faller den tillbaka på etiketten.
 */
function punktnamn(p: Seriepunkt): string {
  const datum = /^(\d{4})-(\d{2})-(\d{2})$/.exec(p.key);
  if (!datum) return p.label;
  return `${Number(datum[3])}/${Number(datum[2])}`;
}

/**
 * En serie på skalan 1–10, beskriven med sina egna tal.
 *
 * Ordningen är den en människa frågar efter: var ligger det nu, hur illa har
 * det varit, hur bra, och hur mycket underlag finns det.
 */
export function seriebeskrivning(punkter: readonly Seriepunkt[]): string {
  const medVärde = punkter.filter((p): p is Seriepunkt & { value: number } => p.value !== null);

  if (medVärde.length === 0) return 'Inget underlag att visa ännu.';

  const senaste = medVärde[medVärde.length - 1];
  const nu = formatScore(senaste.value);
  const delar: string[] = [];

  /*
   * Ytterligheterna nämns bara när de säger något nytt.
   *
   * Med en enda punkt är lägst och högst samma tal som det senaste. Med lika
   * värden hela perioden är de samma som varandra. Och ligger man just nu på
   * sin ytterlighet — vilket är det mest intressanta som kan sägas — så blir
   * "senaste 5,5 … högst 5,5" samma tal och samma dag två gånger, medan
   * poängen försvinner. Då sägs den i stället rakt ut.
   */
  if (medVärde.length === 1) {
    delar.push(`Senaste värdet ${nu} den ${punktnamn(senaste)}.`);
  } else {
    const lägst = medVärde.reduce((a, b) => (b.value < a.value ? b : a));
    const högst = medVärde.reduce((a, b) => (b.value > a.value ? b : a));
    const lågt = formatScore(lägst.value);
    const högt = formatScore(högst.value);

    if (lågt === högt) {
      delar.push(`Senaste värdet ${nu} den ${punktnamn(senaste)}.`, 'Samma värde hela perioden.');
    } else if (nu === lågt) {
      delar.push(`Senaste värdet ${nu} den ${punktnamn(senaste)}, periodens lägsta.`);
      delar.push(`Högst ${högt} den ${punktnamn(högst)}.`);
    } else if (nu === högt) {
      delar.push(`Senaste värdet ${nu} den ${punktnamn(senaste)}, periodens högsta.`);
      delar.push(`Lägst ${lågt} den ${punktnamn(lägst)}.`);
    } else {
      delar.push(`Senaste värdet ${nu} den ${punktnamn(senaste)}.`);
      delar.push(`Lägst ${lågt} den ${punktnamn(lägst)}, högst ${högt} den ${punktnamn(högst)}.`);
    }
  }

  const utan = punkter.length - medVärde.length;
  if (utan > 0) {
    delar.push(utan === 1 ? '1 dag utan svar.' : `${utan} dagar utan svar.`);
  }

  return delar.join(' ');
}

/**
 * Två serier mot varandra — en underenhet mot hela enheten.
 *
 * Beskrivs som två meningar, inte som en jämförelse punkt för punkt. Den som
 * lyssnar ska kunna hålla båda i huvudet; fjorton dagars parvisa tal går inte
 * att följa i tal.
 */
export function jämförelsebeskrivning(
  namn: string,
  egen: readonly Seriepunkt[],
  referensnamn: string,
  referens: readonly Seriepunkt[],
): string {
  return `${namn}: ${seriebeskrivning(egen)} ${referensnamn}: ${seriebeskrivning(referens)}`;
}

export interface Profilrad {
  kategori: string;
  vald: number;
  /** null när enhetens eget snitt undanhålls av integritetsskäl. */
  snitt: number | null;
}

/**
 * Spindeldiagrammet i ord: kategori för kategori, valet mot referensen.
 *
 * Här går det att räkna upp allt, eftersom det är sex tal och inte fjorton —
 * och det är just den jämförelsen diagrammet finns för.
 */
export function profilbeskrivning(
  namn: string,
  referensnamn: string,
  rader: readonly Profilrad[],
): string {
  if (rader.length === 0) return 'Inget underlag att visa ännu.';

  const led = rader.map((r) =>
    r.snitt === null
      ? `${r.kategori} ${formatScore(r.vald)}`
      : `${r.kategori} ${formatScore(r.vald)} mot ${formatScore(r.snitt)}`,
  );

  const saknarReferens = rader.every((r) => r.snitt === null);
  const inledning = saknarReferens
    ? `${namn}, per kategori:`
    : `${namn} mot ${referensnamn}, per kategori:`;

  return `${inledning} ${led.join(', ')}.`;
}

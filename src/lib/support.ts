import type { Category } from './data';
import { uppräkning } from './format';

/**
 * Stödkontakter som visas för en soldat med röda värden.
 *
 * Demons rådgivning sa "prata med befäl eller kompaniets kurator" utan att
 * ange hur. Ett råd utan kontaktväg är inte handlingsbart.
 *
 * De nationella numren nedan är verkliga och allmänt tillgängliga.
 * Förbandsspecifika kontakter (Försvarshälsan, kurator) måste fyllas i per
 * förband innan skarp drift — de varierar mellan regementen och får inte
 * gissas.
 */
/*
 * ── Avstängt den 15 oktober 2026 ────────────────────────────────────────────
 *
 * Fem fysioterapeuter, i en övning inför chefsmötet den 19 oktober: appen ska
 * inte bli en kommunikationskanal mellan värnpliktiga och befäl. En begäran
 * kan bli liggande när plutonchefen är ledig en vecka, och den värnpliktige
 * väntar på ett svar som inte kommer. Den som vill prata går fram och säger
 * det. Vägen till vård går via befälet, inte direkt till 1177 eller en
 * stödlinje. Richard beslutade att följa dem.
 *
 * Avstängt, inte borttaget — sätt `true` för att få tillbaka det. Inget i
 * databasen har ändrats, och gamla samtalsbegäranden ligger kvar och syns
 * igen hos befälet när SAMTALSBEGARAN_PA slås på. Se NÄSTA-STEG.md.
 *
 * Slås bara knapparna på, utan numren: kvittot i SupportBlock säger "använd
 * numren ovan", och de står då inte där. Se över den texten först.
 */

/** Telefonnumren i stödrutan: 112, Självmordslinjen, 1177, Jourhavande medmänniska. */
export const VISA_STODNUMMER = false;

/** Knapparna "Plutonchefen" / "Kompanichefen", och begärandena i befälsvyn. */
export const SAMTALSBEGARAN_PA = false;

/**
 * Det stödrutan säger när knapparna är avstängda. Då är det här den enda
 * vägen, och den ska sägas rakt ut.
 */
export const SAG_TILL_BEFALET =
  'Säg till ditt befäl att du vill prata. Befälet hjälper dig vidare, också till sjukvården om det behövs.';

export interface SupportContact {
  name: string;
  detail: string;
  phone?: string;
  urgent?: boolean;
}

const AKUT: SupportContact = {
  name: 'Akut fara',
  detail: 'Vid omedelbar risk för liv eller hälsa',
  phone: '112',
  urgent: true,
};

const SJALVMORDSLINJEN: SupportContact = {
  name: 'Självmordslinjen',
  detail: 'Öppet dygnet runt, alla dagar',
  phone: '90101',
  urgent: true,
};

const VARDGUIDEN: SupportContact = {
  name: '1177 Vårdguiden',
  detail: 'Sjukvårdsrådgivning dygnet runt',
  phone: '1177',
};

const JOURHAVANDE: SupportContact = {
  name: 'Jourhavande medmänniska',
  detail: 'Anonymt samtalsstöd, kvällar och nätter',
  phone: '08-702 16 80',
};

/*
 * Namngivna konstanter i stället för positioner i en lista. supportPlan()
 * sorterar om dem, och med index hade en ändrad ordning här tyst bytt plats
 * på Självmordslinjen och 1177.
 */
export const NATIONAL_CONTACTS: SupportContact[] = [AKUT, SJALVMORDSLINJEN, VARDGUIDEN, JOURHAVANDE];

/**
 * Förbandets egna stödfunktioner. Tomt tills en administratör lagt in dem —
 * hellre ingen uppgift än en påhittad.
 */
export const UNIT_CONTACTS: SupportContact[] = [];

/**
 * Försvarshälsan och sjukvårdare på förbandet.
 *
 * Utan telefonnummer, med flit. Numret skiljer sig mellan förband och får inte
 * gissas — se kommentaren överst. Vägen dit går via befäl eller sjukvårdare,
 * och det är en kontaktväg som finns överallt.
 */
export const HEALTH_SERVICE_CONTACT: SupportContact = {
  name: 'Försvarshälsan / sjukvårdare',
  detail: 'Kontakta via ditt befäl eller plutonens sjukvårdare',
};

/**
 * Kategorier där rött i första hand pekar mot hur någon mår och har det.
 * Övriga — fysisk, sömn, kost, energi — pekar mot kroppen och återhämtningen.
 */
const MIND: readonly Category[] = ['psykisk', 'social'];

export interface SupportPlan {
  intro: string;
  /** Visas överst — det som passar bäst för just de röda värdena. */
  primary: SupportContact[];
  /** Rubrik för resten. Alltid satt när `secondary` har innehåll. */
  secondaryLabel: string | null;
  secondary: SupportContact[];
}

/**
 * Vilka kontakter som visas, och i vilken ordning.
 *
 * Tidigare fick alla med minst ett rött värde samma lista: 112,
 * Självmordslinjen, 1177, Jourhavande medmänniska. Den som sovit och ätit
 * dåligt möttes alltså av Självmordslinjen — och aldrig av Försvarshälsan.
 * Problemanalysen från Skövde visar att överbelastningsbesvär är den helt
 * dominerande anledningen till att värnpliktiga söker Försvarshälsan, långt
 * före samtalsstöd.
 *
 * INGENTING TAS BORT, bara ordningen ändras. Alla kontakter finns med i
 * varje fall. Någon kan må dåligt psykiskt och ändå svara högt på den frågan,
 * och då ska stödlinjerna och 112 fortfarande stå där. Testet i
 * tests/stod.test.mjs håller den regeln för alla kombinationer.
 *
 * Är något psykiskt eller socialt rött går stödlinjerna först, även om
 * kroppen också är röd: det är det mest brådskande att inte missa.
 *
 * Med `nummer: false` (se VISA_STODNUMMER överst) visas ingen kontakt alls,
 * bara texten. Försvarshälsan försvinner också: dess rad säger "kontakta via
 * ditt befäl", vilket SAG_TILL_BEFALET redan säger.
 *
 * Returnerar null när inget värde är rött — då visas inget stödblock.
 */
export function supportPlan(
  red: readonly Category[],
  { nummer = VISA_STODNUMMER }: { nummer?: boolean } = {},
): SupportPlan | null {
  if (red.length === 0) return null;

  const halsa = [...UNIT_CONTACTS, HEALTH_SERVICE_CONTACT];
  const sinne = red.some((c) => MIND.includes(c));

  /*
   * Inledningen räknar rätt och nämner bara det som faktiskt är lågt. Den sa
   * "Några av dina värden är låga. Brist på sömn, mat och återhämtning…" också
   * när bara sömnen var röd (externa granskare, 17 oktober).
   */
  const antal = red.length === 1 ? 'Ett av dina värden är lågt.' : 'Några av dina värden är låga.';
  const BRIST: Partial<Record<Category, string>> = { somn: 'sömn', kost: 'mat', energi: 'återhämtning' };
  const brist = red.map((c) => BRIST[c]).filter((b): b is string => Boolean(b));
  const intro = sinne
    ? `${antal} Det är vanligare än du tror, och det finns folk vars uppgift det är att hjälpa till.`
    : brist.length > 0
      ? `${antal} Brist på ${uppräkning(brist)} ökar risken för belastningsskador — ta hjälp innan det blir en skada.`
      : `${antal} Ta hjälp i tid, innan det blir en skada.`;

  if (!nummer) return { intro, primary: [], secondaryLabel: null, secondary: [] };

  if (sinne) {
    return {
      intro,
      primary: [AKUT, SJALVMORDSLINJEN, JOURHAVANDE, VARDGUIDEN],
      secondaryLabel: 'Vården på förbandet',
      secondary: halsa,
    };
  }

  // Bara kropp, sömn, kost eller energi.
  return {
    intro,
    primary: [...halsa, VARDGUIDEN],
    secondaryLabel: 'Vid akut fara, eller om du mår psykiskt dåligt',
    secondary: [AKUT, SJALVMORDSLINJEN, JOURHAVANDE],
  };
}

import type { Category } from './data';

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
 * Returnerar null när inget värde är rött — då visas inget stödblock.
 */
export function supportPlan(red: readonly Category[]): SupportPlan | null {
  if (red.length === 0) return null;

  const halsa = [...UNIT_CONTACTS, HEALTH_SERVICE_CONTACT];

  if (red.some((c) => MIND.includes(c))) {
    return {
      intro:
        'Några av dina värden är låga. Det är vanligare än du tror, och det ' +
        'finns folk vars uppgift det är att hjälpa till.',
      primary: [AKUT, SJALVMORDSLINJEN, JOURHAVANDE, VARDGUIDEN],
      secondaryLabel: 'Vården på förbandet',
      secondary: halsa,
    };
  }

  // Bara kropp, sömn, kost eller energi.
  return {
    intro:
      'Några av dina värden är låga. Brist på sömn, mat och återhämtning ökar ' +
      'risken för belastningsskador — ta hjälp innan det blir en skada.',
    primary: [...halsa, VARDGUIDEN],
    secondaryLabel: 'Vid akut fara, eller om du mår psykiskt dåligt',
    secondary: [AKUT, SJALVMORDSLINJEN, JOURHAVANDE],
  };
}

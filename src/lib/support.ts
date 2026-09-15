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

export const NATIONAL_CONTACTS: SupportContact[] = [
  {
    name: 'Akut fara',
    detail: 'Vid omedelbar risk för liv eller hälsa',
    phone: '112',
    urgent: true,
  },
  {
    name: 'Självmordslinjen',
    detail: 'Öppet dygnet runt, alla dagar',
    phone: '90101',
    urgent: true,
  },
  {
    name: '1177 Vårdguiden',
    detail: 'Sjukvårdsrådgivning dygnet runt',
    phone: '1177',
  },
  {
    name: 'Jourhavande medmänniska',
    detail: 'Anonymt samtalsstöd, kvällar och nätter',
    phone: '08-702 16 80',
  },
];

/**
 * Förbandets egna stödfunktioner. Tomt tills en administratör lagt in dem —
 * hellre ingen uppgift än en påhittad.
 */
export const UNIT_CONTACTS: SupportContact[] = [];

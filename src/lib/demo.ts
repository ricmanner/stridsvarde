/**
 * Koderna som står öppet på inloggningssidan i demoläge.
 *
 * Listan finns på ETT ställe därför att den används till två saker som måste
 * hålla ihop: inloggningssidan visar den, och administrationen vägrar röra
 * kontona bakom den. Glider de isär publicerar vi en kod som någon just
 * hunnit spärra, eller skyddar ett konto ingen känner till.
 *
 * Skyddet gäller bara demoläge. I ett pilottest finns varken listan eller
 * kontona — se `environment()` i db/client.ts.
 */
export const PUBLICERADE_DEMOKODER = [
  { roll: 'Värnpliktig', kod: 'P1G1-01' },
  { roll: 'Plutonchef', kod: 'BEF-P1' },
  { roll: 'Kompanichef', kod: 'BEF-KP1' },
  { roll: 'Bataljonschef', kod: 'BEF-BAT' },
  { roll: 'Administratör', kod: 'ADMIN-01' },
] as const;

/** Meddelandet när någon försöker ändra ett av dem. */
export const DEMOKONTO_SKYDDAT =
  'Kontot står på inloggningssidan och är demonstrationens ingång. ' +
  'Skapa ett eget konto för att prova spärr, ny kod och radering.';

/**
 * Tjänstedatum ("service date") — alltid Europe/Stockholm, aldrig UTC.
 *
 * Demon använde `new Date().toISOString().split('T')[0]`, vilket ger UTC.
 * En incheckning kl 23:30 svensk tid hamnade då på gårdagens datum under
 * sommartid. Allt datumberoende i appen ska gå genom den här filen.
 */

const TZ = 'Europe/Stockholm';

/** Dagens tjänstedatum i Stockholm, som 'YYYY-MM-DD'. */
export function serviceDate(d: Date = new Date()): string {
  // 'en-CA' formaterar som YYYY-MM-DD, vilket är exakt det vi vill ha.
  return d.toLocaleDateString('en-CA', { timeZone: TZ });
}

/**
 * Tjänstedatumet N dagar bakåt.
 *
 * Räknar på kalenderdatum i UTC-rymden (där ingen sommartid finns) efter att
 * först ha plockat ut Stockholms kalenderdatum. Det undviker fel på ±1 dag
 * kring sommartidsomställningarna i mars och oktober.
 */
export function serviceDateDaysAgo(days: number, from: Date = new Date()): string {
  const [y, m, d] = serviceDate(from).split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d) - days * 86_400_000);
  return shifted.toISOString().slice(0, 10);
}

/**
 * En sammanhängande lista tjänstedatum, äldst först, inklusive idag.
 * Används för att rita grafer med luckor för dagar utan svar — annars
 * skulle en dag helt utan incheckningar tyst försvinna ur kurvan.
 */
export function serviceDateRange(numDays: number, from: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = numDays - 1; i >= 0; i--) out.push(serviceDateDaysAgo(i, from));
  return out;
}

/** '2026-09-15' → '15/9' för grafernas x-axel. */
export function shortLabel(isoDate: string): string {
  const [, m, d] = isoDate.split('-');
  return `${Number(d)}/${Number(m)}`;
}

/** Svensk veckodag i kortform, t.ex. 'mån'. */
export function weekdayLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d))
    .toLocaleDateString('sv-SE', { weekday: 'short', timeZone: 'UTC' })
    .replace('.', '');
}

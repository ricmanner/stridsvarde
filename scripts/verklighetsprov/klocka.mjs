/**
 * Framflyttad klocka för verklighetsprovet — laddas före appen med
 * `node --import`, så att appen själv är orörd.
 *
 * Appen tar dagens datum ur `new Date()` (src/lib/date.ts) och låter bara en
 * värnpliktig checka in för idag. För att spela fjorton dagar startas den
 * lokala servern om varje "dag" med PROV_IDAG satt till den dagen. Klockan
 * börjar 08.00 svensk tid och går sedan som vanligt.
 *
 * Datumen ska ligga EFTER den verkliga dagen. Sessionskakans utgångsdatum
 * räknas på serverns klocka men kontrolleras av webbläsaren mot den riktiga:
 * en dag i det förflutna hade gett en kaka som redan gått ut.
 */
const idag = process.env.PROV_IDAG;

if (idag) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(idag)) {
    throw new Error(`PROV_IDAG ska vara ÅÅÅÅ-MM-DD, inte "${idag}"`);
  }
  const RiktigDate = Date;
  // 08.00 i Stockholm: 06.00 UTC under vintertid (provets dagar ligger i november).
  const mal = RiktigDate.parse(`${idag}T06:00:00Z`);
  const forskjutning = mal - RiktigDate.now();

  class ProvDate extends RiktigDate {
    constructor(...args) {
      if (args.length === 0) super(RiktigDate.now() + forskjutning);
      else super(...args);
    }
    static now() {
      return RiktigDate.now() + forskjutning;
    }
  }
  /*
   * Egna exemplar av de statiska funktionerna. Next lindar in Date och
   * kopierar bara klassens egna egenskaper, så de ärvda försvann: appen
   * kraschade med "Date.UTC is not a function" (src/lib/date.ts).
   */
  ProvDate.UTC = RiktigDate.UTC;
  ProvDate.parse = RiktigDate.parse;
  globalThis.Date = ProvDate;
}

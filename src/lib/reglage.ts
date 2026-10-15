/**
 * Vilken siffra ett tryck på reglaget betyder.
 *
 * Reglaget börjar tomt (se ScoreSlider), och det första trycket ska ge den
 * siffra man trycker på. iPhones Safari flyttar inte ett reglage vid ett
 * tryck på spåret, bara när man drar i tummen — och ett tomt reglage har
 * ingen tumme att dra i. Därför räknas siffran ut här.
 *
 * Tummens mittpunkt rör sig mellan en halv tumbredd från vänster kant och en
 * halv tumbredd från höger, precis som webbläsaren ritar den. Räknas det över
 * hela bredden hamnar ett tryck på åttan som en sjua.
 *
 * @param x       trycket, räknat från reglagets vänsterkant
 * @param bredd   reglagets bredd
 * @param tumme   tummens bredd (28 px, se .psvi-slider i globals.css)
 */
export function vardeVidTryck(x: number, bredd: number, tumme: number): number {
  return 1 + Math.round(andelVidTryck(x, bredd, tumme) * 9);
}

/**
 * Var på spåret knappens mitt står, från 0 (ettan) till 1 (tian) — utan att
 * avrunda till en siffra. Medan man drar står knappen här, under fingret,
 * och glider till närmaste siffra när man släpper (ScoreSlider).
 */
export function andelVidTryck(x: number, bredd: number, tumme: number): number {
  const andel = (x - tumme / 2) / (bredd - tumme);
  return Math.min(1, Math.max(0, andel));
}

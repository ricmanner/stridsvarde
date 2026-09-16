/**
 * Talformat för allt som visas.
 *
 * Klientsäker — inga serverimporter — så samma funktion används i
 * serverkomponenter, klientkomponenter och notistexter.
 *
 * `toFixed(1)` skrev "5.0" med punkt. För svenska läsare ser det ut som en
 * felöversättning, och appen visas för befäl som inte har anledning att
 * förlåta det. Svensk standard är decimalkomma: "5,0".
 */
export function formatScore(n: number): string {
  return n.toLocaleString('sv-SE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

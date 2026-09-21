import { expect, type Page } from '@playwright/test';

/**
 * Gemensamt för de webbläsartester som öppnar appen på riktigt.
 *
 * Koderna är demons publicerade — samma som står på inloggningssidan. De
 * P1G1-koderna har dagen öppen i seedad demodata (se DAGEN_OPPEN i seed.ts),
 * så det går att gå igenom incheckningen med dem.
 */

export const KODER = {
  varnpliktig: 'P1G1-01',
  varnpliktigKlar: 'P1G2-01', // har redan rapporterat idag
  plutonchef: 'BEF-P1',
  kompanichef: 'BEF-KP1',
  bataljonschef: 'BEF-BAT',
  admin: 'ADMIN-01',
} as const;

export async function loggaIn(page: Page, kod: string): Promise<void> {
  // Rensa först: är man redan inloggad skickar startsidan vidare till rollens
  // egen vy, och då finns inget kodfält att fylla i.
  await page.context().clearCookies();
  await page.goto('/');
  await page.locator('input[name="code"]').fill(kod);
  await page.getByRole('button', { name: 'Logga in' }).click();
  await expect(page).not.toHaveURL(/\/$|utgangen/, { timeout: 15_000 });
}

/**
 * Texten som faktiskt syns, i en form som går att söka i.
 *
 * Webbläsaren återger versalisering från formatmallen, så en rubrik skriven
 * "Enheter" kommer tillbaka som "ENHETER". Jämförelser görs därför i gemener.
 */
export async function synligText(page: Page): Promise<string> {
  /*
   * Vänta ut laddningsvyn först. Utan det läser man "Hämtar…" i stället för
   * sidan, och testet rapporterar att innehållet saknas fast det bara ännu
   * inte hunnit fram. Väntar på kännetecknet och inte på role="status" —
   * adminsidan har en egen sådan som ska stå kvar. Se components/Laddar.tsx.
   */
  await expect(page.locator('[data-laddar]')).toBeHidden();
  return (await page.locator('body').innerText()).toLowerCase();
}

/** Enskilda personers benämningar får aldrig synas i en befälsvy. */
export async function ingaEnskildaPersoner(page: Page): Promise<void> {
  const text = await synligText(page);
  expect(text, 'en enskild persons benämning syns i en befälsvy').not.toMatch(
    /\b(värnpliktig|soldat)\s+\d{2}\b/,
  );
}

/**
 * Öppnar incheckningen, oavsett om dagen redan är besvarad.
 *
 * Databasen lever kvar mellan körningar, så en värnpliktig som checkat in i
 * en tidigare körning skickas direkt till sin återkoppling. Då går samma
 * flöde att nå som rättelse — vilket dessutom är den väg en verklig användare
 * tar när hen svarat fel.
 */
export async function oppnaIncheckning(page: Page): Promise<void> {
  await page.goto('/soldat');

  /*
   * Vänta ut omdirigeringen innan adressen läses.
   *
   * Har dagen redan besvarats skickar servern vidare till återkopplingen,
   * och den omdirigeringen hinner inte alltid fram innan goto() återvänder.
   * Läser man adressen för tidigt ser den ut att vara /soldat, rättelsevägen
   * hoppas över, och testet letar efter en startknapp på en sida som visar
   * återkopplingen. Kostade en felsökning: fem av sex körningar föll på det,
   * och det syntes inte alls förrän samma konto användes två gånger.
   */
  await page.waitForLoadState('networkidle');
  if (page.url().includes('/dashboard')) await page.goto('/soldat?redigera=1');

  await page.getByRole('button', { name: /Starta incheckning|Fortsätt/ }).click();
}

/** Skickar in, med den knapptext som gäller för nytt svar eller rättelse. */
export async function skickaIncheckning(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Bekräfta och skicka|Spara ändringen/ }).click();
  await expect(page).toHaveURL(/\/soldat\/dashboard$/, { timeout: 20_000 });
}

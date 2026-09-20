import { expect, test, type Page } from '@playwright/test';

import { loggaIn, oppnaIncheckning } from './hjalp';

/**
 * Vad som händer när nätet inte svarar.
 *
 * Det här är inte ett påhittat fall. Den värnpliktige rapporterar från en
 * telefon, ofta i skogen, och begäran kan bli hängande på två sätt:
 *
 *   1. Servern får den, men databasen svarar inte.
 *   2. Servern hör aldrig av den — täckningen dog på vägen.
 *
 * En tidsgräns på servern hjälper bara mot det första. Det här testet
 * framkallar det andra: begäran fångas i webbläsaren och besvaras aldrig.
 * Utan ett skyddsnät i klienten står knappen kvar på "Sparar…" för evigt,
 * utan felruta och utan möjlighet att försöka igen.
 *
 * Testet klarar sig utan att veta hur lösningen ser ut — det kräver bara att
 * användaren får ett besked och en väg vidare.
 */

/** Ungefär så länge en människa orkar vänta innan appen känns trasig. */
const RIMLIG_VANTAN = 20_000;

/** Besvarar de sex frågorna med samma värde och stannar på sammanfattningen. */
async function fyllIIncheckningen(page: Page, steg: number): Promise<void> {
  for (let fraga = 1; fraga <= 6; fraga++) {
    const reglage = page.locator('input[type="range"]');
    await expect(reglage).toBeVisible();
    await reglage.focus();
    // Reglaget börjar på 5. Uppåt, så att värdena inte blir röda och drar in
    // stödrutan — den hör till ett annat test.
    for (let i = 0; i < steg; i++) await page.keyboard.press('ArrowRight');
    await page.getByRole('button', { name: fraga === 6 ? 'Sammanfattning' : 'Nästa' }).click();
  }
  await expect(page.getByText(/Bekräfta din incheckning|Bekräfta ändringen/)).toBeVisible();
}

test('en incheckning som inte når fram ger besked i stället för att hänga', async ({ page }) => {
  // Egen värnpliktig: P1G1-01 till 03 används av andra tester, och den här
  // rapporten ska aldrig bli sparad.
  await loggaIn(page, 'P1G1-04');
  await oppnaIncheckning(page);
  await fyllIIncheckningen(page, 3); // 5 + 3 = 8 på varje fråga

  /*
   * Här stryps nätet. En Server Action är en POST till den adress man står
   * på, så incheckningens begäran fångas på /soldat. Handlaren svarar aldrig
   * — det är just det en död förbindelse gör. Den kopplas in först nu, så
   * att inloggning och sidhämtningar dessförinnan fungerar som vanligt.
   */
  await page.route(
    (url) => url.pathname === '/soldat',
    async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      await new Promise(() => {}); // svarar aldrig
    },
  );

  await page.getByRole('button', { name: /Bekräfta och skicka|Spara ändringen/ }).click();

  // 1. Den värnpliktige ska få veta att det inte gick.
  await expect(
    page.getByRole('alert').filter({ hasText: /gick inte|svarar inte|försök/i }),
    'ingen felruta visades — den värnpliktige lämnas i ovisshet',
  ).toBeVisible({ timeout: RIMLIG_VANTAN });

  // 2. Och kunna försöka igen. En knapp som står kvar på "Sparar…" är en
  //    återvändsgränd: sidan måste laddas om, och då är svaren borta.
  const knapp = page.getByRole('button', { name: /Bekräfta och skicka|Spara ändringen/ });
  await expect(knapp, 'knappen släpptes aldrig — går inte att försöka igen').toBeEnabled();

  // 3. Svaren ska ligga kvar. Att fylla i sex frågor på nytt efter ett
  //    nätverksfel är det säkraste sättet att få någon att sluta rapportera.
  await expect(
    page.getByRole('button', { name: /Ändra Sömn, nu 8 av 10/ }),
    'svaren försvann ur formuläret',
  ).toBeVisible();
});

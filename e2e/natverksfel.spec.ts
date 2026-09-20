import { expect, test, type Page } from '@playwright/test';

import { KODER, loggaIn, oppnaIncheckning } from './hjalp';

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
  const dödNät = async (route: import('@playwright/test').Route) => {
    if (route.request().method() !== 'POST') return route.continue();
    await new Promise(() => {}); // svarar aldrig
  };
  await page.route((url) => url.pathname === '/soldat', dödNät);

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

  /*
   * 4. Och när täckningen kommer tillbaka ska ett nytt tryck faktiskt gå
   *    fram. Det här är det egentliga kravet: en felruta som inte leder
   *    någonstans hjälper ingen. Prövas på riktigt, för en ny begäran kan
   *    hamna i kö bakom den som fortfarande hänger — och då ser knappen ut
   *    att fungera utan att göra något.
   */
  // unrouteAll, inte unroute: den senare matchar på funktionens identitet,
  // och en likadan men ny pilfunktion tar inte bort någonting. Kostade en
  // felsökning — avlyssningen låg kvar och appen fick skulden.
  await page.unrouteAll({ behavior: 'ignoreErrors' });

  const skickadeBegäran: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST') skickadeBegäran.push(r.url());
  });

  await knapp.click();

  /*
   * Två kontroller, för de faller på olika saker. Att en ny begäran alls
   * gick ut skiljer "knappen gjorde ingenting" från "nätet är fortfarande
   * nere" — och det är det första som är det farliga felet, eftersom
   * ingenting då syns utåt.
   */
  await expect(async () =>
    expect(skickadeBegäran.length, 'knappen skickade ingen ny begäran').toBeGreaterThan(0),
  ).toPass({ timeout: 5_000 });

  await expect(page, 'nytt försök gick inte fram trots att nätet var tillbaka').toHaveURL(
    /\/soldat\/dashboard$/,
    { timeout: RIMLIG_VANTAN },
  );
});

/**
 * Det andra fallet: nätet är inte dött, bara segt.
 *
 * Befälets vyer räknar om aggregat över hela underenhetsträdet. Tar det tid
 * står den gamla sidan kvar oförändrad, och den rimliga slutsatsen är att
 * klicket inte tog — så klickar man igen, och varje klick startar en ny
 * omräkning som gör väntan längre.
 */

/**
 * Gör appens egna sidhämtningar sävliga, som på ett dåligt mobilnät.
 *
 * Förhämtningen stoppas också, och det är inte fusk utan själva poängen.
 * Next hämtar sidan i bakgrunden redan när länken syns, och lyckas det blir
 * klicket omedelbart — då behövs ingen laddningsvy. Den behövs precis när
 * förhämtningen INTE hunnit fram, vilket är vad ett svagt nät innebär.
 *
 * De två skiljs åt på rubrikerna: `rsc` finns på båda, `next-router-prefetch`
 * bara på förhämtningen.
 */
async function sävligtNät(page: Page, sökväg: string, ms = 5_000): Promise<void> {
  await page.route(
    (url) => url.pathname === sökväg,
    async (route) => {
      const rubriker = route.request().headers();
      if (!rubriker['rsc']) return route.continue();
      /*
       * Förhämtningen släpps fram, bara datan bromsas — och det är hela
       * skillnaden. Next hämtar laddningsskalet i förväg och visar det
       * omedelbart vid klicket; bromsas även förhämtningen är navigeringen
       * i stället BLOCKERAD tills den kommer fram, och då syns ingenting
       * alls. Det såg länge ut som att laddningsvyn var trasig.
       */
      if (rubriker['next-router-prefetch']) return route.continue();
      await new Promise((r) => setTimeout(r, ms));
      await route.continue();
    },
  );
}

test('en långsam sidväxling visar att något är på gång', async ({ page }) => {
  await sävligtNät(page, '/rapport');
  await loggaIn(page, KODER.plutonchef);

  const till = page.getByRole('link', { name: /Rapport för utskrift/ });
  await expect(till).toBeVisible();

  /*
   * Länken måste rullas fram och få ett ögonblick på sig.
   *
   * Next förhämtar en länk när den syns på skärmen, och det är förhämtningen
   * som gör att laddningsvyn kan visas direkt vid klicket. Mätt: utan de här
   * två raderna kommer första begäran först vid klicket, navigeringen
   * blockeras tills den svarat, och skärmen står still på den gamla sidan.
   * Playwrights toBeVisible() kräver inte att elementet syns i fönstret, så
   * det räcker inte för att förhämtningen ska hinna starta.
   */
  await till.scrollIntoViewIfNeeded();
  await page.waitForTimeout(2_000);

  await till.click();

  await expect(
    page.getByRole('status'),
    'ingenting visade att sidan hämtades — klicket ser ut att ha uteblivit',
  ).toBeVisible({ timeout: 3_000 });
});

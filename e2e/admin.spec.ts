import { expect, test } from '@playwright/test';

import { KODER, loggaIn, synligText } from './hjalp';

/**
 * Adminvyn — den enda vy som får se enskilda personer, och den enda som kan
 * förstöra något oåterkalleligt.
 */

const KODMONSTER = /[A-Z2-9]{5}-[A-Z2-9]{5}/;

test.beforeEach(async ({ page }) => {
  await loggaIn(page, KODER.admin);
  await expect(page).toHaveURL(/\/admin/);
});

test('två kodbyten i rad visar båda koderna', async ({ page }) => {
  /*
   * Regressionstest. Lappen kändes tidigare igen på LÄNGDEN av kodsträngen,
   * och eftersom varje kod är elva tecken visades den andra lappen aldrig —
   * medan servern redan hade bytt kod. Personen blev utelåst för gott,
   * eftersom bara hashen sparas.
   *
   * Testet skapar en egen grupp med egna personer. Att byta kod på demons
   * värnpliktiga vore att dra undan mattan för de andra testerna: deras
   * inloggning slutar fungera i samma sekund.
   */
  await page.getByRole('link', { name: /2\. pluton/ }).first().click();
  await expect(page).toHaveURL(/unit=\d+/);
  await expect(page.getByRole('heading', { name: /Ny grupp under 2\. pluton/ })).toBeVisible();

  /*
   * Exakt etikett. Sedan enheter går att byta namn finns två fält som slutar
   * på "Namn" i vyn, och getByLabel söker på delsträng — utan exact träffar
   * den båda och testet faller på "strict mode violation", inte på appen.
   */
  const grupp = `E2E-koder ${Date.now().toString(36)}`;
  await page.getByLabel('Namn', { exact: true }).fill(grupp);
  await page.getByRole('button', { name: 'Skapa', exact: true }).click();

  const gruppLank = page.getByRole('link', { name: new RegExp(grupp) });
  await expect(gruppLank).toBeVisible({ timeout: 20_000 });
  await gruppLank.click();
  await expect(page.getByRole('heading', { name: /Lägg till personer/ })).toBeVisible();

  await page.getByLabel('Antal värnpliktiga').fill('2');
  await page.getByRole('button', { name: /Skapa värnpliktiga och koder/ }).click();

  // Först visas lappen med de två nya koderna. Stäng den.
  await expect(page.getByText(KODMONSTER).first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Stäng' }).click();
  await expect(page.getByText(KODMONSTER)).toHaveCount(0);

  const knappar = page.getByRole('button', { name: 'Ny kod' });
  await expect(knappar).toHaveCount(2);

  // "Ny kod" frågar först — se testet nedan.
  await knappar.nth(0).click();
  await page.getByRole('button', { name: 'Utfärda ny kod' }).click();
  const forsta = (await page.getByText(KODMONSTER).first().innerText()).trim();
  expect(forsta).toMatch(KODMONSTER);

  await page.getByRole('button', { name: 'Stäng' }).click();
  await expect(page.getByText(KODMONSTER)).toHaveCount(0);

  await knappar.nth(1).click();
  await page.getByRole('button', { name: 'Utfärda ny kod' }).click();
  const andra = (await page.getByText(KODMONSTER).first().innerText()).trim();
  expect(andra, 'den andra personens kod visades inte — hen är utelåst').toMatch(KODMONSTER);
  expect(andra).not.toBe(forsta);
});

test('ny kod frågar först, och rutan gäller rätt person', async ({ page }) => {
  /*
   * "Ny kod" spärrade den nuvarande koden direkt, på ett klick. Klickade man
   * på fel rad var den värnpliktige utelåst tills den nya lappen lämnats
   * över. Radering frågade redan; det här var den enda oåterkalleliga
   * knappen som inte gjorde det.
   *
   * Rutans namn kontrolleras också. Alla bekräftelserutor delade samma id,
   * så en skärmläsare fick den FÖRSTA radens fråga uppläst oavsett vilken
   * rad man tryckt på.
   */
  await page.getByRole('link', { name: /1\. pluton/ }).first().click();
  await expect(page).toHaveURL(/unit=\d+/);
  await expect(page.getByRole('heading', { name: /Ny grupp under 1\. pluton/ })).toBeVisible();

  const grupp = `E2E-fraga ${Date.now().toString(36)}`;
  await page.getByLabel('Namn', { exact: true }).fill(grupp);
  await page.getByRole('button', { name: 'Skapa', exact: true }).click();
  const gruppLank = page.getByRole('link', { name: new RegExp(grupp) });
  await expect(gruppLank).toBeVisible({ timeout: 20_000 });
  await gruppLank.click();
  await expect(page.getByRole('heading', { name: /Lägg till personer/ })).toBeVisible();

  await page.getByLabel('Antal värnpliktiga').fill('2');
  await page.getByRole('button', { name: /Skapa värnpliktiga och koder/ }).click();
  await expect(page.getByText(KODMONSTER).first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Stäng' }).click();
  await expect(page.getByText(KODMONSTER)).toHaveCount(0);

  await page.getByRole('button', { name: 'Ny kod' }).nth(1).click();
  const ruta = page.getByRole('dialog', { name: 'Ge Värnpliktig 02 en ny kod?' });
  await expect(ruta).toBeVisible();
  await expect(page.getByText(KODMONSTER), 'koden byttes innan någon bekräftat').toHaveCount(0);
  // Kort: vad som händer nu. Att koden visas en gång säger lappen själv.
  await expect(ruta).toContainText('Den nuvarande koden slutar fungera direkt.');
  await expect(ruta).not.toContainText('en enda gång');

  await ruta.getByRole('button', { name: 'Avbryt' }).click();
  await expect(ruta).toBeHidden();
  await expect(page.getByText(KODMONSTER), 'Avbryt bytte koden ändå').toHaveCount(0);
});

/*
 * Förslaget på ett nytt befäls benämning är rollen, inte roll plus enhet:
 * "Bataljonschef Bataljonen" och "Kompanichef 1. kompani" sa enheten två
 * gånger — den står redan i trädet och i sidhuvudet.
 */
test('ett nytt befäl föreslås heta sin roll', async ({ page }) => {
  await expect(page.getByLabel('Befälets benämning')).toHaveValue('Bataljonschef');
  await page.getByRole('link', { name: /1\. kompani/ }).first().click();
  await expect(page).toHaveURL(/unit=\d+/);
  await expect(page.getByLabel('Befälets benämning')).toHaveValue('Kompanichef');
});

/*
 * Adminvyn säger vilken enhet man står i, och börjar med personerna.
 *
 * Nio grupper heter "1. grupp". Rubriken var en liten grå rad, "GRUPP ·
 * 1. GRUPP", och sa inte vilken — medan den som raderar en enhet bekräftar
 * genom att skriva just det namnet. Ordningen blandade personer och enhet
 * om vartannat, med namnbytet, det man gör mest sällan, som tvåa. Och rutan
 * om gallring, som gäller hela systemet, stod överst på varje enhet.
 *
 * textContent, inte innerText: rubrikerna är versaler i formatmallen.
 */
test('vald enhet syns med hela vägen, och sidan börjar med personerna', async ({ page }) => {
  await expect(page.getByText('Gallring av hälsodata')).toBeVisible();

  await page.getByRole('link', { name: /1\. grupp/ }).first().click();
  await expect(page).toHaveURL(/unit=\d+/);
  await expect(page.getByRole('heading', { level: 2, name: '1. grupp', exact: true })).toBeVisible();
  await expect(page.getByText('i 1. bataljon › 1. kompani › 1. pluton', { exact: true })).toBeVisible();
  await expect(page.getByText('Gallring av hälsodata')).toHaveCount(0);

  const ordning = await page
    .getByRole('heading', { level: 3 })
    .evaluateAll((hs) => hs.map((h) => (h.textContent ?? '').replace(/\s*\(\d+\)\s*$/, '').trim()));
  expect(ordning).toEqual([
    'Personer i enheten',
    'Lägg till personer',
    'Flytta person',
    'Byt namn på enheten',
    'Radera hälsodata',
    'Radera enheten',
  ]);
});

test('demons publicerade konton går inte att förstöra', async ({ page }) => {
  await page.getByRole('link', { name: /1\. grupp/ }).first().click();

  // Raden för det publicerade kontot är låst: ingen knapp för ny kod, utan
  // en förklaring. En knapp som alltid misslyckas vore sämre än ingen knapp.
  const text = await synligText(page);
  expect(text).toContain('låst — demonstrationens ingång');

  const lasta = page.getByText('Låst — demonstrationens ingång');
  await expect(lasta.first()).toBeVisible();
});

test('en ny grupp dyker upp, och går att radera igen', async ({ page }) => {
  await page.getByRole('link', { name: /1\. pluton/ }).first().click();
  /*
   * Vänta tills valet landat innan något skrivs. Klicket i trädet ritar om
   * högra spalten, och text som skrivs under tiden försvinner med den gamla
   * DOM:en — testet skrev i ett fält som ersattes en sekund senare.
   */
  await expect(page).toHaveURL(/unit=\d+/);
  await expect(page.getByRole('heading', { name: /Ny grupp under 1\. pluton/ })).toBeVisible();

  // Unikt namn per körning: två syskonenheter får inte heta lika, och
  // databasen lever kvar mellan körningar. Klockan modulo 10 000 upprepas var
  // tionde sekund och krockade med en tidigare körning.
  const namn = `Grupp E2E ${Date.now().toString(36)}`;
  await page.getByLabel('Namn', { exact: true }).fill(namn);
  /*
   * Formuläret fungerar även innan sidan blivit interaktiv — då skickas det
   * som ett vanligt HTML-formulär och bekräftelsemeddelandet går förlorat,
   * men enheten skapas. Testet kontrollerar därför trädet, som kommer från
   * servern, i stället för meddelandet, som bara finns när JavaScript hann med.
   */
  await page.getByRole('button', { name: 'Skapa', exact: true }).click();
  await expect(page.getByRole('link', { name: new RegExp(namn) })).toBeVisible({ timeout: 20_000 });

  // Radera den igen. Tre steg med flit: visa vad som försvinner, bekräfta,
  // radera. En tom enhet slipper skriva namnet men får en ja-eller-nej-ruta.
  await page.getByRole('link', { name: new RegExp(namn) }).click();
  await expect(page.getByRole('heading', { name: 'Radera enheten' })).toBeVisible();

  await page.getByRole('button', { name: 'Visa vad som raderas' }).click();
  const radera = page.getByRole('button', { name: new RegExp(`Radera ${namn}`) });
  await expect(radera).toBeVisible();

  /*
   * Bekräftelsen är appens egen ruta sedan window.confirm ersattes: en
   * <dialog> med Avbryt och en knapp som säger vad den gör. Den gamla raden
   * lyssnade efter webbläsarens ruta, som inte längre dyker upp.
   */
  await radera.click();
  await expect(page.getByRole('heading', { name: new RegExp(`Radera ${namn}\\?`) })).toBeVisible();
  await page.getByRole('button', { name: 'Radera enheten' }).click();

  await expect(page.getByRole('link', { name: new RegExp(namn) })).toHaveCount(0, {
    timeout: 15_000,
  });
});

test('statussidan går att hitta, och visar databasläge och fångade fel', async ({ page }) => {
  // Sidan gick bara att nå genom att kunna adressen utantill — administratören
  // hittade den inte. Nu finns en länk från adminvyn, och en väg tillbaka.
  await page.getByRole('link', { name: 'Systemstatus och databas' }).click();
  await expect(page).toHaveURL(/\/status$/);
  const text = await synligText(page);
  expect(text).toContain('systemstatus');
  expect(text).toContain('fel som servern fångat');
  expect(text).not.toContain('kunde inte startas');

  // Administratörskoden står på inloggningssidan i demoläge, så den här sidan
  // är i praktiken offentlig. Databasens adress hör inte hemma på en offentlig
  // sida — varken värdnamnet på fjärrdatabasen eller sökvägen till en lokal fil.
  expect(text).not.toContain('libsql://');
  expect(text).not.toMatch(/\/users\/|\.db\b/);

  await page.getByRole('link', { name: /Tillbaka till administrationen/ }).click();
  await expect(page).toHaveURL(/\/admin$/);
});

test('statussidan berättar hur gammal demodatan är', async ({ page }) => {
  /*
   * Demodatan åldras av sig själv, och den enda vägen att flytta fram den mot
   * den delade demon går via den här sidan: databasnycklarna är märkta som
   * känsliga och går inte att hämta ner till en terminal.
   *
   * Testdatabasen seedas om vid varje körning och slutar därför idag. Det som
   * går att kontrollera här är att rutan finns, att den säger att datan är
   * aktuell, och att ingen knapp erbjuds när det inte finns något att göra.
   * Bedömningen av gammal data är täckt av tests/demo-tid-text.test.mjs.
   */
  await page.goto('/status');
  await expect(page.getByRole('heading', { name: 'Demodata' })).toBeVisible();

  const text = await synligText(page);
  expect(text).toContain('demodatan är aktuell');

  await expect(page.getByRole('button', { name: 'Flytta fram demodatan' })).toHaveCount(0);
});

test('återställningen kräver bekräftelseordet och rör inget utan det', async ({ page }) => {
  /*
   * Testet trycker med FEL ord med flit. Rätt ord tömmer databasen och bygger
   * om den, vilket skulle dra undan mattan för de tester som körs efter — de
   * delar databas. Att återställningen verkligen bygger upp demon igen är
   * täckt av tests/aterstallning.test.mjs, som kör den på riktigt.
   *
   * Det som mäts här är spärren: att en felklickning mitt i en visning inte
   * raderar demon.
   */
  await page.goto('/status');
  await expect(page.getByRole('heading', { name: 'Demodata' })).toBeVisible();

  const enheterFore = await page.goto('/admin').then(() => page.getByRole('link').count());

  await page.goto('/status');
  await page.getByLabel(/Skriv ÅTERSTÄLL/).fill('kanske');
  await page.getByRole('button', { name: 'Återställ demon' }).click();

  // Texten, inte rollen: Next har en egen tom role="alert" för sidbyten, och
  // getByRole('alert') träffar båda.
  await expect(page.getByText('Fel bekräftelseord')).toBeVisible();

  // Fortfarande inloggad, och organisationen orörd.
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin/);
  expect(await page.getByRole('link').count()).toBe(enheterFore);
});

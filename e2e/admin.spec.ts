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
  await page.getByRole('link', { name: /Pluton 2/ }).first().click();
  await expect(page).toHaveURL(/unit=\d+/);
  await expect(page.getByRole('heading', { name: /Ny grupp under Pluton 2/ })).toBeVisible();

  const grupp = `E2E-koder ${Date.now().toString(36)}`;
  await page.getByLabel('Namn').fill(grupp);
  await page.getByRole('button', { name: 'Skapa', exact: true }).click();

  const gruppLank = page.getByRole('link', { name: new RegExp(grupp) });
  await expect(gruppLank).toBeVisible({ timeout: 20_000 });
  await gruppLank.click();
  await expect(page.getByRole('heading', { name: /Lägg till personer/ })).toBeVisible();

  await page.getByLabel('Antal värnpliktiga').fill('2');
  await page.getByRole('button', { name: /Skapa och generera koder/ }).click();

  // Först visas lappen med de två nya koderna. Stäng den.
  await expect(page.getByText(KODMONSTER).first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Stäng' }).click();
  await expect(page.getByText(KODMONSTER)).toHaveCount(0);

  const knappar = page.getByRole('button', { name: 'Ny kod' });
  await expect(knappar).toHaveCount(2);

  await knappar.nth(0).click();
  const forsta = (await page.getByText(KODMONSTER).first().innerText()).trim();
  expect(forsta).toMatch(KODMONSTER);

  await page.getByRole('button', { name: 'Stäng' }).click();
  await expect(page.getByText(KODMONSTER)).toHaveCount(0);

  await knappar.nth(1).click();
  const andra = (await page.getByText(KODMONSTER).first().innerText()).trim();
  expect(andra, 'den andra personens kod visades inte — hen är utelåst').toMatch(KODMONSTER);
  expect(andra).not.toBe(forsta);
});

test('demons publicerade konton går inte att förstöra', async ({ page }) => {
  await page.getByRole('link', { name: /Grupp 1/ }).first().click();

  // Raden för det publicerade kontot är låst: ingen knapp för ny kod, utan
  // en förklaring. En knapp som alltid misslyckas vore sämre än ingen knapp.
  const text = await synligText(page);
  expect(text).toContain('låst — demonstrationens ingång');

  const lasta = page.getByText('Låst — demonstrationens ingång');
  await expect(lasta.first()).toBeVisible();
});

test('en ny grupp dyker upp, och går att radera igen', async ({ page }) => {
  await page.getByRole('link', { name: /Pluton 1/ }).first().click();
  /*
   * Vänta tills valet landat innan något skrivs. Klicket i trädet ritar om
   * högra spalten, och text som skrivs under tiden försvinner med den gamla
   * DOM:en — testet skrev i ett fält som ersattes en sekund senare.
   */
  await expect(page).toHaveURL(/unit=\d+/);
  await expect(page.getByRole('heading', { name: /Ny grupp under Pluton 1/ })).toBeVisible();

  // Unikt namn per körning: två syskonenheter får inte heta lika, och
  // databasen lever kvar mellan körningar. Klockan modulo 10 000 upprepas var
  // tionde sekund och krockade med en tidigare körning.
  const namn = `Grupp E2E ${Date.now().toString(36)}`;
  await page.getByLabel('Namn').fill(namn);
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

  page.once('dialog', (d) => d.accept());
  await radera.click();

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

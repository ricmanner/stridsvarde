import { expect, test } from '@playwright/test';

import { ingaEnskildaPersoner, KODER, loggaIn, synligText } from './hjalp';

/**
 * Befälsvyn: tre flikar, tre nivåer, och den gräns som hela appen vilar på —
 * att ett befäl ser sammanställningar, aldrig enskilda personer.
 */

test.describe('plutonchefen', () => {
  test.beforeEach(async ({ page }) => {
    await loggaIn(page, KODER.plutonchef);
    await expect(page).toHaveURL(/\/pluton/);
  });

  test('alla tre flikar renderar utan fel', async ({ page }) => {
    const text = await synligText(page);
    expect(text).toContain('värnpliktiga');
    expect(text).toContain('svarat idag');
    await ingaEnskildaPersoner(page);

    for (const flik of ['Trender', 'Jämförelse']) {
      await page.getByRole('tab', { name: flik }).click();
      await expect(page.getByRole('tabpanel')).toBeVisible();
      const panel = await page.getByRole('tabpanel').innerText();
      expect(panel.length, `${flik} är tom`).toBeGreaterThan(80);
      await ingaEnskildaPersoner(page);
    }
  });

  test('veckosammanfattningen står överst, och samma text finns i rapporten', async ({ page }) => {
    // Fysioterapeuternas önskemål den 14 oktober: några meningar till
    // kompaniets veckomöte, skrivna ur siffrorna — ingen AI.
    const ruta = page.getByRole('region', { name: 'Senaste veckan' });
    await expect(ruta).toBeVisible();
    const rader = await ruta.getByRole('listitem').allInnerTexts();
    expect(rader[0]).toMatch(/^I snitt svarade \d+ % av de \d+ värnpliktiga varje dag\.$/);
    // Demons 1. pluton har sömn och kost i rött efter fältövningen.
    expect(rader.join(' ')).toContain('ligger på röd nivå');
    // 4. grupp har för få personer, och nämns därför aldrig som lägst.
    expect(rader.join(' ')).not.toContain('4. grupp');
    // Ingen fotnot om hur texten tagits fram — Richard ville inte ha den på
    // sidan (16 oktober). Svaret på frågan om AI ges muntligt.
    await expect(page.getByText(/ingen AI/i)).toHaveCount(0);
    await ingaEnskildaPersoner(page);

    await page.goto('/rapport');
    const iRapporten = await page.getByRole('region', { name: 'Senaste veckan' }).getByRole('listitem').allInnerTexts();
    expect(iRapporten).toEqual(rader);
  });

  test('varningen står inte fem gånger: ingen tröskelruta, och gränserna sägs vara preliminära', async ({ page }) => {
    // Väg B, 16 oktober (lib/varningar.ts). Demons 1. pluton har sömn och
    // kost i rött — förut stod det också i en egen ruta under listan.
    await expect(page.getByRole('heading', { name: /Tröskelvärden/ })).toHaveCount(0);
    await expect(page.getByText(/Gränserna för grönt, gult och rött är preliminära/)).toBeVisible();
    // Det röda syns fortfarande: märket överst och i listan.
    await expect(page.getByText(/\d kategorier? i rött/)).toBeVisible();
    // Befälsrådet står kvar — det enda som säger vad befälet kan göra.
    await expect(page.getByRole('heading', { name: 'Befälsråd' })).toBeVisible();
    // Den dagliga notisen är gömd. Sök i notisrutan: Befälsrådet säger själv
    // "ligger på kritisk nivå", och det ska stå kvar.
    await expect(page.locator('[data-notiser]', { hasText: 'kritisk nivå' })).toHaveCount(0);
  });

  test('perioden går att byta, och bara till tillåtna värden', async ({ page }) => {
    await page.getByRole('tab', { name: 'Trender' }).click();
    await page.getByRole('link', { name: '21d' }).click();
    await expect(page).toHaveURL(/period=21/);
    expect(await synligText(page)).toContain('21 dagar');

    // Påhittad period faller tillbaka till sju dagar i stället för att öppna
    // ett eget tidsfönster — annars går enskilda dagar att räkna fram.
    await page.goto('/pluton?period=3');
    expect(await synligText(page)).toContain('7 dagar');
  });

  test('graferna ritas, inte bara rubrikerna', async ({ page }) => {
    await page.getByRole('tab', { name: 'Trender' }).click();
    // Sex små grafer, en per kategori.
    await expect(page.locator('.recharts-surface')).toHaveCount(6);
    await expect(page.getByRole('img', { name: /Trend för enheten: Sömn/ })).toBeVisible();

    await page.getByRole('tab', { name: 'Jämförelse' }).click();
    await expect(page.getByRole('img', { name: /mot hela enheten över tid/ })).toBeVisible();
    await expect(page.getByRole('img', { name: /Profil för/ })).toBeVisible();
  });

  test('exporten ger en fil med samma tal som skärmen', async ({ page }) => {
    const svar = await page.request.get('/api/export?typ=dagar&period=7');
    expect(svar.status()).toBe(200);
    const csv = await svar.text();
    const rader = csv.trim().split('\r\n');
    expect(rader.length).toBeGreaterThan(1);
    expect(rader[0]).toContain('Datum;Svarande');
    expect(csv, 'full flyttalsprecision i filen').not.toMatch(/\d+\.\d{3,}/);
  });
});

test('kompani- och bataljonschefen ser sina egna nivåer', async ({ page }) => {
  await loggaIn(page, KODER.kompanichef);
  await expect(page).toHaveURL(/\/kompani/);
  expect(await synligText(page)).toContain('kompaninivå');
  await ingaEnskildaPersoner(page);

  await page.goto('/bataljon');
  await expect(page).toHaveURL(/ingen-behorighet/);

  await page.goto('/soldat');
  await expect(page).toHaveURL(/ingen-behorighet/);
});

test('en värnpliktig kommer inte in i befälsvyn', async ({ page }) => {
  await loggaIn(page, KODER.varnpliktigKlar);

  for (const sida of ['/pluton', '/kompani', '/bataljon', '/rapport', '/admin']) {
    await page.goto(sida);
    await expect(page, `${sida} släppte in en värnpliktig`).toHaveURL(/ingen-behorighet/);
  }
});

test('utan inloggning kommer man ingenstans', async ({ page, context }) => {
  await context.clearCookies();
  for (const sida of ['/pluton', '/admin', '/soldat/dashboard', '/rapport']) {
    await page.goto(sida);
    await expect(page, `${sida} var öppen utan inloggning`).toHaveURL(/\/$|utgangen/);
  }
});

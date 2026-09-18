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

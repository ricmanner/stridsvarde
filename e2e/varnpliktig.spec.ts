import { expect, test } from '@playwright/test';

import { KODER, loggaIn, oppnaIncheckning, skickaIncheckning, synligText } from './hjalp';

/** Klickar sig fram till sammanfattningen, varifrån man än står. */
async function tillSammanfattningen(page: import('@playwright/test').Page) {
  for (let i = 0; i < 7; i++) {
    const sammanfattning = page.getByRole('button', { name: 'Sammanfattning' });
    if (await sammanfattning.isVisible()) {
      await sammanfattning.click();
      return;
    }
    await page.getByRole('button', { name: 'Nästa' }).click();
  }
  throw new Error('kom aldrig fram till sammanfattningen');
}

/**
 * Den värnpliktiges flöde, hela vägen.
 *
 * Det här är appens enda vy som varje användare måste igenom. Går den sönder
 * spelar resten ingen roll.
 */

test('rapporterar sitt mående och får återkoppling', async ({ page }) => {
  await loggaIn(page, KODER.varnpliktig);
  await oppnaIncheckning(page);

  // Sex frågor. Skjutreglaget styrs med tangentbord — samma väg som den som
  // inte använder mus, och stabilare än att dra i ett reglage.
  for (let fraga = 1; fraga <= 6; fraga++) {
    const reglage = page.locator('input[type="range"]');
    await expect(reglage).toBeVisible();
    await reglage.focus();
    // Från mitten (5) upp till 8, så att värdena inte blir röda och drar in
    // stödrutan — den prövas i ett eget test.
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
    await page.getByRole('button', { name: fraga === 6 ? 'Sammanfattning' : 'Nästa' }).click();
  }

  await expect(page.getByText(/Bekräfta din incheckning|Bekräfta ändringen/)).toBeVisible();

  // Sammanfattningens rader ska gå att rätta med tangentbord — de var
  // tidigare klickbara div:ar som bara fungerade med mus.
  const rad = page.getByRole('button', { name: /Ändra Sömn, nu \d+ av 10/ });
  await expect(rad).toBeVisible();
  await rad.click();
  await expect(page.locator('input[type="range"]')).toBeVisible();
  // Man landar på den frågan, inte på sammanfattningen — därav vägen tillbaka.
  await tillSammanfattningen(page);

  await skickaIncheckning(page);
  const text = await synligText(page);
  expect(text).toContain('hälsostatus idag');
  expect(text).toContain('svarsfrekvens');
});

test('den som redan rapporterat skickas till sin återkoppling', async ({ page }) => {
  await loggaIn(page, KODER.varnpliktigKlar);
  await expect(page).toHaveURL(/\/soldat\/dashboard$/);

  // Båda flikarna ska rendera. Historikfliken ritar sex grafer, och det är
  // där ett saknat värde tidigare kunde fälla hela vyn.
  await page.getByRole('tab', { name: 'Historia' }).click();
  await expect(page.getByRole('tabpanel')).toBeVisible();
  const text = await synligText(page);
  expect(text).toContain('din närvaro');
  expect(text).not.toContain('application error');
});

test('flikarna går att stega med piltangenter', async ({ page }) => {
  await loggaIn(page, KODER.varnpliktigKlar);

  const oversikt = page.getByRole('tab', { name: 'Översikt' });
  await expect(oversikt).toHaveAttribute('aria-selected', 'true');

  await oversikt.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Historia' })).toHaveAttribute('aria-selected', 'true');

  await page.keyboard.press('Home');
  await expect(oversikt).toHaveAttribute('aria-selected', 'true');
});

test('låga värden ger stödkontakter, inte bara en siffra', async ({ page }) => {
  await loggaIn(page, 'P1G1-02');
  await oppnaIncheckning(page);

  // Lägsta värdet på varje fråga: det här är personen appen finns för.
  for (let fraga = 1; fraga <= 6; fraga++) {
    const reglage = page.locator('input[type="range"]');
    await reglage.focus();
    for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowLeft');
    await page.getByRole('button', { name: fraga === 6 ? 'Sammanfattning' : 'Nästa' }).click();
  }
  await skickaIncheckning(page);

  const text = await synligText(page);
  expect(text, 'stödrutan ska ligga överst').toContain('du behöver inte lösa det här själv');
  expect(text).toContain('1177');
  expect(text, 'krislinjerna ska finnas när psykiskt mående är rött').toContain('självmordslinjen');

  // Och möjligheten att be befälet höra av sig.
  await expect(page.getByRole('button', { name: /plutonchefen/i })).toBeVisible();
});

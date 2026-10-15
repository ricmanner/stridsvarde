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

test('varje fråga säger vad siffran betyder, och info-knappen listar alla nivåer', async ({ page }) => {
  // Eget konto: P1G1-01 har checkat in i testet ovan, och då börjar reglagen
  // på de sparade svaren i stället för på 5. Det här testet skickar inget.
  await loggaIn(page, 'P1G1-05');
  await oppnaIncheckning(page);

  // Reglaget börjar på 5, alltså gult. Texten står ovanför reglaget och
  // följer med när det flyttas. Sök i <p>: listan i den stängda rutan har
  // samma texter, i <span>.
  const text = (t: string) => page.locator('p', { hasText: t });
  await expect(text('Stel, öm eller sliten.')).toBeVisible();
  const reglage = page.locator('input[type="range"]');
  await reglage.focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  await expect(text('Kroppen känns bra. Inget som hindrar dig.')).toBeVisible();
  await expect(text('Stel, öm eller sliten.')).toHaveCount(0);
  // Skärmläsaren får samma sak som den som ser texten.
  await expect(reglage).toHaveAttribute('aria-valuetext', /^8 av 10\. Kroppen känns bra/);

  // Info-knappen: alla tre nivåerna, och den man står på är markerad.
  await page.getByRole('button', { name: 'Vad betyder siffrorna för fysisk form?' }).click();
  const ruta = page.getByRole('dialog', { name: 'Hur mår din kropp idag?' });
  await expect(ruta).toBeVisible();
  for (const niva of ['1–3', '4–6', '7–10']) await expect(ruta.getByText(niva)).toBeVisible();
  await expect(ruta.locator('[aria-current]')).toContainText('Kroppen känns bra');

  await page.keyboard.press('Escape');
  await expect(ruta).toBeHidden();

  // Nästa fråga har sina egna texter.
  await page.getByRole('button', { name: 'Nästa' }).click();
  await expect(text('Mer pressad än vanligt.')).toBeVisible();
  await page.getByRole('button', { name: 'Vad betyder siffrorna för psykiskt mående?' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Stäng' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('den som redan rapporterat skickas till sin återkoppling', async ({ page }) => {
  await loggaIn(page, KODER.varnpliktigKlar);
  await expect(page).toHaveURL(/\/soldat\/dashboard$/);

  // Båda flikarna ska rendera. Historikfliken ritar sex grafer, och det är
  // där ett saknat värde tidigare kunde fälla hela vyn.
  await page.getByRole('tab', { name: 'Historik' }).click();
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
  await expect(page.getByRole('tab', { name: 'Historik' })).toHaveAttribute('aria-selected', 'true');

  await page.keyboard.press('Home');
  await expect(oversikt).toHaveAttribute('aria-selected', 'true');
});

/*
 * Sedan den 15 oktober utan nummer och utan samtalsknappar (VISA_STODNUMMER
 * och SAMTALSBEGARAN_PA i lib/support.ts). Rutan står kvar, och säger att
 * vägen går via befälet. Slås de på igen: se testets version i historiken.
 */
test('låga värden ger stödrutan, som hänvisar till befälet', async ({ page }) => {
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
  expect(text).toContain('säg till ditt befäl att du vill prata');
  // Numren var länkar att ringa. Att leta efter "112" i sidans text kunde
  // träffa en siffra någon annanstans; länkarna är det som faktiskt fanns.
  await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
  expect(text).not.toContain('självmordslinjen');

  // Ingen knapp som skickar en begäran — den som vill prata går fram och säger det.
  await expect(page.getByRole('button', { name: /plutonchefen|kompanichefen/i })).toHaveCount(0);
});

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
  // Att raderna går att ändra ska synas, inte bara gå.
  await expect(page.getByText('Stämmer något inte? Tryck på raden för att ändra.')).toBeVisible();
  const rad = page.getByRole('button', { name: /Ändra Sömn, nu \d+ av 10/ });
  await expect(rad).toBeVisible();
  await rad.click();
  await expect(page.locator('input[type="range"]')).toBeVisible();

  // Därifrån går man direkt tillbaka — förut fick man trycka Nästa genom
  // alla frågor efter den man ändrat.
  await expect(page.getByRole('button', { name: 'Nästa' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Till sammanfattningen' }).click();
  await expect(page.getByText(/Bekräfta din incheckning|Bekräfta ändringen/)).toBeVisible();

  // Den vanliga vägen är orörd: börjar man om från fråga 1 står det Nästa.
  await page.getByRole('button', { name: /Ändra Fysisk form/ }).click();
  await page.getByRole('button', { name: 'Tillbaka' }).click();
  await page.getByRole('button', { name: /Starta incheckning|Fortsätt/ }).click();
  await expect(page.getByRole('button', { name: 'Nästa' })).toBeVisible();
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

  // Texten står ovanför reglaget och följer med när det flyttas. Sök i <p>:
  // listan i den stängda rutan har samma texter, i <span>. Reglaget börjar
  // tomt; första piltrycket ger 6, så tre tryck ger 8.
  const text = (t: string) => page.locator('p', { hasText: t });
  const reglage = page.locator('input[type="range"]');
  await reglage.focus();
  await page.keyboard.press('ArrowRight');
  await expect(text('Stel, öm eller sliten.')).toBeVisible();
  for (let i = 0; i < 2; i++) await page.keyboard.press('ArrowRight');
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
  await reglage.focus();
  await page.keyboard.press('ArrowRight');
  await expect(text('Mer pressad än vanligt.')).toBeVisible();
  await page.getByRole('button', { name: 'Vad betyder siffrorna för psykiskt mående?' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Stäng' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('reglaget börjar tomt, och man går inte vidare utan att välja', async ({ page }) => {
  /*
   * Förut stod reglaget på 5, och den som bara tryckte Nästa sex gånger
   * skickade in sex femmor som såg ut som svar. Beslut den 15 oktober.
   */
  await loggaIn(page, 'P1G1-07');
  await oppnaIncheckning(page);

  const reglage = page.locator('input[type="range"]');
  const nasta = page.getByRole('button', { name: 'Nästa' });
  await expect(page.getByText('Välj en siffra för att gå vidare.')).toBeVisible();
  await expect(nasta).toBeDisabled();
  await expect(reglage).toHaveAttribute('aria-valuetext', 'Inget svar än');
  // Knappen är grå och linjen ofärgad förrän man valt — en färgad knapp hade
  // sett ut som ett svar. En regel för det försvann en gång i bygget utan att
  // något föll, så färgen mäts i den byggda sidan.
  const kant = () => page.locator('.psvi-tumme').evaluate((el) => getComputedStyle(el).borderTopColor);
  const fyllning = () => page.locator('.psvi-fyllning').evaluate((el) => getComputedStyle(el).visibility);
  await expect.poll(kant).toBe('rgb(148, 163, 184)');
  await expect.poll(fyllning).toBe('hidden');

  // Ett tryck på skalan, där sjuan sitter, ger 7 — också femman skulle gå
  // med ett tryck, vilket var skälet att börja tomt i stället för på 5.
  // Knappen är 40 punkter bred (oval, som Apples reglage), och dess mitt
  // rör sig mellan en halv knappbredd från vardera kanten.
  const ruta = (await reglage.boundingBox())!;
  const x = 20 + ((ruta.width - 40) * 6) / 9;
  await page.mouse.click(ruta.x + x, ruta.y + ruta.height / 2);
  await expect(reglage).toHaveAttribute('aria-valuetext', /^7 av 10/);
  await expect.poll(kant).not.toBe('rgb(148, 163, 184)');
  await expect.poll(fyllning).toBe('visible');

  // Oval knapp, bredare än hög.
  const knapp = (await page.locator('.psvi-tumme').boundingBox())!;
  expect(Math.round(knapp.width)).toBe(40);
  expect(knapp.height).toBeLessThan(knapp.width);

  // Den stora siffran: en, och den nya.
  await expect(page.locator('[data-siffra]')).toHaveText('7');

  /*
   * Siffran glider in vid ett enstaka steg, men inte medan man drar — då
   * byts den många gånger i sekunden, och den första rullande versionen blev
   * rörig (Richard, iPhone, 15 oktober).
   */
  const siffrornasRorelser = () =>
    page.evaluate(() =>
      document
        .getAnimations()
        .map((a) => (a as CSSAnimation).animationName)
        .filter((n) => n?.startsWith('psvi-siffra')),
    );
  await reglage.focus();
  await page.keyboard.press('ArrowRight');
  expect(await siffrornasRorelser()).toEqual(['psvi-siffra-in-upp']);
  await page.waitForTimeout(400);

  const y = ruta.y + ruta.height / 2;
  await page.mouse.move(ruta.x + 20 + ((ruta.width - 40) * 7) / 9, y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(ruta.x + 20 + ((ruta.width - 40) * (7 - i)) / 9, y);
    expect(await siffrornasRorelser(), 'ingen rullning under dragningen').toEqual([]);
  }
  await page.mouse.up();
  await expect(reglage).toHaveAttribute('aria-valuetext', /^2 av 10/);

  // Tillbaka till sjuan för resten av testet.
  await reglage.focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
  await expect(nasta).toBeEnabled();

  // Nästa fråga är tom igen; tangentbordet fungerar från tomt.
  await nasta.click();
  await expect(nasta).toBeDisabled();
  await reglage.focus();
  await page.keyboard.press('ArrowRight');
  await expect(reglage).toHaveAttribute('aria-valuetext', /^6 av 10/);

  // Tillbaka behåller det man valt.
  await page.getByRole('button', { name: 'Tillbaka' }).click();
  await expect(reglage).toHaveAttribute('aria-valuetext', /^7 av 10/);
});

test('på en iPad står Nästa och Tillbaka nära reglaget, inte längst ned på skärmen', async ({ page }) => {
  /*
   * Incheckningen fyllde hela skärmhöjden och lade knapparna längst ned —
   * rätt i en telefon, där tummen når nederkanten. På en iPad Air hamnade
   * Nästa 687 px under reglaget (Richard, 16 oktober; cheferna ska prova
   * på iPads). Telefonen är oförändrad.
   */
  await page.setViewportSize({ width: 820, height: 1180 });
  await loggaIn(page, 'P1G1-06');
  await oppnaIncheckning(page);

  const reglage = (await page.locator('.psvi-reglage').boundingBox())!;
  const nasta = (await page.getByRole('button', { name: 'Nästa' }).boundingBox())!;
  const avstand = nasta.y - (reglage.y + reglage.height);
  expect(avstand, `Nästa står ${Math.round(avstand)} px under reglaget`).toBeLessThan(150);
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

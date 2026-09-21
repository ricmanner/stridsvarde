import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { KODER, loggaIn, oppnaIncheckning } from './hjalp';

/**
 * Tillgänglighet mätt av axe, inte av mina antaganden.
 *
 * Lagen om tillgänglighet till digital offentlig service kräver WCAG 2.1 AA.
 * Ett verktyg fångar ungefär en tredjedel av kraven — resten kräver en
 * människa — men den tredjedelen är den som lättast går sönder obemärkt:
 * kontrast, etiketter, rubrikordning, landmärken.
 */

async function granska(page: Page, vad: string) {
  /*
   * Låt sidan bli färdig först — och "färdig" betyder inte det man först tror.
   *
   * Vid en navigering inne i appen sätter Next dokumentets titel i
   * webbläsaren, efter att sidan bytts. Det är processorarbete, inte
   * nätverksarbete, så `networkidle` väntar inte in det. Uppmätt med
   * webbläsarens processor bromsad tjugo gånger: efter inloggning är titeln
   * tom, och den dyker upp 378 ms senare. Vid full omladdning finns den
   * alltid direkt.
   *
   * Därför föll granskningen hos GitHub men aldrig här: deras maskin är
   * långsam nog att axe hann läsa sidan i det fönstret och rapportera
   * "Documents must have <title>" om en sida som har en.
   *
   * Väntan är bunden. Har en sida ingen titel alls hinner den aldrig dyka
   * upp, testet faller ändå — med ett tydligare besked än axes. Kontrollen
   * tystas alltså inte, den görs vid rätt tidpunkt.
   */
  await page.locator('[data-laddar]').waitFor({ state: 'hidden', timeout: 30_000 });
  await page.waitForLoadState('networkidle');
  await expect
    .poll(() => page.title(), {
      timeout: 15_000,
      message: `${vad}: sidan fick aldrig någon titel`,
    })
    .not.toBe('');

  const resultat = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const brister = resultat.violations.map(
    (v) => `${vad}: ${v.id} (${v.impact}) — ${v.nodes.length} st: ${v.help}`,
  );
  return brister;
}

test('inloggningen', async ({ page }) => {
  await page.goto('/');
  expect(await granska(page, 'inloggning')).toEqual([]);
});

test('incheckningen, alla steg', async ({ page }) => {
  await loggaIn(page, 'P1G1-03');
  expect(await granska(page, 'start')).toEqual([]);

  await oppnaIncheckning(page);
  expect(await granska(page, 'fråga 1')).toEqual([]);

  const reglage = page.locator('input[type="range"]');
  await reglage.focus();
  await page.keyboard.press('ArrowLeft');
  for (let i = 1; i <= 6; i++) {
    await page.getByRole('button', { name: i === 6 ? 'Sammanfattning' : 'Nästa' }).click();
  }
  expect(await granska(page, 'sammanfattning')).toEqual([]);
});

test('den värnpliktiges återkoppling, båda flikarna', async ({ page }) => {
  await loggaIn(page, KODER.varnpliktigKlar);
  expect(await granska(page, 'översikt')).toEqual([]);

  await page.getByRole('tab', { name: 'Historia' }).click();
  expect(await granska(page, 'historia')).toEqual([]);
});

test('befälsvyn, alla tre flikarna', async ({ page }) => {
  await loggaIn(page, KODER.plutonchef);
  expect(await granska(page, 'översikt')).toEqual([]);

  for (const flik of ['Trender', 'Jämförelse']) {
    await page.getByRole('tab', { name: flik }).click();
    expect(await granska(page, flik.toLowerCase())).toEqual([]);
  }
});

test('adminvyn och rapporten', async ({ page }) => {
  await loggaIn(page, KODER.admin);
  expect(await granska(page, 'admin')).toEqual([]);

  await page.goto('/status');
  expect(await granska(page, 'status')).toEqual([]);

  await loggaIn(page, KODER.plutonchef);
  await page.goto('/rapport');
  expect(await granska(page, 'rapport')).toEqual([]);
});

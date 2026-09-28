import { expect, test } from '@playwright/test';

import { KODER, loggaIn } from './hjalp';

/**
 * Aktivitetsloggen — nås med en egen kod i det vanliga inloggningsfältet,
 * och av ingen annan. Varför: lib/auth/logg.ts.
 */

const LOGGKOD = 'LOGGK-E2E23'; // samma som LOGG_KOD i playwright.config.ts

async function oppnaLoggen(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByLabel('Inloggningskod').fill(LOGGKOD.toLowerCase());
  await page.getByRole('button', { name: 'Logga in' }).click();
  await expect(page).toHaveURL(/\/logg$/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { level: 1, name: 'Aktivitetslogg' })).toBeVisible();
}

test('loggkoden leder till loggen, och administratören når den inte', async ({ page }) => {
  await oppnaLoggen(page);
  await expect(page.getByText('Bara den som har loggkoden ser den här sidan')).toBeVisible();

  // En ny webbläsare, inloggad som den publicerade administratören.
  await page.context().clearCookies();
  await loggaIn(page, KODER.admin);
  await page.goto('/logg');
  await expect(page).not.toHaveURL(/\/logg/);
  await expect(page.getByRole('heading', { name: 'Aktivitetslogg' })).toHaveCount(0);
});

test('det administratören gör syns i loggen, med roll och enhet', async ({ page }) => {
  await loggaIn(page, KODER.admin);
  await page.getByRole('link', { name: /1\. pluton/ }).first().click();
  await expect(page).toHaveURL(/unit=\d+/);
  await expect(page.getByRole('heading', { name: /Ny grupp under 1\. pluton/ })).toBeVisible();
  const namn = `E2E-logg ${Date.now().toString(36)}`;
  await page.getByLabel('Namn', { exact: true }).fill(namn);
  await page.getByRole('button', { name: 'Skapa', exact: true }).click();
  await expect(page.getByRole('link', { name: new RegExp(namn) })).toBeVisible({ timeout: 20_000 });

  await page.context().clearCookies();
  await oppnaLoggen(page);
  await expect(page.getByText(`1. bataljon › 1. kompani › 1. pluton › ${namn}`)).toBeVisible();
  await expect(page.getByText('Ny enhet').first()).toBeVisible();

  // Inloggningen nyss står också där, med roll och enhet — aldrig koden.
  await expect(page.getByText('administratör i 1. bataljon').first()).toBeVisible();
  await expect(page.getByText(KODER.admin)).toHaveCount(0);
});

test('stäng loggen, och den är stängd', async ({ page }) => {
  await oppnaLoggen(page);
  await page.getByRole('button', { name: 'Stäng loggen' }).click();
  await expect(page).not.toHaveURL(/\/logg/, { timeout: 15_000 });
  await page.goto('/logg');
  await expect(page).not.toHaveURL(/\/logg/);
});

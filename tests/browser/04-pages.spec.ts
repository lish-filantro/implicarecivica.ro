/**
 * The remaining authenticated pages open and show their main content;
 * the public institution page shows the open-data block.
 */
import { test, expect } from '@playwright/test';
import { CITIZEN } from './helpers/accounts';
import { acceptCookies, login } from './helpers/login';

test.describe('paginile aplicației', () => {
  test('emailuri: folderele și lista', async ({ page }) => {
    await login(page, CITIZEN, '/emails');
    for (const folder of ['Primite', 'De revizuit', 'Trimise', 'Toate']) {
      await expect(page.getByRole('button', { name: new RegExp(folder) }).first()).toBeVisible();
    }
    await expect(page.getByText(/Selectează un email|Fără emailuri|Niciun email/i).first()).toBeVisible();
  });

  test('setări: profil și preferințe de notificare', async ({ page }) => {
    await login(page, CITIZEN, '/settings');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByDisplayValue(CITIZEN.loginEmail)).toBeVisible();
    await expect(page.getByDisplayValue(CITIZEN.displayName)).toBeVisible();
    await expect(page.getByRole('heading', { name: /Notificari/ })).toBeVisible();
  });

  test('feedback: formularul se trimite', async ({ page }) => {
    await login(page, CITIZEN, '/feedback');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Sugestie', exact: true }).click();
    await page.locator('textarea').first().fill('Test automat din browser: formularul de feedback funcționează.');
    await page.getByRole('button', { name: 'Trimite feedback' }).click();
    await expect(page.getByText(/Mulțumim! Feedbackul tău a fost înregistrat/)).toBeVisible();
  });

  test('pagina publică a unei instituții afișează blocul de date deschise', async ({ page }) => {
    await acceptCookies(page);
    await page.goto('/institutii/anaf');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/date deschise|suficiente cereri/i).first()).toBeVisible({ timeout: 20_000 });
  });
});

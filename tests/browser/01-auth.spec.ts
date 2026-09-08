/**
 * Authentication through the real UI: protected pages redirect to /login,
 * the login form signs the citizen in, admin pages stay closed to non-admins.
 */
import { test, expect } from '@playwright/test';
import { CITIZEN } from './helpers/accounts';
import { login } from './helpers/login';

test.describe('autentificare', () => {
  test('o pagină protejată redirecționează la /login și păstrează destinația', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login\?redirectedFrom=%2Fdashboard/);
    await expect(page.locator('#email')).toBeVisible();
  });

  test('login cu email și parolă ajunge în aplicație', async ({ page }) => {
    await login(page, CITIZEN, '/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('parola greșită afișează eroare și rămâne pe /login', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill(CITIZEN.loginEmail);
    await page.locator('#password').fill('parola-gresita-123');
    await page.getByRole('button', { name: 'Intră în cont' }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/invalid|gre[șs]it|incorect|eroare/i)).toBeVisible();
  });

  test('dashboard-ul admin nu e accesibil unui utilizator obișnuit', async ({ page }) => {
    await login(page, CITIZEN, '/admin/dashboard');
    await expect(page).not.toHaveURL(/\/admin\/dashboard$/);
  });
});

/**
 * UI login through the real /login form (email + password).
 */
import { expect, type Page } from '@playwright/test';
import { readCreds, type TestAccount } from './accounts';

export async function login(page: Page, account: TestAccount, redirectTo = '/dashboard'): Promise<void> {
  const { password } = readCreds();
  await page.goto('/login');
  await page.locator('#email').fill(account.loginEmail);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /autentific|conectare|intr[aă]|login/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
  if (redirectTo) await page.goto(redirectTo);
}

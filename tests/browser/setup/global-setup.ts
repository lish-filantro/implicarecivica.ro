/**
 * Runs once before the suite: fresh password for both accounts, approved
 * profiles, and a clean slate (no requests/emails from previous runs).
 */
import type { FullConfig } from '@playwright/test';
import { loadEnvLocal } from '../helpers/env';
import { CITIZEN, INSTITUTION, newPassword, writeCreds } from '../helpers/accounts';
import { cleanupAccountData, ensureAccount } from '../helpers/db';

export default async function globalSetup(config: FullConfig): Promise<void> {
  loadEnvLocal();
  const baseURL = (config.projects[0]?.use.baseURL as string | undefined) ?? 'http://localhost:3000';
  const password = process.env.E2E_PASSWORD || newPassword();

  await ensureAccount(CITIZEN, password);
  await ensureAccount(INSTITUTION, password);
  await cleanupAccountData(CITIZEN);
  await cleanupAccountData(INSTITUTION);

  writeCreds({ password, baseURL, createdAt: new Date().toISOString() });
  console.log(`[browser-setup] accounts ready, base URL ${baseURL}`);
}

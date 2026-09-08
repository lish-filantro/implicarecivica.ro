/**
 * Browser tests (Playwright) — drive the real app in Chromium against a running
 * deployment (default: the local dev server; E2E_BASE_URL for Preview/Production).
 *
 *   npm run test:browser                                # http://localhost:3000
 *   E2E_BASE_URL=https://www.implicarecivica.ro npm run test:browser
 *
 * The suite uses two dedicated accounts (citizen + institution) created by the
 * global setup with the service role key from .env.local; see tests/browser/README.md.
 */
import { defineConfig } from '@playwright/test';
import { loadEnvLocal } from './tests/browser/helpers/env';

loadEnvLocal();

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests/browser',
  testMatch: /.*\.spec\.ts/,
  globalSetup: './tests/browser/setup/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL,
    headless: true,
    viewport: { width: 1280, height: 800 },
    locale: 'ro-RO',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});

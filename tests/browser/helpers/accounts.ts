/**
 * The two accounts the browser suite plays with:
 *
 *  - CITIZEN      the existing e2e user (test-e2e@… login, test-cetatean@… platform address)
 *  - INSTITUTION  a platform user whose address acts as the institution's registry
 *                 (institutie-test@…). Emails the citizen sends land in this inbox
 *                 through the real path (Resend → Cloudflare → worker → webhook), and
 *                 the tests answer from it through Resend, like a clerk would.
 *
 * Passwords are set fresh by the global setup (auth.admin) and shared with the
 * specs through tests/browser/.auth/creds.json (gitignored).
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

export interface TestAccount {
  id: string;
  loginEmail: string;
  platformEmail: string;
  displayName: string;
}

export const CITIZEN: TestAccount = {
  id: 'a0000000-e2e0-4000-a000-000000000001',
  loginEmail: 'test-e2e@implicarecivica.ro',
  platformEmail: 'test-cetatean@implicarecivica.ro',
  displayName: 'Test E2E Cetățean',
};

export const INSTITUTION: TestAccount = {
  id: 'a0000000-e2e0-4000-a000-000000000002',
  loginEmail: 'institutie-test@implicarecivica.ro',
  platformEmail: 'institutie-test@implicarecivica.ro',
  displayName: 'Primăria Test E2E (registratură)',
};

export const INSTITUTION_NAME = 'Primăria Test E2E';

const CREDS_PATH = path.resolve(process.cwd(), 'tests/browser/.auth/creds.json');

export interface Creds {
  password: string;
  baseURL: string;
  createdAt: string;
}

export function newPassword(): string {
  return `E2e-${randomBytes(12).toString('base64url')}!`;
}

export function writeCreds(creds: Creds): void {
  fs.mkdirSync(path.dirname(CREDS_PATH), { recursive: true });
  fs.writeFileSync(CREDS_PATH, JSON.stringify(creds, null, 2));
}

export function readCreds(): Creds {
  if (!fs.existsSync(CREDS_PATH)) throw new Error('Missing tests/browser/.auth/creds.json — the global setup did not run');
  return JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8')) as Creds;
}

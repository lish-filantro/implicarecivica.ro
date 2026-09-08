/**
 * Loads .env.local into process.env (without overriding variables already set),
 * so the browser tests can use the Supabase service role and Resend keys the
 * same way the Vitest suites do. Tiny on purpose: no dotenv dependency.
 */
import fs from 'node:fs';
import path from 'node:path';

export function loadEnvLocal(file = path.resolve(process.cwd(), '.env.local')): void {
  if (!fs.existsSync(file)) return;
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    const hash = value.indexOf(' #');
    if (hash > 0 && !value.startsWith('"')) value = value.slice(0, hash).trim();
    value = value.replace(/^"(.*)"$/, '$1');
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export function requireTestEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Browser tests need ${name} (set it in .env.local or the environment)`);
  return value;
}

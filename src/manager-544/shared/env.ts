/**
 * Fail-fast access to environment variables.
 *
 * Every server-side read of `process.env` in manager-544 goes through here so
 * that a missing or placeholder secret is an explicit error, never a silent
 * "auth disabled" fallback. Values are read on every call (no import-time
 * cache), which keeps tests free to mutate `process.env`.
 */

export class EnvError extends Error {
  readonly variable: string;

  constructor(variable: string, reason: string) {
    super(`Environment variable ${variable} ${reason}`);
    this.name = 'EnvError';
    this.variable = variable;
  }
}

/** Values that look like an unfilled template rather than a real secret. */
const PLACEHOLDER_PATTERNS = [
  /placeholder/i,
  /^x{3,}$/i,
  /^\.{3}$/,
  /\.\.\.$/, // "sk-ant-..."
  /^your-/i,
  /^changeme$/i,
  /^todo$/i,
];

export function isPlaceholder(value: string): boolean {
  const v = value.trim();
  return v.length === 0 || PLACEHOLDER_PATTERNS.some((p) => p.test(v));
}

function read(name: string): string | undefined {
  const raw = process.env[name];
  if (raw === undefined) return undefined;
  const v = raw.trim();
  return v.length === 0 ? undefined : v;
}

/** Value of a required variable; throws EnvError when missing or empty. */
export function requireEnv(name: string): string {
  const v = read(name);
  if (v === undefined) throw new EnvError(name, 'is required but not set');
  return v;
}

/** Like requireEnv, but also rejects placeholder-looking values. Use for secrets. */
export function requireSecret(name: string): string {
  const v = requireEnv(name);
  if (isPlaceholder(v)) throw new EnvError(name, 'is set to a placeholder value; configure a real secret');
  return v;
}

/** Value of an optional variable, or the fallback / undefined when missing or empty. */
export function optionalEnv(name: string): string | undefined;
export function optionalEnv(name: string, fallback: string): string;
export function optionalEnv(name: string, fallback?: string): string | undefined {
  return read(name) ?? fallback;
}

/** True when running in a production deployment (Vercel sets VERCEL_ENV). */
export function isProduction(): boolean {
  return optionalEnv('VERCEL_ENV') === 'production' || optionalEnv('NODE_ENV') === 'production';
}

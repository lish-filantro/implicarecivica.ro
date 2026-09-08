/**
 * Retry transient AI-provider failures (429 rate limit, 5xx) with exponential backoff.
 * Free/low tiers allow ~1 request/second, so a burst of emails easily trips 429.
 * Client errors such as 400/401/403 are never retried.
 */

export interface RetryOptions {
  /** Total number of calls, including the first one. Default 4. */
  attempts?: number;
  /** Delay before the first retry; doubles on each further retry. Default 1500 ms. */
  baseDelayMs?: number;
  /** Injectable for tests; defaults to setTimeout. */
  sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_ATTEMPTS = 4;
const DEFAULT_BASE_DELAY_MS = 1500;

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function numberProp(err: object, key: string): number | undefined {
  const value = (err as Record<string, unknown>)[key];
  return typeof value === 'number' ? value : undefined;
}

/** HTTP status of a thrown error: `statusCode`, `status`, or "Status NNN" in the message. */
export function errorStatus(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const direct = numberProp(err, 'statusCode') ?? numberProp(err, 'status');
  if (direct !== undefined) return direct;
  const message = (err as { message?: unknown }).message;
  const match = typeof message === 'string' ? /Status (\d{3})/.exec(message) : null;
  return match ? Number(match[1]) : undefined;
}

export function isRetryableStatus(status: number | undefined): boolean {
  return status === 429 || (status !== undefined && status >= 500);
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const attempts = opts.attempts ?? DEFAULT_ATTEMPTS;
  const baseDelayMs = opts.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const sleep = opts.sleep ?? defaultSleep;

  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastErr = err;
      const status = errorStatus(err);
      if (!isRetryableStatus(status) || i === attempts - 1) throw err;
      const delayMs = baseDelayMs * 2 ** i;
      console.warn(`[Analysis] Mistral ${status}, retry ${i + 1}/${attempts - 1} in ${delayMs}ms`);
      await sleep(delayMs);
    }
  }
  throw lastErr;
}

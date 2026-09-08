/**
 * pipeline/analysis/retry — withRetry: exponential backoff on 429 / 5xx only.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { withRetry, errorStatus } from '@m544/pipeline/analysis/retry';

function httpError(status: number): Error & { statusCode: number } {
  return Object.assign(new Error(`API error ${status}`), { statusCode: status });
}

function failNTimes(times: number, err: unknown, value = 'ok') {
  let calls = 0;
  return vi.fn(async () => {
    calls++;
    if (calls <= times) throw err;
    return value;
  });
}

let delays: number[];
const sleep = async (ms: number) => {
  delays.push(ms);
};

beforeEach(() => {
  delays = [];
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('withRetry', () => {
  it('returns the value on first success without sleeping', async () => {
    const fn = vi.fn(async () => 42);
    await expect(withRetry(fn, { sleep })).resolves.toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(delays).toEqual([]);
  });

  it('retries 429 twice then succeeds, with 1500 and 3000 ms delays', async () => {
    const fn = failNTimes(2, httpError(429));
    await expect(withRetry(fn, { sleep })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(delays).toEqual([1500, 3000]);
  });

  it('gives up after 4 attempts on persistent 429 (delays 1500, 3000, 6000)', async () => {
    const err = httpError(429);
    const fn = failNTimes(10, err);
    await expect(withRetry(fn, { sleep })).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(4);
    expect(delays).toEqual([1500, 3000, 6000]);
  });

  it('retries 5xx errors', async () => {
    const fn = failNTimes(1, httpError(503));
    await expect(withRetry(fn, { sleep })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry 403', async () => {
    const err = httpError(403);
    const fn = failNTimes(1, err);
    await expect(withRetry(fn, { sleep })).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(delays).toEqual([]);
  });

  it('does not retry 400', async () => {
    const fn = failNTimes(1, httpError(400));
    await expect(withRetry(fn, { sleep })).rejects.toThrow(/400/);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('reads the status from err.status', async () => {
    const fn = failNTimes(1, Object.assign(new Error('boom'), { status: 500 }));
    await expect(withRetry(fn, { sleep })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries a real Anthropic SDK RateLimitError (err.status = 429) and logs a provider-neutral warning', async () => {
    const err = Anthropic.APIError.generate(
      429,
      { error: { type: 'rate_limit_error', message: 'Rate limited' } },
      undefined,
      new Headers(),
    );
    expect(err).toBeInstanceOf(Anthropic.RateLimitError);
    expect(errorStatus(err)).toBe(429);
    const fn = failNTimes(1, err);
    await expect(withRetry(fn, { sleep })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledWith('[Analysis] HTTP 429, retry 1/3 in 1500ms');
  });

  it('does not retry an Anthropic AuthenticationError (401)', async () => {
    const err = Anthropic.APIError.generate(401, { error: { type: 'authentication_error', message: 'x' } }, undefined, new Headers());
    const fn = failNTimes(1, err);
    await expect(withRetry(fn, { sleep })).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('reads the status from the message ("Status 429")', async () => {
    const fn = failNTimes(1, new Error('Unexpected API response: Status 429 Too Many Requests'));
    await expect(withRetry(fn, { sleep })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry errors without a status, nor non-Error throwables', async () => {
    const fn1 = failNTimes(1, new Error('network down'));
    await expect(withRetry(fn1, { sleep })).rejects.toThrow('network down');
    expect(fn1).toHaveBeenCalledTimes(1);

    const fn2 = failNTimes(1, 'a string');
    await expect(withRetry(fn2, { sleep })).rejects.toBe('a string');
    expect(fn2).toHaveBeenCalledTimes(1);
  });

  it('honours custom attempts and base delay', async () => {
    const fn = failNTimes(10, httpError(500));
    await expect(withRetry(fn, { sleep, attempts: 2, baseDelayMs: 100 })).rejects.toThrow(/500/);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(delays).toEqual([100]);
  });
});

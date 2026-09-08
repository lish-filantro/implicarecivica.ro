import { describe, it, expect, vi } from 'vitest';
import { rateLimitCheckUrl, fetchRateLimit } from '@m544/ui/requests/rate-limit';

describe('rateLimitCheckUrl', () => {
  it('prefers the institution email', () => {
    expect(rateLimitCheckUrl({ email: 'a@b.ro', name: 'Prim' })).toBe('/api/rate-limit/check?email=a%40b.ro');
  });

  it('falls back to the institution name when the email is missing or blank', () => {
    expect(rateLimitCheckUrl({ email: null, name: 'Primăria Pitești' })).toBe(
      '/api/rate-limit/check?name=Prim%C4%83ria%20Pite%C8%99ti',
    );
    expect(rateLimitCheckUrl({ email: '  ', name: 'X' })).toBe('/api/rate-limit/check?name=X');
    expect(rateLimitCheckUrl({ name: 'X' })).toBe('/api/rate-limit/check?name=X');
  });

  it('returns null when neither is available', () => {
    expect(rateLimitCheckUrl({})).toBeNull();
    expect(rateLimitCheckUrl({ email: '', name: '' })).toBeNull();
  });
});

describe('fetchRateLimit', () => {
  const info = { sent_today: 3, remaining: 7, limit: 10 };

  it('returns the parsed body on 200', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(info))) as unknown as typeof fetch;
    expect(await fetchRateLimit({ email: 'a@b.ro' }, fetchFn)).toEqual(info);
    expect(fetchFn).toHaveBeenCalledWith('/api/rate-limit/check?email=a%40b.ro');
  });

  it('returns null on a non-OK response', async () => {
    const fetchFn = vi.fn(async () => new Response('{}', { status: 401 })) as unknown as typeof fetch;
    expect(await fetchRateLimit({ email: 'a@b.ro' }, fetchFn)).toBeNull();
  });

  it('returns null on a network error', async () => {
    const fetchFn = vi.fn(async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    expect(await fetchRateLimit({ name: 'Prim' }, fetchFn)).toBeNull();
  });

  it('does not call fetch when there is nothing to check', async () => {
    const fetchFn = vi.fn() as unknown as typeof fetch;
    expect(await fetchRateLimit({}, fetchFn)).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

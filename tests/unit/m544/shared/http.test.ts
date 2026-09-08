/**
 * shared/http — uniform JSON responses, error responses and body parsing.
 *
 * Contract:
 *  - json(data, status = 200): NextResponse with JSON body
 *  - httpError(status, message, extra?): NextResponse { error: message, ...extra }
 *  - parseJsonBody(request, schema): { ok: true, data } | { ok: false, response: 400 }
 *  - withErrorBoundary(handler, label): wraps a route handler; unexpected throws -> 500
 *    with a generic message (no stack / internal message leaked), logged with label.
 */
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { NextRequest } from 'next/server';
import { json, httpError, parseJsonBody, withErrorBoundary } from '@m544/shared/http';

function req(body: unknown, init: { raw?: string; method?: string } = {}) {
  return new NextRequest('http://localhost/api/test', {
    method: init.method ?? 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: init.raw ?? JSON.stringify(body),
  });
}

describe('json', () => {
  it('serializes data with status 200 by default', async () => {
    const res = json({ a: 1 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ a: 1 });
  });

  it('accepts a custom status', async () => {
    const res = json({ created: true }, 201);
    expect(res.status).toBe(201);
  });
});

describe('httpError', () => {
  it('returns { error } with the given status', async () => {
    const res = httpError(401, 'Neautorizat');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Neautorizat' });
  });

  it('merges extra fields', async () => {
    const res = httpError(429, 'Limită', { remaining: 0, limit: 10 });
    expect(await res.json()).toEqual({ error: 'Limită', remaining: 0, limit: 10 });
  });
});

describe('parseJsonBody', () => {
  const schema = z.object({ email_id: z.string().uuid() });

  it('returns data when the body matches the schema', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const result = await parseJsonBody(req({ email_id: id }), schema);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.email_id).toBe(id);
  });

  it('returns a 400 response when the body does not match', async () => {
    const result = await parseJsonBody(req({ email_id: 'nope' }), schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      const body = await result.response.json();
      expect(body.error).toMatch(/email_id/);
    }
  });

  it('returns a 400 response when the body is not JSON', async () => {
    const result = await parseJsonBody(req(null, { raw: '{not json' }), schema);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(400);
  });
});

describe('withErrorBoundary', () => {
  it('passes through the handler response', async () => {
    const handler = withErrorBoundary(async () => json({ ok: true }), 'test');
    const res = await handler(req({}));
    expect(res.status).toBe(200);
  });

  it('converts unexpected throws into a generic 500 without leaking the message', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = withErrorBoundary(async () => {
      throw new Error('secret internal detail');
    }, 'test-route');
    const res = await handler(req({}));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain('secret internal detail');
    expect(errorSpy).toHaveBeenCalled();
    expect(String(errorSpy.mock.calls[0][0])).toContain('test-route');
    errorSpy.mockRestore();
  });

  it('maps EnvError to 500 "misconfigured" naming the variable (server-side only)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { EnvError } = await import('@m544/shared/env');
    const handler = withErrorBoundary(async () => {
      throw new EnvError('CRON_SECRET', 'is required');
    }, 'cron');
    const res = await handler(req({}));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/misconfigur/i);
    expect(JSON.stringify(body)).not.toContain('CRON_SECRET'); // never leak which secret is missing
    expect(String(errorSpy.mock.calls[0]).includes('CRON_SECRET')).toBe(true); // but log it
    errorSpy.mockRestore();
  });
});

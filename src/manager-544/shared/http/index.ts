/**
 * Uniform HTTP helpers for route handlers: JSON responses, error responses,
 * validated body parsing and an error boundary that never leaks internals.
 */

import { NextResponse, type NextRequest } from 'next/server';
import type { ZodType } from 'zod';
import { EnvError } from '@m544/shared/env';

export function json<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status });
}

export function httpError(status: number, message: string, extra: Record<string, unknown> = {}): NextResponse {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export type ParsedBody<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

/**
 * Parse and validate a JSON request body against a zod schema.
 * Invalid JSON or schema violations produce a 400 with the offending path(s).
 */
export async function parseJsonBody<T>(request: NextRequest, schema: ZodType<T>): Promise<ParsedBody<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: httpError(400, 'Body JSON invalid') };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    return { ok: false, response: httpError(400, `Date invalide: ${detail}`) };
  }
  return { ok: true, data: parsed.data };
}

type RouteHandler<Ctx> = (request: NextRequest, ctx?: Ctx) => Promise<NextResponse> | NextResponse;

/**
 * Wrap a route handler so that unexpected exceptions become a generic 500.
 * EnvError (missing/placeholder secret) becomes a 500 "misconfigured" that
 * names the variable only in the server log, never in the response.
 */
export function withErrorBoundary<Ctx = unknown>(handler: RouteHandler<Ctx>, label: string): RouteHandler<Ctx> {
  return async (request, ctx) => {
    try {
      return await handler(request, ctx);
    } catch (err) {
      if (err instanceof EnvError) {
        console.error(`[${label}] misconfigured: ${err.message}`);
        return httpError(500, 'Serviciul nu este configurat corect (misconfigured)');
      }
      const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      console.error(`[${label}] unhandled error: ${message}`);
      return httpError(500, 'Eroare internă');
    }
  };
}

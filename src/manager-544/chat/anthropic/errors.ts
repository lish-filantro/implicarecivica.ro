/**
 * Map Anthropic API failures to the responses the chat UI expects. Anything
 * not handled here is left to withErrorBoundary (generic 500, nothing leaked).
 */
import type { NextResponse } from 'next/server';
import { httpError } from '@m544/shared/http';

function statusOf(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const status = (err as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
}

export function anthropicErrorResponse(err: unknown): NextResponse | null {
  switch (statusOf(err)) {
    case 401:
      return httpError(401, 'ANTHROPIC_API_KEY invalid', { details: 'Verifica cheia in .env.local' });
    case 429:
      return httpError(429, 'Rate limit atins', { details: 'Asteapta cateva secunde si incearca din nou.' });
    default:
      return null;
  }
}

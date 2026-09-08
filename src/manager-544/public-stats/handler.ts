/**
 * GET /api/public/institutii-stats?nume=<nume_scurt>&slug=<slug> — open data, no auth.
 *   400 neither param · 200 InstitutionStats (cached 1h at the edge, 24h stale)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { httpError, withErrorBoundary } from '@m544/shared/http';
import { aggregateInstitutionStats } from './aggregate';
import type { PublicStatsRepo } from './repo';

export interface PublicStatsDeps {
  repo: PublicStatsRepo;
  now: () => Date;
}

export const CACHE_CONTROL = 'public, s-maxage=3600, stale-while-revalidate=86400';

function param(request: NextRequest, name: string): string | undefined {
  const value = request.nextUrl.searchParams.get(name)?.trim();
  return value ? value : undefined;
}

export function createInstitutionStatsHandler(getDeps: () => PublicStatsDeps) {
  return withErrorBoundary(async (request: NextRequest) => {
    const nume = param(request, 'nume');
    const slug = param(request, 'slug');
    if (!nume && !slug) return httpError(400, 'Parametrul nume sau slug este obligatoriu');

    const deps = getDeps();
    const rows = await deps.repo.listRows({ nume, slug });
    const stats = aggregateInstitutionStats(rows, deps.now());
    return NextResponse.json(stats, { headers: { 'Cache-Control': CACHE_CONTROL } });
  }, 'public-stats');
}

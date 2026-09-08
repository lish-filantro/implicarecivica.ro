/**
 * GET /api/public/institutii-stats — open data per institution (no auth).
 * Implementation: src/manager-544/public-stats/handler.ts
 * Dynamic (query-dependent); caching is done through the Cache-Control header.
 */
import { createInstitutionStatsHandler } from '@m544/public-stats/handler';
import { createPublicStatsDeps } from '@m544/public-stats/deps';

export const dynamic = 'force-dynamic';

export const GET = createInstitutionStatsHandler(createPublicStatsDeps);

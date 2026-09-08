/**
 * GET /api/admin/stats — aggregate dashboard numbers (admins only).
 * Implementation: src/manager-544/admin.
 */
import { createAdminStatsHandler } from '@m544/admin/handlers';
import { createAdminDeps } from '@m544/admin/deps';

export const dynamic = 'force-dynamic';

export const GET = createAdminStatsHandler(createAdminDeps);

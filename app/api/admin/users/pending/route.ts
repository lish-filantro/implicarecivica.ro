/**
 * GET /api/admin/users/pending — accounts waiting for approval (admins only).
 * Implementation: src/manager-544/admin.
 */
import { createPendingUsersHandler } from '@m544/admin/handlers';
import { createAdminDeps } from '@m544/admin/deps';

export const dynamic = 'force-dynamic';

export const GET = createPendingUsersHandler(createAdminDeps);

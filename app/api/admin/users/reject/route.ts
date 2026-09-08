/**
 * POST /api/admin/users/reject { userId } — delete the auth user (profile cascades; admins only).
 * Implementation: src/manager-544/admin.
 */
import { createRejectUserHandler } from '@m544/admin/handlers';
import { createAdminDeps } from '@m544/admin/deps';

export const POST = createRejectUserHandler(createAdminDeps);

/**
 * POST /api/admin/users/approve { userId } — mark a profile approved (admins only).
 * Implementation: src/manager-544/admin.
 */
import { createApproveUserHandler } from '@m544/admin/handlers';
import { createAdminDeps } from '@m544/admin/deps';

export const POST = createApproveUserHandler(createAdminDeps);

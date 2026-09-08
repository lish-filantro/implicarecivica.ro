/**
 * Route handlers for the admin API. The `app/api/admin/**` route files are
 * one-line adapters over these factories; tests build handlers with fakes.
 *
 *   GET  /api/admin/stats          aggregate dashboard numbers
 *   GET  /api/admin/users/pending  { users: PendingUser[] }
 *   POST /api/admin/users/approve  { userId }  → { success: true }
 *   POST /api/admin/users/reject   { userId }  → { success: true }
 *
 * All four require a session whose email is in ADMIN_EMAILS
 * (401 without session, 403 for a non-admin, 500 when misconfigured).
 */
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin, type AuthDeps } from '@m544/shared/auth';
import { json, parseJsonBody, withErrorBoundary } from '@m544/shared/http';
import { loadAdminStats, type AdminStatsRepo } from './stats';
import { listPendingUsers, approveUser, rejectUser, type AdminUsersRepo } from './users';

export interface AdminDeps extends AuthDeps {
  stats: AdminStatsRepo;
  users: AdminUsersRepo;
  now?: () => Date;
}

export type AdminDepsFactory = () => AdminDeps;

const userIdBodySchema = z.object({ userId: z.string().uuid() });

export function createAdminStatsHandler(getDeps: AdminDepsFactory) {
  return withErrorBoundary(async (_request: NextRequest) => {
    const deps = getDeps();
    const guard = await requireAdmin(deps);
    if (!guard.ok) return guard.response;
    return json(await loadAdminStats({ repo: deps.stats, now: deps.now }));
  }, 'admin/stats');
}

export function createPendingUsersHandler(getDeps: AdminDepsFactory) {
  return withErrorBoundary(async (_request: NextRequest) => {
    const deps = getDeps();
    const guard = await requireAdmin(deps);
    if (!guard.ok) return guard.response;
    return json({ users: await listPendingUsers(deps.users) });
  }, 'admin/users/pending');
}

function createUserActionHandler(
  getDeps: AdminDepsFactory,
  label: string,
  action: (repo: AdminUsersRepo, userId: string) => Promise<void>,
) {
  return withErrorBoundary(async (request: NextRequest) => {
    const deps = getDeps();
    const guard = await requireAdmin(deps);
    if (!guard.ok) return guard.response;

    const body = await parseJsonBody(request, userIdBodySchema);
    if (!body.ok) return body.response;

    await action(deps.users, body.data.userId);
    return json({ success: true });
  }, label);
}

export function createApproveUserHandler(getDeps: AdminDepsFactory) {
  return createUserActionHandler(getDeps, 'admin/users/approve', approveUser);
}

export function createRejectUserHandler(getDeps: AdminDepsFactory) {
  return createUserActionHandler(getDeps, 'admin/users/reject', rejectUser);
}

/**
 * Contract tests for the admin routes: 401 (no session), 403 (non-admin),
 * 400 (bad body), 200 shapes. Supabase is replaced by fakes; the session is a
 * fake auth client injected through deps.createClient.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import {
  createAdminStatsHandler,
  createPendingUsersHandler,
  createApproveUserHandler,
  createRejectUserHandler,
  type AdminDeps,
} from '@m544/admin/handlers';
import type { AdminStatsRepo } from '@m544/admin/stats';
import { FakeAdminUsersRepo } from './_fake-users-repo';

const ADMIN = { id: 'admin-1', email: 'admin@example.ro' } as User;
const MORTAL = { id: 'user-1', email: 'user@example.ro' } as User;
const UUID = '11111111-1111-4111-8111-111111111111';

const emptyStats: AdminStatsRepo = {
  countProfiles: async () => 0,
  countPendingProfiles: async () => 0,
  profileSignupsSince: async () => [],
  countSince: async () => 0,
  countActiveCampaigns: async () => 0,
  requestStatuses: async () => [],
  feedbackStatuses: async () => [],
  requestInstitutions: async () => [],
  activeUserIdsSince: async () => [],
};

function makeDeps(user: User | null) {
  const users = new FakeAdminUsersRepo();
  const deps: AdminDeps = {
    createClient: async () => ({
      auth: { getUser: async () => ({ data: { user }, error: user ? null : { message: 'no session' } }) },
    }),
    stats: emptyStats,
    users,
    now: () => new Date('2026-09-08T12:00:00.000Z'),
  };
  return { deps, users };
}

function get(path: string) {
  return new NextRequest(`http://localhost${path}`);
}
function post(path: string, body: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const savedAdmins = process.env.ADMIN_EMAILS;
const savedVercel = process.env.VERCEL_ENV;
beforeEach(() => {
  process.env.ADMIN_EMAILS = 'admin@example.ro';
  delete process.env.VERCEL_ENV;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  if (savedAdmins === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = savedAdmins;
  if (savedVercel === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = savedVercel;
  vi.restoreAllMocks();
});

describe('auth on every admin route', () => {
  const routes = [
    ['GET /api/admin/stats', (d: AdminDeps) => createAdminStatsHandler(() => d)(get('/api/admin/stats'))],
    [
      'GET /api/admin/users/pending',
      (d: AdminDeps) => createPendingUsersHandler(() => d)(get('/api/admin/users/pending')),
    ],
    [
      'POST /api/admin/users/approve',
      (d: AdminDeps) => createApproveUserHandler(() => d)(post('/api/admin/users/approve', { userId: UUID })),
    ],
    [
      'POST /api/admin/users/reject',
      (d: AdminDeps) => createRejectUserHandler(() => d)(post('/api/admin/users/reject', { userId: UUID })),
    ],
  ] as const;

  for (const [name, call] of routes) {
    it(`${name}: 401 without session, 403 for a non-admin`, async () => {
      expect((await call(makeDeps(null).deps)).status).toBe(401);
      expect((await call(makeDeps(MORTAL).deps)).status).toBe(403);
    });
  }

  it('500 misconfigured in production when ADMIN_EMAILS is missing (never open)', async () => {
    delete process.env.ADMIN_EMAILS;
    process.env.VERCEL_ENV = 'production';
    const res = await createAdminStatsHandler(() => makeDeps(ADMIN).deps)(get('/api/admin/stats'));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/misconfigur/i);
  });
});

describe('GET /api/admin/stats', () => {
  it('200 with the dashboard shape', async () => {
    const res = await createAdminStatsHandler(() => makeDeps(ADMIN).deps)(get('/api/admin/stats'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(
      ['activity', 'dailySignups', 'feedbackStatus', 'requestStatus', 'topInstitutions', 'users'].sort(),
    );
    expect(body.users).toEqual({ total: 0, new_7d: 0, new_30d: 0, active_30d: 0, pending_approval: 0 });
    expect(body.dailySignups).toHaveLength(30);
  });
});

describe('GET /api/admin/users/pending', () => {
  it('200 with { users: [...] }', async () => {
    const { deps, users } = makeDeps(ADMIN);
    users.seed({ id: 'p1', approved: false, created_at: '2026-09-01T00:00:00Z', email: 'p1@x.ro' });
    const res = await createPendingUsersHandler(() => deps)(get('/api/admin/users/pending'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      users: [
        {
          id: 'p1',
          email: 'p1@x.ro',
          first_name: null,
          last_name: null,
          display_name: null,
          created_at: '2026-09-01T00:00:00Z',
        },
      ],
    });
  });
});

describe('POST /api/admin/users/approve', () => {
  it('400 on missing/non-uuid userId or invalid JSON', async () => {
    const { deps } = makeDeps(ADMIN);
    const h = createApproveUserHandler(() => deps);
    expect((await h(post('/api/admin/users/approve', {}))).status).toBe(400);
    expect((await h(post('/api/admin/users/approve', { userId: 'abc' }))).status).toBe(400);
    expect((await h(post('/api/admin/users/approve', '{nope'))).status).toBe(400);
  });

  it('200 { success: true } and approves the profile', async () => {
    const { deps, users } = makeDeps(ADMIN);
    users.seed({ id: UUID, approved: false, created_at: '2026-09-01T00:00:00Z', email: 'p@x.ro' });
    const res = await createApproveUserHandler(() => deps)(post('/api/admin/users/approve', { userId: UUID }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(users.profiles.get(UUID)?.approved).toBe(true);
  });

  it('500 generic when the repo fails (no DB message leak)', async () => {
    const { deps, users } = makeDeps(ADMIN);
    users.failWith = new Error('relation profiles does not exist');
    const res = await createApproveUserHandler(() => deps)(post('/api/admin/users/approve', { userId: UUID }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/relation/);
  });
});

describe('POST /api/admin/users/reject', () => {
  it('400 on bad body', async () => {
    const res = await createRejectUserHandler(() => makeDeps(ADMIN).deps)(
      post('/api/admin/users/reject', { userId: 5 }),
    );
    expect(res.status).toBe(400);
  });

  it('200 { success: true } and deletes the auth user', async () => {
    const { deps, users } = makeDeps(ADMIN);
    users.seed({ id: UUID, approved: false, created_at: '2026-09-01T00:00:00Z', email: 'p@x.ro' });
    const res = await createRejectUserHandler(() => deps)(post('/api/admin/users/reject', { userId: UUID }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(users.deletedAuthUsers).toEqual([UUID]);
  });
});

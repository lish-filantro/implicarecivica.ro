/**
 * admin/users — pending list (profiles + auth emails), approve, reject.
 */
import { describe, it, expect } from 'vitest';
import { listPendingUsers, approveUser, rejectUser } from '@m544/admin/users';
import { FakeAdminUsersRepo } from './_fake-users-repo';

describe('listPendingUsers', () => {
  it('returns unapproved profiles with emails from auth, newest first', async () => {
    const repo = new FakeAdminUsersRepo();
    repo.seed({ id: 'a', approved: false, created_at: '2026-09-01T00:00:00Z', email: 'a@x.ro', first_name: 'Ana' });
    repo.seed({ id: 'b', approved: false, created_at: '2026-09-05T00:00:00Z', email: 'b@x.ro' });
    repo.seed({ id: 'c', approved: true, created_at: '2026-09-06T00:00:00Z', email: 'c@x.ro' });
    const users = await listPendingUsers(repo);
    expect(users.map((u) => u.id)).toEqual(['b', 'a']);
    expect(users[1]).toEqual({
      id: 'a',
      email: 'a@x.ro',
      first_name: 'Ana',
      last_name: null,
      display_name: null,
      created_at: '2026-09-01T00:00:00Z',
    });
  });

  it('email is null when auth has no user', async () => {
    const repo = new FakeAdminUsersRepo();
    repo.seed({ id: 'a', approved: false, created_at: '2026-09-01T00:00:00Z', email: null });
    expect((await listPendingUsers(repo))[0].email).toBeNull();
  });

  it('returns [] and does not query auth when nothing is pending', async () => {
    const repo = new FakeAdminUsersRepo();
    expect(await listPendingUsers(repo)).toEqual([]);
    expect(repo.emailLookups).toBe(0);
  });
});

describe('approveUser', () => {
  it('sets approved = true on the profile', async () => {
    const repo = new FakeAdminUsersRepo();
    repo.seed({ id: 'a', approved: false, created_at: '2026-09-01T00:00:00Z', email: 'a@x.ro' });
    await approveUser(repo, 'a');
    expect(repo.profiles.get('a')?.approved).toBe(true);
  });

  it('propagates repository errors', async () => {
    const repo = new FakeAdminUsersRepo();
    repo.failWith = new Error('db down');
    await expect(approveUser(repo, 'a')).rejects.toThrow('db down');
  });
});

describe('rejectUser', () => {
  it('deletes the auth user (profile cascades)', async () => {
    const repo = new FakeAdminUsersRepo();
    repo.seed({ id: 'a', approved: false, created_at: '2026-09-01T00:00:00Z', email: 'a@x.ro' });
    await rejectUser(repo, 'a');
    expect(repo.deletedAuthUsers).toEqual(['a']);
    expect(repo.profiles.has('a')).toBe(false);
  });
});

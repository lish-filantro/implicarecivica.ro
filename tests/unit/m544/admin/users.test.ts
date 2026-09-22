/**
 * admin/users — pending list (profiles + auth emails), approve, reject.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { listPendingUsers, approveUser, rejectUser, type ApprovalMailer } from '@m544/admin/users';
import type { OutgoingEmail, SendResult } from '@m544/emails/send';
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

/**
 * Confirmarea pe email (F9 din raportul de testare). Cele două reguli de aici:
 * numele se citeşte cu `getProfile`, care funcţionează şi DUPĂ aprobare (spre deosebire de
 * `listUnapprovedProfiles`), iar o trimitere eşuată nu întoarce eroare administratorului —
 * contul e deja aprobat, iar un retry ar trimite al doilea email.
 */
describe('approveUser — emailul de confirmare', () => {
  afterEach(() => vi.restoreAllMocks());

  function makeMailer(result: SendResult | Error = { data: { id: 'x' }, error: null }) {
    const sent: OutgoingEmail[] = [];
    const mailer: ApprovalMailer = {
      fromAddress: 'Implicare Civică <notificari@implicarecivica.ro>',
      appUrl: 'https://implicarecivica.ro',
      sender: {
        async send(payload) {
          sent.push(payload);
          if (result instanceof Error) throw result;
          return result;
        },
      },
    };
    return { mailer, sent };
  }

  function seeded() {
    const repo = new FakeAdminUsersRepo();
    repo.seed({
      id: 'a',
      approved: false,
      created_at: '2026-09-01T00:00:00Z',
      email: 'irina@x.ro',
      first_name: 'Irina',
      display_name: 'Irina Bogdan',
    });
    return repo;
  }

  it('trimite confirmarea pe adresa din auth, cu numele profilului', async () => {
    const repo = seeded();
    const { mailer, sent } = makeMailer();

    await approveUser(repo, 'a', mailer);

    expect(repo.profiles.get('a')?.approved).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toEqual(['irina@x.ro']);
    expect(sent[0].from).toBe('Implicare Civică <notificari@implicarecivica.ro>');
    expect(sent[0].subject).toBe('Contul tău Implicare Civică a fost aprobat');
    expect(sent[0].text).toContain('Irina');
    expect(sent[0].html).toContain('https://implicarecivica.ro/login');
  });

  it('nu trimite nimic când nu i se dă un mailer', async () => {
    const repo = seeded();
    await approveUser(repo, 'a');
    expect(repo.profiles.get('a')?.approved).toBe(true);
  });

  it('nu trimite când auth nu mai are o adresă pentru utilizator', async () => {
    const repo = new FakeAdminUsersRepo();
    repo.seed({ id: 'a', approved: false, created_at: '2026-09-01T00:00:00Z', email: null });
    const { mailer, sent } = makeMailer();

    await approveUser(repo, 'a', mailer);

    expect(sent).toEqual([]);
    expect(repo.profiles.get('a')?.approved).toBe(true);
  });

  it('nu eşuează aprobarea când trimiterea aruncă', async () => {
    const repo = seeded();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { mailer } = makeMailer(new Error('Resend down'));

    await expect(approveUser(repo, 'a', mailer)).resolves.toBeUndefined();

    expect(repo.profiles.get('a')?.approved).toBe(true);
    expect(spy).toHaveBeenCalled();
  });

  it('nu eşuează aprobarea când Resend întoarce o eroare în răspuns', async () => {
    const repo = seeded();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { mailer } = makeMailer({ data: null, error: { message: 'domain not verified' } });

    await expect(approveUser(repo, 'a', mailer)).resolves.toBeUndefined();

    expect(repo.profiles.get('a')?.approved).toBe(true);
    expect(spy).toHaveBeenCalled();
  });

  it('salută fără nume când profilul nu are niciunul', async () => {
    const repo = new FakeAdminUsersRepo();
    repo.seed({ id: 'a', approved: false, created_at: '2026-09-01T00:00:00Z', email: 'a@x.ro' });
    const { mailer, sent } = makeMailer();

    await approveUser(repo, 'a', mailer);

    expect(sent[0]?.text?.startsWith('Salut,')).toBe(true);
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

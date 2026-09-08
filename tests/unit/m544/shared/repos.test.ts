/**
 * Repository contract tests.
 *
 * The same suite runs against the in-memory fakes (always) and against the
 * real Supabase implementations (only when RUN_DB_TESTS=1, using the e2e test
 * user). This keeps the fakes honest: any behaviour the pipeline relies on is
 * asserted on both.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { EmailsRepo } from '@m544/shared/db/emails-repo';
import type { RequestsRepo } from '@m544/shared/db/requests-repo';
import type { ProfilesRepo } from '@m544/shared/db/profiles-repo';
import { FakeEmailsRepo, FakeRequestsRepo, FakeProfilesRepo } from '../_fakes/fake-repos';

const TEST_USER_ID = 'a0000000-e2e0-4000-a000-000000000001';
const RUN_DB = process.env.RUN_DB_TESTS === '1';

interface Suite {
  name: string;
  emails: () => EmailsRepo;
  requests: () => RequestsRepo;
  profiles: () => ProfilesRepo;
  seedRequest: (r: { registration_number?: string; status?: string; institution_email?: string; deadline_date?: string }) => Promise<string>;
  seedEmail: (e: { type?: 'sent' | 'received'; request_id?: string; message_id?: string; to_email?: string; from_email?: string; processing_status?: string; retry_count?: number }) => Promise<string>;
  cleanup: () => Promise<void>;
}

function fakeSuite(): Suite {
  const emails = new FakeEmailsRepo();
  const requests = new FakeRequestsRepo();
  const profiles = new FakeProfilesRepo();
  profiles.seed({ id: TEST_USER_ID, mailcow_email: 'test-cetatean@implicarecivica.ro', display_name: 'Test' });
  return {
    name: 'fake',
    emails: () => emails,
    requests: () => requests,
    profiles: () => profiles,
    seedRequest: async (r) =>
      requests.seed({ user_id: TEST_USER_ID, ...r, status: (r.status as Request['status']) ?? 'pending' }).id,
    seedEmail: async (e) =>
      emails.seed({
        user_id: TEST_USER_ID,
        ...e,
        processing_status: (e.processing_status as Email['processing_status']) ?? 'pending',
      }).id,
    cleanup: async () => {
      emails.rows.clear();
      requests.rows.clear();
    },
  };
}

type Request = import('@m544/shared/types/request').Request;
type Email = import('@m544/shared/types/email').Email;

async function realSuite(): Promise<Suite> {
  const { createServiceClient } = await import('@m544/shared/db/clients');
  const { SupabaseEmailsRepo } = await import('@m544/shared/db/emails-repo');
  const { SupabaseRequestsRepo } = await import('@m544/shared/db/requests-repo');
  const { SupabaseProfilesRepo } = await import('@m544/shared/db/profiles-repo');
  const sb = createServiceClient();
  return {
    name: 'supabase',
    emails: () => new SupabaseEmailsRepo(sb),
    requests: () => new SupabaseRequestsRepo(sb),
    profiles: () => new SupabaseProfilesRepo(sb),
    seedRequest: async (r) => {
      const { data, error } = await sb
        .from('requests')
        .insert({ user_id: TEST_USER_ID, institution_name: 'Repo Test', subject: 'Repo test', status: r.status ?? 'pending', ...r })
        .select('id')
        .single();
      if (error) throw error;
      return data.id;
    },
    seedEmail: async (e) => {
      const { data, error } = await sb
        .from('emails')
        .insert({
          user_id: TEST_USER_ID,
          message_id: e.message_id ?? `<repo-${randomUUID()}@test>`,
          type: e.type ?? 'received',
          from_email: e.from_email ?? 'inst@test.ro',
          to_email: e.to_email ?? 'test-cetatean@implicarecivica.ro',
          subject: 'Repo test',
          processing_status: e.processing_status ?? 'pending',
          retry_count: e.retry_count ?? 0,
          request_id: e.request_id ?? null,
        })
        .select('id')
        .single();
      if (error) throw error;
      return data.id;
    },
    cleanup: async () => {
      await sb.from('emails').delete().eq('user_id', TEST_USER_ID);
      await sb.from('requests').delete().eq('user_id', TEST_USER_ID);
    },
  };
}

const suites: Array<() => Promise<Suite>> = [async () => fakeSuite()];
if (RUN_DB) suites.push(realSuite);

for (const make of suites) {
  describe.sequential(`repositories`, async () => {
    let s: Suite;
    beforeAll(async () => {
      s = await make();
      await s.cleanup();
    });
    afterAll(async () => {
      await s.cleanup();
    });

    describe('RequestsRepo', () => {
      it('getById returns null for unknown id', async () => {
        expect(await s.requests().getById(randomUUID())).toBeNull();
      });

      it('update patches fields and getById reflects them', async () => {
        const id = await s.seedRequest({});
        await s.requests().update(id, { status: 'received', registration_number: '1234/2025' });
        const row = await s.requests().getById(id);
        expect(row?.status).toBe('received');
        expect(row?.registration_number).toBe('1234/2025');
      });

      it('findByRegistrationNumber matches exactly, scoped to the user', async () => {
        const id = await s.seedRequest({ registration_number: '9999/RP/2025' });
        expect(await s.requests().findByRegistrationNumber(TEST_USER_ID, '9999/RP/2025')).toBe(id);
        expect(await s.requests().findByRegistrationNumber(TEST_USER_ID, '9999')).toBeNull();
        expect(await s.requests().findByRegistrationNumber(randomUUID(), '9999/RP/2025')).toBeNull();
      });

      it('listWithRegistration returns only requests that have a number', async () => {
        await s.cleanup();
        const withReg = await s.seedRequest({ registration_number: '111/2025' });
        await s.seedRequest({});
        const list = await s.requests().listWithRegistration(TEST_USER_ID);
        expect(list.map((r) => r.id)).toEqual([withReg]);
        expect(list[0].registration_number).toBe('111/2025');
      });

      it('listOpen excludes answered and orders oldest first', async () => {
        await s.cleanup();
        const older = await s.seedRequest({ status: 'received' });
        await new Promise((r) => setTimeout(r, 5));
        const newer = await s.seedRequest({ status: 'pending' });
        await s.seedRequest({ status: 'answered' });
        const open = await s.requests().listOpen(TEST_USER_ID);
        expect(open.map((r) => r.id)).toEqual([older, newer]);
      });

      it('listOverdueIds returns open requests whose effective deadline passed', async () => {
        await s.cleanup();
        const past = new Date(Date.now() - 86400000).toISOString();
        const future = new Date(Date.now() + 86400000).toISOString();
        const overdue = await s.seedRequest({ status: 'received', deadline_date: past });
        await s.seedRequest({ status: 'received', deadline_date: future });
        await s.seedRequest({ status: 'answered', deadline_date: past });
        await s.seedRequest({ status: 'pending' }); // no deadline
        // The real DB also holds other users' rows: assert membership, not equality.
        const ids = await s.requests().listOverdueIds(new Date().toISOString());
        expect(ids).toContain(overdue);
        const mine = (await s.requests().listOpen(TEST_USER_ID)).map((r) => r.id);
        expect(ids.filter((id) => mine.includes(id))).toEqual([overdue]);
      });
    });

    describe('EmailsRepo', () => {
      it('insert rejects a duplicate (user_id, message_id) as duplicate, not as error', async () => {
        const base = {
          user_id: TEST_USER_ID,
          message_id: `<dup-${randomUUID()}@test>`,
          type: 'received' as const,
          from_email: 'a@b.ro',
          to_email: 'test-cetatean@implicarecivica.ro',
          subject: 'dup',
          processing_status: 'pending' as const,
        };
        const first = await s.emails().insert(base);
        expect(first.ok).toBe(true);
        const second = await s.emails().insert(base);
        expect(second).toEqual({ ok: false, duplicate: true });
      });

      it('findIdByMessageId / getRequestIdOfEmail support thread matching', async () => {
        const reqId = await s.seedRequest({});
        const msgId = `<thread-${randomUUID()}@test>`;
        const emailId = await s.seedEmail({ type: 'sent', request_id: reqId, message_id: msgId });
        expect(await s.emails().findIdByMessageId(msgId)).toBe(emailId);
        expect(await s.emails().getRequestIdOfEmail(emailId)).toBe(reqId);
        expect(await s.emails().findIdByMessageId('<nope@test>')).toBeNull();
      });

      it('listPendingReceived returns pending received emails with retry_count < 3, oldest first, limited', async () => {
        await s.cleanup();
        const a = await s.seedEmail({});
        await new Promise((r) => setTimeout(r, 5));
        const b = await s.seedEmail({});
        const c = await s.seedEmail({ retry_count: 3 });
        const d = await s.seedEmail({ processing_status: 'completed' });
        const e = await s.seedEmail({ type: 'sent' });
        // The real DB also holds other users' pending emails: check ours are present, in order,
        // and that excluded rows never appear.
        const excluded = new Set([c, d, e]);
        const all = await s.emails().listPendingReceived(100);
        const ours = all.filter((id) => id === a || id === b || excluded.has(id));
        expect(ours).toEqual([a, b]);
        expect((await s.emails().listPendingReceived(1)).length).toBe(1);
      });

      it('hasSentToAddress is case-insensitive substring on to_email', async () => {
        const reqId = await s.seedRequest({});
        await s.seedEmail({ type: 'sent', request_id: reqId, to_email: 'Registratura@Primaria.ro' });
        expect(await s.emails().hasSentToAddress(reqId, 'registratura@primaria.ro')).toBe(true);
        expect(await s.emails().hasSentToAddress(reqId, 'altcineva@primaria.ro')).toBe(false);
      });

      it('update patches processing fields', async () => {
        const id = await s.seedEmail({});
        await s.emails().update(id, { processing_status: 'failed', retry_count: 3, error_log: 'x' });
        const row = await s.emails().getById(id);
        expect(row?.processing_status).toBe('failed');
        expect(row?.retry_count).toBe(3);
      });
    });

    describe('ProfilesRepo', () => {
      it('findIdByMailcowEmail is case-insensitive', async () => {
        expect(await s.profiles().findIdByMailcowEmail('Test-Cetatean@ImplicareCivica.ro')).toBe(TEST_USER_ID);
        expect(await s.profiles().findIdByMailcowEmail('nobody@implicarecivica.ro')).toBeNull();
      });

      it('getSenderIdentity returns display name and platform email', async () => {
        const identity = await s.profiles().getSenderIdentity(TEST_USER_ID);
        expect(identity?.mailcow_email).toBe('test-cetatean@implicarecivica.ro');
      });
    });
  });
}

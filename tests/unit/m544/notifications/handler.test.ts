/** Contract tests for GET /api/cron/notify-deadlines (src/manager-544/notifications/handler.ts). */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createNotifyDeadlinesHandler } from '@m544/notifications/handler';
import type { DigestDeps } from '@m544/notifications/digest';
import { FakeNotificationsRepo, FakeSender, daysFrom } from './_fakes';

const SECRET = 'cron-secret-for-tests-123';

function get(auth: string | null = `Bearer ${SECRET}`) {
  return new NextRequest('http://localhost/api/cron/notify-deadlines', {
    headers: auth ? { authorization: auth } : {},
  });
}

function deps(): DigestDeps & { repo: FakeNotificationsRepo; sender: FakeSender } {
  return {
    repo: new FakeNotificationsRepo(),
    sender: new FakeSender(),
    appUrl: 'https://implicarecivica.ro',
    fromAddress: 'Implicare Civică <notificari@implicarecivica.ro>',
  };
}

beforeEach(() => {
  process.env.CRON_SECRET = SECRET;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  delete process.env.CRON_SECRET;
  vi.restoreAllMocks();
});

describe('GET /api/cron/notify-deadlines', () => {
  it('401 without the secret and with a wrong secret', async () => {
    expect((await createNotifyDeadlinesHandler(deps)(get(null))).status).toBe(401);
    expect((await createNotifyDeadlinesHandler(deps)(get('Bearer nope'))).status).toBe(401);
  });

  it('500 misconfigured when CRON_SECRET is missing, never open', async () => {
    delete process.env.CRON_SECRET;
    const res = await createNotifyDeadlinesHandler(deps)(get('Bearer anything'));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/misconfigur/i);
  });

  it('200 with the digest summary', async () => {
    const d = deps();
    d.repo.addUser({ userId: 'u1' });
    d.repo.addRequest({ user_id: 'u1', deadline_date: daysFrom(new Date(), 1) });
    const res = await createNotifyDeadlinesHandler(() => d)(get());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ success: true, users: 1, emails_sent: 1, notices: 1, skipped: 0, errors: 0 });
    expect(body.checked_at).toMatch(/^\d{4}-/);
    expect(d.sender.sent).toHaveLength(1);
  });

  it('500 generic when the deps factory throws (error boundary)', async () => {
    const res = await createNotifyDeadlinesHandler(() => {
      throw new Error('kaboom');
    })(get());
    expect(res.status).toBe(500);
    expect((await res.json()).error).not.toContain('kaboom');
  });
});

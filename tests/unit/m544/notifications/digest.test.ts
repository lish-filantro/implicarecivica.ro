/** Unit tests for src/manager-544/notifications/digest.ts (one digest per user, dedupe, errors). */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendDeadlineDigests, toDateIso } from '@m544/notifications/digest';
import { FakeNotificationsRepo, FakeSender, daysFrom } from './_fakes';

const now = new Date(2026, 8, 8, 6, 0);
const today = toDateIso(now);
const FROM = 'Implicare Civică <notificari@implicarecivica.ro>';

function build() {
  const repo = new FakeNotificationsRepo();
  const sender = new FakeSender();
  const run = () =>
    sendDeadlineDigests({ repo, sender, now: () => now, appUrl: 'https://implicarecivica.ro', fromAddress: FROM });
  return { repo, sender, run };
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('toDateIso', () => {
  it('formats the local calendar day as YYYY-MM-DD', () => {
    expect(toDateIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('sendDeadlineDigests', () => {
  it('sends exactly one email per user with notices and marks them sent', async () => {
    const { repo, sender, run } = build();
    repo.addUser({ userId: 'u1', email: 'ana@x.ro', displayName: 'Ana', deadlineDays: 3 });
    repo.addUser({ userId: 'u2', email: 'bob@x.ro' });
    const r1 = repo.addRequest({ user_id: 'u1', deadline_date: daysFrom(now, 1) });
    const r2 = repo.addRequest({ user_id: 'u1', deadline_date: daysFrom(now, -2) });
    repo.addRequest({ user_id: 'u1', deadline_date: daysFrom(now, 30) }); // outside the window
    repo.addRequest({ user_id: 'u2', deadline_date: daysFrom(now, 2) });

    const summary = await run();

    expect(summary).toEqual({ users: 2, emails_sent: 2, notices: 3, skipped: 0, errors: 0 });
    expect(sender.sent).toHaveLength(2);
    const toAna = sender.sent.find((m) => m.to[0] === 'ana@x.ro');
    expect(toAna?.from).toBe(FROM);
    expect(toAna?.subject).toBe('1 cerere cu termen apropiat, 1 depășită – implicarecivica.ro');
    expect(toAna?.html).toContain('Bună, Ana');
    expect(repo.markSentCalls.find((c) => c.userId === 'u1')).toEqual({
      userId: 'u1',
      dateIso: today,
      entries: [
        { requestId: r2.id, kind: 'overdue' },
        { requestId: r1.id, kind: 'upcoming' },
      ],
    });
  });

  it('skips users with nothing to notify and users whose notices were all sent today', async () => {
    const { repo, sender, run } = build();
    repo.addUser({ userId: 'u1' });
    repo.addUser({ userId: 'u2' });
    repo.addRequest({ user_id: 'u1', deadline_date: daysFrom(now, 20) });
    const r = repo.addRequest({ user_id: 'u2', deadline_date: daysFrom(now, 1) });
    await repo.markSent('u2', [{ requestId: r.id, kind: 'upcoming' }], today);
    repo.markSentCalls = [];

    const summary = await run();

    expect(summary).toEqual({ users: 2, emails_sent: 0, notices: 0, skipped: 2, errors: 0 });
    expect(sender.sent).toHaveLength(0);
    expect(repo.markSentCalls).toHaveLength(0);
  });

  it('dedupes by (request, kind): a request that became overdue since the upcoming notice is sent again', async () => {
    const { repo, sender, run } = build();
    repo.addUser({ userId: 'u1' });
    const r = repo.addRequest({ user_id: 'u1', deadline_date: daysFrom(now, -1) });
    await repo.markSent('u1', [{ requestId: r.id, kind: 'upcoming' }], today);

    const summary = await run();

    expect(summary.emails_sent).toBe(1);
    expect(sender.sent[0].subject).toContain('depășită');
  });

  it('running twice on the same day sends nothing the second time', async () => {
    const { repo, sender, run } = build();
    repo.addUser({ userId: 'u1' });
    repo.addRequest({ user_id: 'u1', deadline_date: daysFrom(now, 0) });
    await run();
    const second = await run();
    expect(sender.sent).toHaveLength(1);
    expect(second).toMatchObject({ emails_sent: 0, skipped: 1 });
  });

  it('an error for one user is logged and counted; the other users are still served', async () => {
    const { repo, sender, run } = build();
    repo.addUser({ userId: 'bad' });
    repo.addUser({ userId: 'good' });
    repo.failFor = 'bad';
    repo.addRequest({ user_id: 'good', deadline_date: daysFrom(now, 1) });

    const summary = await run();

    expect(summary).toMatchObject({ users: 2, emails_sent: 1, errors: 1 });
    expect(sender.sent[0].to).toEqual(['good@example.ro']);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('bad'));
  });

  it('a Resend error counts as an error and does not mark the notices as sent', async () => {
    const { repo, sender, run } = build();
    repo.addUser({ userId: 'u1', email: 'x@x.ro' });
    repo.addRequest({ user_id: 'u1', deadline_date: daysFrom(now, 1) });
    sender.failTo.add('x@x.ro');

    const summary = await run();

    expect(summary).toMatchObject({ emails_sent: 0, errors: 1, notices: 0 });
    expect(repo.markSentCalls).toHaveLength(0);
  });

  it('no opted-in users → empty summary', async () => {
    const { run } = build();
    expect(await run()).toEqual({ users: 0, emails_sent: 0, notices: 0, skipped: 0, errors: 0 });
  });
});

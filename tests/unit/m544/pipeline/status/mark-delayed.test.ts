/**
 * pipeline/status/mark-delayed — nightly overdue check via a DB-filtered query.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { markDelayedRequests } from '@m544/pipeline/status/mark-delayed';
import { FakeRequestsRepo } from '../../_fakes/fake-repos';

const NOW = new Date('2025-03-20T00:00:00.000Z');
const PAST = '2025-03-10T00:00:00.000Z';
const FUTURE = '2025-04-01T00:00:00.000Z';
const USER = 'user-1';

let requests: FakeRequestsRepo;
beforeEach(() => {
  requests = new FakeRequestsRepo();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('markDelayedRequests', () => {
  it('marks only open requests whose effective deadline is before now', async () => {
    const overdue = requests.seed({ user_id: USER, status: 'received', deadline_date: PAST });
    const overdueExt = requests.seed({ user_id: USER, status: 'extension', deadline_date: PAST, extension_date: PAST });
    const extendedIntoFuture = requests.seed({
      user_id: USER,
      status: 'extension',
      deadline_date: PAST,
      extension_date: FUTURE,
    });
    const future = requests.seed({ user_id: USER, status: 'received', deadline_date: FUTURE });
    const noDeadline = requests.seed({ user_id: USER, status: 'pending' });
    const answered = requests.seed({ user_id: USER, status: 'answered', deadline_date: PAST });
    const alreadyDelayed = requests.seed({ user_id: USER, status: 'delayed', deadline_date: PAST });

    const count = await markDelayedRequests({ requests, now: () => NOW });

    expect(count).toBe(2);
    expect((await requests.getById(overdue.id))?.status).toBe('delayed');
    expect((await requests.getById(overdueExt.id))?.status).toBe('delayed');
    expect((await requests.getById(extendedIntoFuture.id))?.status).toBe('extension');
    expect((await requests.getById(future.id))?.status).toBe('received');
    expect((await requests.getById(noDeadline.id))?.status).toBe('pending');
    expect((await requests.getById(answered.id))?.status).toBe('answered');
    expect((await requests.getById(alreadyDelayed.id))?.status).toBe('delayed');
  });

  it('returns 0 when nothing is overdue', async () => {
    requests.seed({ user_id: USER, status: 'received', deadline_date: FUTURE });
    expect(await markDelayedRequests({ requests, now: () => NOW })).toBe(0);
  });

  it('passes the fixed clock to the repository query', async () => {
    const spy = vi.spyOn(requests, 'listOverdueIds');
    await markDelayedRequests({ requests, now: () => NOW });
    expect(spy).toHaveBeenCalledWith(NOW.toISOString());
  });

  it('is idempotent: a second run marks nothing new', async () => {
    requests.seed({ user_id: USER, status: 'received', deadline_date: PAST });
    expect(await markDelayedRequests({ requests, now: () => NOW })).toBe(1);
    expect(await markDelayedRequests({ requests, now: () => NOW })).toBe(0);
  });

  it('counts only successful updates and continues after a failure', async () => {
    const a = requests.seed({ user_id: USER, status: 'received', deadline_date: PAST });
    const b = requests.seed({ user_id: USER, status: 'received', deadline_date: PAST });
    const original = requests.update.bind(requests);
    vi.spyOn(requests, 'update').mockImplementation(async (id, patch) => {
      if (id === a.id) throw new Error('db down');
      return original(id, patch);
    });
    expect(await markDelayedRequests({ requests, now: () => NOW })).toBe(1);
    expect((await requests.getById(b.id))?.status).toBe('delayed');
    expect(console.error).toHaveBeenCalled();
  });
});

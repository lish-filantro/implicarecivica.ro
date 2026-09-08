/**
 * admin/stats — pure aggregations + loadAdminStats over an injected repo.
 * Behaviour mirrors the former app/api/admin/stats/route.ts exactly
 * (UTC day buckets, 30-day window, "unknown"/"Necunoscută" fallbacks, top 15).
 */
import { describe, it, expect } from 'vitest';
import {
  aggregateDailySignups,
  distribution,
  topInstitutions,
  countDistinct,
  loadAdminStats,
  type AdminStatsRepo,
} from '@m544/admin/stats';

const NOW = new Date('2026-09-08T12:00:00.000Z');
const DAY = 86400000;

describe('aggregateDailySignups', () => {
  it('returns exactly 30 UTC days ending today, oldest first, zero-filled', () => {
    const out = aggregateDailySignups([], NOW);
    expect(out).toHaveLength(30);
    expect(out[0]).toEqual({ day: '2026-08-10', count: 0 });
    expect(out[29]).toEqual({ day: '2026-09-08', count: 0 });
    expect(out.every((d) => d.count === 0)).toBe(true);
  });

  it('counts rows per UTC day', () => {
    const rows = [
      { created_at: '2026-09-08T00:30:00.000Z' },
      { created_at: '2026-09-08T23:59:59.000Z' },
      { created_at: '2026-09-07T23:59:59.000Z' },
      { created_at: '2026-09-07T22:00:00-03:00' }, // = 2026-09-08T01:00Z
    ];
    const out = aggregateDailySignups(rows, NOW);
    expect(out.find((d) => d.day === '2026-09-08')?.count).toBe(3);
    expect(out.find((d) => d.day === '2026-09-07')?.count).toBe(1);
  });

  it('ignores rows outside the 30-day window', () => {
    const out = aggregateDailySignups([{ created_at: new Date(NOW.getTime() - 40 * DAY).toISOString() }], NOW);
    expect(out.reduce((s, d) => s + d.count, 0)).toBe(0);
  });
});

describe('distribution', () => {
  it('counts by key and maps null/empty to "unknown"', () => {
    const rows = [{ status: 'sent' }, { status: 'answered' }, { status: 'sent' }, { status: null }, { status: '' }];
    expect(distribution(rows, 'status')).toEqual({ sent: 2, answered: 1, unknown: 2 });
  });

  it('returns an empty object for no rows', () => {
    expect(distribution([], 'status')).toEqual({});
  });
});

describe('topInstitutions', () => {
  const rows = [
    { institution_name: 'Primăria A', status: 'answered' },
    { institution_name: 'Primăria A', status: 'sent' },
    { institution_name: 'Primăria B', status: 'answered' },
    { institution_name: null, status: 'sent' },
    { institution_name: 'Primăria C', status: 'sent' },
    { institution_name: 'Primăria C', status: 'sent' },
    { institution_name: 'Primăria C', status: 'answered' },
  ];

  it('aggregates total + answered per institution, sorted by total desc', () => {
    expect(topInstitutions(rows, 15)).toEqual([
      { name: 'Primăria C', total: 3, answered: 1 },
      { name: 'Primăria A', total: 2, answered: 1 },
      { name: 'Primăria B', total: 1, answered: 1 },
      { name: 'Necunoscută', total: 1, answered: 0 },
    ]);
  });

  it('limits to n', () => {
    expect(topInstitutions(rows, 2).map((i) => i.name)).toEqual(['Primăria C', 'Primăria A']);
  });

  it('defaults n to 15', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ institution_name: `I${i}`, status: 'sent' }));
    expect(topInstitutions(many)).toHaveLength(15);
  });
});

describe('countDistinct', () => {
  it('counts distinct non-empty values', () => {
    const rows = [{ user_id: 'a' }, { user_id: 'b' }, { user_id: 'a' }, { user_id: null }, { user_id: '' }];
    expect(countDistinct(rows, 'user_id')).toBe(2);
  });
});

class FakeStatsRepo implements AdminStatsRepo {
  calls: string[] = [];
  async countProfiles(since?: string) {
    this.calls.push(`countProfiles:${since ?? 'all'}`);
    return since ? (since > '2026-08-31' ? 3 : 7) : 42;
  }
  async countPendingProfiles() {
    return 4;
  }
  async profileSignupsSince(since: string) {
    this.calls.push(`signups:${since}`);
    return [{ created_at: '2026-09-08T01:00:00.000Z' }, { created_at: '2026-09-08T02:00:00.000Z' }];
  }
  async countSince(table: 'requests' | 'request_sessions' | 'messages' | 'feedback', since: string) {
    this.calls.push(`${table}:${since}`);
    return { requests: 10, request_sessions: 5, messages: 100, feedback: 2 }[table];
  }
  async countActiveCampaigns() {
    return 1;
  }
  async requestStatuses() {
    return [{ status: 'sent' }, { status: 'answered' }, { status: null }];
  }
  async feedbackStatuses() {
    return [{ status: 'new' }];
  }
  async requestInstitutions() {
    return [{ institution_name: 'X', status: 'answered' }];
  }
  async activeUserIdsSince(since: string) {
    this.calls.push(`active:${since}`);
    return [{ user_id: 'u1' }, { user_id: 'u1' }, { user_id: 'u2' }];
  }
  async countReceivedEmails(status: 'pending' | 'failed') {
    this.calls.push(`emails:${status}`);
    return { pending: 6, failed: 2 }[status];
  }
  async countEmailsNeedingReview() {
    return 3;
  }
  async lastInboundAt() {
    return '2026-09-08T11:30:00.000Z';
  }
}

describe('loadAdminStats', () => {
  it('returns the dashboard JSON shape built from the repo', async () => {
    const repo = new FakeStatsRepo();
    const out = await loadAdminStats({ repo, now: () => NOW });
    expect(out).toEqual({
      users: { total: 42, new_7d: 3, new_30d: 7, active_30d: 2, pending_approval: 4 },
      dailySignups: expect.any(Array),
      activity: { requests_30d: 10, sessions_30d: 5, messages_30d: 100, feedback_30d: 2, campaigns_active: 1 },
      requestStatus: { sent: 1, answered: 1, unknown: 1 },
      feedbackStatus: { new: 1 },
      topInstitutions: [{ name: 'X', total: 1, answered: 1 }],
      emails: { pending: 6, failed: 2, needs_review: 3, last_inbound_at: '2026-09-08T11:30:00.000Z' },
    });
    expect(repo.calls).toEqual(expect.arrayContaining(['emails:pending', 'emails:failed']));
    expect(out.dailySignups).toHaveLength(30);
    expect(out.dailySignups[29]).toEqual({ day: '2026-09-08', count: 2 });
  });

  it('uses 7-day and 30-day windows relative to now', async () => {
    const repo = new FakeStatsRepo();
    await loadAdminStats({ repo, now: () => NOW });
    const since7 = new Date(NOW.getTime() - 7 * DAY).toISOString();
    const since30 = new Date(NOW.getTime() - 30 * DAY).toISOString();
    expect(repo.calls).toContain(`countProfiles:${since7}`);
    expect(repo.calls).toContain(`countProfiles:${since30}`);
    expect(repo.calls).toContain(`signups:${since30}`);
    expect(repo.calls).toContain(`requests:${since30}`);
    expect(repo.calls).toContain(`active:${since30}`);
  });
});

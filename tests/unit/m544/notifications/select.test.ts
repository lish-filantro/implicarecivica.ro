/** Unit tests for src/manager-544/notifications/select.ts (pure selection rules). */
import { describe, it, expect } from 'vitest';
import { selectNotifications } from '@m544/notifications/select';
import { req, daysFrom } from './_fakes';

const now = new Date(2026, 8, 8, 10, 30); // 8 Sep 2026, 10:30 local
const profile = { notification_deadline_days: 3 };
const u = 'u1';

describe('selectNotifications', () => {
  it('deadline today → upcoming with 0 days left', () => {
    const out = selectNotifications([req({ user_id: u, deadline_date: daysFrom(now, 0) })], profile, now);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: 'upcoming', daysLeft: 0 });
  });

  it('deadline in exactly N days → upcoming; N+1 days → nothing', () => {
    const inN = req({ user_id: u, deadline_date: daysFrom(now, 3) });
    const inN1 = req({ user_id: u, deadline_date: daysFrom(now, 4) });
    const out = selectNotifications([inN, inN1], profile, now);
    expect(out.map((n) => n.request.id)).toEqual([inN.id]);
    expect(out[0].daysLeft).toBe(3);
  });

  it('deadline yesterday → overdue with negative daysLeft', () => {
    const out = selectNotifications([req({ user_id: u, deadline_date: daysFrom(now, -1) })], profile, now);
    expect(out[0]).toMatchObject({ kind: 'overdue', daysLeft: -1 });
  });

  it('status delayed → overdue even when the stored deadline is not past', () => {
    const out = selectNotifications(
      [req({ user_id: u, status: 'delayed', deadline_date: daysFrom(now, 10) })],
      profile,
      now,
    );
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('overdue');
  });

  it('ignores answered requests and requests without any deadline', () => {
    const out = selectNotifications(
      [
        req({ user_id: u, status: 'answered', deadline_date: daysFrom(now, -5) }),
        req({ user_id: u, status: 'pending' }),
      ],
      profile,
      now,
    );
    expect(out).toEqual([]);
  });

  it('uses extension_date over deadline_date as the effective deadline', () => {
    const r = req({
      user_id: u,
      status: 'extension',
      deadline_date: daysFrom(now, -2),
      extension_date: daysFrom(now, 2),
    });
    const out = selectNotifications([r], profile, now);
    expect(out[0]).toMatchObject({ kind: 'upcoming', daysLeft: 2 });
  });

  it('respects a per-user window (notification_deadline_days = 7)', () => {
    const out = selectNotifications(
      [req({ user_id: u, deadline_date: daysFrom(now, 6) })],
      { notification_deadline_days: 7 },
      now,
    );
    expect(out).toHaveLength(1);
  });

  it('sorts overdue first, then by daysLeft ascending', () => {
    const a = req({ user_id: u, id: 'a', deadline_date: daysFrom(now, 2) });
    const b = req({ user_id: u, id: 'b', deadline_date: daysFrom(now, -3) });
    const c = req({ user_id: u, id: 'c', deadline_date: daysFrom(now, 0) });
    const d = req({ user_id: u, id: 'd', deadline_date: daysFrom(now, -1) });
    const out = selectNotifications([a, b, c, d], profile, now);
    expect(out.map((n) => n.request.id)).toEqual(['b', 'd', 'c', 'a']);
  });
});

/**
 * Admin dashboard statistics: pure aggregations over row shapes plus
 * `loadAdminStats`, which runs the queries through an injected repository and
 * returns the JSON shape consumed by app/admin/dashboard. Aggregate only —
 * no personal data leaves this module.
 */

const DAY_MS = 86400000;
const SIGNUP_WINDOW_DAYS = 30;
const TOP_INSTITUTIONS = 15;

export interface CreatedAtRow {
  created_at: string;
}
export interface StatusRow {
  status: string | null;
}
export interface InstitutionRow {
  institution_name: string | null;
  status: string | null;
}
export interface UserIdRow {
  user_id: string | null;
}

export type CountedTable = 'requests' | 'request_sessions' | 'messages' | 'feedback';
export type EmailProcessingStatus = 'pending' | 'failed';

/** The read queries of the dashboard, expressed as intent rather than SQL. */
export interface AdminStatsRepo {
  /** Profiles created at/after `since` (ISO); all profiles when omitted. */
  countProfiles(since?: string): Promise<number>;
  countPendingProfiles(): Promise<number>;
  profileSignupsSince(since: string): Promise<CreatedAtRow[]>;
  countSince(table: CountedTable, since: string): Promise<number>;
  countActiveCampaigns(): Promise<number>;
  requestStatuses(): Promise<StatusRow[]>;
  feedbackStatuses(): Promise<StatusRow[]>;
  requestInstitutions(): Promise<InstitutionRow[]>;
  activeUserIdsSince(since: string): Promise<UserIdRow[]>;
  /** Received emails in the given processing state. */
  countReceivedEmails(status: EmailProcessingStatus): Promise<number>;
  countEmailsNeedingReview(): Promise<number>;
  /** `received_at` of the most recent received email, or null when none. */
  lastInboundAt(): Promise<string | null>;
}

export interface DailySignup {
  day: string;
  count: number;
}
export interface InstitutionStat {
  name: string;
  total: number;
  answered: number;
}

export interface AdminStats {
  users: { total: number; new_7d: number; new_30d: number; active_30d: number; pending_approval: number };
  dailySignups: DailySignup[];
  activity: {
    requests_30d: number;
    sessions_30d: number;
    messages_30d: number;
    feedback_30d: number;
    campaigns_active: number;
  };
  requestStatus: Record<string, number>;
  feedbackStatus: Record<string, number>;
  topInstitutions: InstitutionStat[];
  emails: { pending: number; failed: number; needs_review: number; last_inbound_at: string | null };
}

const utcDay = (d: Date) => d.toISOString().split('T')[0];

/** Signups per UTC day for the last 30 days (oldest first), zero-filled. */
export function aggregateDailySignups(rows: CreatedAtRow[], now: Date): DailySignup[] {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const day = utcDay(new Date(row.created_at));
    counts[day] = (counts[day] ?? 0) + 1;
  }
  const out: DailySignup[] = [];
  for (let i = SIGNUP_WINDOW_DAYS - 1; i >= 0; i--) {
    const key = utcDay(new Date(now.getTime() - i * DAY_MS));
    out.push({ day: key, count: counts[key] ?? 0 });
  }
  return out;
}

/** Count rows per value of `key`; null/empty values are bucketed as "unknown". */
export function distribution<K extends string>(rows: Record<K, string | null>[], key: K): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const value = row[key] || 'unknown';
    out[value] = (out[value] ?? 0) + 1;
  }
  return out;
}

/** Institutions by request volume with the number of answered requests. */
export function topInstitutions(rows: InstitutionRow[], n = TOP_INSTITUTIONS): InstitutionStat[] {
  const map = new Map<string, InstitutionStat>();
  for (const row of rows) {
    const name = row.institution_name || 'Necunoscută';
    const entry = map.get(name) ?? { name, total: 0, answered: 0 };
    entry.total += 1;
    if (row.status === 'answered') entry.answered += 1;
    map.set(name, entry);
  }
  return [...map.values()].sort((a, b) => b.total - a.total).slice(0, n);
}

/** Number of distinct non-empty values of `key`. */
export function countDistinct<K extends string>(rows: Record<K, string | null>[], key: K): number {
  const seen = new Set<string>();
  for (const row of rows) {
    const value = row[key];
    if (value) seen.add(value);
  }
  return seen.size;
}

export interface AdminStatsDeps {
  repo: AdminStatsRepo;
  now?: () => Date;
}

export async function loadAdminStats({ repo, now = () => new Date() }: AdminStatsDeps): Promise<AdminStats> {
  const current = now();
  const since7d = new Date(current.getTime() - 7 * DAY_MS).toISOString();
  const since30d = new Date(current.getTime() - 30 * DAY_MS).toISOString();

  const [
    total,
    new7d,
    new30d,
    signups,
    requests30d,
    sessions30d,
    messages30d,
    feedback30d,
    campaignsActive,
    requestStatuses,
    feedbackStatuses,
    institutions,
    activeUsers,
    pendingApproval,
    emailsPending,
    emailsFailed,
    emailsNeedsReview,
    lastInboundAt,
  ] = await Promise.all([
    repo.countProfiles(),
    repo.countProfiles(since7d),
    repo.countProfiles(since30d),
    repo.profileSignupsSince(since30d),
    repo.countSince('requests', since30d),
    repo.countSince('request_sessions', since30d),
    repo.countSince('messages', since30d),
    repo.countSince('feedback', since30d),
    repo.countActiveCampaigns(),
    repo.requestStatuses(),
    repo.feedbackStatuses(),
    repo.requestInstitutions(),
    repo.activeUserIdsSince(since30d),
    repo.countPendingProfiles(),
    repo.countReceivedEmails('pending'),
    repo.countReceivedEmails('failed'),
    repo.countEmailsNeedingReview(),
    repo.lastInboundAt(),
  ]);

  return {
    users: {
      total,
      new_7d: new7d,
      new_30d: new30d,
      active_30d: countDistinct(activeUsers, 'user_id'),
      pending_approval: pendingApproval,
    },
    dailySignups: aggregateDailySignups(signups, current),
    activity: {
      requests_30d: requests30d,
      sessions_30d: sessions30d,
      messages_30d: messages30d,
      feedback_30d: feedback30d,
      campaigns_active: campaignsActive,
    },
    requestStatus: distribution(requestStatuses, 'status'),
    feedbackStatus: distribution(feedbackStatuses, 'status'),
    topInstitutions: topInstitutions(institutions),
    emails: {
      pending: emailsPending,
      failed: emailsFailed,
      needs_review: emailsNeedsReview,
      last_inbound_at: lastInboundAt,
    },
  };
}

/**
 * Daily digest: for every opted-in user, select the requests worth a notice,
 * drop the (request, kind) pairs already sent today, add the emails the pipeline
 * could not attribute, send ONE email and record what was sent. A failure for
 * one user is logged and counted; the loop goes on with the next user.
 *
 * The two parts are independent — either one on its own is worth an email.
 */
import type { EmailSender, OutgoingEmail } from '@m544/emails/send';
import { selectNotifications } from './select';
import { buildDigestEmail } from './template';
import type { NotificationsRepo, OptedInUser, ReviewNotice, SentEntry } from './repo';

export interface DigestDeps {
  repo: NotificationsRepo;
  sender: EmailSender;
  now?: () => Date;
  appUrl: string;
  /** e.g. "Implicare Civică <notificari@implicarecivica.ro>" */
  fromAddress: string;
}

export interface DigestSummary {
  users: number;
  emails_sent: number;
  /** Deadline notices included in the emails that were sent. */
  notices: number;
  /** Unattributed emails mentioned in the emails that were sent. */
  reviews: number;
  /** Users with nothing new to notify today. */
  skipped: number;
  errors: number;
}

/**
 * How far back the digest looks for emails flagged for review. Matches the daily
 * cadence of the cron: each flagged email is mentioned once, the day it arrived,
 * and never nagged about again — the "De revizuit" folder is the durable surface.
 * A missed cron run therefore loses these notices; the flag itself is not lost.
 */
export const REVIEW_WINDOW_HOURS = 24;

/** Local calendar day as YYYY-MM-DD (same clock as the deadline arithmetic). */
export function toDateIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Deadline notices not yet sent to this user today. */
async function freshNotices(user: OptedInUser, deps: DigestDeps, now: Date, dateIso: string) {
  const requests = await deps.repo.listOpenRequests(user.userId);
  const all = selectNotifications(requests, { notification_deadline_days: user.deadlineDays }, now);
  if (all.length === 0) return [];
  const sent = await deps.repo.listSentToday(user.userId, dateIso);
  return all.filter((n) => !sent.some((s) => s.requestId === n.request.id && s.kind === n.kind));
}

/**
 * Best-effort: a deadline digest is worth sending even if the emails cannot be
 * listed, so a failure here is logged and treated as "nothing to attribute".
 */
async function reviewNotices(user: OptedInUser, deps: DigestDeps, now: Date): Promise<ReviewNotice[]> {
  const since = new Date(now.getTime() - REVIEW_WINDOW_HOURS * 3600_000).toISOString();
  try {
    return await deps.repo.listEmailsNeedingReview(user.userId, since);
  } catch (err) {
    console.error(
      `[notify-deadlines] user ${user.userId}: listing emails to attribute failed:`,
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

/** What went into the user's digest; both counts zero means nothing was sent. */
async function digestForUser(
  user: OptedInUser,
  deps: DigestDeps,
  now: Date,
  dateIso: string,
): Promise<{ notices: number; reviews: number }> {
  const nothing = { notices: 0, reviews: 0 };
  const fresh = await freshNotices(user, deps, now, dateIso);
  const reviews = await reviewNotices(user, deps, now);
  if (fresh.length === 0 && reviews.length === 0) return nothing;

  const email = buildDigestEmail(fresh, { appUrl: deps.appUrl, displayName: user.displayName }, reviews);
  const payload: OutgoingEmail = {
    from: deps.fromAddress,
    to: [user.email],
    subject: email.subject,
    html: email.html,
    text: email.text,
    headers: { 'X-Digest-Date': dateIso },
  };
  const result = await deps.sender.send(payload);
  if (result.error) throw new Error(`Resend: ${result.error.message}`);

  // Only deadline notices are logged: the unattributed emails are deduplicated
  // by their arrival window, so there is nothing to record for them.
  if (fresh.length) {
    const entries: SentEntry[] = fresh.map((n) => ({ requestId: n.request.id, kind: n.kind }));
    await deps.repo.markSent(user.userId, entries, dateIso);
  }
  return { notices: fresh.length, reviews: reviews.length };
}

export async function sendDeadlineDigests(deps: DigestDeps): Promise<DigestSummary> {
  const now = (deps.now ?? (() => new Date()))();
  const dateIso = toDateIso(now);
  const summary: DigestSummary = { users: 0, emails_sent: 0, notices: 0, reviews: 0, skipped: 0, errors: 0 };

  const users = await deps.repo.listOptedInUsers();
  summary.users = users.length;

  for (const user of users) {
    try {
      const { notices, reviews } = await digestForUser(user, deps, now, dateIso);
      if (notices === 0 && reviews === 0) summary.skipped += 1;
      else {
        summary.emails_sent += 1;
        summary.notices += notices;
        summary.reviews += reviews;
      }
    } catch (err) {
      summary.errors += 1;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[notify-deadlines] user ${user.userId}: ${message}`);
    }
  }
  return summary;
}

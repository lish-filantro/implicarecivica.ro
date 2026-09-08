/**
 * Daily deadline digest: for every opted-in user, select the requests worth a
 * notice, drop the (request, kind) pairs already sent today, send ONE email
 * and record what was sent. A failure for one user is logged and counted; the
 * loop goes on with the next user.
 */
import type { EmailSender, OutgoingEmail } from '@m544/emails/send';
import { selectNotifications } from './select';
import { buildDigestEmail } from './template';
import type { NotificationsRepo, OptedInUser, SentEntry } from './repo';

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
  /** Notices included in the emails that were sent. */
  notices: number;
  /** Users with nothing new to notify today. */
  skipped: number;
  errors: number;
}

/** Local calendar day as YYYY-MM-DD (same clock as the deadline arithmetic). */
export function toDateIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Number of notices sent, or 0 when the user had nothing new. */
async function digestForUser(user: OptedInUser, deps: DigestDeps, now: Date, dateIso: string): Promise<number> {
  const requests = await deps.repo.listOpenRequests(user.userId);
  const all = selectNotifications(requests, { notification_deadline_days: user.deadlineDays }, now);
  if (all.length === 0) return 0;

  const sent = await deps.repo.listSentToday(user.userId, dateIso);
  const fresh = all.filter((n) => !sent.some((s) => s.requestId === n.request.id && s.kind === n.kind));
  if (fresh.length === 0) return 0;

  const email = buildDigestEmail(fresh, { appUrl: deps.appUrl, displayName: user.displayName });
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

  const entries: SentEntry[] = fresh.map((n) => ({ requestId: n.request.id, kind: n.kind }));
  await deps.repo.markSent(user.userId, entries, dateIso);
  return fresh.length;
}

export async function sendDeadlineDigests(deps: DigestDeps): Promise<DigestSummary> {
  const now = (deps.now ?? (() => new Date()))();
  const dateIso = toDateIso(now);
  const summary: DigestSummary = { users: 0, emails_sent: 0, notices: 0, skipped: 0, errors: 0 };

  const users = await deps.repo.listOptedInUsers();
  summary.users = users.length;

  for (const user of users) {
    try {
      const count = await digestForUser(user, deps, now, dateIso);
      if (count === 0) summary.skipped += 1;
      else {
        summary.emails_sent += 1;
        summary.notices += count;
      }
    } catch (err) {
      summary.errors += 1;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[notify-deadlines] user ${user.userId}: ${message}`);
    }
  }
  return summary;
}

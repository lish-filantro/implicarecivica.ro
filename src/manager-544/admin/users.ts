/**
 * Manual account approval: list users waiting for approval, approve one,
 * or reject one (deletes the auth user; the profile row cascades).
 *
 * Approving also sends the confirmation email — before it existed the account was
 * unlocked in silence and the user stayed on /pending-approval with no way to know.
 */
import type { EmailSender, OutgoingEmail } from '@m544/emails/send';
import { buildApprovalEmail } from './approval-email';

export interface PendingProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  created_at: string;
}

export interface PendingUser extends PendingProfile {
  email: string | null;
}

/** Profiles table + auth.admin, as needed by the approval flow. */
export interface AdminUsersRepo {
  /** Unapproved profiles, newest first. */
  listUnapprovedProfiles(): Promise<PendingProfile[]>;
  /**
   * One profile, approved or not. The approval email needs the name AFTER
   * `setApproved`, when `listUnapprovedProfiles()` no longer returns the row.
   */
  getProfile(id: string): Promise<PendingProfile | null>;
  /** Email from auth.users, or null when the auth user no longer exists. */
  getAuthEmail(id: string): Promise<string | null>;
  setApproved(id: string, approved: boolean): Promise<void>;
  deleteAuthUser(id: string): Promise<void>;
}

export async function listPendingUsers(repo: AdminUsersRepo): Promise<PendingUser[]> {
  const profiles = await repo.listUnapprovedProfiles();
  if (profiles.length === 0) return [];
  return Promise.all(
    profiles.map(async (p) => ({
      id: p.id,
      email: await repo.getAuthEmail(p.id),
      first_name: p.first_name,
      last_name: p.last_name,
      display_name: p.display_name,
      created_at: p.created_at,
    })),
  );
}

/** Same shape as the digest deps: the Resend `emails` object plus the two strings around it. */
export interface ApprovalMailer {
  sender: EmailSender;
  /** e.g. "Implicare Civică <notificari@implicarecivica.ro>" */
  fromAddress: string;
  /** Base URL of the app; the email links to `${appUrl}/login`. */
  appUrl: string;
}

/** Best-effort confirmation; every failure path is swallowed by the caller below. */
async function sendApprovalEmail(repo: AdminUsersRepo, userId: string, mailer: ApprovalMailer): Promise<void> {
  const to = await repo.getAuthEmail(userId);
  if (!to) return;
  const profile = await repo.getProfile(userId);
  const displayName = profile?.first_name?.trim() || profile?.display_name?.trim().split(/\s+/)[0] || '';
  const email = buildApprovalEmail({ displayName, appUrl: mailer.appUrl });

  const payload: OutgoingEmail = {
    from: mailer.fromAddress,
    to: [to],
    subject: email.subject,
    html: email.html,
    text: email.text,
    headers: { 'X-Entity-Ref-ID': `approval-${userId}` },
  };
  const result = await mailer.sender.send(payload);
  if (result.error) throw new Error(`Resend: ${result.error.message}`);
}

/**
 * Approving never fails because of the email: the account is already approved at that point,
 * and an admin who sees an error would retry and send a second confirmation.
 */
export async function approveUser(
  repo: AdminUsersRepo,
  userId: string,
  mailer?: ApprovalMailer,
): Promise<void> {
  await repo.setApproved(userId, true);
  if (!mailer) return;
  try {
    await sendApprovalEmail(repo, userId, mailer);
  } catch (err) {
    console.error(
      `[Admin] Aprobare ${userId}: emailul de confirmare nu a plecat:`,
      err instanceof Error ? err.message : err,
    );
  }
}

export function rejectUser(repo: AdminUsersRepo, userId: string): Promise<void> {
  return repo.deleteAuthUser(userId);
}

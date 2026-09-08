import type { Email } from '@m544/shared/types/email';

export type EmailFolder = 'inbox' | 'sent' | 'all' | 'review';

export const FOLDER_LABELS: Record<EmailFolder, string> = {
  inbox: 'Primite',
  sent: 'Trimise',
  all: 'Toate',
  review: 'De revizuit',
};

/** Order of the folders in the sidebar and the mobile bar. */
export const FOLDER_ORDER: EmailFolder[] = ['inbox', 'review', 'sent', 'all'];

/** Received email the matcher could not attribute with confidence (or a suspicious transition). */
export function needsReview(email: Email): boolean {
  return email.type === 'received' && email.needs_review === true;
}

/** Folder + free-text filter for the email list. */
export function filterEmails(emails: Email[], folder: EmailFolder, search: string): Email[] {
  let result = emails;

  if (folder === 'inbox') {
    result = result.filter((e) => e.type === 'received');
  } else if (folder === 'sent') {
    result = result.filter((e) => e.type === 'sent');
  } else if (folder === 'review') {
    result = result.filter(needsReview);
  }

  if (search.trim()) {
    const q = search.toLowerCase();
    result = result.filter(
      (e) =>
        e.subject.toLowerCase().includes(q) ||
        e.from_email.toLowerCase().includes(q) ||
        e.to_email.toLowerCase().includes(q),
    );
  }

  return result;
}

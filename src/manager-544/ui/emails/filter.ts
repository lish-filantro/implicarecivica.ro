import type { Email } from '@m544/shared/types/email';

export type EmailFolder = 'inbox' | 'sent' | 'all';

/** Folder + free-text filter for the email list (moved 1:1 from the emails page). */
export function filterEmails(emails: Email[], folder: EmailFolder, search: string): Email[] {
  let result = emails;

  if (folder === 'inbox') {
    result = result.filter((e) => e.type === 'received');
  } else if (folder === 'sent') {
    result = result.filter((e) => e.type === 'sent');
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

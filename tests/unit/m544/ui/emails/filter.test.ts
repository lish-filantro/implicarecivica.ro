import { describe, it, expect } from 'vitest';
import { filterEmails, needsReview, FOLDER_LABELS, FOLDER_ORDER } from '@m544/ui/emails/filter';
import { makeEmail } from './_fixtures';

const received = makeEmail({ id: 'r1', type: 'received', subject: 'Raspuns final', from_email: 'a@primarie.ro' });
const flagged = makeEmail({ id: 'r2', type: 'received', subject: 'Neclar', needs_review: true });
const sent = makeEmail({
  id: 's1',
  type: 'sent',
  subject: 'Solicitare',
  from_email: 'ion@544.ro',
  to_email: 'b@consiliu.ro',
});
const all = [received, flagged, sent];

describe('filterEmails', () => {
  it('inbox keeps only received emails', () => {
    expect(filterEmails(all, 'inbox', '').map((e) => e.id)).toEqual(['r1', 'r2']);
  });

  it('sent keeps only sent emails', () => {
    expect(filterEmails(all, 'sent', '').map((e) => e.id)).toEqual(['s1']);
  });

  it('review keeps only received emails flagged needs_review', () => {
    expect(filterEmails(all, 'review', '').map((e) => e.id)).toEqual(['r2']);
    // a sent email can never be "to review", whatever the flag says
    expect(filterEmails([makeEmail({ type: 'sent', needs_review: true })], 'review', '')).toEqual([]);
    expect(needsReview(flagged)).toBe(true);
    expect(needsReview(received)).toBe(false);
  });

  it('all keeps everything when search is blank', () => {
    expect(filterEmails(all, 'all', '   ')).toEqual(all);
  });

  it('search matches subject, from and to case-insensitively', () => {
    expect(filterEmails(all, 'all', 'FINAL').map((e) => e.id)).toEqual(['r1']);
    expect(filterEmails(all, 'all', 'consiliu').map((e) => e.id)).toEqual(['s1']);
    expect(filterEmails(all, 'all', 'primarie').map((e) => e.id)).toEqual(['r1', 'r2']);
    expect(filterEmails(all, 'all', 'nimic')).toEqual([]);
  });

  it('search is applied after the folder filter', () => {
    expect(filterEmails(all, 'inbox', 'consiliu')).toEqual([]);
    expect(filterEmails(all, 'review', 'final')).toEqual([]);
  });

  it('exposes labels and order for every folder', () => {
    expect(FOLDER_ORDER).toEqual(['inbox', 'review', 'sent', 'all']);
    expect(FOLDER_LABELS.review).toBe('De revizuit');
    for (const f of FOLDER_ORDER) expect(FOLDER_LABELS[f]).toBeTruthy();
  });
});

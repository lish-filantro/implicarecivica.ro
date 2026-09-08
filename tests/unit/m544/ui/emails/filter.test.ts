import { describe, it, expect } from 'vitest';
import { filterEmails } from '@m544/ui/emails/filter';
import { makeEmail } from './_fixtures';

const received = makeEmail({ id: 'r1', type: 'received', subject: 'Raspuns final', from_email: 'a@primarie.ro' });
const sent = makeEmail({
  id: 's1',
  type: 'sent',
  subject: 'Solicitare',
  from_email: 'ion@544.ro',
  to_email: 'b@consiliu.ro',
});
const all = [received, sent];

describe('filterEmails', () => {
  it('inbox keeps only received emails', () => {
    expect(filterEmails(all, 'inbox', '').map((e) => e.id)).toEqual(['r1']);
  });

  it('sent keeps only sent emails', () => {
    expect(filterEmails(all, 'sent', '').map((e) => e.id)).toEqual(['s1']);
  });

  it('all keeps everything when search is blank', () => {
    expect(filterEmails(all, 'all', '   ')).toEqual(all);
  });

  it('search matches subject, from and to case-insensitively', () => {
    expect(filterEmails(all, 'all', 'FINAL').map((e) => e.id)).toEqual(['r1']);
    expect(filterEmails(all, 'all', 'consiliu').map((e) => e.id)).toEqual(['s1']);
    expect(filterEmails(all, 'all', 'primarie').map((e) => e.id)).toEqual(['r1']);
    expect(filterEmails(all, 'all', 'nimic')).toEqual([]);
  });

  it('search is applied after the folder filter', () => {
    expect(filterEmails(all, 'inbox', 'consiliu')).toEqual([]);
  });
});

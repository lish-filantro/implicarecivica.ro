/**
 * Pure helpers behind the "assign to a question" selects: grouping the user's
 * requests into sessions, labelling one question, and guessing which session the
 * sender most likely belongs to.
 */
import { describe, it, expect } from 'vitest';
import { groupBySession, questionLabel, guessSessionKey } from '@m544/ui/emails/review/assignable';
import type { AssignableRequest } from '@m544/requests/queries.client';
import { getStatusLabel } from '@m544/requests/utils/labels';

function row(over: Partial<AssignableRequest> = {}): AssignableRequest {
  return {
    id: 'r1',
    subject: 'Cheltuieli cultură',
    institution_name: 'Primăria Cluj',
    institution_email: 'registratura@primariaclujnapoca.ro',
    status: 'pending',
    registration_number: null,
    deadline_date: null,
    extension_date: null,
    session_id: 's1',
    session_label: 'Buget 2026',
    ...over,
  };
}

describe('groupBySession', () => {
  it('groups requests under their session, preserving the incoming order', () => {
    const groups = groupBySession([
      row({ id: 'r1', session_id: 's1', session_label: 'Buget' }),
      row({ id: 'r2', session_id: 's2', session_label: 'Achiziții' }),
      row({ id: 'r3', session_id: 's1', session_label: 'Buget' }),
    ]);
    expect(groups.map((g) => [g.key, g.label, g.requests.map((r) => r.id)])).toEqual([
      ['s1', 'Buget', ['r1', 'r3']],
      ['s2', 'Achiziții', ['r2']],
    ]);
  });

  it('gives a session-less request a group of its own', () => {
    const groups = groupBySession([row({ id: 'r9', session_id: null, session_label: 'Orfană' })]);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('request:r9');
    expect(groups[0].label).toBe('Orfană');
  });

  it('returns no groups for no requests', () => {
    expect(groupBySession([])).toEqual([]);
  });
});

describe('questionLabel', () => {
  it('leads with the registration number and shows the effective deadline', () => {
    const label = questionLabel(row({ registration_number: '4521', deadline_date: '2026-10-03', status: 'received' }));
    expect(label).toContain('nr. 4521');
    expect(label).toContain('3 oct.');
    expect(label).toContain(getStatusLabel('received'));
  });

  it('prefers the extension date over the plain deadline', () => {
    const label = questionLabel(
      row({ registration_number: '4521', deadline_date: '2026-10-03', extension_date: '2026-10-23', status: 'extension' }),
    );
    expect(label).toContain('termen 23 oct.');
    expect(label).not.toContain('termen 3 oct.');
  });

  it('says so when the question has no registration number yet', () => {
    expect(questionLabel(row())).toContain('fără număr');
  });

  it('never leaves the subject out, so two questions of a session stay distinguishable', () => {
    expect(questionLabel(row({ subject: 'Lista contractelor' }))).toContain('Lista contractelor');
  });
});

describe('guessSessionKey', () => {
  const groups = () =>
    groupBySession([
      row({ id: 'r1', session_id: 's1', session_label: 'Buget', institution_email: 'registratura@primariaclujnapoca.ro' }),
      row({ id: 'r2', session_id: 's2', session_label: 'Achiziții', institution_email: 'contact@cjcluj.ro' }),
    ]);

  it('picks the session whose institution address is the sender', () => {
    expect(guessSessionKey(groups(), 'Contact CJ <contact@cjcluj.ro>')).toBe('s2');
  });

  it('falls back to the domain when the answer comes from another mailbox of the institution', () => {
    expect(guessSessionKey(groups(), 'cabinet.primar@primariaclujnapoca.ro')).toBe('s1');
  });

  it('returns null when nothing matches, rather than guessing arbitrarily', () => {
    expect(guessSessionKey(groups(), 'newsletter@altceva.ro')).toBeNull();
    expect(guessSessionKey(groups(), '')).toBeNull();
  });
});

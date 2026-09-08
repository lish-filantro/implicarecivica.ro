/**
 * pipeline/matching/thread — strategy 1: parent_email_id → request_id chain.
 */
import { describe, it, expect } from 'vitest';
import { matchByThread } from '@m544/pipeline/matching';
import { FakeEmailsRepo } from '../../_fakes/fake-repos';

const USER = 'user-1';

describe('matchByThread', () => {
  it('returns a high-confidence thread match when the parent email is linked to a request', async () => {
    const emails = new FakeEmailsRepo();
    const parent = emails.seed({ user_id: USER, type: 'sent', request_id: 'req-A' });
    const result = await matchByThread({ parent_email_id: parent.id }, emails);
    expect(result).toEqual({ requestId: 'req-A', strategy: 'thread', confidence: 'high' });
  });

  it('returns null when the email has no parent', async () => {
    const emails = new FakeEmailsRepo();
    expect(await matchByThread({ parent_email_id: null }, emails)).toBeNull();
  });

  it('returns null when the parent email exists but is not linked to a request', async () => {
    const emails = new FakeEmailsRepo();
    const parent = emails.seed({ user_id: USER, type: 'sent' });
    expect(await matchByThread({ parent_email_id: parent.id }, emails)).toBeNull();
  });

  it('returns null when the parent email does not exist', async () => {
    const emails = new FakeEmailsRepo();
    expect(await matchByThread({ parent_email_id: 'missing' }, emails)).toBeNull();
  });
});

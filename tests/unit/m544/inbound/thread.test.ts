/**
 * inbound/webhook/thread — parent email detection via In-Reply-To / References.
 */
import { describe, it, expect } from 'vitest';
import { detectParentEmail, candidateMessageIds } from '@m544/inbound/webhook/thread';
import { FakeEmailsRepo } from '../_fakes/fake-repos';

describe('candidateMessageIds', () => {
  it('puts In-Reply-To first, then References in order, without brackets or duplicates', () => {
    expect(candidateMessageIds('<a@x>', '<b@x> <a@x>  <c@x>')).toEqual(['a@x', 'b@x', 'c@x']);
  });
  it('handles missing headers', () => {
    expect(candidateMessageIds(undefined, undefined)).toEqual([]);
    expect(candidateMessageIds('', '')).toEqual([]);
    expect(candidateMessageIds(undefined, '<only@x>')).toEqual(['only@x']);
  });
});

describe('detectParentEmail', () => {
  it('returns the id of our email whose message_id matches In-Reply-To', async () => {
    const emails = new FakeEmailsRepo();
    const sent = emails.seed({ user_id: 'u1', type: 'sent', message_id: 'orig@implicarecivica.ro' });
    expect(await detectParentEmail({ inReplyTo: '<orig@implicarecivica.ro>' }, emails)).toBe(sent.id);
  });

  it('falls back to References when In-Reply-To is unknown', async () => {
    const emails = new FakeEmailsRepo();
    const sent = emails.seed({ user_id: 'u1', type: 'sent', message_id: 'root@implicarecivica.ro' });
    expect(
      await detectParentEmail({ inReplyTo: '<unknown@x>', references: '<root@implicarecivica.ro> <unknown@x>' }, emails),
    ).toBe(sent.id);
  });

  it('returns null when nothing matches or headers are absent', async () => {
    const emails = new FakeEmailsRepo();
    expect(await detectParentEmail({}, emails)).toBeNull();
    expect(await detectParentEmail({ inReplyTo: '<nope@x>' }, emails)).toBeNull();
  });
});

/**
 * inbound/webhook/user-lookup — which user owns the recipient address.
 */
import { describe, it, expect } from 'vitest';
import { resolveRecipientUser } from '@m544/inbound/webhook/user-lookup';
import { FakeEmailsRepo, FakeProfilesRepo } from '../_fakes/fake-repos';

describe('resolveRecipientUser', () => {
  it('finds the user by platform address in profiles (case-insensitive)', async () => {
    const profiles = new FakeProfilesRepo();
    profiles.seed({ id: 'u1', mailcow_email: 'ion.popescu@implicarecivica.ro' });
    const emails = new FakeEmailsRepo();
    expect(await resolveRecipientUser('Ion.Popescu@ImplicareCivica.ro', { profiles, emails })).toBe('u1');
  });

  it('falls back to the sender of a previously sent email from that address', async () => {
    const profiles = new FakeProfilesRepo();
    const emails = new FakeEmailsRepo();
    emails.seed({ user_id: 'u2', type: 'sent', from_email: 'legacy@implicarecivica.ro' });
    expect(await resolveRecipientUser('legacy@implicarecivica.ro', { profiles, emails })).toBe('u2');
  });

  it('returns null when nobody owns the address', async () => {
    expect(await resolveRecipientUser('nobody@implicarecivica.ro', { profiles: new FakeProfilesRepo(), emails: new FakeEmailsRepo() })).toBeNull();
  });
});

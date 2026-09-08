/**
 * pipeline/matching/context — strategy 3: sender evidence only.
 *  (a) sender address == request.institution_email
 *  (b) we sent an email for the request to the sender address
 * The fixed subject is NOT evidence. Multiple candidates → no match + needsReview.
 */
import { describe, it, expect } from 'vitest';
import { matchByContext } from '@m544/pipeline/matching';
import { FakeEmailsRepo, FakeRequestsRepo } from '../../_fakes/fake-repos';

const USER = 'user-1';
const FIXED_SUBJECT = 'Cerere informații publice - Legea 544/2001';

function setup() {
  return { requests: new FakeRequestsRepo(), emails: new FakeEmailsRepo() };
}

describe('matchByContext', () => {
  it('matches when the sender is the institution email of exactly one open request', async () => {
    const { requests, emails } = setup();
    const req = requests.seed({ user_id: USER, institution_email: 'registratura@ps3.ro' });
    requests.seed({ user_id: USER, institution_email: 'contact@primaria-cluj.ro' });
    const outcome = await matchByContext(
      { user_id: USER, from_email: '"Primăria Sector 3" <Registratura@PS3.ro>', subject: 'Re: ceva' },
      requests,
      emails,
    );
    expect(outcome).toEqual({
      match: { requestId: req.id, strategy: 'context', confidence: 'medium' },
      needsReview: false,
      reason: expect.stringContaining('sender'),
    });
  });

  it('matches when we sent an email for exactly one open request to the sender address', async () => {
    const { requests, emails } = setup();
    const req = requests.seed({ user_id: USER }); // no institution_email on either request
    requests.seed({ user_id: USER });
    emails.seed({ user_id: USER, type: 'sent', request_id: req.id, to_email: 'Ion <ion@institutie.ro>' });
    const outcome = await matchByContext(
      { user_id: USER, from_email: 'ion@institutie.ro', subject: FIXED_SUBJECT },
      requests,
      emails,
    );
    expect(outcome.match).toEqual({ requestId: req.id, strategy: 'context', confidence: 'medium' });
    expect(outcome.needsReview).toBe(false);
  });

  it('two open requests towards the same institution → no match, needsReview', async () => {
    const { requests, emails } = setup();
    requests.seed({ user_id: USER, institution_email: 'registratura@ps3.ro', date_initiated: '2025-11-01T00:00:00Z' });
    requests.seed({ user_id: USER, institution_email: 'registratura@ps3.ro', date_initiated: '2025-12-01T00:00:00Z' });
    const outcome = await matchByContext(
      { user_id: USER, from_email: 'registratura@ps3.ro', subject: FIXED_SUBJECT },
      requests,
      emails,
    );
    expect(outcome.match).toBeNull();
    expect(outcome.needsReview).toBe(true);
    expect(outcome.reason).toMatch(/ambiguous: 2 candidate requests for sender registratura@ps3\.ro/);
  });

  it('counts a request once even when both (a) and (b) hold for it', async () => {
    const { requests, emails } = setup();
    const req = requests.seed({ user_id: USER, institution_email: 'registratura@ps3.ro' });
    emails.seed({ user_id: USER, type: 'sent', request_id: req.id, to_email: 'registratura@ps3.ro' });
    const outcome = await matchByContext(
      { user_id: USER, from_email: 'registratura@ps3.ro', subject: FIXED_SUBJECT },
      requests,
      emails,
    );
    expect(outcome.match?.requestId).toBe(req.id);
  });

  it('the fixed subject alone is NOT evidence (no match, no review)', async () => {
    const { requests, emails } = setup();
    requests.seed({ user_id: USER, subject: FIXED_SUBJECT, institution_email: 'a@inst.ro' });
    const outcome = await matchByContext(
      { user_id: USER, from_email: 'someone@else.ro', subject: `Re: ${FIXED_SUBJECT}` },
      requests,
      emails,
    );
    expect(outcome).toEqual({ match: null, needsReview: false, reason: 'no match' });
  });

  it('ignores answered requests and other users', async () => {
    const { requests, emails } = setup();
    requests.seed({ user_id: USER, institution_email: 'a@inst.ro', status: 'answered' });
    requests.seed({ user_id: 'other', institution_email: 'a@inst.ro' });
    const outcome = await matchByContext({ user_id: USER, from_email: 'a@inst.ro', subject: '' }, requests, emails);
    expect(outcome.match).toBeNull();
    expect(outcome.needsReview).toBe(false);
  });

  it('empty sender address never matches (guards the ilike wildcard)', async () => {
    const { requests, emails } = setup();
    const req = requests.seed({ user_id: USER });
    emails.seed({ user_id: USER, type: 'sent', request_id: req.id, to_email: 'x@y.ro' });
    const outcome = await matchByContext({ user_id: USER, from_email: '', subject: '' }, requests, emails);
    expect(outcome).toEqual({ match: null, needsReview: false, reason: 'no match' });
  });
});

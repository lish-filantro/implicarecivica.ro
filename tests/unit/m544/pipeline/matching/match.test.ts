/**
 * pipeline/matching/match — orchestration: thread → registration → context,
 * plus autoHealRegistrationNumber.
 */
import { describe, it, expect } from 'vitest';
import { matchEmailToRequest, autoHealRegistrationNumber } from '@m544/pipeline/matching';
import type { AnalysisResult, MatchableEmail } from '@m544/pipeline/types';
import { FakeEmailsRepo, FakeRequestsRepo } from '../../_fakes/fake-repos';

const USER = 'user-1';

const analysis = (registration_number: string | null): AnalysisResult => ({
  category: 'raspunse',
  registration_number,
  registration_date: null,
  response_date: null,
  answer_summary: null,
  extension_days: null,
  extension_reason: null,
  redirected_to: null,
  evidence: '',
  confidence: 0.9,
});

const email = (over: Partial<MatchableEmail> = {}): MatchableEmail => ({
  id: 'email-1',
  user_id: USER,
  parent_email_id: null,
  from_email: 'inst@c.ro',
  subject: 'Re: Cerere informații publice - Legea 544/2001',
  ...over,
});

/** Three requests, each reachable by exactly one strategy. */
function scenario() {
  const requests = new FakeRequestsRepo();
  const emails = new FakeEmailsRepo();
  const byThread = requests.seed({ user_id: USER, institution_email: 'a@a.ro' });
  const byReg = requests.seed({ user_id: USER, institution_email: 'b@b.ro', registration_number: '1000/2025' });
  const byContext = requests.seed({ user_id: USER, institution_email: 'inst@c.ro' });
  const parent = emails.seed({ user_id: USER, type: 'sent', request_id: byThread.id });
  return { requests, emails, byThread, byReg, byContext, parent };
}

describe('matchEmailToRequest', () => {
  it('thread wins over registration and context', async () => {
    const s = scenario();
    const outcome = await matchEmailToRequest(email({ parent_email_id: s.parent.id }), analysis('1000/2025'), s);
    expect(outcome.match).toEqual({ requestId: s.byThread.id, strategy: 'thread', confidence: 'high' });
    expect(outcome.needsReview).toBe(false);
  });

  it('registration wins over context when there is no thread', async () => {
    const s = scenario();
    const outcome = await matchEmailToRequest(email(), analysis('1000/2025'), s);
    expect(outcome.match).toEqual({ requestId: s.byReg.id, strategy: 'registration', confidence: 'high' });
  });

  it('falls back to context when neither thread nor registration applies', async () => {
    const s = scenario();
    const outcome = await matchEmailToRequest(email(), analysis(null), s);
    expect(outcome.match).toEqual({ requestId: s.byContext.id, strategy: 'context', confidence: 'medium' });
  });

  it('unknown registration number falls through to context', async () => {
    const s = scenario();
    const outcome = await matchEmailToRequest(email(), analysis('7777/2025'), s);
    expect(outcome.match?.requestId).toBe(s.byContext.id);
  });

  it('propagates the ambiguous outcome from context', async () => {
    const s = scenario();
    s.requests.seed({ user_id: USER, institution_email: 'inst@c.ro' });
    const outcome = await matchEmailToRequest(email(), analysis(null), s);
    expect(outcome.match).toBeNull();
    expect(outcome.needsReview).toBe(true);
  });

  it('no evidence at all → no match, no review', async () => {
    const s = scenario();
    const outcome = await matchEmailToRequest(email({ from_email: 'stranger@x.ro' }), analysis(null), s);
    expect(outcome).toEqual({ match: null, needsReview: false, reason: 'no match' });
  });
});

describe('autoHealRegistrationNumber', () => {
  it('sets the registration number when the request has none', async () => {
    const requests = new FakeRequestsRepo();
    const req = requests.seed({ user_id: USER });
    await autoHealRegistrationNumber(req.id, '29702/14.11.2025', requests);
    expect((await requests.getById(req.id))?.registration_number).toBe('29702/14.11.2025');
  });

  it('leaves an existing registration number untouched', async () => {
    const requests = new FakeRequestsRepo();
    const req = requests.seed({ user_id: USER, registration_number: 'ORIGINAL' });
    await autoHealRegistrationNumber(req.id, 'NEW', requests);
    expect((await requests.getById(req.id))?.registration_number).toBe('ORIGINAL');
  });

  it('does nothing for an unknown request', async () => {
    const requests = new FakeRequestsRepo();
    await expect(autoHealRegistrationNumber('missing', 'X', requests)).resolves.toBeUndefined();
  });
});

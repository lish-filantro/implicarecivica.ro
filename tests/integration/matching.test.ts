/**
 * Integration Tests — 3-Tier Request Matching (real Supabase)
 *
 *   1. Thread Matching (parent_email_id)
 *   2. Registration Number Matching (exact + fuzzy + core)
 *   3. Context Matching (sender = institution email / we sent to sender)
 *
 * Cost: 0 Mistral calls (matching is DB-only)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { matchEmailToRequest } from '@m544/pipeline/matching';
import { SupabaseEmailsRepo } from '@m544/shared/db/emails-repo';
import { SupabaseRequestsRepo } from '@m544/shared/db/requests-repo';
import type { AnalysisResult } from '@m544/pipeline/types';
import { getTestSupabase, TEST_USER_ID, TEST_INSTITUTION_EMAIL } from '../helpers/supabase-test-client';
import { ensureTestUserProfile, cleanupAllTestData, createTestSession, createSentEmail } from '../helpers/cleanup';

let requestIds: string[];
let sentEmailId: string;

const SUBJECT = 'Cerere informații publice - Test Matching';

function deps() {
  const sb = getTestSupabase();
  return { emails: new SupabaseEmailsRepo(sb), requests: new SupabaseRequestsRepo(sb) };
}

function fakeAnalysis(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    category: 'inregistrate',
    registration_number: null,
    registration_date: null,
    response_date: null,
    answer_summary: null,
    extension_days: null,
    extension_reason: null,
    redirected_to: null,
    evidence: 'test',
    confidence: 0.9,
    ...overrides,
  };
}

const email = (over: { parent_email_id?: string | null; from_email?: string; subject?: string } = {}) => ({
  id: 'test-email',
  user_id: TEST_USER_ID,
  parent_email_id: over.parent_email_id ?? null,
  from_email: over.from_email ?? 'unknown@other.ro',
  subject: over.subject ?? 'Altceva',
});

beforeAll(async () => {
  await ensureTestUserProfile();
  await cleanupAllTestData();

  const result = await createTestSession({
    subject: SUBJECT,
    institutionName: 'Primăria Test Matching',
    institutionEmail: TEST_INSTITUTION_EMAIL,
    questions: ['Care sunt contractele active?'],
  });
  requestIds = result.requestIds;

  sentEmailId = await createSentEmail({
    requestId: requestIds[0],
    toEmail: TEST_INSTITUTION_EMAIL,
    subject: SUBJECT,
    body: '<p>Stimată instituție, vă rog...</p>',
  });

  await getTestSupabase().from('requests').update({ registration_number: '1234/RP/2025' }).eq('id', requestIds[0]);
});

afterAll(async () => {
  await cleanupAllTestData();
});

describe('Matching — Thread (parent_email_id)', () => {
  it('matches via parent_email_id when parent has request_id', async () => {
    const { match } = await matchEmailToRequest(email({ parent_email_id: sentEmailId, from_email: TEST_INSTITUTION_EMAIL }), fakeAnalysis(), deps());
    expect(match).toEqual({ requestId: requestIds[0], strategy: 'thread', confidence: 'high' });
  });

  it('falls through when parent_email_id is null and nothing else matches', async () => {
    const outcome = await matchEmailToRequest(email({ from_email: 'unknown@random.ro', subject: 'Completely unrelated' }), fakeAnalysis(), deps());
    expect(outcome.match).toBeNull();
    expect(outcome.needsReview).toBe(false);
  });
});

describe('Matching — Registration Number', () => {
  it('exact match', async () => {
    const { match } = await matchEmailToRequest(email(), fakeAnalysis({ registration_number: '1234/RP/2025' }), deps());
    expect(match).toEqual({ requestId: requestIds[0], strategy: 'registration', confidence: 'high' });
  });

  it('fuzzy match — partial containment', async () => {
    const { match } = await matchEmailToRequest(email(), fakeAnalysis({ registration_number: '1234/RP' }), deps());
    expect(match).toEqual({ requestId: requestIds[0], strategy: 'registration', confidence: 'medium' });
  });

  it('core match — same number, different date', async () => {
    const { match } = await matchEmailToRequest(email(), fakeAnalysis({ registration_number: '1234/22.11.2025' }), deps());
    expect(match?.requestId).toBe(requestIds[0]);
    expect(match?.strategy).toBe('registration');
  });

  it('no match on a non-existent registration number and unknown sender', async () => {
    const { match } = await matchEmailToRequest(email(), fakeAnalysis({ registration_number: '9999/ZZ/2030' }), deps());
    expect(match).toBeNull();
  });
});

describe('Matching — Context', () => {
  it('matches via institution email (sender = institution_email on request)', async () => {
    const outcome = await matchEmailToRequest(email({ from_email: TEST_INSTITUTION_EMAIL, subject: 'Altceva complet diferit' }), fakeAnalysis(), deps());
    expect(outcome.match).toEqual({ requestId: requestIds[0], strategy: 'context', confidence: 'medium' });
    expect(outcome.reason).toBe('sender is institution email');
  });

  it('the fixed subject alone is NOT evidence (design decision: every request shares it)', async () => {
    const outcome = await matchEmailToRequest(email({ from_email: 'alt-departament@alt-domeniu.ro', subject: 'Re: ' + SUBJECT }), fakeAnalysis(), deps());
    expect(outcome.match).toBeNull();
  });

  it('matches via sent-to (we sent an email to this sender) when the request has no institution_email', async () => {
    const sb = getTestSupabase();
    await sb.from('requests').update({ institution_email: null }).eq('id', requestIds[0]);
    const outcome = await matchEmailToRequest(email({ from_email: `Registratură <${TEST_INSTITUTION_EMAIL}>` }), fakeAnalysis(), deps());
    expect(outcome.match?.requestId).toBe(requestIds[0]);
    expect(outcome.reason).toBe('we sent to this address');
    await sb.from('requests').update({ institution_email: TEST_INSTITUTION_EMAIL }).eq('id', requestIds[0]);
  });

  it('two open requests to the same institution → ambiguous, flagged for review', async () => {
    const second = await createTestSession({
      subject: SUBJECT,
      institutionName: 'Primăria Test Matching',
      institutionEmail: TEST_INSTITUTION_EMAIL,
      questions: ['A doua întrebare'],
    });
    const outcome = await matchEmailToRequest(email({ from_email: TEST_INSTITUTION_EMAIL }), fakeAnalysis(), deps());
    expect(outcome.match).toBeNull();
    expect(outcome.needsReview).toBe(true);
    await getTestSupabase().from('requests').delete().eq('id', second.requestIds[0]);
    await getTestSupabase().from('request_sessions').delete().eq('id', second.sessionId);
  });

  it('returns null when nothing matches', async () => {
    const outcome = await matchEmailToRequest(email({ from_email: 'totally-unknown@nowhere.ro', subject: 'Promoție pizza' }), fakeAnalysis(), deps());
    expect(outcome.match).toBeNull();
    expect(outcome.needsReview).toBe(false);
  });
});

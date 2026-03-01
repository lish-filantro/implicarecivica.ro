/**
 * Integration Tests — 3-Tier Request Matching
 *
 * Tests the matching strategies against real Supabase data:
 *   1. Thread Matching (parent_email_id)
 *   2. Registration Number Matching (exact + fuzzy)
 *   3. Context Matching (subject + institution email + sent-to)
 *
 * Cost: 0 Mistral calls (matching is DB-only)
 * Time: ~10s (DB round-trips only)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { matchEmailToRequest } from '@/lib/services/request-matching';
import { getTestSupabase, TEST_USER_ID, TEST_INSTITUTION_EMAIL } from '../helpers/supabase-test-client';
import { ensureTestUserProfile, cleanupAllTestData, createTestSession, createSentEmail } from '../helpers/cleanup';
import type { AnalysisResult } from '@/lib/services/analysis-service';

let sessionId: string;
let requestIds: string[];
let sentEmailId: string;

const SUBJECT = 'Cerere informații publice - Test Matching';

// Minimal AnalysisResult for matching (no actual AI call needed)
function fakeAnalysis(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    category: 'inregistrate',
    registration_number: null,
    registration_date: null,
    response_date: null,
    answer_summary: null,
    extension_days: null,
    extension_reason: null,
    evidence: 'test',
    confidence: 0.9,
    ...overrides,
  };
}

beforeAll(async () => {
  await ensureTestUserProfile();
  await cleanupAllTestData();

  // Create a session with one request
  const result = await createTestSession({
    subject: SUBJECT,
    institutionName: 'Primăria Test Matching',
    institutionEmail: TEST_INSTITUTION_EMAIL,
    questions: ['Care sunt contractele active?'],
  });

  sessionId = result.sessionId;
  requestIds = result.requestIds;

  // Create a "sent" email linked to the request
  sentEmailId = await createSentEmail({
    requestId: requestIds[0],
    toEmail: TEST_INSTITUTION_EMAIL,
    subject: SUBJECT,
    body: '<p>Stimată instituție, vă rog...</p>',
  });

  // Set registration number on the request (for reg number matching tests)
  const supabase = getTestSupabase();
  await supabase
    .from('requests')
    .update({ registration_number: '1234/RP/2025' })
    .eq('id', requestIds[0]);
});

afterAll(async () => {
  await cleanupAllTestData();
});

// ═══════════════════════════════════════════════════════════
// Strategy 1: Thread Matching
// ═══════════════════════════════════════════════════════════
describe('Matching — Thread (parent_email_id)', () => {
  it('matches via parent_email_id when parent has request_id', async () => {
    const match = await matchEmailToRequest(
      {
        id: 'test-thread-email',
        user_id: TEST_USER_ID,
        parent_email_id: sentEmailId, // parent is our sent email → has request_id
        from_email: TEST_INSTITUTION_EMAIL,
        subject: 'Re: ' + SUBJECT,
      },
      fakeAnalysis(),
    );

    expect(match).not.toBeNull();
    expect(match!.requestId).toBe(requestIds[0]);
    expect(match!.strategy).toBe('thread');
    expect(match!.confidence).toBe('high');
  });

  it('falls through when parent_email_id is null', async () => {
    // This should NOT match via thread — will try other strategies
    const match = await matchEmailToRequest(
      {
        id: 'test-no-thread-email',
        user_id: TEST_USER_ID,
        parent_email_id: null,
        from_email: 'unknown@random.ro',
        subject: 'Completely unrelated subject',
      },
      fakeAnalysis(),
    );

    // No thread, no reg number, no context → null
    expect(match).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════
// Strategy 2: Registration Number Matching
// ═══════════════════════════════════════════════════════════
describe('Matching — Registration Number', () => {
  it('exact match on registration_number', async () => {
    const match = await matchEmailToRequest(
      {
        id: 'test-reg-exact',
        user_id: TEST_USER_ID,
        parent_email_id: null,
        from_email: 'unknown@other.ro',
        subject: 'Some unrelated subject',
      },
      fakeAnalysis({ registration_number: '1234/RP/2025' }),
    );

    expect(match).not.toBeNull();
    expect(match!.requestId).toBe(requestIds[0]);
    expect(match!.strategy).toBe('registration');
    expect(match!.confidence).toBe('high');
  });

  it('fuzzy match — partial containment', async () => {
    const match = await matchEmailToRequest(
      {
        id: 'test-reg-fuzzy',
        user_id: TEST_USER_ID,
        parent_email_id: null,
        from_email: 'unknown@other.ro',
        subject: 'Altceva',
      },
      fakeAnalysis({ registration_number: '1234/RP' }), // subset
    );

    expect(match).not.toBeNull();
    expect(match!.requestId).toBe(requestIds[0]);
    expect(match!.strategy).toBe('registration');
    expect(match!.confidence).toBe('medium');
  });

  it('no match on non-existent registration number', async () => {
    const match = await matchEmailToRequest(
      {
        id: 'test-reg-none',
        user_id: TEST_USER_ID,
        parent_email_id: null,
        from_email: 'unknown@other.ro',
        subject: 'Altceva',
      },
      fakeAnalysis({ registration_number: '9999/ZZ/2030' }),
    );

    // Falls through to context matching — but subject/institution don't match either
    // Could be null or context match depending on data
    if (match) {
      expect(match.strategy).not.toBe('registration');
    }
  });
});

// ═══════════════════════════════════════════════════════════
// Strategy 3: Context Matching
// ═══════════════════════════════════════════════════════════
describe('Matching — Context', () => {
  it('matches via institution email (sender = institution_email on request)', async () => {
    const match = await matchEmailToRequest(
      {
        id: 'test-ctx-inst',
        user_id: TEST_USER_ID,
        parent_email_id: null,
        from_email: TEST_INSTITUTION_EMAIL,
        subject: 'Altceva complet diferit',
      },
      fakeAnalysis(),
    );

    expect(match).not.toBeNull();
    expect(match!.requestId).toBe(requestIds[0]);
    expect(match!.strategy).toBe('context');
    expect(match!.confidence).toBe('medium');
  });

  it('matches via normalized subject', async () => {
    const match = await matchEmailToRequest(
      {
        id: 'test-ctx-subject',
        user_id: TEST_USER_ID,
        parent_email_id: null,
        from_email: 'alt-departament@alt-domeniu.ro',
        subject: 'Re: ' + SUBJECT, // Re: prefix should be stripped
      },
      fakeAnalysis(),
    );

    expect(match).not.toBeNull();
    expect(match!.requestId).toBe(requestIds[0]);
    expect(match!.strategy).toBe('context');
  });

  it('matches via sent-to (we sent an email to this sender)', async () => {
    const match = await matchEmailToRequest(
      {
        id: 'test-ctx-sent-to',
        user_id: TEST_USER_ID,
        parent_email_id: null,
        from_email: TEST_INSTITUTION_EMAIL,
        subject: 'Confirmare primire cerere nr 1234',
      },
      fakeAnalysis(),
    );

    expect(match).not.toBeNull();
    expect(match!.requestId).toBe(requestIds[0]);
    expect(match!.strategy).toBe('context');
  });

  it('returns null when nothing matches', async () => {
    const match = await matchEmailToRequest(
      {
        id: 'test-ctx-none',
        user_id: TEST_USER_ID,
        parent_email_id: null,
        from_email: 'totally-unknown@nowhere.ro',
        subject: 'Promoție pizza 50% reducere',
      },
      fakeAnalysis(),
    );

    expect(match).toBeNull();
  });
});

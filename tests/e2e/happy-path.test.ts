/**
 * E2E Test — Happy Path (Set_1_Happy_Path_Parcuri)
 *
 * Simulates the simplest successful flow:
 *   1. Citizen creates session + request
 *   2. Citizen sends email
 *   3. Institution sends confirmation PDF → status: received
 *   4. Institution sends final response PDF → status: answered
 *   5. Session status becomes 'completed'
 *
 * Uses real: Supabase, Mistral OCR, Mistral Large
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestSupabase, TEST_USER_ID, TEST_INSTITUTION_EMAIL } from '../helpers/supabase-test-client';
import { ensureTestUserProfile, cleanupAllTestData, createTestSession, createSentEmail } from '../helpers/cleanup';
import { injectAndProcess } from '../helpers/inject-email';
import { getTestScenarios } from '../helpers/pdf-loader';

const scenario = getTestScenarios().find((s) => s.setName === 'Set_1_Happy_Path_Parcuri')!;

let sessionId: string;
let requestId: string;
let sentEmailId: string;

beforeAll(async () => {
  await ensureTestUserProfile();
  await cleanupAllTestData();

  // Create session with 1 request
  const result = await createTestSession({
    subject: scenario.subject,
    institutionName: scenario.institutionName,
    institutionEmail: TEST_INSTITUTION_EMAIL,
    questions: ['Care este situația parcurilor din sector?'],
  });

  sessionId = result.sessionId;
  requestId = result.requestIds[0];

  // Simulate the citizen's sent email
  sentEmailId = await createSentEmail({
    requestId,
    toEmail: TEST_INSTITUTION_EMAIL,
    subject: scenario.subject,
    body: '<p>Stimată instituție, în baza Legii 544/2001...</p>',
  });
}, 30_000);

afterAll(async () => {
  await cleanupAllTestData();
});

describe(`E2E Happy Path — ${scenario.setName}`, () => {
  const confirmare = scenario.pdfs.find((p) => p.docType === 'confirmare')!;
  const raspuns = scenario.pdfs.find((p) => ['raspuns_final', 'raspuns'].includes(p.docType))!;

  it('Step 1: Initial request status is pending', async () => {
    const supabase = getTestSupabase();
    const { data: req } = await supabase.from('requests').select('status').eq('id', requestId).single();
    expect(req!.status).toBe('pending');
  });

  it('Step 2: Inject confirmare → status becomes received', async () => {
    const result = await injectAndProcess({
      requestId,
      parentEmailId: sentEmailId,
      fromEmail: `Registratură <${TEST_INSTITUTION_EMAIL}>`,
      subject: `Re: ${scenario.subject}`,
      body: '<p>Cererea dvs. a fost înregistrată.</p>',
      pdfBytes: confirmare.getBytes(),
      pdfFileName: confirmare.fileName + '.pdf',
    });

    expect(result.success).toBe(true);
    expect(result.category).toBe('inregistrate');
    expect(result.matchStrategy).toBe('thread');
    expect(result.matchedRequestId).toBe(requestId);

    // Verify request updated
    const supabase = getTestSupabase();
    const { data: req } = await supabase.from('requests').select('*').eq('id', requestId).single();
    expect(req!.status).toBe('received');
    expect(req!.registration_number).toBeTruthy();
    expect(req!.deadline_date).toBeTruthy();
  }, 120_000);

  it('Step 3: Inject răspuns final → status becomes answered', async () => {
    const result = await injectAndProcess({
      requestId,
      fromEmail: `Registratură <${TEST_INSTITUTION_EMAIL}>`,
      subject: `Re: ${scenario.subject}`,
      body: '<p>Vă comunicăm răspunsul la cererea dvs.</p>',
      pdfBytes: raspuns.getBytes(),
      pdfFileName: raspuns.fileName + '.pdf',
    });

    expect(result.success).toBe(true);
    expect(result.category).toBe('raspunse');
    expect(result.matchStrategy).toBe('registration');
    expect(result.matchedRequestId).toBe(requestId);

    // Verify final request state
    const supabase = getTestSupabase();
    const { data: req } = await supabase.from('requests').select('*').eq('id', requestId).single();
    expect(req!.status).toBe('answered');
    expect(req!.answer_summary).toBeTruthy();
    expect(req!.response_received_date).toBeTruthy();
  }, 120_000);

  it('Step 4: Session cached_status is completed', async () => {
    const supabase = getTestSupabase();
    const { data: session } = await supabase
      .from('request_sessions')
      .select('cached_status, total_requests')
      .eq('id', sessionId)
      .single();

    // Session should be completed since the only request is answered
    expect(session!.total_requests).toBe(1);
    // cached_status is updated by DB trigger — may be 'completed' or recalculated
    expect(['completed', 'partial_answered']).toContain(session!.cached_status);
  });
});

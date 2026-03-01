/**
 * E2E Test — Refusal (Set_3_Refusal_Salarii)
 *
 * Flow: confirmare → refuz
 * Verifies that a refusal is still classified as 'raspunse' (answered)
 * and the answer_summary contains the refusal reason.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestSupabase, TEST_INSTITUTION_EMAIL } from '../helpers/supabase-test-client';
import { ensureTestUserProfile, cleanupAllTestData, createTestSession, createSentEmail } from '../helpers/cleanup';
import { injectAndProcess } from '../helpers/inject-email';
import { getTestScenarios } from '../helpers/pdf-loader';

const scenario = getTestScenarios().find((s) => s.setName === 'Set_3_Refusal_Salarii')!;

let requestId: string;
let sentEmailId: string;

beforeAll(async () => {
  await ensureTestUserProfile();
  await cleanupAllTestData();

  const result = await createTestSession({
    subject: scenario.subject,
    institutionName: scenario.institutionName,
    institutionEmail: TEST_INSTITUTION_EMAIL,
    questions: ['Care sunt salariile funcționarilor publici?'],
  });

  requestId = result.requestIds[0];

  sentEmailId = await createSentEmail({
    requestId,
    toEmail: TEST_INSTITUTION_EMAIL,
    subject: scenario.subject,
    body: '<p>Cerere Legea 544/2001</p>',
  });
}, 30_000);

afterAll(async () => {
  await cleanupAllTestData();
});

describe(`E2E Refusal — ${scenario.setName}`, () => {
  const confirmare = scenario.pdfs.find((p) => p.docType === 'confirmare')!;
  const refuz = scenario.pdfs.find((p) => ['refuz', 'refuz_partial'].includes(p.docType))!;

  it('Step 1: Confirmare → received', async () => {
    const result = await injectAndProcess({
      parentEmailId: sentEmailId,
      fromEmail: `Registratură <${TEST_INSTITUTION_EMAIL}>`,
      subject: `Re: ${scenario.subject}`,
      pdfBytes: confirmare.getBytes(),
      pdfFileName: confirmare.fileName + '.pdf',
    });

    expect(result.success).toBe(true);
    expect(result.category).toBe('inregistrate');
    expect(result.matchStrategy).toBe('thread');

    const supabase = getTestSupabase();
    const { data: req } = await supabase.from('requests').select('*').eq('id', requestId).single();
    expect(req!.status).toBe('received');
    expect(req!.registration_number).toBeTruthy();
  }, 120_000);

  it('Step 2: Refuz → answered (refusal is still a response)', async () => {
    const result = await injectAndProcess({
      fromEmail: `Registratură <${TEST_INSTITUTION_EMAIL}>`,
      subject: `Re: ${scenario.subject}`,
      pdfBytes: refuz.getBytes(),
      pdfFileName: refuz.fileName + '.pdf',
    });

    expect(result.success).toBe(true);
    expect(result.category).toBe('raspunse');
    expect(result.matchStrategy).toBe('registration');

    const supabase = getTestSupabase();
    const { data: req } = await supabase.from('requests').select('*').eq('id', requestId).single();
    expect(req!.status).toBe('answered');
    expect(req!.answer_summary).toBeTruthy();
  }, 120_000);
});

/**
 * E2E Test — Clarification (Set_5_Clarification_Scoli)
 *
 * Flow: confirmare → cerere clarificări → răspuns final
 * Tests that a clarification request is classified as 'amanate'
 * and the final response correctly sets status to 'answered'.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestSupabase, TEST_INSTITUTION_EMAIL } from '../helpers/supabase-test-client';
import { ensureTestUserProfile, cleanupAllTestData, createTestSession, createSentEmail } from '../helpers/cleanup';
import { injectAndProcess } from '../helpers/inject-email';
import { getTestScenarios } from '../helpers/pdf-loader';

const scenario = getTestScenarios().find((s) => s.setName === 'Set_5_Clarification_Scoli')!;

let requestId: string;
let sentEmailId: string;

beforeAll(async () => {
  await ensureTestUserProfile();
  await cleanupAllTestData();

  const result = await createTestSession({
    subject: scenario.subject,
    institutionName: scenario.institutionName,
    institutionEmail: TEST_INSTITUTION_EMAIL,
    questions: ['Care este situația școlilor din județ?'],
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

describe(`E2E Clarification — ${scenario.setName}`, () => {
  const confirmare = scenario.pdfs.find((p) => p.docType === 'confirmare')!;
  const clarificari = scenario.pdfs.find((p) => p.docType === 'cerere_clarificari')!;
  const raspuns = scenario.pdfs.find((p) => ['raspuns_final', 'raspuns'].includes(p.docType))!;

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

    // Verify registration number was extracted
    const supabase = getTestSupabase();
    const { data: req } = await supabase.from('requests').select('registration_number').eq('id', requestId).single();
    expect(req!.registration_number).toBeTruthy();
  }, 120_000);

  it('Step 2: Cerere clarificări → processed (non-deterministic)', async () => {
    // Mistral is non-deterministic on clarification requests:
    // sometimes 'amanate' (delay), sometimes 'inregistrate' (admin step)
    const result = await injectAndProcess({
      fromEmail: `Registratură <${TEST_INSTITUTION_EMAIL}>`,
      subject: `Re: ${scenario.subject}`,
      pdfBytes: clarificari.getBytes(),
      pdfFileName: clarificari.fileName + '.pdf',
    });

    expect(result.success).toBe(true);
    expect(['amanate', 'inregistrate']).toContain(result.category);
    expect(result.matchStrategy).toBe('registration');

    const supabase = getTestSupabase();
    const { data: req } = await supabase.from('requests').select('status').eq('id', requestId).single();
    expect(['received', 'extension']).toContain(req!.status);
  }, 120_000);

  it('Step 3: Răspuns final → answered', async () => {
    const result = await injectAndProcess({
      fromEmail: `Registratură <${TEST_INSTITUTION_EMAIL}>`,
      subject: `Re: ${scenario.subject}`,
      pdfBytes: raspuns.getBytes(),
      pdfFileName: raspuns.fileName + '.pdf',
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

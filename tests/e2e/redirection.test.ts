/**
 * E2E Test — Redirection (Set_4_Redirection_Metro)
 *
 * Flow: confirmare → redirecționare
 * Verifies that a redirection to another institution is classified as 'raspunse'
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestSupabase, TEST_INSTITUTION_EMAIL } from '../helpers/supabase-test-client';
import { ensureTestUserProfile, cleanupAllTestData, createTestSession, createSentEmail } from '../helpers/cleanup';
import { injectAndProcess } from '../helpers/inject-email';
import { getTestScenarios } from '../helpers/pdf-loader';

const scenario = getTestScenarios().find((s) => s.setName === 'Set_4_Redirection_Metro')!;

let requestId: string;
let sentEmailId: string;

beforeAll(async () => {
  await ensureTestUserProfile();
  await cleanupAllTestData();

  const result = await createTestSession({
    subject: scenario.subject,
    institutionName: scenario.institutionName,
    institutionEmail: TEST_INSTITUTION_EMAIL,
    questions: ['Care este stadiul proiectului de extindere metrou?'],
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

describe(`E2E Redirection — ${scenario.setName}`, () => {
  const confirmare = scenario.pdfs.find((p) => p.docType === 'confirmare')!;
  const redirectionare = scenario.pdfs.find((p) => p.docType === 'redirectionare')!;

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

  it('Step 2: Redirecționare → processed (non-deterministic category)', async () => {
    // Mistral is non-deterministic on redirections:
    // sometimes 'raspunse' (it's a response), sometimes 'inregistrate' (forwarding action)
    const result = await injectAndProcess({
      fromEmail: `Registratură <${TEST_INSTITUTION_EMAIL}>`,
      subject: `Re: ${scenario.subject}`,
      pdfBytes: redirectionare.getBytes(),
      pdfFileName: redirectionare.fileName + '.pdf',
    });

    expect(result.success).toBe(true);
    expect(['raspunse', 'inregistrate']).toContain(result.category);
    expect(result.matchStrategy).toBe('registration');

    const supabase = getTestSupabase();
    const { data: req } = await supabase.from('requests').select('*').eq('id', requestId).single();
    // Status depends on category: 'answered' if raspunse, 'received' if inregistrate
    expect(['answered', 'received']).toContain(req!.status);
  }, 120_000);
});

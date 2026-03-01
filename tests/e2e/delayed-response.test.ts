/**
 * E2E Test — Delayed Response (Set_2_Delayed_Achizitii)
 *
 * Flow: confirmare → prelungire → răspuns final
 * Tests the extension deadline logic (10 days → 30 days)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestSupabase, TEST_USER_ID, TEST_INSTITUTION_EMAIL } from '../helpers/supabase-test-client';
import { ensureTestUserProfile, cleanupAllTestData, createTestSession, createSentEmail } from '../helpers/cleanup';
import { injectAndProcess } from '../helpers/inject-email';
import { getTestScenarios } from '../helpers/pdf-loader';

const scenario = getTestScenarios().find((s) => s.setName === 'Set_2_Delayed_Achizitii')!;

let sessionId: string;
let requestId: string;
let sentEmailId: string;

beforeAll(async () => {
  await ensureTestUserProfile();
  await cleanupAllTestData();

  const result = await createTestSession({
    subject: scenario.subject,
    institutionName: scenario.institutionName,
    institutionEmail: TEST_INSTITUTION_EMAIL,
    questions: ['Care sunt achizițiile publice din ultimul an?'],
  });

  sessionId = result.sessionId;
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

describe(`E2E Delayed Response — ${scenario.setName}`, () => {
  const confirmare = scenario.pdfs.find((p) => p.docType === 'confirmare')!;
  const prelungire = scenario.pdfs.find((p) => ['amanare', 'notificare_prelungire'].includes(p.docType))!;
  const raspuns = scenario.pdfs.find((p) => ['raspuns_final', 'raspuns'].includes(p.docType))!;

  it('Step 1: Confirmare → received + deadline 10 zile', async () => {
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
    expect(req!.deadline_date).toBeTruthy();

    // Deadline should be ~10 days from now
    const deadline = new Date(req!.deadline_date);
    const now = new Date();
    const diffDays = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(5);
    expect(diffDays).toBeLessThan(15);
  }, 120_000);

  it('Step 2: Prelungire → extension + deadline 30 zile', async () => {
    const result = await injectAndProcess({
      fromEmail: `Registratură <${TEST_INSTITUTION_EMAIL}>`,
      subject: `Re: ${scenario.subject}`,
      pdfBytes: prelungire.getBytes(),
      pdfFileName: prelungire.fileName + '.pdf',
    });

    expect(result.success).toBe(true);
    expect(result.category).toBe('amanate');
    expect(result.matchStrategy).toBe('registration');

    const supabase = getTestSupabase();
    const { data: req } = await supabase.from('requests').select('*').eq('id', requestId).single();
    expect(req!.status).toBe('extension');
    expect(req!.extension_date).toBeTruthy();

    // Extension date should be ~30 days from date_received
    const extDate = new Date(req!.extension_date);
    const received = new Date(req!.date_received);
    const diffDays = (extDate.getTime() - received.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThanOrEqual(28);
    expect(diffDays).toBeLessThanOrEqual(32);
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

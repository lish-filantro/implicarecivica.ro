/**
 * E2E Test — Delayed Response (Set_2_Delayed_Achizitii)
 *
 * Flow: confirmare → prelungire → răspuns final
 * Tests the extension deadline logic (10 → 30 BUSINESS days from registration, HG 123/2002 art. 16)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestSupabase, TEST_USER_ID, TEST_INSTITUTION_EMAIL } from '../helpers/supabase-test-client';
import { ensureTestUserProfile, cleanupAllTestData, createTestSession, createSentEmail } from '../helpers/cleanup';
import { injectAndProcess } from '../helpers/inject-email';
import { getTestScenarios } from '../helpers/pdf-loader';
import { standardDeadline, extendedDeadline } from '@m544/pipeline/status/deadlines';
import { businessDaysBetween } from '@m544/shared/utils/business-days';

const epoch = (iso: string) => new Date(iso).getTime();

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

  it('Step 1: Confirmare → received + deadline 10 zile lucrătoare', async () => {
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

    // deadline_date = 10 business days after date_received (weekends + public holidays skipped)
    expect(req!.date_received).toBeTruthy();
    expect(epoch(req!.deadline_date)).toBe(epoch(standardDeadline(new Date(req!.date_received).toISOString())));
    expect(businessDaysBetween(req!.date_received, req!.deadline_date)).toBe(10);
  }, 120_000);

  it('Step 2: Prelungire → extension + deadline 30 zile lucrătoare', async () => {
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

    // extension_date = 30 business days after date_received; extension_days stores the total (30)
    expect(epoch(req!.extension_date)).toBe(epoch(extendedDeadline(new Date(req!.date_received).toISOString())));
    expect(businessDaysBetween(req!.date_received, req!.extension_date)).toBe(30);
    expect(req!.extension_days).toBe(30);
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

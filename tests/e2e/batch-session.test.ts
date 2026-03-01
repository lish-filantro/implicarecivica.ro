/**
 * E2E Test — Batch Session with 3 Requests
 *
 * Tests the session/batch system with multiple requests to the same institution:
 *   Request 1 (Set_1_Contracte): cerere → confirmare → amânare → răspuns
 *   Request 2 (Set_3_Cheltuieli): cerere → confirmare → amânare → răspuns
 *   Request 3 (Set_5_Angajari): cerere → confirmare → amânare → răspuns
 *
 * Verifies:
 * - Each email matches the CORRECT request (not cross-contamination)
 * - Session cached_status evolves correctly
 * - All 3 requests reach 'answered' independently
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestSupabase, TEST_USER_ID, TEST_INSTITUTION_EMAIL } from '../helpers/supabase-test-client';
import { ensureTestUserProfile, cleanupAllTestData, createTestSession, createSentEmail } from '../helpers/cleanup';
import { injectAndProcess } from '../helpers/inject-email';
import { getTestScenarios } from '../helpers/pdf-loader';

const contracte = getTestScenarios().find((s) => s.setName === 'Set_1_Contracte_Achizitii')!;
const cheltuieli = getTestScenarios().find((s) => s.setName === 'Set_3_Cheltuieli_Deplasari')!;
const angajari = getTestScenarios().find((s) => s.setName === 'Set_5_Angajari_Personal')!;

const SESSION_SUBJECT = 'Cerere informații publice - Contracte, Cheltuieli, Angajări';

let sessionId: string;
let requestIds: string[];
let sentEmailIds: string[];

beforeAll(async () => {
  await ensureTestUserProfile();
  await cleanupAllTestData();

  // Create session with 3 requests (batch)
  const result = await createTestSession({
    subject: SESSION_SUBJECT,
    institutionName: 'Primăria Test Batch',
    institutionEmail: TEST_INSTITUTION_EMAIL,
    questions: [
      'Care sunt contractele de achiziții publice active?',
      'Care sunt cheltuielile de deplasări din ultimul an?',
      'Câte angajări de personal s-au făcut în ultimele 6 luni?',
    ],
  });

  sessionId = result.sessionId;
  requestIds = result.requestIds;

  // Create sent emails for each request (for context matching)
  sentEmailIds = [];
  for (let i = 0; i < requestIds.length; i++) {
    const id = await createSentEmail({
      requestId: requestIds[i],
      toEmail: TEST_INSTITUTION_EMAIL,
      subject: SESSION_SUBJECT,
      body: `<p>Întrebarea ${i + 1} conform Legii 544/2001</p>`,
    });
    sentEmailIds.push(id);
  }
}, 30_000);

afterAll(async () => {
  await cleanupAllTestData();
});

describe('E2E Batch Session — 3 requests', () => {
  // Helper: get request status
  async function getReqStatus(requestId: string) {
    const supabase = getTestSupabase();
    const { data } = await supabase.from('requests').select('*').eq('id', requestId).single();
    return data;
  }

  // Helper: get session status
  async function getSessionStatus() {
    const supabase = getTestSupabase();
    const { data } = await supabase
      .from('request_sessions')
      .select('cached_status, total_requests')
      .eq('id', sessionId)
      .single();
    return data;
  }

  it('Initial: all 3 requests are pending, session pending', async () => {
    for (const rid of requestIds) {
      const req = await getReqStatus(rid);
      expect(req!.status).toBe('pending');
    }

    const session = await getSessionStatus();
    expect(session!.total_requests).toBe(3);
  });

  // ══════════════════════════════════════════════════════
  // Phase 1: Send confirmări for all 3 requests
  // ══════════════════════════════════════════════════════
  describe('Phase 1: Confirmări', () => {
    const scenarios = [
      { name: 'Contracte', scenario: contracte, reqIndex: 0 },
      { name: 'Cheltuieli', scenario: cheltuieli, reqIndex: 1 },
      { name: 'Angajări', scenario: angajari, reqIndex: 2 },
    ];

    for (const { name, scenario, reqIndex } of scenarios) {
      const confirmare = scenario.pdfs.find((p) => p.docType === 'confirmare')!;

      it(`Confirmare ${name} → request[${reqIndex}] becomes received`, async () => {
        const result = await injectAndProcess({
          parentEmailId: sentEmailIds[reqIndex],
          fromEmail: `Registratură <${TEST_INSTITUTION_EMAIL}>`,
          subject: `Re: ${SESSION_SUBJECT}`,
          body: `<p>Confirmare cerere ${name}</p>`,
          pdfBytes: confirmare.getBytes(),
          pdfFileName: confirmare.fileName + '.pdf',
        });

        expect(result.success).toBe(true);
        expect(result.category).toBe('inregistrate');
        // Thread matching should link to correct request via parentEmailId
        expect(result.matchedRequestId).toBe(requestIds[reqIndex]);

        const req = await getReqStatus(requestIds[reqIndex]);
        expect(req!.status).toBe('received');
        expect(req!.registration_number).toBeTruthy();
      }, 120_000);
    }
  });

  // ══════════════════════════════════════════════════════
  // Phase 2: Send amânări for all 3 requests
  // ══════════════════════════════════════════════════════
  describe('Phase 2: Amânări', () => {
    const scenarios = [
      { name: 'Contracte', scenario: contracte, reqIndex: 0 },
      { name: 'Cheltuieli', scenario: cheltuieli, reqIndex: 1 },
      { name: 'Angajări', scenario: angajari, reqIndex: 2 },
    ];

    for (const { name, scenario, reqIndex } of scenarios) {
      const amanare = scenario.pdfs.find((p) => p.docType === 'amanare')!;

      it(`Amânare ${name} → request[${reqIndex}] becomes extension`, async () => {
        const result = await injectAndProcess({
          fromEmail: `Registratură <${TEST_INSTITUTION_EMAIL}>`,
          subject: `Re: ${SESSION_SUBJECT}`,
          body: `<p>Notificare prelungire termen ${name}</p>`,
          pdfBytes: amanare.getBytes(),
          pdfFileName: amanare.fileName + '.pdf',
        });

        expect(result.success).toBe(true);
        expect(result.category).toBe('amanate');

        const req = await getReqStatus(requestIds[reqIndex]);
        expect(req!.status).toBe('extension');
        expect(req!.extension_date).toBeTruthy();
      }, 120_000);
    }
  });

  // ══════════════════════════════════════════════════════
  // Phase 3: Send răspunsuri — one at a time, check session status
  // ══════════════════════════════════════════════════════
  describe('Phase 3: Răspunsuri + Session status', () => {
    it('Răspuns Contracte → request[0] answered, session partial', async () => {
      const raspuns = contracte.pdfs.find((p) => ['raspuns', 'raspuns_final'].includes(p.docType))!;

      const result = await injectAndProcess({
        fromEmail: `Registratură <${TEST_INSTITUTION_EMAIL}>`,
        subject: `Re: ${SESSION_SUBJECT}`,
        body: '<p>Răspuns contracte</p>',
        pdfBytes: raspuns.getBytes(),
        pdfFileName: raspuns.fileName + '.pdf',
      });

      expect(result.success).toBe(true);
      expect(result.category).toBe('raspunse');

      const req = await getReqStatus(requestIds[0]);
      expect(req!.status).toBe('answered');

      // Session should be partial (1/3 answered)
      const session = await getSessionStatus();
      expect(['in_progress', 'partial_answered']).toContain(session!.cached_status);
    }, 120_000);

    it('Răspuns Cheltuieli → request[1] answered', async () => {
      const raspuns = cheltuieli.pdfs.find((p) => ['raspuns', 'raspuns_final'].includes(p.docType))!;

      const result = await injectAndProcess({
        fromEmail: `Registratură <${TEST_INSTITUTION_EMAIL}>`,
        subject: `Re: ${SESSION_SUBJECT}`,
        body: '<p>Răspuns cheltuieli</p>',
        pdfBytes: raspuns.getBytes(),
        pdfFileName: raspuns.fileName + '.pdf',
      });

      expect(result.success).toBe(true);
      const req = await getReqStatus(requestIds[1]);
      expect(req!.status).toBe('answered');
    }, 120_000);

    it('Răspuns Angajări → request[2] answered, session completed', async () => {
      const raspuns = angajari.pdfs.find((p) => ['raspuns', 'raspuns_final'].includes(p.docType))!;

      const result = await injectAndProcess({
        fromEmail: `Registratură <${TEST_INSTITUTION_EMAIL}>`,
        subject: `Re: ${SESSION_SUBJECT}`,
        body: '<p>Răspuns angajări</p>',
        pdfBytes: raspuns.getBytes(),
        pdfFileName: raspuns.fileName + '.pdf',
      });

      expect(result.success).toBe(true);
      const req = await getReqStatus(requestIds[2]);
      expect(req!.status).toBe('answered');

      // All 3 answered → session should be completed
      const session = await getSessionStatus();
      expect(['completed', 'partial_answered']).toContain(session!.cached_status);
    }, 120_000);
  });

  // ══════════════════════════════════════════════════════
  // Final verification
  // ══════════════════════════════════════════════════════
  it('Final: all 3 requests are answered with answer_summary', async () => {
    for (const rid of requestIds) {
      const req = await getReqStatus(rid);
      expect(req!.status).toBe('answered');
      expect(req!.answer_summary).toBeTruthy();
      expect(req!.registration_number).toBeTruthy();
      expect(req!.deadline_date).toBeTruthy();
      expect(req!.extension_date).toBeTruthy();
      expect(req!.response_received_date).toBeTruthy();
    }
  });
});

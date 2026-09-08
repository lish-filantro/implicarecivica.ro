/**
 * pipeline/process-email — one received email through OCR → analysis → matching → status.
 * Everything injected: repos are in-memory fakes, OCR/analysis are stubs.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processEmail, type ProcessDeps } from '@m544/pipeline/process-email';
import { processPendingBatch } from '@m544/pipeline/batch';
import type { AnalysisResult } from '@m544/pipeline/types';
import { FakeEmailsRepo, FakeRequestsRepo, FakeStorageRepo } from '../_fakes/fake-repos';
import { FakeInstitutionsRepo } from '../_fakes/fake-institutions-repo';

const USER = 'u1';

function analysis(over: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    category: 'inregistrate',
    registration_number: '1234/2026',
    registration_date: null,
    response_date: null,
    answer_summary: null,
    extension_days: null,
    extension_reason: null,
    redirected_to: null,
    evidence: 'test',
    confidence: 0.9,
    ...over,
  };
}

function makeDeps(result: AnalysisResult | Error = analysis()) {
  const emails = new FakeEmailsRepo();
  const requests = new FakeRequestsRepo();
  const storage = new FakeStorageRepo();
  const ocr = vi.fn(async () => ({ markdown: 'OCR TEXT nr. 1234/2026', pages: 1, docSizeBytes: 10 }));
  const analyze = vi.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
  const deps: ProcessDeps = { emails, requests, storage, ocr, analyze };
  return { emails, requests, storage, ocr, analyze, deps };
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('processEmail — guards', () => {
  it('returns not-found for an unknown id', async () => {
    const { deps } = makeDeps();
    const r = await processEmail('nope', deps);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/not found/i);
  });

  it('is idempotent: completed emails are returned without reprocessing', async () => {
    const { deps, emails, analyze } = makeDeps();
    const e = emails.seed({ user_id: USER, processing_status: 'completed', category: 'raspunse' });
    const r = await processEmail(e.id, deps);
    expect(r).toMatchObject({ success: true, category: 'raspunse' });
    expect(analyze).not.toHaveBeenCalled();
  });

  it('skips sent emails', async () => {
    const { deps, emails, analyze } = makeDeps();
    const e = emails.seed({ user_id: USER, type: 'sent' });
    const r = await processEmail(e.id, deps);
    expect(r.success).toBe(true);
    expect(r.skipped).toMatch(/not a received/i);
    expect(analyze).not.toHaveBeenCalled();
  });
});

describe('processEmail — happy path', () => {
  it('runs OCR when a PDF is attached and not yet processed, then analysis, matching, status', async () => {
    const { deps, emails, requests, storage, ocr, analyze } = makeDeps();
    const req = requests.seed({ user_id: USER, institution_email: 'reg@primaria.ro' });
    const sent = emails.seed({ user_id: USER, type: 'sent', request_id: req.id, message_id: 'orig@x' });
    storage.files.set(`${USER}/e1/doc.pdf`, { bytes: new Uint8Array([1]), contentType: 'application/pdf' });
    const e = emails.seed({
      id: 'e1',
      user_id: USER,
      from_email: 'Registratura <reg@primaria.ro>',
      body: '<p>Cererea a fost <b>înregistrată</b></p>',
      pdf_file_path: `${USER}/e1/doc.pdf`,
      parent_email_id: sent.id,
      received_at: '2026-09-01T10:00:00.000Z',
    });

    const r = await processEmail(e.id, deps);

    expect(ocr).toHaveBeenCalledTimes(1);
    expect(analyze).toHaveBeenCalledWith(
      expect.objectContaining({ subject: e.subject, body: 'Cererea a fost înregistrată', ocrText: 'OCR TEXT nr. 1234/2026' }),
    );
    expect(r).toMatchObject({ success: true, category: 'inregistrate', matchedRequestId: req.id, matchStrategy: 'thread' });
    expect(r.statusUpdate).toBe('pending → received');

    const stored = await emails.getById(e.id);
    expect(stored?.processing_status).toBe('completed');
    expect(stored?.ocr_processed).toBe(true);
    expect(stored?.ocr_text).toBe('OCR TEXT nr. 1234/2026');
    expect(stored?.category).toBe('inregistrate');
    expect(stored?.registration_number).toBe('1234/2026');
    expect(stored?.request_id).toBe(req.id);
    expect(stored?.error_log).toBeNull();

    const updatedReq = await requests.getById(req.id);
    expect(updatedReq?.status).toBe('received');
    expect(updatedReq?.registration_number).toBe('1234/2026');
    expect(updatedReq?.deadline_date).toBeTruthy();
  });

  it('does not re-run OCR when ocr_processed is already true, but reuses the stored text', async () => {
    const { deps, emails, ocr, analyze } = makeDeps(analysis({ category: 'irelevant', registration_number: null }));
    const e = emails.seed({ user_id: USER, pdf_file_path: 'u1/x/doc.pdf', ocr_processed: true, ocr_text: 'OLD OCR' });
    await processEmail(e.id, deps);
    expect(ocr).not.toHaveBeenCalled();
    expect(analyze).toHaveBeenCalledWith(expect.objectContaining({ ocrText: 'OLD OCR' }));
  });

  it('continues without OCR text when the PDF cannot be downloaded or OCR throws', async () => {
    const { deps, emails, ocr } = makeDeps();
    ocr.mockRejectedValueOnce(new Error('mistral down'));
    const e = emails.seed({ user_id: USER, pdf_file_path: 'missing/path.pdf' });
    const r = await processEmail(e.id, deps);
    expect(r.success).toBe(true);
    const stored = await emails.getById(e.id);
    expect(stored?.ocr_processed).toBe(false);
    expect(stored?.processing_status).toBe('completed');
  });
});

describe('processEmail — categories and matching outcomes', () => {
  it('irelevant: completed, no matching attempted, no request touched', async () => {
    const { deps, emails, requests } = makeDeps(analysis({ category: 'irelevant', registration_number: null }));
    const req = requests.seed({ user_id: USER, institution_email: 'reg@primaria.ro' });
    const e = emails.seed({ user_id: USER, from_email: 'reg@primaria.ro', subject: 'Confirm Your Signup' });
    const r = await processEmail(e.id, deps);
    expect(r).toMatchObject({ success: true, category: 'irelevant' });
    expect(r.matchStrategy).toBeUndefined();
    expect((await emails.getById(e.id))?.processing_status).toBe('completed');
    expect((await requests.getById(req.id))?.status).toBe('pending');
  });

  it('ambiguous context match → completed, unmatched, needs_review flagged', async () => {
    const { deps, emails, requests } = makeDeps(analysis({ registration_number: null }));
    requests.seed({ user_id: USER, institution_email: 'reg@primaria.ro' });
    requests.seed({ user_id: USER, institution_email: 'reg@primaria.ro' });
    const e = emails.seed({ user_id: USER, from_email: 'reg@primaria.ro' });
    const r = await processEmail(e.id, deps);
    expect(r.success).toBe(true);
    expect(r.matchedRequestId).toBeUndefined();
    expect(r.needsReview).toBe(true);
    const stored = await emails.getById(e.id);
    expect(stored?.needs_review).toBe(true);
    expect(stored?.processing_status).toBe('completed');
  });

  it('auto-heals a missing registration number on the matched request', async () => {
    const { deps, emails, requests } = makeDeps(analysis({ category: 'raspunse', answer_summary: { type: 'text', content: 'ok' } }));
    const req = requests.seed({ user_id: USER, status: 'received', institution_email: 'reg@primaria.ro' });
    const e = emails.seed({ user_id: USER, from_email: 'reg@primaria.ro' });
    await processEmail(e.id, deps);
    const updated = await requests.getById(req.id);
    expect(updated?.registration_number).toBe('1234/2026');
    expect(updated?.status).toBe('answered');
  });

  it('redirectionat stores redirected_to on the request and keeps it open', async () => {
    const { deps, emails, requests } = makeDeps(
      analysis({ category: 'redirectionat', redirected_to: 'Consiliul Județean Ilfov' }),
    );
    const req = requests.seed({ user_id: USER, status: 'received', registration_number: '1234/2026' });
    const e = emails.seed({ user_id: USER, from_email: 'x@y.ro' });
    const r = await processEmail(e.id, deps);
    expect(r.matchStrategy).toBe('registration');
    const updated = await requests.getById(req.id);
    expect(updated?.redirected_to).toBe('Consiliul Județean Ilfov');
    expect(updated?.status).toBe('received');
  });
});

describe('processEmail — learning verified institution addresses', () => {
  function withInstitutions(result: AnalysisResult = analysis()) {
    const base = makeDeps(result);
    const institutions = new FakeInstitutionsRepo();
    return { ...base, institutions, deps: { ...base.deps, institutions } };
  }

  it('records the sender address for the matched request institution (source raspuns)', async () => {
    const { deps, emails, requests, institutions } = withInstitutions();
    const req = requests.seed({ user_id: USER, institution_name: 'Primăria Municipiului Pitești', institution_email: 'reg@primariapitesti.ro' });
    const sent = emails.seed({ user_id: USER, type: 'sent', request_id: req.id, message_id: 'orig@x' });
    const e = emails.seed({ user_id: USER, from_email: 'Registratura <Reg@PrimariaPitesti.ro>', parent_email_id: sent.id });
    const r = await processEmail(e.id, deps);
    expect(r.matchedRequestId).toBe(req.id);
    expect(institutions.calls).toEqual([
      { name: 'Primăria Municipiului Pitești', email: 'reg@primariapitesti.ro', source: 'raspuns' },
    ]);
    expect((await institutions.findByName('Primăria Municipiului Pitești'))[0]).toMatchObject({ email: 'reg@primariapitesti.ro', nr_confirmari: 1 });
  });

  it('learns nothing for irelevant emails or when no request matched', async () => {
    const irrelevant = withInstitutions(analysis({ category: 'irelevant', registration_number: null }));
    irrelevant.requests.seed({ user_id: USER, institution_email: 'reg@primaria.ro' });
    const e1 = irrelevant.emails.seed({ user_id: USER, from_email: 'reg@primaria.ro' });
    await processEmail(e1.id, irrelevant.deps);
    expect(irrelevant.institutions.calls).toEqual([]);

    const unmatched = withInstitutions(analysis({ registration_number: null }));
    const e2 = unmatched.emails.seed({ user_id: USER, from_email: 'nobody@nowhere.ro' });
    await processEmail(e2.id, unmatched.deps);
    expect(unmatched.institutions.calls).toEqual([]);
  });

  it('a failing repo is logged and never fails processing; absent repo is a no-op', async () => {
    const { deps, emails, requests, institutions } = withInstitutions();
    institutions.failNext = new Error('institutii_locale down');
    const req = requests.seed({ user_id: USER, institution_email: 'reg@primaria.ro' });
    const sent = emails.seed({ user_id: USER, type: 'sent', request_id: req.id, message_id: 'orig@y' });
    const e = emails.seed({ user_id: USER, from_email: 'reg@primaria.ro', parent_email_id: sent.id });
    const r = await processEmail(e.id, deps);
    expect(r).toMatchObject({ success: true, matchedRequestId: req.id });
    expect((await emails.getById(e.id))?.processing_status).toBe('completed');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('institution'), 'institutii_locale down');

    const plain = makeDeps();
    const req2 = plain.requests.seed({ user_id: USER, institution_email: 'reg@primaria.ro' });
    const e2 = plain.emails.seed({ user_id: USER, from_email: 'reg@primaria.ro' });
    expect((await processEmail(e2.id, plain.deps)).matchedRequestId).toBe(req2.id);
  });
});

describe('processEmail — failures and retries', () => {
  it('analysis failure → pending with retry_count+1 and error_log', async () => {
    const { deps, emails } = makeDeps(new Error('Status 500'));
    const e = emails.seed({ user_id: USER });
    const r = await processEmail(e.id, deps);
    expect(r.success).toBe(false);
    const stored = await emails.getById(e.id);
    expect(stored?.processing_status).toBe('pending');
    expect(stored?.retry_count).toBe(1);
    expect(stored?.error_log).toMatch(/Status 500/);
  });

  it('third failure → failed', async () => {
    const { deps, emails } = makeDeps(new Error('boom'));
    const e = emails.seed({ user_id: USER, retry_count: 2 });
    await processEmail(e.id, deps);
    expect((await emails.getById(e.id))?.processing_status).toBe('failed');
  });
});

describe('processPendingBatch', () => {
  it('processes up to `limit` pending received emails oldest first and summarizes', async () => {
    const { deps, emails, analyze } = makeDeps(analysis({ category: 'irelevant', registration_number: null }));
    const a = emails.seed({ user_id: USER });
    const b = emails.seed({ user_id: USER });
    emails.seed({ user_id: USER, processing_status: 'completed' });
    const summary = await processPendingBatch(1, deps);
    expect(summary).toMatchObject({ processed: 1, successful: 1, failed: 0 });
    expect(summary.results[0].emailId).toBe(a.id);
    expect(analyze).toHaveBeenCalledTimes(1);
    const rest = await processPendingBatch(5, deps);
    expect(rest.results.map((r) => r.emailId)).toEqual([b.id]);
  });

  it('returns processed 0 when nothing is pending', async () => {
    const { deps } = makeDeps();
    expect(await processPendingBatch(5, deps)).toEqual({ processed: 0, successful: 0, failed: 0, results: [] });
  });
});

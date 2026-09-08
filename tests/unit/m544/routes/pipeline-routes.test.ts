/**
 * Contract tests for the pipeline routes (emails/process, cron/process-emails,
 * cron/check-deadlines): auth, body validation, response shapes.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  createProcessEmailHandler,
  createProcessCronHandler,
  createCheckDeadlinesHandler,
} from '@m544/pipeline/handlers';
import type { ProcessDeps } from '@m544/pipeline/process-email';
import { FakeEmailsRepo, FakeRequestsRepo, FakeStorageRepo } from '../_fakes/fake-repos';

const SECRET = 'cron-secret-for-tests-123';

function deps(): ProcessDeps & { emails: FakeEmailsRepo; requests: FakeRequestsRepo } {
  return {
    emails: new FakeEmailsRepo(),
    requests: new FakeRequestsRepo(),
    storage: new FakeStorageRepo(),
    ocr: async () => ({ markdown: '', pages: 0, docSizeBytes: null }),
    analyze: async () => ({
      category: 'irelevant',
      registration_number: null,
      registration_date: null,
      response_date: null,
      answer_summary: null,
      extension_days: null,
      extension_reason: null,
      redirected_to: null,
      evidence: '',
      confidence: 1,
    }),
  };
}

function post(body: unknown, auth: string | null = `Bearer ${SECRET}`) {
  return new NextRequest('http://localhost/api/emails/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth ? { authorization: auth } : {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}
function get(path: string, auth: string | null = `Bearer ${SECRET}`) {
  return new NextRequest(`http://localhost${path}`, { headers: auth ? { authorization: auth } : {} });
}

beforeEach(() => {
  process.env.CRON_SECRET = SECRET;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  delete process.env.CRON_SECRET;
  vi.restoreAllMocks();
});

describe('POST /api/emails/process', () => {
  it('401 without the cron secret', async () => {
    const res = await createProcessEmailHandler(deps)(post({ batch: true }, null));
    expect(res.status).toBe(401);
  });

  it('401 with a wrong secret', async () => {
    const res = await createProcessEmailHandler(deps)(post({ batch: true }, 'Bearer nope'));
    expect(res.status).toBe(401);
  });

  it('500 misconfigured when CRON_SECRET is missing, never open', async () => {
    delete process.env.CRON_SECRET;
    const res = await createProcessEmailHandler(deps)(post({ batch: true }, 'Bearer anything'));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/misconfigur/i);
  });

  it('400 on invalid body (neither email_id nor batch)', async () => {
    const res = await createProcessEmailHandler(deps)(post({}));
    expect(res.status).toBe(400);
    const res2 = await createProcessEmailHandler(deps)(post({ email_id: 'not-a-uuid' }));
    expect(res2.status).toBe(400);
    const res3 = await createProcessEmailHandler(deps)(post('{bad json'));
    expect(res3.status).toBe(400);
  });

  it('processes a single email by id', async () => {
    const d = deps();
    const e = d.emails.seed({ user_id: 'u1' });
    const res = await createProcessEmailHandler(() => d)(post({ email_id: e.id }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ success: true, emailId: e.id, category: 'irelevant' });
  });

  it('single email: unknown id → success false, still 200 (business result, not transport error)', async () => {
    const res = await createProcessEmailHandler(deps)(post({ email_id: '11111111-1111-4111-8111-111111111111' }));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(false);
  });

  it('batch mode honours limit and returns the summary', async () => {
    const d = deps();
    d.emails.seed({ user_id: 'u1' });
    d.emails.seed({ user_id: 'u1' });
    const res = await createProcessEmailHandler(() => d)(post({ batch: true, limit: 1 }));
    expect(await res.json()).toMatchObject({ processed: 1, successful: 1, failed: 0 });
  });
});

describe('GET /api/cron/process-emails', () => {
  it('401 without secret; 200 with summary otherwise', async () => {
    const d = deps();
    d.emails.seed({ user_id: 'u1' });
    expect((await createProcessCronHandler(() => d)(get('/api/cron/process-emails', null))).status).toBe(401);
    const res = await createProcessCronHandler(() => d)(get('/api/cron/process-emails'));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ processed: 1, successful: 1 });
  });
});

describe('GET /api/cron/check-deadlines', () => {
  it('marks overdue requests and reports the count', async () => {
    const d = deps();
    const past = new Date(Date.now() - 86400000).toISOString();
    d.requests.seed({ user_id: 'u1', status: 'received', deadline_date: past });
    d.requests.seed({ user_id: 'u1', status: 'received', deadline_date: new Date(Date.now() + 86400000).toISOString() });
    const res = await createCheckDeadlinesHandler(() => d)(get('/api/cron/check-deadlines'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.delayed_count).toBe(1);
    expect(body.checked_at).toMatch(/^\d{4}-/);
  });

  it('401 without secret', async () => {
    expect((await createCheckDeadlinesHandler(deps)(get('/api/cron/check-deadlines', null))).status).toBe(401);
  });
});

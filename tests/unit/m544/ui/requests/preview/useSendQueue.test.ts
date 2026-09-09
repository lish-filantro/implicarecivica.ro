// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useSendQueue,
  buildSessionRequest,
  buildEmailRequest,
  SEND_DELAY_MS,
  type SendQueueInput,
} from '@m544/ui/requests/preview/useSendQueue';
import { FIXED_SUBJECT } from '@m544/requests/email-template';
import type { QuestionItem, WizardFormData } from '@m544/ui/requests/wizard/types';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const FORM: WizardFormData = {
  solicitantName: 'Ion Popescu',
  solicitantEmail: 'ion@mail.ro',
  solicitantAddress: 'Str. Victoriei 10',
  saveAddress: false,
  institutionName: 'Primăria Pitești',
  institutionEmail: 'registratura@primaria.ro',
  sessionName: 'Transparență',
};

const Q: QuestionItem[] = [
  { id: 'a', category: 'A_FINANCIAR', text: 'Care e bugetul?', isCustom: false, isEdited: false },
  { id: 'b', category: 'B_RESPONSABILITATE', text: 'Cine răspunde?', isCustom: true, isEdited: false },
];

const INPUT: SendQueueInput = { selectedQuestions: Q, formData: FORM, conversationId: 'conv-1' };

type Route = (body: Record<string, unknown>) => Response;
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** A fetch fake routed by URL; every call is recorded as { url, body }. */
function fakeFetch(routes: Record<string, Route>) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : {};
    calls.push({ url, body });
    expect(init?.method).toBe('POST');
    const route = routes[url];
    if (!route) throw new Error(`unrouted ${url}`);
    return route(body);
  }) as unknown as typeof fetch;
  return { fetchFn, calls };
}

const okSend: Route = () => json(200, { success: true });

beforeEach(() => {
  push.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('buildSessionRequest / buildEmailRequest', () => {
  it('creates a new session with the wizard data', () => {
    expect(buildSessionRequest(INPUT)).toEqual({
      url: '/api/sessions/create',
      body: {
        name: 'Transparență',
        subject: FIXED_SUBJECT,
        institution_name: 'Primăria Pitești',
        institution_email: 'registratura@primaria.ro',
        conversation_id: 'conv-1',
        questions: ['Care e bugetul?', 'Cine răspunde?'],
      },
    });
  });

  it('omits empty name and conversation id', () => {
    const { body } = buildSessionRequest({ ...INPUT, conversationId: null, formData: { ...FORM, sessionName: '' } });
    expect(body.name).toBeUndefined();
    expect(body.conversation_id).toBeUndefined();
  });

  it('targets add-requests for an existing session, sending only the questions', () => {
    expect(buildSessionRequest({ ...INPUT, existingSessionId: 'S1' })).toEqual({
      url: '/api/sessions/S1/add-requests',
      body: { questions: ['Care e bugetul?', 'Cine răspunde?'] },
    });
  });

  it('builds the email payload with the HTML body', () => {
    const req = buildEmailRequest('Care e bugetul?', FORM, 'r1');
    expect(req).toMatchObject({ to: 'registratura@primaria.ro', subject: FIXED_SUBJECT, request_id: 'r1' });
    expect(req.body).toContain('Care e bugetul?');
    expect(req.body).toContain('Ion Popescu');
  });
});

describe('useSendQueue', () => {
  it('happy path: creates the session, links it to the conversation, sends sequentially with the 30 s delay, redirects', async () => {
    const { fetchFn, calls } = fakeFetch({
      '/api/sessions/create': () => json(200, { session: { id: 'S9' }, requests: [{ id: 'r1' }, { id: 'r2' }] }),
      '/api/emails/send': okSend,
    });
    const sleep = vi.fn(async (_ms: number) => {});
    const markHandoffSession = vi.fn(async () => {});
    const { result } = renderHook(() => useSendQueue(INPUT, { fetch: fetchFn, sleep, markHandoffSession }));

    expect(result.current.isSending).toBe(false);
    await act(async () => result.current.sendAll());

    expect(calls.map((c) => c.url)).toEqual(['/api/sessions/create', '/api/emails/send', '/api/emails/send']);
    expect(calls[1].body).toMatchObject({ request_id: 'r1', to: FORM.institutionEmail, subject: FIXED_SUBJECT });
    expect(calls[2].body).toMatchObject({ request_id: 'r2' });
    expect(String(calls[1].body.body)).toContain('Care e bugetul?');
    expect(String(calls[2].body.body)).toContain('Cine răspunde?');

    expect(sleep).toHaveBeenCalledTimes(1); // between the two emails only
    expect(sleep).toHaveBeenCalledWith(SEND_DELAY_MS);
    expect(SEND_DELAY_MS).toBe(30_000);

    expect(result.current.progress).toEqual({ sent: 2, total: 2 });
    expect(result.current.sendError).toBeNull();
    expect(result.current.secondsLeft).toBeNull();
    expect(result.current.isSending).toBe(true); // stays "sending" until the redirect unmounts it
    expect(markHandoffSession).toHaveBeenCalledWith('conv-1', 'S9');
    expect(push).toHaveBeenCalledWith('/dashboard');
  });

  it('shows the countdown while waiting between emails', async () => {
    const { fetchFn } = fakeFetch({
      '/api/sessions/create': () => json(200, { requests: [{ id: 'r1' }, { id: 'r2' }] }),
      '/api/emails/send': okSend,
    });
    let release!: () => void;
    const sleep = vi.fn(() => new Promise<void>((resolve) => { release = resolve; }));
    const { result } = renderHook(() => useSendQueue(INPUT, { fetch: fetchFn, sleep }));

    let sending!: Promise<void>;
    await act(async () => {
      sending = result.current.sendAll();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current.isSending).toBe(true);
    expect(result.current.progress).toEqual({ sent: 1, total: 2 });
    expect(result.current.secondsLeft).toBe(30);
    expect(push).not.toHaveBeenCalled();

    await act(async () => {
      release();
      await sending;
    });
    expect(result.current.secondsLeft).toBeNull();
    expect(result.current.progress).toEqual({ sent: 2, total: 2 });
    expect(push).toHaveBeenCalledWith('/dashboard');
  });

  it('add-to-existing-session path posts to /add-requests and then sends, without touching the hand-off', async () => {
    const { fetchFn, calls } = fakeFetch({
      '/api/sessions/S1/add-requests': () => json(200, { session: { id: 'S1' }, requests: [{ id: 'r9' }] }),
      '/api/emails/send': okSend,
    });
    const markHandoffSession = vi.fn(async () => {});
    const { result } = renderHook(() =>
      useSendQueue({ ...INPUT, selectedQuestions: [Q[0]], existingSessionId: 'S1' }, { fetch: fetchFn, sleep: async () => {}, markHandoffSession }),
    );
    await act(async () => result.current.sendAll());
    expect(markHandoffSession).not.toHaveBeenCalled();

    expect(calls[0]).toEqual({ url: '/api/sessions/S1/add-requests', body: { questions: ['Care e bugetul?'] } });
    expect(calls[1].body).toMatchObject({ request_id: 'r9' });
    expect(result.current.progress).toEqual({ sent: 1, total: 1 });
    expect(push).toHaveBeenCalledWith('/dashboard');
  });

  it('surfaces a 429 from session creation as sendError and sends nothing', async () => {
    const { fetchFn, calls } = fakeFetch({
      '/api/sessions/create': () => json(429, { error: 'Limită zilnică atinsă (10/zi)' }),
      '/api/emails/send': okSend,
    });
    const { result } = renderHook(() => useSendQueue(INPUT, { fetch: fetchFn, sleep: async () => {} }));
    await act(async () => result.current.sendAll());

    expect(result.current.sendError).toBe('Limită zilnică atinsă (10/zi)');
    expect(result.current.isSending).toBe(false);
    expect(result.current.secondsLeft).toBeNull();
    expect(calls).toHaveLength(1);
    expect(push).not.toHaveBeenCalled();
  });

  it('surfaces a 404 from add-requests as sendError', async () => {
    const { fetchFn } = fakeFetch({
      '/api/sessions/gone/add-requests': () => json(404, { error: 'Sesiunea nu a fost găsită' }),
    });
    const { result } = renderHook(() =>
      useSendQueue({ ...INPUT, existingSessionId: 'gone' }, { fetch: fetchFn, sleep: async () => {} }),
    );
    await act(async () => result.current.sendAll());
    expect(result.current.sendError).toBe('Sesiunea nu a fost găsită');
  });

  it('falls back to generic messages when the error body is empty or no requests come back', async () => {
    const noBody = fakeFetch({ '/api/sessions/create': () => json(500, {}) });
    const a = renderHook(() => useSendQueue(INPUT, { fetch: noBody.fetchFn, sleep: async () => {} }));
    await act(async () => a.result.current.sendAll());
    expect(a.result.current.sendError).toBe('Eroare la crearea cererilor');

    const empty = fakeFetch({ '/api/sessions/create': () => json(200, { requests: [] }) });
    const b = renderHook(() => useSendQueue(INPUT, { fetch: empty.fetchFn, sleep: async () => {} }));
    await act(async () => b.result.current.sendAll());
    expect(b.result.current.sendError).toBe('Nu s-au creat cererile');
  });

  it('a failed email is logged and not counted, but the run completes', async () => {
    let n = 0;
    const { fetchFn } = fakeFetch({
      '/api/sessions/create': () => json(200, { requests: [{ id: 'r1' }, { id: 'r2' }] }),
      '/api/emails/send': () => (++n === 1 ? new Response('smtp down', { status: 500 }) : okSend({})),
    });
    const { result } = renderHook(() => useSendQueue(INPUT, { fetch: fetchFn, sleep: async () => {} }));
    await act(async () => result.current.sendAll());

    expect(result.current.progress).toEqual({ sent: 1, total: 2 });
    expect(result.current.sendError).toBeNull();
    expect(console.error).toHaveBeenCalledWith('Failed to send email 1:', 'smtp down');
    expect(push).toHaveBeenCalledWith('/dashboard');
  });

  it('a network failure becomes sendError with the thrown message', async () => {
    const fetchFn = vi.fn(async () => { throw new Error('Failed to fetch'); }) as unknown as typeof fetch;
    const { result } = renderHook(() => useSendQueue(INPUT, { fetch: fetchFn, sleep: async () => {} }));
    await act(async () => result.current.sendAll());
    expect(result.current.sendError).toBe('Failed to fetch');
    expect(result.current.isSending).toBe(false);
  });

  it('a failed hand-off link is logged and does not stop the send', async () => {
    const { fetchFn, calls } = fakeFetch({
      '/api/sessions/create': () => json(200, { session: { id: 'S9' }, requests: [{ id: 'r1' }] }),
      '/api/emails/send': okSend,
    });
    const markHandoffSession = vi.fn(async () => {
      throw new Error('column handoff does not exist');
    });
    const { result } = renderHook(() => useSendQueue(INPUT, { fetch: fetchFn, sleep: async () => {}, markHandoffSession }));
    await act(async () => result.current.sendAll());
    expect(console.error).toHaveBeenCalledWith('Failed to link the session to the conversation:', expect.any(Error));
    expect(calls.map((c) => c.url)).toEqual(['/api/sessions/create', '/api/emails/send']);
    expect(push).toHaveBeenCalledWith('/dashboard');
  });
});

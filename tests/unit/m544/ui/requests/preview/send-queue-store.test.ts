// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  startSend,
  getSendQueueState,
  subscribeSendQueue,
  useSendQueueState,
  dismissSendQueue,
  resetSendQueue,
  SEND_DELAY_MS,
  type SendQueueInput,
} from '@m544/ui/requests/preview/send-queue-store';
import type { QuestionItem, WizardFormData } from '@m544/ui/requests/wizard/types';

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

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function fakeFetch(routes: Record<string, () => Response>) {
  const calls: string[] = [];
  const fetchFn = vi.fn(async (url: string) => {
    calls.push(url);
    const route = routes[url];
    if (!route) throw new Error(`unrouted ${url}`);
    return route();
  }) as unknown as typeof fetch;
  return { fetchFn, calls };
}

const twoRequests = () => json(200, { session: { id: 'S9' }, requests: [{ id: 'r1' }, { id: 'r2' }] });
const okSend = () => json(200, { success: true });

beforeEach(() => {
  resetSendQueue();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('send-queue-store', () => {
  it('runs the whole send outside React: status, counter, session id, hand-off link, unload guard', async () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const { fetchFn, calls } = fakeFetch({ '/api/sessions/create': twoRequests, '/api/emails/send': okSend });
    const markHandoffSession = vi.fn(async () => {});
    const seen: string[] = [];
    const unsubscribe = subscribeSendQueue(() => seen.push(getSendQueueState().status));

    const ok = await startSend(INPUT, { fetch: fetchFn, sleep: async () => {}, markHandoffSession });

    expect(ok).toBe(true);
    expect(getSendQueueState()).toMatchObject({ status: 'done', sent: 2, total: 2, secondsLeft: null, sessionId: 'S9', institutionName: 'Primăria Pitești' });
    expect(getSendQueueState().finishedAt).toBeTypeOf('number');
    expect(calls).toEqual(['/api/sessions/create', '/api/emails/send', '/api/emails/send']);
    expect(markHandoffSession).toHaveBeenCalledWith('conv-1', 'S9');
    expect(seen[0]).toBe('sending');
    expect(seen.at(-1)).toBe('done');
    expect(add).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    expect(remove).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    unsubscribe();
  });

  it('refuses a second start while sending, allows one after done or error', async () => {
    let release!: () => void;
    const sleep = vi.fn(() => new Promise<void>((r) => { release = r; }));
    const { fetchFn } = fakeFetch({ '/api/sessions/create': twoRequests, '/api/emails/send': okSend });
    const first = startSend(INPUT, { fetch: fetchFn, sleep, markHandoffSession: async () => {} });
    await new Promise((r) => setTimeout(r, 0));
    expect(getSendQueueState().status).toBe('sending');
    expect(getSendQueueState().secondsLeft).toBe(SEND_DELAY_MS / 1000);

    expect(await startSend(INPUT, { fetch: fetchFn, sleep: async () => {} })).toBe(false);

    release();
    expect(await first).toBe(true);
    expect(getSendQueueState().status).toBe('done');
    expect(await startSend(INPUT, { fetch: fetchFn, sleep: async () => {}, markHandoffSession: async () => {} })).toBe(true);
  });

  it('a failed creation becomes an error state with the API message and releases the guard', async () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { fetchFn, calls } = fakeFetch({ '/api/sessions/create': () => json(429, { error: 'Limită zilnică atinsă' }) });
    expect(await startSend(INPUT, { fetch: fetchFn, sleep: async () => {} })).toBe(false);
    expect(getSendQueueState()).toMatchObject({ status: 'error', error: 'Limită zilnică atinsă', sent: 0 });
    expect(calls).toHaveLength(1);
    expect(remove).toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });

  it('dismiss clears done/error but never an active send; reset clears everything', async () => {
    const { fetchFn } = fakeFetch({ '/api/sessions/create': () => json(500, {}) });
    await startSend(INPUT, { fetch: fetchFn, sleep: async () => {} });
    expect(getSendQueueState().status).toBe('error');
    dismissSendQueue();
    expect(getSendQueueState().status).toBe('idle');

    let release!: () => void;
    const sleep = vi.fn(() => new Promise<void>((r) => { release = r; }));
    const running = fakeFetch({ '/api/sessions/create': twoRequests, '/api/emails/send': okSend });
    const p = startSend(INPUT, { fetch: running.fetchFn, sleep, markHandoffSession: async () => {} });
    await new Promise((r) => setTimeout(r, 0));
    dismissSendQueue();
    expect(getSendQueueState().status).toBe('sending');
    release();
    await p;
    resetSendQueue();
    expect(getSendQueueState().status).toBe('idle');
  });

  it('useSendQueueState re-renders subscribers', async () => {
    const { result } = renderHook(() => useSendQueueState());
    expect(result.current.status).toBe('idle');
    const { fetchFn } = fakeFetch({ '/api/sessions/create': () => json(200, { requests: [{ id: 'r1' }] }), '/api/emails/send': okSend });
    await act(async () => {
      await startSend({ ...INPUT, selectedQuestions: [Q[0]], conversationId: null }, { fetch: fetchFn, sleep: async () => {} });
    });
    expect(result.current).toMatchObject({ status: 'done', sent: 1, total: 1, sessionId: null });
  });
});

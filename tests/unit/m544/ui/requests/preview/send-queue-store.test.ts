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
  retryFailedSends,
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

  it('trimite restul întrebărilor când una eşuează şi reţine motivul (Review Focus 3)', async () => {
    const three: SendQueueInput = {
      ...INPUT,
      selectedQuestions: [...Q, { id: 'c', category: 'A_FINANCIAR', text: 'Câte contracte?', isCustom: true, isEdited: false }],
    };
    let emailCall = 0;
    const { fetchFn } = fakeFetch({
      '/api/sessions/create': () => json(200, { session: { id: 'S9' }, requests: [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }] }),
      '/api/emails/send': () =>
        ++emailCall === 2
          ? json(400, { error: 'Fișierul „doc.pdf” nu mai e disponibil. Atașează-l din nou.' })
          : json(200, { success: true }),
    });
    await startSend(three, { fetch: fetchFn, sleep: async () => {}, markHandoffSession: async () => {} });
    const s = getSendQueueState();
    expect(s.status).toBe('done');
    expect(s.sent).toBe(2);
    expect(s.failures).toEqual([
      { question: 'Cine răspunde?', error: expect.stringContaining('doc.pdf'), retryable: false, requestId: 'r2' },
    ]);
  });

  // Un 504 al platformei poate veni DUPĂ ce emailul a plecat: omul trebuie să ştie să verifice.
  it('un răspuns de eroare care nu e JSON (ex. gateway timeout) spune să verifici dacă cererea a plecat', async () => {
    const { fetchFn } = fakeFetch({
      '/api/sessions/create': twoRequests,
      '/api/emails/send': () => new Response('<html>Gateway Timeout</html>', { status: 504 }),
    });
    await startSend(INPUT, { fetch: fetchFn, sleep: async () => {}, markHandoffSession: async () => {} });
    const s = getSendQueueState();
    expect(s.status).toBe('done');
    expect(s.sent).toBe(0);
    expect(s.failures).toEqual([
      { question: 'Care e bugetul?', error: 'Eroare 504 — serverul nu a răspuns la timp; verifică în dashboard dacă cererea a plecat.', retryable: false, requestId: 'r1' },
      { question: 'Cine răspunde?', error: 'Eroare 504 — serverul nu a răspuns la timp; verifică în dashboard dacă cererea a plecat.', retryable: false, requestId: 'r2' },
    ]);
  });

  // Înainte, o conexiune ruptă oprea toată coada, iar banner-ul sugera redeschiderea
  // previzualizării — adică încă un rând de cereri pentru aceleaşi întrebări.
  it('o conexiune ruptă la un email nu opreşte coada şi nu se oferă la retrimitere', async () => {
    let emailCall = 0;
    const fetchFn = vi.fn(async (url: string) => {
      if (url === '/api/sessions/create') return twoRequests();
      if (++emailCall === 1) throw new TypeError('Failed to fetch');
      return okSend();
    }) as unknown as typeof fetch;
    await startSend(INPUT, { fetch: fetchFn, sleep: async () => {}, markHandoffSession: async () => {} });
    const s = getSendQueueState();
    expect(s).toMatchObject({ status: 'done', sent: 1, total: 2 });
    expect(s.failures).toEqual([
      { question: 'Care e bugetul?', error: expect.stringContaining('verifică în dashboard'), retryable: false, requestId: 'r1' },
    ]);
    expect(await retryFailedSends({ fetch: fetchFn, sleep: async () => {} })).toBe(false);
  });

  it('un 500 care nu e refuzul Resend (poate veni după trimitere) nu se retrimite', async () => {
    const { fetchFn } = fakeFetch({
      '/api/sessions/create': () => json(200, { requests: [{ id: 'r1' }] }),
      '/api/emails/send': () => json(500, { error: 'Eroare internă' }),
    });
    await startSend({ ...INPUT, selectedQuestions: [Q[0]] }, { fetch: fetchFn, sleep: async () => {} });
    expect(getSendQueueState().failures[0].retryable).toBe(false);
  });

  it('retrimite doar ce sigur n-a plecat, pe aceeaşi cerere, fără să creeze altele', async () => {
    const three: SendQueueInput = {
      ...INPUT,
      selectedQuestions: [...Q, { id: 'c', category: 'A_FINANCIAR', text: 'Câte contracte?', isCustom: true, isEdited: false }],
    };
    let emailCall = 0;
    const bodies: Array<{ request_id?: string }> = [];
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/sessions/create') return json(200, { requests: [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }] });
      bodies.push(JSON.parse(String(init?.body)));
      emailCall++;
      if (emailCall === 1) return json(500, { error: 'Eroare la trimitere: rate limited' });
      if (emailCall === 2) return new Response('<html>timeout</html>', { status: 504 });
      return okSend();
    }) as unknown as typeof fetch;

    await startSend(three, { fetch: fetchFn, sleep: async () => {}, markHandoffSession: async () => {} });
    expect(getSendQueueState()).toMatchObject({ sent: 1, total: 3 });
    expect(getSendQueueState().failures.map((f) => f.retryable)).toEqual([true, false]);

    expect(await retryFailedSends({ fetch: fetchFn, sleep: async () => {} })).toBe(true);
    const s = getSendQueueState();
    expect(s).toMatchObject({ status: 'done', sent: 2, total: 3 });
    expect(s.failures).toEqual([expect.objectContaining({ question: 'Cine răspunde?', retryable: false })]);
    expect(bodies.at(-1)?.request_id).toBe('r1');
    expect(fetchFn).toHaveBeenCalledTimes(1 + 3 + 1);
    expect(await retryFailedSends({ fetch: fetchFn, sleep: async () => {} })).toBe(false);
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

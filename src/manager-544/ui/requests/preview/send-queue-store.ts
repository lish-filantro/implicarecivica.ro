'use client';

import { useSyncExternalStore } from 'react';
import { markHandoffSession as defaultMarkHandoffSession } from '@m544/chat/queries.client';
import { buildSessionRequest, buildEmailRequest, type SendQueueInput } from './send-requests';

export { buildSessionRequest, buildEmailRequest, type SendQueueInput } from './send-requests';

/**
 * The send queue lives outside React so closing the preview modal or leaving the
 * wizard page does not stop it: requests are created, then the emails go out one
 * by one with a 30 s pause. Components read it through useSendQueueState(); the
 * global SendQueueBanner shows progress on every authenticated page. A
 * beforeunload guard is held while sending (only a reload can kill the loop).
 */

export const SEND_DELAY_MS = 30_000; // 30 seconds between emails (spam filters)
export const SEND_DELAY_SECONDS = SEND_DELAY_MS / 1000;

export type SendStatus = 'idle' | 'sending' | 'done' | 'error';

export interface SendQueueState {
  status: SendStatus;
  sent: number;
  total: number;
  secondsLeft: number | null;
  error: string | null;
  institutionName: string;
  institutionEmail: string;
  /** The session the requests belong to (existing or just created), once known. */
  sessionId: string | null;
  finishedAt: number | null;
}

export interface SendQueueDeps {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  /** Writes the created session id on the conversation's hand-off (defaults to the browser query). */
  markHandoffSession?: (conversationId: string, sessionId: string) => Promise<void>;
}

interface CreatedRequest {
  id: string;
}

interface CreateResponse {
  session?: { id?: string };
  requests?: CreatedRequest[];
}

const IDLE: SendQueueState = {
  status: 'idle',
  sent: 0,
  total: 0,
  secondsLeft: null,
  error: null,
  institutionName: '',
  institutionEmail: '',
  sessionId: null,
  finishedAt: null,
};

let state: SendQueueState = IDLE;
const listeners = new Set<() => void>();
let countdownTimer: ReturnType<typeof setInterval> | null = null;
let unloadGuard: ((e: BeforeUnloadEvent) => void) | null = null;

function emit(): void {
  for (const listener of listeners) listener();
}

function setState(patch: Partial<SendQueueState>): void {
  state = { ...state, ...patch };
  emit();
}

export function getSendQueueState(): SendQueueState {
  return state;
}

export function subscribeSendQueue(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** React binding of the store. */
export function useSendQueueState(): SendQueueState {
  return useSyncExternalStore(subscribeSendQueue, getSendQueueState, getSendQueueState);
}

/** Clears a finished (done/error) queue, e.g. from the banner's close button. No-op while sending. */
export function dismissSendQueue(): void {
  if (state.status === 'sending') return;
  setState(IDLE);
}

/** Test seam: back to idle unconditionally, timers and guards released. */
export function resetSendQueue(): void {
  stopCountdown();
  holdUnloadGuard(false);
  state = IDLE;
  emit();
}

function holdUnloadGuard(on: boolean): void {
  if (typeof window === 'undefined') return;
  if (on && !unloadGuard) {
    unloadGuard = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', unloadGuard);
  } else if (!on && unloadGuard) {
    window.removeEventListener('beforeunload', unloadGuard);
    unloadGuard = null;
  }
}

function stopCountdown(): void {
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = null;
}

function startCountdown(seconds: number): void {
  stopCountdown();
  setState({ secondsLeft: seconds });
  countdownTimer = setInterval(() => {
    const next = (state.secondsLeft ?? 1) - 1;
    if (next <= 0) {
      stopCountdown();
      setState({ secondsLeft: null });
    } else {
      setState({ secondsLeft: next });
    }
  }, 1000);
}

const defaultFetch: typeof fetch = (...args) => fetch(...args);
const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function postJson(fetchFn: typeof fetch, url: string, body: unknown): Promise<Response> {
  return fetchFn(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

/**
 * Creates the requests (new session or add to an existing one), links a new
 * session to the conversation's hand-off, then sends the emails sequentially.
 * Resolves to true when every step ran (individual email failures are logged and
 * counted, not fatal); false when refused (already sending) or failed.
 */
export async function startSend(input: SendQueueInput, deps: SendQueueDeps = {}): Promise<boolean> {
  if (state.status === 'sending') return false;
  const fetchFn = deps.fetch ?? defaultFetch;
  const sleep = deps.sleep ?? defaultSleep;
  const markHandoffSession = deps.markHandoffSession ?? defaultMarkHandoffSession;
  const { selectedQuestions, formData } = input;

  state = {
    ...IDLE,
    status: 'sending',
    total: selectedQuestions.length,
    institutionName: formData.institutionName,
    institutionEmail: formData.institutionEmail,
    sessionId: input.existingSessionId ?? null,
  };
  emit();
  holdUnloadGuard(true);

  try {
    const { url, body } = buildSessionRequest(input);
    const sessionResponse = await postJson(fetchFn, url, body);
    if (!sessionResponse.ok) {
      const data: { error?: string } = await sessionResponse.json();
      throw new Error(data.error || 'Eroare la crearea cererilor');
    }

    const { session, requests } = (await sessionResponse.json()) as CreateResponse;
    if (!requests?.length) throw new Error('Nu s-au creat cererile');
    if (session?.id) setState({ sessionId: session.id });

    // Link the new session back to the conversation it came from (best effort).
    if (!input.existingSessionId && input.conversationId && session?.id) {
      try {
        await markHandoffSession(input.conversationId, session.id);
      } catch (err) {
        console.error('Failed to link the session to the conversation:', err);
      }
    }

    let sentCount = 0;
    for (let i = 0; i < requests.length; i++) {
      const emailResponse = await postJson(
        fetchFn,
        '/api/emails/send',
        buildEmailRequest(selectedQuestions[i].text, formData, requests[i].id),
      );
      if (!emailResponse.ok) {
        console.error(`Failed to send email ${i + 1}:`, await emailResponse.text());
      } else {
        sentCount++;
      }
      setState({ sent: sentCount, total: requests.length });

      if (i < requests.length - 1) {
        startCountdown(SEND_DELAY_SECONDS);
        await sleep(SEND_DELAY_MS);
        stopCountdown();
        setState({ secondsLeft: null });
      }
    }

    holdUnloadGuard(false);
    setState({ status: 'done', secondsLeft: null, finishedAt: Date.now() });
    return true;
  } catch (error) {
    console.error('Send error:', error);
    stopCountdown();
    holdUnloadGuard(false);
    setState({ status: 'error', error: error instanceof Error ? error.message : 'Eroare la trimitere', secondsLeft: null });
    return false;
  }
}

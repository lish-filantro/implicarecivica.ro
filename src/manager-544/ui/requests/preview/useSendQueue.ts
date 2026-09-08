'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FIXED_SUBJECT, formatEmailBodyHtml } from '@m544/requests/email-template';
import { CHAT_TRANSFER_KEY } from '../wizard/chat-transfer';
import type { QuestionItem, WizardFormData } from '../wizard/types';

export const SEND_DELAY_MS = 30_000; // 30 seconds between emails (spam filters)
export const SEND_DELAY_SECONDS = SEND_DELAY_MS / 1000;

export interface SendQueueInput {
  selectedQuestions: QuestionItem[];
  formData: WizardFormData;
  conversationId: string | null;
  /** When set, questions are appended to this session instead of creating a new one. */
  existingSessionId?: string;
}

export interface SendQueueDeps {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export interface SendProgress {
  sent: number;
  total: number;
}

interface CreatedRequest {
  id: string;
}

const defaultFetch: typeof fetch = (...args) => fetch(...args);
const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Step 1 of the send: where and what to POST to create the requests. */
export function buildSessionRequest(input: SendQueueInput): { url: string; body: Record<string, unknown> } {
  const questions = input.selectedQuestions.map((q) => q.text);
  if (input.existingSessionId) {
    return { url: `/api/sessions/${input.existingSessionId}/add-requests`, body: { questions } };
  }
  const { formData } = input;
  return {
    url: '/api/sessions/create',
    body: {
      name: formData.sessionName || undefined,
      subject: FIXED_SUBJECT,
      institution_name: formData.institutionName,
      institution_email: formData.institutionEmail,
      conversation_id: input.conversationId || undefined,
      questions,
    },
  };
}

/** Step 2 of the send: the body of one /api/emails/send call. */
export function buildEmailRequest(question: string, formData: WizardFormData, requestId: string) {
  return {
    to: formData.institutionEmail,
    subject: FIXED_SUBJECT,
    body: formatEmailBodyHtml(question, formData),
    request_id: requestId,
  };
}

function postJson(fetchFn: typeof fetch, url: string, body: unknown): Promise<Response> {
  return fetchFn(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

/**
 * Creates the requests (new session or add to an existing one) and then sends the
 * emails one by one with a 30 s pause, reporting progress and the countdown.
 * On success clears the chat hand-over and redirects to /dashboard.
 */
export function useSendQueue(input: SendQueueInput, deps: SendQueueDeps = {}) {
  const router = useRouter();
  const fetchFn = deps.fetch ?? defaultFetch;
  const sleep = deps.sleep ?? defaultSleep;

  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState<SendProgress>({ sent: 0, total: 0 });
  const [sendError, setSendError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // Countdown to the next email
  useEffect(() => {
    if (secondsLeft === null || secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => (s ?? 1) - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  // Warn before closing the tab during send
  useEffect(() => {
    if (!isSending) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isSending]);

  const sendAll = useCallback(async () => {
    if (isSending) return;
    const { selectedQuestions, formData } = input;

    setIsSending(true);
    setSendError(null);
    setProgress({ sent: 0, total: selectedQuestions.length });

    try {
      const { url, body } = buildSessionRequest(input);
      const sessionResponse = await postJson(fetchFn, url, body);
      if (!sessionResponse.ok) {
        const data: { error?: string } = await sessionResponse.json();
        throw new Error(data.error || 'Eroare la crearea cererilor');
      }

      const { requests } = (await sessionResponse.json()) as { requests?: CreatedRequest[] };
      if (!requests?.length) throw new Error('Nu s-au creat cererile');

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
        setProgress({ sent: sentCount, total: requests.length });

        if (i < requests.length - 1) {
          setSecondsLeft(SEND_DELAY_SECONDS);
          await sleep(SEND_DELAY_MS);
          setSecondsLeft(null);
        }
      }

      sessionStorage.removeItem(CHAT_TRANSFER_KEY);
      router.push('/dashboard');
    } catch (error) {
      console.error('Send error:', error);
      setSendError(error instanceof Error ? error.message : 'Eroare la trimitere');
      setIsSending(false);
      setSecondsLeft(null);
    }
  }, [isSending, input, fetchFn, sleep, router]);

  return { isSending, progress, secondsLeft, sendError, sendAll };
}

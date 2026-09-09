'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  getSendQueueState,
  startSend,
  useSendQueueState,
  type SendQueueDeps,
  type SendQueueInput,
} from './send-queue-store';

export {
  SEND_DELAY_MS,
  SEND_DELAY_SECONDS,
  buildSessionRequest,
  buildEmailRequest,
  type SendQueueInput,
  type SendQueueDeps,
} from './send-queue-store';

export interface SendProgress {
  sent: number;
  total: number;
}

/**
 * The preview modal's view of the global send queue: starts it and, while this
 * hook is still mounted when the run it started finishes, redirects to /dashboard.
 * If the modal was closed in the meantime the SendQueueBanner takes over.
 */
export function useSendQueue(input: SendQueueInput, deps: SendQueueDeps = {}) {
  const router = useRouter();
  const state = useSendQueueState();
  const inputRef = useRef(input);
  inputRef.current = input;
  const depsRef = useRef(deps);
  depsRef.current = deps;
  const startedHere = useRef(false);
  const redirected = useRef(false);

  useEffect(() => {
    if (state.status === 'done' && startedHere.current && !redirected.current) {
      redirected.current = true;
      router.push('/dashboard');
    }
  }, [state.status, router]);

  const sendAll = useCallback(async () => {
    if (getSendQueueState().status === 'sending') return;
    startedHere.current = true;
    redirected.current = false;
    await startSend(inputRef.current, depsRef.current);
  }, []);

  const isSending = state.status === 'sending' || (state.status === 'done' && startedHere.current);

  return {
    isSending,
    progress: { sent: state.sent, total: state.total } as SendProgress,
    secondsLeft: state.secondsLeft,
    sendError: state.status === 'error' ? state.error : null,
    sendAll,
  };
}

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ChatInstitution, ConversationHandoff } from '@m544/shared/types/chat';
import { extractProblemContext, type HistoryMessage } from '@m544/chat/guardrails/context';
import * as chatQueries from '@m544/chat/queries.client';

/** The subset of chat queries the hook needs (injectable for tests). */
export type HandoffQueries = Pick<
  typeof chatQueries,
  'getConversationHandoff' | 'updateConversationHandoff' | 'updateConversationStep'
>;

export interface UseHandoffOptions {
  conversationId: string | null;
  queries?: HandoffQueries;
  /** Test seam for timestamps. */
  now?: () => Date;
}

/** A fresh (unconfirmed) hand-off from the institution the assistant just identified. */
export function buildHandoff(
  institution: ChatInstitution,
  history: HistoryMessage[],
  now: () => Date = () => new Date(),
): ConversationHandoff {
  const ctx = extractProblemContext(history);
  return {
    institutionName: institution.name,
    institutionEmail: institution.email,
    emailConfidence: institution.confidence,
    sourceUrl: institution.sourceUrl,
    problemContext: { ce: ctx.ce ?? '', unde: ctx.unde ?? '', cand: ctx.cand ?? '' },
    identifiedAt: now().toISOString(),
    confirmedAt: null,
    sessionId: null,
    questions: null,
    questionsModel: null,
  };
}

/**
 * The chat → wizard hand-off of one conversation: loaded with the conversation,
 * replaced when the assistant identifies an institution (unless a request
 * session already exists), confirmed when the user presses "Pregătește cererile".
 * Writes are best-effort: the in-memory value stays even when Supabase fails.
 */
export function useHandoff({ conversationId, queries = chatQueries, now = () => new Date() }: UseHandoffOptions) {
  const [handoff, setHandoff] = useState<ConversationHandoff | null>(null);
  const [loading, setLoading] = useState(false);
  const handoffRef = useRef<ConversationHandoff | null>(null);

  const commit = useCallback((next: ConversationHandoff | null) => {
    handoffRef.current = next;
    setHandoff(next);
  }, []);

  useEffect(() => {
    if (!conversationId) {
      commit(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    queries
      .getConversationHandoff(conversationId)
      .then((loaded) => {
        // A reply may have recorded a hand-off while the load was in flight; keep it.
        if (!cancelled && !handoffRef.current) commit(loaded);
      })
      .catch((err) => console.error('Failed to load handoff:', err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId, queries, commit]);

  /** Called with the assistant's reply that carries an institution. */
  const recordInstitution = useCallback(
    (institution: ChatInstitution, history: HistoryMessage[], convId: string) => {
      if (handoffRef.current?.sessionId) return; // requests already sent from this conversation
      const next = buildHandoff(institution, history, now);
      commit(next);
      queries.updateConversationHandoff(convId, next).catch((err) => console.error('Failed to save handoff:', err));
    },
    [queries, now, commit],
  );

  /** "Pregătește cererile": marks the hand-off confirmed and the conversation STEP_3; resolves to the conversation id. */
  const confirm = useCallback(async (): Promise<string | null> => {
    const current = handoffRef.current;
    if (!current || !conversationId) return null;
    const confirmed: ConversationHandoff = { ...current, confirmedAt: current.confirmedAt ?? now().toISOString() };
    commit(confirmed);
    try {
      await queries.updateConversationHandoff(conversationId, confirmed);
      await queries.updateConversationStep(conversationId, 'STEP_3');
    } catch (err) {
      console.error('Failed to confirm handoff:', err);
    }
    return conversationId;
  }, [conversationId, queries, now, commit]);

  return { handoff, loading, recordInstitution, confirm };
}

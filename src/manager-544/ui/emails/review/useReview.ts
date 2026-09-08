'use client';

/**
 * Client side of POST /api/emails/[id]/review. `post` is injectable so the
 * components can be tested without a network; the default uses fetch.
 * Every action resolves to the refreshed email (and calls `onUpdated`) or to
 * null after setting `error`.
 */
import { useCallback, useState } from 'react';
import type { Email } from '@m544/shared/types/email';
import type { EmailCategory } from '@m544/shared/types/request';

export type ReviewBody =
  | { action: 'assign'; request_id: string }
  | { action: 'reclassify'; category: EmailCategory; note?: string }
  | { action: 'dismiss' };

export type ReviewPost = (emailId: string, body: ReviewBody) => Promise<Email>;

export interface UseReviewOptions {
  post?: ReviewPost;
  onUpdated?: (email: Email) => void;
}

export interface ReviewApi {
  assign: (emailId: string, requestId: string) => Promise<Email | null>;
  reclassify: (emailId: string, category: EmailCategory, note?: string) => Promise<Email | null>;
  dismiss: (emailId: string) => Promise<Email | null>;
  busy: boolean;
  error: string | null;
}

export const REVIEW_ERROR = 'Eroare la revizuire';

export const fetchReviewPost: ReviewPost = async (emailId, body) => {
  const res = await fetch(`/api/emails/${encodeURIComponent(emailId)}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { email?: Email; error?: string };
  if (!res.ok || !data.email) throw new Error(data.error || REVIEW_ERROR);
  return data.email;
};

export function useReview({ post = fetchReviewPost, onUpdated }: UseReviewOptions = {}): ReviewApi {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (emailId: string, body: ReviewBody): Promise<Email | null> => {
      setBusy(true);
      setError(null);
      try {
        const email = await post(emailId, body);
        onUpdated?.(email);
        return email;
      } catch (err) {
        setError(err instanceof Error ? err.message : REVIEW_ERROR);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [post, onUpdated],
  );

  const assign = useCallback((emailId: string, requestId: string) => run(emailId, { action: 'assign', request_id: requestId }), [run]);
  const reclassify = useCallback(
    (emailId: string, category: EmailCategory, note?: string) =>
      run(emailId, note?.trim() ? { action: 'reclassify', category, note: note.trim() } : { action: 'reclassify', category }),
    [run],
  );
  const dismiss = useCallback((emailId: string) => run(emailId, { action: 'dismiss' }), [run]);

  return { assign, reclassify, dismiss, busy, error };
}

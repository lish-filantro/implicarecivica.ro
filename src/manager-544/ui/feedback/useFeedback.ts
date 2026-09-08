'use client';

import { useState, useEffect, useCallback } from 'react';
import { createFeedback, listMyFeedback } from '@m544/feedback/queries.client';
import type { Feedback, FeedbackCategory, CreateFeedbackPayload } from '@m544/shared/types/feedback';

export interface FeedbackDeps {
  createFeedback: (payload: CreateFeedbackPayload) => Promise<Feedback>;
  listMyFeedback: () => Promise<Feedback[]>;
}

const DEFAULT_DEPS: FeedbackDeps = {
  createFeedback: (payload) => createFeedback(payload),
  listMyFeedback: () => listMyFeedback(),
};

/** History + inline form state of the feedback page (moved 1:1 from the page). */
export function useFeedback(deps: FeedbackDeps = DEFAULT_DEPS) {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadFeedback() {
      try {
        const data = await deps.listMyFeedback();
        setFeedback(data);
      } catch (err) {
        console.error('Failed to load feedback:', err);
      } finally {
        setLoading(false);
      }
    }
    loadFeedback();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = useCallback(async () => {
    if (!category || !message.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const newItem = await deps.createFeedback({
        category,
        message: message.trim(),
        page_url: '/feedback',
      });
      setFeedback((prev) => [newItem, ...prev]);
      setCategory(null);
      setMessage('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError('Nu s-a putut trimite feedbackul. Încearcă din nou.');
    } finally {
      setSubmitting(false);
    }
  }, [deps, category, message]);

  return { feedback, loading, category, setCategory, message, setMessage, submitting, success, error, submit };
}

'use client';

import { useState, useEffect } from 'react';
import { createFeedback, listMyFeedback } from '@/lib/supabase/feedback-queries';
import { formatDate } from '@/lib/utils';
import type { Feedback, FeedbackCategory, FeedbackStatus } from '@/lib/types/feedback';

const CATEGORIES: { value: FeedbackCategory; label: string }[] = [
  { value: 'bug', label: 'Bug' },
  { value: 'sugestie', label: 'Sugestie' },
  { value: 'utilizare', label: 'Dificultate' },
  { value: 'altele', label: 'Altele' },
];

const CATEGORY_CONFIG: Record<FeedbackCategory, { label: string; className: string }> = {
  bug: {
    label: 'Bug',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  },
  sugestie: {
    label: 'Sugestie',
    className: 'bg-civic-blue-100 text-civic-blue-700 dark:bg-civic-blue-900/30 dark:text-civic-blue-300',
  },
  utilizare: {
    label: 'Dificultate',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  },
  altele: {
    label: 'Altele',
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  },
};

const STATUS_CONFIG: Record<FeedbackStatus, { label: string; className: string }> = {
  nou: {
    label: 'Nou',
    className: 'bg-civic-blue-100 text-civic-blue-700 dark:bg-civic-blue-900/30 dark:text-civic-blue-300',
  },
  in_lucru: {
    label: 'În lucru',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  },
  rezolvat: {
    label: 'Rezolvat',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  respins: {
    label: 'Respins',
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  },
};

export default function FeedbackPage() {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFeedback();
  }, []);

  async function loadFeedback() {
    try {
      const data = await listMyFeedback();
      setFeedback(data);
    } catch (err) {
      console.error('Failed to load feedback:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!category || !message.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const newItem = await createFeedback({
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
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Feedback
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Ajută-ne să îmbunătățim platforma. Orice sugestie sau problemă contează.
        </p>
      </div>

      {/* Inline feedback form */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-8">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
          Trimite feedback
        </h2>

        {/* Category pills */}
        <div className="mb-4">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 block">
            Categorie
          </label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setCategory(cat.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg
                           border transition-colors duration-200
                           ${category === cat.value
                             ? 'bg-civic-blue-50 dark:bg-civic-blue-900/20 text-civic-blue-700 dark:text-civic-blue-300 border-civic-blue-300 dark:border-civic-blue-700'
                             : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                           }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Message textarea */}
        <div className="mb-4">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 block">
            Mesaj
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Descrie problema, sugestia sau dificultatea..."
            rows={4}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700
                       bg-white dark:bg-gray-900
                       text-sm text-gray-900 dark:text-white
                       placeholder:text-gray-400 dark:placeholder:text-gray-500
                       px-3 py-2.5 focus:outline-none focus:ring-2
                       focus:ring-civic-blue-500/50 resize-none"
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400 mb-3">
            {error}
          </p>
        )}

        {/* Success */}
        {success && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-3">
            Mulțumim! Feedbackul tău a fost înregistrat.
          </p>
        )}

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!category || !message.trim() || submitting}
          className="flex items-center gap-2
                     px-5 py-2 rounded-lg text-sm font-medium
                     bg-civic-blue-600 hover:bg-civic-blue-700
                     dark:bg-civic-blue-500 dark:hover:bg-civic-blue-600
                     text-white transition-colors duration-200
                     disabled:opacity-50 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-civic-blue-500/50"
        >
          {submitting ? (
            <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
          {submitting ? 'Se trimite...' : 'Trimite feedback'}
        </button>
      </div>

      {/* Feedback history */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
          Istoricul feedbackului
        </h2>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-3" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : feedback.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic py-6 text-center">
            Nu ai trimis încă niciun feedback.
          </p>
        ) : (
          <div className="space-y-3">
            {feedback.map((item) => {
              const catConfig = CATEGORY_CONFIG[item.category];
              const statusConfig = STATUS_CONFIG[item.status];
              return (
                <div
                  key={item.id}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700
                             p-4 transition-colors duration-200 hover:border-gray-300 dark:hover:border-gray-600"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${catConfig.className}`}>
                      {catConfig.label}
                    </span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusConfig.className}`}>
                      {statusConfig.label}
                    </span>
                    <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
                      {formatDate(item.created_at, 'relative')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                    {item.message}
                  </p>
                  {item.page_url && (
                    <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                      Pagina: {item.page_url}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

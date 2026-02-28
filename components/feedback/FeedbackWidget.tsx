'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { createFeedback } from '@/lib/supabase/feedback-queries';
import type { FeedbackCategory } from '@/lib/types/feedback';

const CATEGORIES: { value: FeedbackCategory; label: string }[] = [
  { value: 'bug', label: 'Bug' },
  { value: 'sugestie', label: 'Sugestie' },
  { value: 'utilizare', label: 'Dificultate' },
  { value: 'altele', label: 'Altele' },
];

export function FeedbackWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setCategory(null);
    setMessage('');
    setError(null);
    setSuccess(false);
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(resetForm, 300);
  };

  const handleSubmit = async () => {
    if (!category || !message.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      await createFeedback({
        category,
        message: message.trim(),
        page_url: pathname,
      });
      setSuccess(true);
      setTimeout(handleClose, 2000);
    } catch {
      setError('Nu s-a putut trimite feedbackul. Încearcă din nou.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating trigger button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50
                     h-12 w-12 rounded-full
                     bg-civic-blue-600 hover:bg-civic-blue-700
                     dark:bg-civic-blue-500 dark:hover:bg-civic-blue-600
                     text-white shadow-lg hover:shadow-xl
                     transition-all duration-200
                     flex items-center justify-center
                     focus:outline-none focus:ring-2 focus:ring-civic-blue-500/50"
          aria-label="Trimite feedback"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
      )}

      {/* Panel overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-4 sm:p-6">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/20 dark:bg-black/40"
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <div className="relative w-full max-w-sm bg-white dark:bg-gray-800
                          rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700
                          animate-slide-in">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3
                            border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Trimite feedback
              </h3>
              <button
                onClick={handleClose}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600
                           dark:hover:text-gray-300 hover:bg-gray-100
                           dark:hover:bg-gray-700 transition-colors"
                aria-label="Închide"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-4">
              {success ? (
                <div className="text-center py-6">
                  <div className="mx-auto w-10 h-10 rounded-full
                                  bg-emerald-100 dark:bg-emerald-900/30
                                  flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Mulțumim pentru feedback!
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Feedbackul tău a fost înregistrat.
                  </p>
                </div>
              ) : (
                <>
                  {/* Category pills */}
                  <div>
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 block">
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
                  <div>
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      Mesaj
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Descrie pe scurt..."
                      rows={3}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700
                                 bg-white dark:bg-gray-900
                                 text-sm text-gray-900 dark:text-white
                                 placeholder:text-gray-400 dark:placeholder:text-gray-500
                                 px-3 py-2 focus:outline-none focus:ring-2
                                 focus:ring-civic-blue-500/50 resize-none"
                    />
                  </div>

                  {/* Error */}
                  {error && (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      {error}
                    </p>
                  )}

                  {/* Submit */}
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!category || !message.trim() || submitting}
                    className="w-full flex items-center justify-center gap-2
                               px-4 py-2 rounded-lg text-sm font-medium
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
                    {submitting ? 'Se trimite...' : 'Trimite'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

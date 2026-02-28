'use client';

import { useState, useEffect } from 'react';
import { listMyFeedback } from '@/lib/supabase/feedback-queries';
import { formatDate } from '@/lib/utils';
import type { Feedback, FeedbackCategory, FeedbackStatus } from '@/lib/types/feedback';

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

  useEffect(() => {
    async function load() {
      try {
        const data = await listMyFeedback();
        setFeedback(data);
      } catch (err) {
        console.error('Failed to load feedback:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Feedbackul meu
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Istoricul feedbackului trimis. Folosește butonul din colțul din dreapta-jos pentru a trimite feedback nou.
        </p>
      </div>

      {/* Loading */}
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
        /* Empty state */
        <div className="text-center py-16">
          <div className="p-4 rounded-full bg-civic-blue-50 dark:bg-civic-blue-900/20 inline-block mb-4">
            <svg className="h-8 w-8 text-civic-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Niciun feedback trimis
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-sm mx-auto">
            Folosește butonul din colțul din dreapta-jos pentru a trimite primul tău feedback.
          </p>
        </div>
      ) : (
        /* Feedback list */
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
  );
}

'use client';

import type { FeedbackCategory } from '@m544/shared/types/feedback';
import { CATEGORIES } from './feedback-config';

interface FeedbackFormProps {
  category: FeedbackCategory | null;
  onCategoryChange: (category: FeedbackCategory) => void;
  message: string;
  onMessageChange: (message: string) => void;
  submitting: boolean;
  success: boolean;
  error: string | null;
  onSubmit: () => void;
}

export default function FeedbackForm({
  category,
  onCategoryChange,
  message,
  onMessageChange,
  submitting,
  success,
  error,
  onSubmit,
}: FeedbackFormProps) {
  return (
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
              onClick={() => onCategoryChange(cat.value)}
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
          onChange={(e) => onMessageChange(e.target.value)}
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
        onClick={onSubmit}
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
  );
}

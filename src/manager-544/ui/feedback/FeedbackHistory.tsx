'use client';

import { formatDate } from '@/lib/utils';
import type { Feedback } from '@m544/shared/types/feedback';
import { CATEGORY_CONFIG, STATUS_CONFIG } from './feedback-config';

export default function FeedbackHistory({ feedback, loading }: { feedback: Feedback[]; loading: boolean }) {
  return (
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
  );
}

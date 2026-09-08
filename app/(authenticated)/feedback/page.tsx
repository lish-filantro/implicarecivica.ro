'use client';

import { useFeedback } from '@m544/ui/feedback/useFeedback';
import FeedbackForm from '@m544/ui/feedback/FeedbackForm';
import FeedbackHistory from '@m544/ui/feedback/FeedbackHistory';

export default function FeedbackPage() {
  const { feedback, loading, category, setCategory, message, setMessage, submitting, success, error, submit } =
    useFeedback();

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
      <FeedbackForm
        category={category}
        onCategoryChange={setCategory}
        message={message}
        onMessageChange={setMessage}
        submitting={submitting}
        success={success}
        error={error}
        onSubmit={submit}
      />

      {/* Feedback history */}
      <FeedbackHistory feedback={feedback} loading={loading} />
    </div>
  );
}

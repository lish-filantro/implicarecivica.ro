'use client';

import React, { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useRequestWizard } from '@m544/ui/requests/wizard/useRequestWizard';
import { useAddRequestsPage } from '@m544/ui/requests/add/useAddRequestsPage';
import { useQuestionGeneration } from '@m544/ui/requests/wizard/useQuestionGeneration';
import { SessionInfoCard } from '@m544/ui/requests/add/SessionInfoCard';
import { RateLimitInfo } from '@m544/ui/requests/add/RateLimitInfo';
import { AddRequestsQuestions } from '@m544/ui/requests/add/AddRequestsQuestions';
import { PreviewModal } from '@m544/ui/requests/preview/PreviewModal';
import { LoadingSpinner } from '@/components/shared/loading-spinner';

function AddRequestsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('session');

  const wizard = useRequestWizard();
  const { session, loading, error, rateLimit } = useAddRequestsPage(sessionId, wizard);

  // New questions on the chat model, aware of what this session already sent; started by the button.
  const questionGen = useQuestionGeneration({
    source: session ? { sessionId: session.id } : null,
    autoStart: false,
    problemContext: null,
    institutionName: session?.institution_name ?? null,
    onCategoryReady: wizard.setQuestionsForCategory,
  });

  const showPreview = wizard.currentStep === 3;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
        <p className="text-protest-red-600 dark:text-protest-red-400">{error || 'Sesiune negăsită'}</p>
        <button
          onClick={() => router.push('/dashboard')}
          className="mt-4 text-sm text-civic-blue-600 dark:text-civic-blue-400 hover:underline"
        >
          Înapoi la dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-3 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Înapoi la dashboard
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Trimite alte cereri
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Adaugă întrebări noi la sesiunea existentă
        </p>
      </div>

      {/* Session info card (read-only) */}
      <SessionInfoCard session={session} />

      {/* Rate limit info */}
      {rateLimit !== null && <RateLimitInfo rateLimit={rateLimit} />}

      {/* Questions — direct step 2 */}
      {rateLimit === null || rateLimit.remaining > 0 ? (
        <AddRequestsQuestions
          wizard={wizard}
          questionGen={questionGen}
          rateLimit={rateLimit}
          onBack={() => router.push('/dashboard')}
        />
      ) : null}

      {/* Preview modal */}
      {showPreview && (
        <PreviewModal
          wizard={wizard}
          onClose={() => wizard.setStep(2)}
          existingSessionId={session.id}
        />
      )}
    </div>
  );
}

export default function AddRequestsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh]">
          <LoadingSpinner size="lg" />
        </div>
      }
    >
      <AddRequestsContent />
    </Suspense>
  );
}

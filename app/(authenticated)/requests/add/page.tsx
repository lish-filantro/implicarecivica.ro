'use client';

import React, { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useRequestWizard } from '@m544/ui/requests/wizard/useRequestWizard';
import { useAddRequestsPage } from '@m544/ui/requests/add/useAddRequestsPage';
import { SessionInfoCard } from '@m544/ui/requests/add/SessionInfoCard';
import { RateLimitInfo } from '@m544/ui/requests/add/RateLimitInfo';
import { QuestionCategoryList } from '@m544/ui/requests/questions/QuestionCategoryList';
import { StickyActionBar } from '@m544/ui/requests/wizard/StickyActionBar';
import { PreviewModal } from '@m544/ui/requests/preview/PreviewModal';
import { LoadingSpinner } from '@/components/shared/loading-spinner';

function AddRequestsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('session');

  const wizard = useRequestWizard();
  const { session, loading, error, rateLimit } = useAddRequestsPage(sessionId, wizard);

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
        <div className="space-y-6 pb-24">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              Adaugă întrebări noi
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Adaugă întrebările pe care dorești să le trimiți instituției.
            </p>
          </div>

          <QuestionCategoryList wizard={wizard} />

          <StickyActionBar
            selectedCount={wizard.selectedCount}
            onBack={() => router.push('/dashboard')}
            onPreview={() => wizard.setStep(3)}
            isDisabled={!wizard.canProceedToStep3 || (rateLimit !== null && wizard.selectedCount > rateLimit.remaining)}
            dailyLimitInfo={rateLimit ? { remaining: rateLimit.remaining } : undefined}
          />
        </div>
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

'use client';

import React, { useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRequestWizard } from '@m544/ui/requests/wizard/useRequestWizard';
import { useQuestionGeneration } from '@m544/ui/requests/wizard/useQuestionGeneration';
import { readChatTransferData } from '@m544/ui/requests/wizard/chat-transfer';
import { StepperBar } from '@m544/ui/requests/wizard/StepperBar';
import { StepFormData } from '@m544/ui/requests/wizard/StepFormData';
import { StepSelectQuestions } from '@m544/ui/requests/wizard/StepSelectQuestions';
import { PreviewModal } from '@m544/ui/requests/preview/PreviewModal';
import { LoadingSpinner } from '@/components/shared/loading-spinner';

function NewRequestContent() {
  const searchParams = useSearchParams();
  const fromChat = searchParams.get('from') === 'chat';

  // Read chat data from sessionStorage (set by chat page before redirect)
  const chatData = useMemo(
    () => readChatTransferData(fromChat, typeof window === 'undefined' ? null : window.sessionStorage),
    [fromChat],
  );

  const wizard = useRequestWizard({
    initialChatData: chatData ? {
      institutionName: chatData.institutionName,
      institutionEmail: chatData.institutionEmail,
      conversationId: chatData.conversationId,
    } : null,
  });

  const questionGen = useQuestionGeneration({
    problemContext: chatData?.problemContext || null,
    institutionName: chatData?.institutionName || null,
    onCategoryReady: wizard.setQuestionsForCategory,
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Trimite Cereri
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Formulează și trimite cereri de informații publice conform Legii 544/2001
        </p>
      </div>

      <StepperBar currentStep={wizard.currentStep} />

      {wizard.currentStep === 1 && (
        <StepFormData wizard={wizard} />
      )}

      {wizard.currentStep === 2 && (
        <StepSelectQuestions
          wizard={wizard}
          questionGen={questionGen}
          fromChat={fromChat}
        />
      )}

      {wizard.currentStep === 3 && (
        <PreviewModal
          wizard={wizard}
          onClose={() => wizard.setStep(2)}
        />
      )}
    </div>
  );
}

export default function NewRequestPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh]">
          <LoadingSpinner size="lg" />
        </div>
      }
    >
      <NewRequestContent />
    </Suspense>
  );
}

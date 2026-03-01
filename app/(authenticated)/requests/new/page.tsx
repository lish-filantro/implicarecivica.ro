'use client';

import React, { useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRequestWizard } from '@/lib/hooks/useRequestWizard';
import { useQuestionGeneration } from '@/lib/hooks/useQuestionGeneration';
import { StepperBar } from '@/components/requests/StepperBar';
import { StepFormData } from '@/components/requests/StepFormData';
import { StepSelectQuestions } from '@/components/requests/StepSelectQuestions';
import { PreviewModal } from '@/components/requests/PreviewModal';
import { LoadingSpinner } from '@/components/shared/loading-spinner';

interface ChatTransferData {
  institutionName?: string;
  institutionEmail?: string;
  problemContext?: {
    ce: string;
    unde: string;
    cand: string;
  };
  conversationId?: string;
}

function NewRequestContent() {
  const searchParams = useSearchParams();
  const fromChat = searchParams.get('from') === 'chat';

  // Read chat data from sessionStorage (set by chat page before redirect)
  const chatData = useMemo<ChatTransferData | null>(() => {
    if (!fromChat) return null;
    try {
      const raw = sessionStorage.getItem('requestWizardData');
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore parse errors
    }
    return null;
  }, [fromChat]);

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

  // Auto-advance to step 2 if coming from chat (data is pre-filled)
  useEffect(() => {
    if (fromChat && chatData?.institutionName) {
      // Small delay to allow profile loading in StepFormData
      const timer = setTimeout(() => {
        // Don't auto-advance — let user verify data first
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [fromChat, chatData]);

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

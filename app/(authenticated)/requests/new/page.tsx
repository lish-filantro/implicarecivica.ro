'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ConversationHandoff } from '@m544/shared/types/chat';
import { getConversationHandoff } from '@m544/chat/queries.client';
import { getProfile } from '@m544/emails/profile-queries.client';
import { useRequestWizard } from '@m544/ui/requests/wizard/useRequestWizard';
import { useQuestionGeneration } from '@m544/ui/requests/wizard/useQuestionGeneration';
import { decideStartStep, formFromHandoff } from '@m544/ui/requests/wizard/handoff-entry';
import type { WizardProfile } from '@m544/ui/requests/wizard/types';
import { StepperBar } from '@m544/ui/requests/wizard/StepperBar';
import { StepFormData } from '@m544/ui/requests/wizard/StepFormData';
import { StepSelectQuestions } from '@m544/ui/requests/wizard/StepSelectQuestions';
import { PreviewModal } from '@m544/ui/requests/preview/PreviewModal';
import { LoadingSpinner } from '@/components/shared/loading-spinner';

/** What the wizard is entered with: nothing (manual), or a conversation's hand-off + the profile. */
interface WizardEntry {
  conversationId: string | null;
  handoff: ConversationHandoff | null;
  profile: WizardProfile | null;
}

const MANUAL_ENTRY: WizardEntry = { conversationId: null, handoff: null, profile: null };

function Spinner() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <LoadingSpinner size="lg" />
    </div>
  );
}

/** Loads the hand-off and the profile for ?conversation=<id>; without the param the wizard starts empty. */
function NewRequestContent() {
  const searchParams = useSearchParams();
  const conversationId = searchParams.get('conversation');
  const [entry, setEntry] = useState<WizardEntry | null>(conversationId ? null : MANUAL_ENTRY);

  useEffect(() => {
    if (!conversationId) {
      setEntry(MANUAL_ENTRY);
      return;
    }
    let cancelled = false;
    setEntry(null);
    Promise.all([
      getConversationHandoff(conversationId).catch((err) => {
        console.error('Failed to load the conversation hand-off:', err);
        return null;
      }),
      getProfile().catch((err) => {
        console.error('Failed to load profile:', err);
        return null;
      }),
    ]).then(([handoff, profile]) => {
      if (!cancelled) setEntry({ conversationId, handoff, profile });
    });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  if (!entry) return <Spinner />;
  return <WizardBody entry={entry} />;
}

/** The wizard itself; mounted once the entry is known so the hooks start on the right step. */
function WizardBody({ entry }: { entry: WizardEntry }) {
  const { conversationId, handoff, profile } = entry;
  const fromChat = Boolean(handoff);

  const wizard = useRequestWizard({
    initialChatData: handoff ? formFromHandoff(handoff, conversationId) : null,
    initialStep: decideStartStep(handoff, profile),
  });

  // Step 1 pre-fills from the profile when it mounts; when it is skipped, do it here.
  const { initFormFromProfile } = wizard;
  useEffect(() => {
    if (profile) initFormFromProfile(profile);
  }, [profile, initFormFromProfile]);

  const questionGen = useQuestionGeneration({
    source: handoff && conversationId ? { conversationId } : null,
    preloaded: handoff?.questions ?? null,
    problemContext: handoff?.problemContext ?? null,
    institutionName: handoff?.institutionName ?? null,
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

      {conversationId && !handoff && (
        <p
          role="note"
          className="mb-6 text-sm text-gray-700 dark:text-gray-300 bg-activist-orange-50 dark:bg-activist-orange-900/20 border border-activist-orange-200 dark:border-activist-orange-900/40 rounded-xl px-4 py-3"
        >
          Conversația nu are o instituție confirmată. Completează datele manual.
        </p>
      )}

      <StepperBar currentStep={wizard.currentStep} />

      {wizard.currentStep === 1 && (
        <StepFormData wizard={wizard} highlightMissing={fromChat} />
      )}

      {wizard.currentStep === 2 && (
        <StepSelectQuestions
          wizard={wizard}
          questionGen={questionGen}
          fromChat={fromChat}
          summary={fromChat ? { onEdit: () => wizard.setStep(1) } : undefined}
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
    <Suspense fallback={<Spinner />}>
      <NewRequestContent />
    </Suspense>
  );
}

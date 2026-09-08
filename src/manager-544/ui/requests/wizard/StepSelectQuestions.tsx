'use client';

import React from 'react';
import type { RequestWizard } from './useRequestWizard';
import type { useQuestionGeneration } from './useQuestionGeneration';
import { QuestionCategoryList } from '../questions/QuestionCategoryList';
import { StickyActionBar } from './StickyActionBar';

interface StepSelectQuestionsProps {
  wizard: RequestWizard;
  questionGen: ReturnType<typeof useQuestionGeneration>;
  fromChat: boolean;
}

export function StepSelectQuestions({ wizard, questionGen, fromChat }: StepSelectQuestionsProps) {
  return (
    <div className="space-y-6 pb-24">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          Selectează întrebările
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {fromChat
            ? 'Alege întrebările pe care dorești să le trimiți. Poți edita sau adăuga întrebări noi.'
            : 'Adaugă întrebările pe care dorești să le trimiți instituției.'
          }
        </p>
      </div>

      <QuestionCategoryList wizard={wizard} isCategoryLoading={(cat) => questionGen.categories[cat].isLoading} />

      <StickyActionBar
        selectedCount={wizard.selectedCount}
        onBack={() => wizard.setStep(1)}
        onPreview={() => wizard.setStep(3)}
        isDisabled={!wizard.canProceedToStep3}
      />
    </div>
  );
}

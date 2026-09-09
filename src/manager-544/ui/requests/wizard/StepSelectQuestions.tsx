'use client';

import React from 'react';
import type { RequestWizard } from './useRequestWizard';
import type { useQuestionGeneration } from './useQuestionGeneration';
import { QuestionCategoryList } from '../questions/QuestionCategoryList';
import { StickyActionBar } from './StickyActionBar';
import { WizardSummaryCard } from './WizardSummaryCard';
import { RECOMMENDED_MAX_SELECTED } from './types';

interface StepSelectQuestionsProps {
  wizard: RequestWizard;
  questionGen: ReturnType<typeof useQuestionGeneration>;
  fromChat: boolean;
  /** When the wizard started at step 2: the step-1 recap with "Modifică". */
  summary?: { onEdit: () => void };
}

export function StepSelectQuestions({ wizard, questionGen, fromChat, summary }: StepSelectQuestionsProps) {
  return (
    <div className="space-y-6 pb-24">
      {summary && <WizardSummaryCard formData={wizard.formData} onEdit={summary.onEdit} />}

      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          Selectează întrebările
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {fromChat
            ? 'Alege întrebările pe care dorești să le trimiți. Poți edita sau adăuga întrebări noi.'
            : 'Adaugă întrebările pe care dorești să le trimiți instituției.'
          }{' '}
          Recomandăm cel mult {RECOMMENDED_MAX_SELECTED} întrebări trimise odată.
        </p>
      </div>

      {questionGen.setError && (
        <div
          role="alert"
          className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-protest-red-200 dark:border-protest-red-900/40 bg-protest-red-50 dark:bg-protest-red-900/20 px-4 py-3"
        >
          <p className="text-sm text-protest-red-700 dark:text-protest-red-300 sm:mr-auto">{questionGen.setError}</p>
          <button
            type="button"
            onClick={questionGen.retry}
            disabled={questionGen.isAnyLoading}
            className="px-4 py-2 min-h-[40px] text-sm font-medium bg-civic-blue-600 hover:bg-civic-blue-700 text-white rounded-lg transition-colors disabled:bg-gray-400"
          >
            Reîncearcă
          </button>
        </div>
      )}

      {questionGen.notice && (
        <p role="note" className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2">
          {questionGen.notice}
        </p>
      )}

      <QuestionCategoryList wizard={wizard} isCategoryLoading={(cat) => questionGen.categories[cat].isLoading} />

      <StickyActionBar
        selectedCount={wizard.selectedCount}
        onBack={() => wizard.setStep(1)}
        onPreview={() => wizard.setStep(3)}
        isDisabled={!wizard.canProceedToStep3}
        recommendedMax={RECOMMENDED_MAX_SELECTED}
      />
    </div>
  );
}

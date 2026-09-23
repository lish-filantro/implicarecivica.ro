'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';
import { QuestionCategoryList } from '../questions/QuestionCategoryList';
import { StickyActionBar } from '../wizard/StickyActionBar';
import { AttachmentsBusyHint } from '../wizard/AttachmentsBusyHint';
import { RECOMMENDED_MAX_SELECTED } from '../wizard/types';
import type { RequestWizard } from '../wizard/useRequestWizard';
import type { useQuestionGeneration } from '../wizard/useQuestionGeneration';
import type { RateLimitInfo } from '../rate-limit';

interface AddRequestsQuestionsProps {
  wizard: RequestWizard;
  questionGen: ReturnType<typeof useQuestionGeneration>;
  rateLimit: RateLimitInfo | null;
  onBack: () => void;
}

/**
 * Corpul „adaugă întrebări la o sesiune existentă" al /requests/add — extras din pagină ca să fie
 * testabil fără plumbing-ul ei (search params, încărcarea sesiunii). Foloseşte acelaşi
 * AttachmentsBusyHint ca StepSelectQuestions, ca cele două drumuri să nu se dezacordeze pe motivul
 * pentru care previzualizarea e blocată.
 */
export function AddRequestsQuestions({ wizard, questionGen, rateLimit, onBack }: AddRequestsQuestionsProps) {
  return (
    <div className="space-y-6 pb-24">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          Adaugă întrebări noi
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Adaugă întrebările pe care dorești să le trimiți instituției, sau lasă asistentul să propună altele.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <button
          type="button"
          onClick={questionGen.start}
          disabled={questionGen.isAnyLoading}
          className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] text-sm font-medium bg-grassroots-green-500 hover:bg-grassroots-green-600 text-white rounded-lg transition-colors shadow-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          <Sparkles className="h-4 w-4" />
          {questionGen.isAnyLoading
            ? 'Se generează…'
            : questionGen.totalGenerated > 0
              ? 'Generează alte întrebări'
              : 'Generează întrebări noi'}
        </button>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Întrebările propuse țin cont de cele trimise deja în această sesiune.
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

      <QuestionCategoryList wizard={wizard} isCategoryLoading={(cat) => questionGen.categories[cat].isLoading} />

      <AttachmentsBusyHint show={wizard.hasBusyAttachments && wizard.selectedCount > 0} />

      <StickyActionBar
        selectedCount={wizard.selectedCount}
        onBack={onBack}
        onPreview={() => wizard.setStep(3)}
        isDisabled={!wizard.canProceedToStep3 || (rateLimit !== null && wizard.selectedCount > rateLimit.remaining)}
        dailyLimitInfo={rateLimit ? { remaining: rateLimit.remaining } : undefined}
        recommendedMax={RECOMMENDED_MAX_SELECTED}
      />
    </div>
  );
}

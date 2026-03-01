'use client';

import React from 'react';
import { CATEGORIES } from '@/lib/hooks/useRequestWizard';
import type { useRequestWizard } from '@/lib/hooks/useRequestWizard';
import type { useQuestionGeneration } from '@/lib/hooks/useQuestionGeneration';
import { QuestionCategory } from './QuestionCategory';
import { StickyActionBar } from './StickyActionBar';

interface StepSelectQuestionsProps {
  wizard: ReturnType<typeof useRequestWizard>;
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

      <div className="space-y-3">
        {CATEGORIES.map(cat => (
          <QuestionCategory
            key={cat.id}
            category={cat}
            questions={wizard.questions[cat.id]}
            selectedIds={wizard.selectedQuestionIds}
            selectedCount={wizard.selectedCountByCategory[cat.id]}
            isLoading={questionGen.categories[cat.id].isLoading}
            onToggle={wizard.toggleQuestion}
            onSelectAll={() => wizard.selectAllInCategory(cat.id)}
            onDeselectAll={() => wizard.deselectAllInCategory(cat.id)}
            onEdit={wizard.editQuestion}
            onAddCustom={(text) => wizard.addCustomQuestion(cat.id, text)}
            onRemove={wizard.removeQuestion}
          />
        ))}
      </div>

      <StickyActionBar
        selectedCount={wizard.selectedCount}
        onBack={() => wizard.setStep(1)}
        onPreview={() => wizard.setStep(3)}
        isDisabled={!wizard.canProceedToStep3}
      />
    </div>
  );
}

'use client';

import React from 'react';
import { CATEGORIES } from '../wizard/types';
import type { QuestionCategory as QCat } from '../wizard/types';
import type { RequestWizard } from '../wizard/useRequestWizard';
import { QuestionCategory } from './QuestionCategory';

interface QuestionCategoryListProps {
  wizard: RequestWizard;
  /** Per-category generation state (defaults to not loading, e.g. on /requests/add). */
  isCategoryLoading?: (category: QCat) => boolean;
}

/** The five category accordions wired to the wizard (shared by /requests/new and /requests/add). */
export function QuestionCategoryList({ wizard, isCategoryLoading }: QuestionCategoryListProps) {
  return (
    <div className="space-y-3">
      {CATEGORIES.map(cat => (
        <QuestionCategory
          key={cat.id}
          category={cat}
          questions={wizard.questions[cat.id]}
          selectedIds={wizard.selectedQuestionIds}
          selectedCount={wizard.selectedCountByCategory[cat.id]}
          isLoading={isCategoryLoading ? isCategoryLoading(cat.id) : false}
          onToggle={wizard.toggleQuestion}
          onSelectAll={() => wizard.selectAllInCategory(cat.id)}
          onDeselectAll={() => wizard.deselectAllInCategory(cat.id)}
          onEdit={wizard.editQuestion}
          onAddCustom={(text) => wizard.addCustomQuestion(cat.id, text)}
          onRemove={wizard.removeQuestion}
        />
      ))}
    </div>
  );
}

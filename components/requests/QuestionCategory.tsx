'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { QuestionItem } from './QuestionItem';
import type { QuestionItem as QuestionItemType, QuestionCategory as QCat } from '@/lib/hooks/useRequestWizard';

interface QuestionCategoryProps {
  category: { id: QCat; label: string; description: string };
  questions: QuestionItemType[];
  selectedIds: Set<string>;
  selectedCount: number;
  isLoading: boolean;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onEdit: (id: string, text: string) => void;
  onAddCustom: (text: string) => void;
  onRemove: (id: string) => void;
}

export function QuestionCategory({
  category,
  questions,
  selectedIds,
  selectedCount,
  isLoading,
  onToggle,
  onSelectAll,
  onDeselectAll,
  onEdit,
  onAddCustom,
  onRemove,
}: QuestionCategoryProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customText, setCustomText] = useState('');

  const totalCount = questions.length;
  const allSelected = totalCount > 0 && selectedCount === totalCount;

  const handleAddCustom = () => {
    const trimmed = customText.trim();
    if (trimmed) {
      onAddCustom(trimmed);
      setCustomText('');
      setIsAddingCustom(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-shadow hover:shadow-md">
      {/* Header — always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-500 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-500 flex-shrink-0" />
          )}
          <div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {category.label}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 hidden sm:inline">
              {category.description}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isLoading ? (
            <span className="text-xs text-gray-400 animate-pulse">Se generează...</span>
          ) : (
            <Badge
              variant={selectedCount > 0 ? 'default' : 'outline'}
              className={selectedCount > 0 ? 'bg-civic-blue-100 text-civic-blue-800 dark:bg-civic-blue-900/30 dark:text-civic-blue-300 border-0' : ''}
            >
              {selectedCount}/{totalCount}
            </Badge>
          )}
        </div>
      </button>

      {/* Body — expandable */}
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          {/* Select all / Deselect */}
          {totalCount > 0 && (
            <div className="px-5 py-2 flex gap-3 border-b border-gray-100 dark:border-gray-700/50">
              <button
                onClick={allSelected ? onDeselectAll : onSelectAll}
                className="text-xs font-medium text-civic-blue-600 dark:text-civic-blue-400 hover:text-civic-blue-800 dark:hover:text-civic-blue-300 transition-colors"
              >
                {allSelected ? 'Deselectează toate' : 'Selectează toate'}
              </button>
            </div>
          )}

          {/* Loading skeleton */}
          {isLoading && (
            <div className="px-5 py-3 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-start gap-3 animate-pulse">
                  <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Question list */}
          {!isLoading && (
            <div className="px-2 py-1">
              {questions.length === 0 && (
                <p className="px-5 py-4 text-sm text-gray-400 dark:text-gray-500 text-center">
                  Nicio întrebare. Adaugă una mai jos.
                </p>
              )}
              {questions.map(q => (
                <QuestionItem
                  key={q.id}
                  question={q}
                  isSelected={selectedIds.has(q.id)}
                  onToggle={() => onToggle(q.id)}
                  onEdit={(text) => onEdit(q.id, text)}
                  onRemove={q.isCustom ? () => onRemove(q.id) : undefined}
                />
              ))}
            </div>
          )}

          {/* Add custom question */}
          {!isLoading && (
            <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700/50">
              {isAddingCustom ? (
                <div className="space-y-2">
                  <textarea
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    placeholder="Scrie întrebarea ta..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-civic-blue-500/50 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
                    rows={2}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddCustom(); }
                      if (e.key === 'Escape') { setIsAddingCustom(false); setCustomText(''); }
                    }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddCustom}
                      disabled={!customText.trim()}
                      className="px-3 py-1.5 text-xs font-medium bg-civic-blue-600 text-white rounded-lg hover:bg-civic-blue-700 disabled:bg-gray-400 transition-colors"
                    >
                      Adaugă
                    </button>
                    <button
                      onClick={() => { setIsAddingCustom(false); setCustomText(''); }}
                      className="px-3 py-1.5 text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                      Anulează
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsAddingCustom(true)}
                  className="flex items-center gap-1.5 text-xs font-medium text-civic-blue-600 dark:text-civic-blue-400 hover:text-civic-blue-800 dark:hover:text-civic-blue-300 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adaugă întrebare
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

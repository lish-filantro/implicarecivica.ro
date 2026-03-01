'use client';

import React, { useState } from 'react';
import { Pencil, X, Check, RotateCcw } from 'lucide-react';
import type { QuestionItem as QuestionItemType } from '@/lib/hooks/useRequestWizard';

interface QuestionItemProps {
  question: QuestionItemType;
  isSelected: boolean;
  onToggle: () => void;
  onEdit: (newText: string) => void;
  onRemove?: () => void;
}

export function QuestionItem({ question, isSelected, onToggle, onEdit, onRemove }: QuestionItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(question.text);

  const handleStartEdit = () => {
    setEditText(question.text);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== question.text) {
      onEdit(trimmed);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditText(question.text);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    }
    if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  if (isEditing) {
    return (
      <div className="p-3 bg-civic-blue-50/50 dark:bg-civic-blue-900/10 rounded-lg border border-civic-blue-200 dark:border-civic-blue-800">
        <textarea
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-civic-blue-500/50 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
          rows={3}
          autoFocus
        />
        <div className="flex gap-2 mt-2">
          <button
            onClick={handleSaveEdit}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-civic-blue-600 text-white rounded-lg hover:bg-civic-blue-700 transition-colors"
          >
            <Check className="h-3 w-3" />
            Salvează
          </button>
          <button
            onClick={handleCancelEdit}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            Anulează
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      {/* Checkbox - min 44px touch target */}
      <div className="flex items-center justify-center min-w-[44px] min-h-[44px] -m-2">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggle}
          className="h-5 w-5 text-civic-blue-600 focus:ring-civic-blue-500 border-gray-300 dark:border-gray-600 rounded cursor-pointer"
        />
      </div>

      {/* Question text */}
      <p
        className={`flex-1 text-sm leading-relaxed cursor-pointer select-none ${
          isSelected
            ? 'text-gray-900 dark:text-white'
            : 'text-gray-500 dark:text-gray-400'
        } ${question.isEdited ? 'italic' : ''}`}
        onClick={onToggle}
      >
        {question.text}
        {question.isEdited && (
          <span className="ml-1 text-xs text-civic-blue-500">(editat)</span>
        )}
      </p>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleStartEdit}
          className="p-1.5 text-gray-400 hover:text-civic-blue-600 rounded transition-colors"
          title="Editează"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        {question.isCustom && onRemove && (
          <button
            onClick={onRemove}
            className="p-1.5 text-gray-400 hover:text-protest-red-600 rounded transition-colors"
            title="Șterge"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';

interface AddCustomQuestionProps {
  onAdd: (text: string) => void;
}

/** The "Adaugă întrebare" link that turns into a textarea at the bottom of a category. */
export function AddCustomQuestion({ onAdd }: AddCustomQuestionProps) {
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customText, setCustomText] = useState('');

  const handleAddCustom = () => {
    const trimmed = customText.trim();
    if (trimmed) {
      onAdd(trimmed);
      setCustomText('');
      setIsAddingCustom(false);
    }
  };

  return (
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
  );
}

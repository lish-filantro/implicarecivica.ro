'use client';

import React from 'react';
import { ArrowLeft, Eye } from 'lucide-react';

interface StickyActionBarProps {
  selectedCount: number;
  onBack: () => void;
  onPreview: () => void;
  isDisabled: boolean;
  dailyLimitInfo?: { remaining: number };
}

export function StickyActionBar({ selectedCount, onBack, onPreview, isDisabled, dailyLimitInfo }: StickyActionBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Înapoi</span>
        </button>

        <div className="text-center">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            <span className="text-civic-blue-600 dark:text-civic-blue-400 font-semibold">
              {selectedCount}
            </span>
            {' '}
            {selectedCount === 1 ? 'cerere selectată' : 'cereri selectate'}
          </span>
          {dailyLimitInfo && (
            <span className={`block text-xs mt-0.5 ${
              dailyLimitInfo.remaining === 0 || selectedCount > dailyLimitInfo.remaining
                ? 'text-protest-red-600 dark:text-protest-red-400'
                : 'text-gray-400 dark:text-gray-500'
            }`}>
              Limită: {dailyLimitInfo.remaining} cereri rămase azi
            </span>
          )}
        </div>

        <button
          onClick={onPreview}
          disabled={isDisabled}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-civic-blue-600 hover:bg-civic-blue-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:shadow-none"
        >
          <Eye className="h-4 w-4" />
          <span className="hidden sm:inline">Previzualizare</span>
        </button>
      </div>
    </div>
  );
}

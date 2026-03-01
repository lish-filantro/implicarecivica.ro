'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Mail } from 'lucide-react';
import { formatEmailBodyText, FIXED_SUBJECT } from '@/lib/utils/emailTemplate';
import type { WizardFormData } from '@/lib/hooks/useRequestWizard';

interface PreviewEmailCardProps {
  index: number;
  total: number;
  question: string;
  formData: WizardFormData;
}

export function PreviewEmailCard({ index, total, question, formData }: PreviewEmailCardProps) {
  const [isExpanded, setIsExpanded] = useState(index === 0);

  const emailBody = formatEmailBodyText(question, formData);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Mail className="h-4 w-4 text-civic-blue-500 flex-shrink-0" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            Cererea {index + 1} din {total}
          </span>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-500" />
        )}
      </button>

      {/* Body */}
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 px-5 py-4">
          {/* Email headers */}
          <div className="space-y-1 mb-4 pb-3 border-b border-gray-100 dark:border-gray-700/50">
            <div className="flex gap-2 text-xs">
              <span className="font-semibold text-gray-500 dark:text-gray-400 w-14">Către:</span>
              <span className="text-gray-900 dark:text-white">{formData.institutionEmail}</span>
            </div>
            <div className="flex gap-2 text-xs">
              <span className="font-semibold text-gray-500 dark:text-gray-400 w-14">Subiect:</span>
              <span className="text-gray-900 dark:text-white">{FIXED_SUBJECT}</span>
            </div>
          </div>

          {/* Email body */}
          <pre className="text-xs leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans">
            {emailBody}
          </pre>
        </div>
      )}
    </div>
  );
}

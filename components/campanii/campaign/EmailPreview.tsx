"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Mail } from "lucide-react";

interface EmailPreviewProps {
  subject: string;
  body: string;
  recipientCount: number;
}

export function EmailPreview({ subject, body, recipientCount }: EmailPreviewProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-civic-blue-500 dark:text-civic-blue-400" />
          <span className="font-semibold text-gray-700 dark:text-gray-300">
            Vezi emailul pe care îl vei trimite
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400 dark:text-gray-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400 dark:text-gray-500" />
        )}
      </button>

      {expanded && (
        <div className="p-4 bg-white dark:bg-gray-800 animate-fade-in">
          <div className="mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              <strong>Către:</strong> {recipientCount} destinatari
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              <strong>Subiect:</strong> {subject}
            </p>
          </div>
          <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-body leading-relaxed">
            {body}
          </pre>
        </div>
      )}
    </div>
  );
}

"use client";

import { TEMPLATE_VARIABLES } from "@/lib/campanii/template-variables";

interface EmailPreviewPaneProps {
  subject: string;
  body: string;
  signature?: string;
  recipientCount: number;
}

/** Highlight template variables with colored badges in preview */
function highlightVariables(text: string): React.ReactNode[] {
  if (!text) return [];

  const parts: React.ReactNode[] = [];
  const regex = /(\{(\w+)\})/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    const fullTag = match[1];
    const key = match[2];
    const variable = TEMPLATE_VARIABLES.find((v) => v.key === key);

    if (variable) {
      // Render as highlighted sample value
      parts.push(
        <span
          key={`${key}-${match.index}`}
          className="inline-block bg-activist-orange-100 dark:bg-activist-orange-900/30 text-activist-orange-700 dark:text-activist-orange-300 px-1 rounded font-medium"
          title={`Variabilă: ${fullTag}`}
        >
          {variable.sampleValue}
        </span>
      );
    } else {
      parts.push(fullTag);
    }

    lastIndex = match.index + fullTag.length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
}

export function EmailPreviewPane({
  subject,
  body,
  signature,
  recipientCount,
}: EmailPreviewPaneProps) {
  const fullBody = signature ? `${body}\n\n${signature}` : body;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide font-semibold mb-2">
          Previzualizare email
        </p>
        <div className="space-y-1 text-sm">
          <p className="text-gray-500 dark:text-gray-400">
            <span className="font-medium">Către:</span>{" "}
            {recipientCount > 0
              ? `${recipientCount} destinatar${recipientCount > 1 ? "i" : ""}`
              : "Niciun destinatar"}
          </p>
          <p className="text-gray-900 dark:text-white">
            <span className="font-medium text-gray-500 dark:text-gray-400">
              Subiect:
            </span>{" "}
            {subject ? highlightVariables(subject) : (
              <span className="text-gray-300 dark:text-gray-600 italic">
                Completează subiectul...
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-4">
        {fullBody ? (
          <div className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {highlightVariables(fullBody)}
          </div>
        ) : (
          <p className="text-gray-300 dark:text-gray-600 italic text-sm">
            Emailul va apărea aici pe măsură ce scrii...
          </p>
        )}
      </div>

      {/* Legend */}
      <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/30">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          <span className="inline-block bg-activist-orange-100 dark:bg-activist-orange-900/30 text-activist-orange-700 dark:text-activist-orange-300 px-1 rounded text-xs">
            text evidențiat
          </span>{" "}
          = se completează automat de fiecare participant
        </p>
      </div>
    </div>
  );
}

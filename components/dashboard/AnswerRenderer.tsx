/**
 * AnswerRenderer Component
 * Renders answer summaries in multiple formats (text, list, table)
 * Supports both structured JSON and legacy string formats
 */

import type { AnswerSummary } from '@/lib/types/request';

interface AnswerRendererProps {
  summary: AnswerSummary | undefined;
  className?: string;
}

export function AnswerRenderer({ summary, className = '' }: AnswerRendererProps) {
  // Handle undefined summary
  if (!summary) {
    return (
      <p className={`text-sm text-gray-500 dark:text-gray-400 italic ${className}`}>
        Nu există rezumat disponibil
      </p>
    );
  }
  // STRUCTURED FORMAT - Check if it's a JSON object with type
  if (typeof summary === 'object' && summary !== null && 'type' in summary) {

    // FORMAT 1: TEXT (simple paragraph)
    if (summary.type === 'text') {
      return (
        <p className={`text-sm text-gray-800 dark:text-gray-200 leading-relaxed ${className}`}>
          {summary.content}
        </p>
      );
    }

    // FORMAT 2: LIST (bullet points)
    if (summary.type === 'list') {
      return (
        <div className={`text-sm text-gray-800 dark:text-gray-200 leading-relaxed space-y-1 ${className}`}>
          {summary.content.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span
                className="mt-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"
                aria-hidden="true"
              />
              <span>{item}</span>
            </div>
          ))}
        </div>
      );
    }

    // FORMAT 3: TABLE (grid with headers and rows)
    if (summary.type === 'table') {
      const columnCount = summary.headers.length;

      return (
        <div className={`text-xs overflow-x-auto ${className}`}>
          <div
            className="grid gap-1 min-w-max"
            style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
          >
            {/* Headers */}
            {summary.headers.map((header, i) => (
              <div
                key={`header-${i}`}
                className="font-bold text-gray-700 dark:text-gray-300 truncate pb-1 border-b border-emerald-200 dark:border-emerald-800"
              >
                {header}
              </div>
            ))}

            {/* Rows */}
            {summary.rows.map((row, rowIdx) =>
              row.map((cell, cellIdx) => (
                <div
                  key={`${rowIdx}-${cellIdx}`}
                  className="text-gray-600 dark:text-gray-400 truncate py-0.5"
                >
                  {cell}
                </div>
              ))
            )}
          </div>
        </div>
      );
    }
  }

  // LEGACY FORMAT - String with separators (; or \n)
  const text = typeof summary === 'string' ? summary : JSON.stringify(summary);
  const lines = text
    .split(/;|\n/)
    .map(line => line.trim())
    .filter(Boolean);

  // If only one line, render as simple paragraph
  if (lines.length === 1) {
    return (
      <p className={`text-sm text-gray-800 dark:text-gray-200 leading-relaxed ${className}`}>
        {lines[0]}
      </p>
    );
  }

  // Multiple lines - render as bullet list
  return (
    <div className={`text-sm text-gray-800 dark:text-gray-200 leading-relaxed space-y-1 ${className}`}>
      {lines.map((line, i) => (
        <div key={i} className="flex items-start gap-2">
          <span
            className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"
            aria-hidden="true"
          />
          <span>{line}</span>
        </div>
      ))}
    </div>
  );
}

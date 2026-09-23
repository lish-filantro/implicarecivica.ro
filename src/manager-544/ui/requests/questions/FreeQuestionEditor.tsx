'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';
import { AddCustomQuestion } from './AddCustomQuestion';
import { AttachmentPicker } from '../attachments/AttachmentPicker';
import type { QuestionItem } from '../wizard/types';
import type { OutgoingAttachment } from '@m544/requests/attachments';

interface FreeQuestionEditorProps {
  questions: QuestionItem[];
  onAdd: (text: string) => void;
  onEdit: (id: string, text: string) => void;
  onRemove: (id: string) => void;
  onAttachmentsChange: (id: string, next: OutgoingAttachment[]) => void;
  onAttachmentsBusy: (id: string, busy: boolean) => void;
}

/**
 * Pasul 2 pe drumul manual: întrebările scrise de om, câte un câmp pe rând. Nu are categorii —
 * acelea au sens doar pentru un set generat din chat; fără el, omul vedea A–E goale (0/0).
 * Starea e tot cea din useWizardQuestions (întrebări custom, selectate la adăugare), deci
 * previzualizarea şi trimiterea le primesc exact ca pe orice altă întrebare.
 */
export function FreeQuestionEditor({
  questions,
  onAdd,
  onEdit,
  onRemove,
  onAttachmentsChange,
  onAttachmentsBusy,
}: FreeQuestionEditorProps) {
  // A question emptied and left would go out as an empty request: drop it instead.
  const handleBlur = (q: QuestionItem) => {
    const trimmed = q.text.trim();
    if (!trimmed) onRemove(q.id);
    else if (trimmed !== q.text) onEdit(q.id, trimmed);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {questions.length === 0 ? (
        <p className="px-5 py-6 text-sm text-gray-500 dark:text-gray-400 text-center">
          Încă nu ai adăugat nicio întrebare. Scrie câte o întrebare pe rând; fiecare pleacă drept o cerere separată.
        </p>
      ) : (
        <ol className="px-3 sm:px-5 py-3 space-y-3">
          {questions.map((q, i) => (
            <li key={q.id} className="flex flex-col gap-1.5">
              <div className="flex items-start gap-2 sm:gap-3">
                <span className="mt-2.5 w-6 shrink-0 text-right text-sm font-medium text-gray-500 dark:text-gray-400" aria-hidden="true">
                  {i + 1}.
                </span>
                <textarea
                  aria-label={`Întrebarea ${i + 1}`}
                  value={q.text}
                  onChange={(e) => onEdit(q.id, e.target.value)}
                  onBlur={() => handleBlur(q)}
                  rows={2}
                  className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-civic-blue-500/50 bg-white dark:bg-gray-900 text-gray-900 dark:text-white resize-y"
                />
                <button
                  type="button"
                  onClick={() => onRemove(q.id)}
                  aria-label={`Șterge întrebarea ${i + 1}`}
                  title="Șterge"
                  className="flex items-center justify-center min-w-[40px] min-h-[40px] text-gray-400 hover:text-protest-red-600 dark:hover:text-protest-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="pl-8 sm:pl-9">
                <AttachmentPicker
                  attachments={q.attachments ?? []}
                  onChange={(next) => onAttachmentsChange(q.id, next)}
                  onBusyChange={(busy) => onAttachmentsBusy(q.id, busy)}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
      <AddCustomQuestion onAdd={onAdd} />
    </div>
  );
}

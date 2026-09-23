'use client';

/**
 * „📎 Ataşează" pentru o întrebare: fişierele urcate, cu mărime şi „✕", şi cele în aşteptare —
 * în curs de încărcare sau eşuate, cu motivul şi „Reîncearcă". Doar o vedere: starea (inclusiv
 * încărcările în zbor şi eşecurile) stă în wizard, pe id-ul întrebării (useQuestionAttachments),
 * ca să supravieţuiască demontării picker-ului — categorie strânsă, editare, pasul 1.
 * Spec: docs/plans/2026-09-23-atasamente-design.md §4.3.
 */
import { Paperclip, X, Loader2, AlertCircle } from 'lucide-react';
import { ATTACHMENT_ACCEPT, formatMb, type OutgoingAttachment } from '@m544/requests/attachments';
import type { PendingAttachment, QuestionAttachmentsApi } from '../wizard/useQuestionAttachments';
import type { QuestionItem } from '../wizard/types';

interface AttachmentPickerProps {
  attachments: readonly OutgoingAttachment[];
  pending: readonly PendingAttachment[];
  onAddFiles: (files: File[]) => void;
  onRemove: (path: string) => void;
  onRetry: (key: string) => void;
  onDismiss: (key: string) => void;
}

/** Legătura dintre o întrebare şi starea de ataşamente a wizard-ului. */
export function QuestionAttachmentPicker({ question, api }: { question: QuestionItem; api: QuestionAttachmentsApi }) {
  const id = question.id;
  return (
    <AttachmentPicker
      attachments={question.attachments ?? []}
      pending={api.pending[id] ?? []}
      onAddFiles={(files) => void api.add(id, files)}
      onRemove={(path) => api.remove(id, path)}
      onRetry={(key) => void api.retry(id, key)}
      onDismiss={(key) => api.dismiss(id, key)}
    />
  );
}

export function AttachmentPicker({ attachments, pending, onAddFiles, onRemove, onRetry, onDismiss }: AttachmentPickerProps) {
  return (
    <div className="mt-2 space-y-1.5">
      {attachments.map((a) => (
        <div key={a.path} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
          <Paperclip className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          <span className="truncate">{a.name}</span>
          <span className="text-gray-400">{formatMb(a.size)}</span>
          <button
            type="button"
            aria-label={`Elimină ${a.name}`}
            onClick={() => onRemove(a.path)}
            className="p-0.5 text-gray-400 hover:text-protest-red-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      {pending.map((p) => (
        <div key={p.key} className="flex items-start gap-2 text-xs">
          {p.status === 'uploading' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-civic-blue-500 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 text-protest-red-600 shrink-0 mt-0.5" />
          )}
          <div className="min-w-0">
            <span className="truncate text-gray-700 dark:text-gray-300">{p.name}</span>{' '}
            {p.status === 'uploading' ? (
              <span className="text-gray-400">se încarcă…</span>
            ) : (
              <span className="text-protest-red-700 dark:text-protest-red-300">{p.error}</span>
            )}
          </div>
          {p.status === 'error' && p.file && (
            <button type="button" onClick={() => onRetry(p.key)} className="text-civic-blue-600 dark:text-civic-blue-400 hover:underline shrink-0">
              Reîncearcă
            </button>
          )}
          {p.status === 'error' && (
            <button
              type="button"
              aria-label={`Elimină ${p.name}`}
              onClick={() => onDismiss(p.key)}
              className="p-0.5 text-gray-400 hover:text-protest-red-600 shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}

      <label className="inline-flex items-center gap-1.5 text-xs font-medium text-civic-blue-600 dark:text-civic-blue-400 cursor-pointer hover:underline">
        <Paperclip className="h-3.5 w-3.5" />
        Atașează
        <input
          type="file"
          multiple
          accept={ATTACHMENT_ACCEPT}
          className="sr-only"
          onChange={(e) => {
            onAddFiles(Array.from(e.target.files ?? []));
            e.target.value = '';
          }}
        />
      </label>
    </div>
  );
}

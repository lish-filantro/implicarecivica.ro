'use client';

import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Send, AlertTriangle } from 'lucide-react';
import { PreviewEmailCard } from './PreviewEmailCard';
import { RateLimitNotice } from './RateLimitNotice';
import { SendProgress } from './SendProgress';
import { useSendQueue, SEND_DELAY_SECONDS } from './useSendQueue';
import { useRateLimitCheck } from './useRateLimitCheck';
import type { RequestWizard } from '../wizard/useRequestWizard';

interface PreviewModalProps {
  wizard: RequestWizard;
  onClose: () => void;
  existingSessionId?: string;
}

/**
 * Step 3: the emails about to go out, the daily-limit check and the sequential send.
 * The send runs in the global queue, so the modal can be closed at any time; the
 * SendQueueBanner then shows the progress on every page.
 */
export function PreviewModal({ wizard, onClose, existingSessionId }: PreviewModalProps) {
  const selectedQuestions = wizard.getSelectedQuestions();
  const { formData, conversationId } = wizard;

  const { rateLimit, rateLimitLoading } = useRateLimitCheck({
    email: formData.institutionEmail,
    name: formData.institutionName,
  });
  const exceedsLimit = rateLimit !== null && selectedQuestions.length > rateLimit.remaining;

  const { isSending, progress, secondsLeft, sendError, sendAll } = useSendQueue({
    selectedQuestions,
    formData,
    conversationId,
    existingSessionId,
  });

  const handleSendAll = () => {
    if (exceedsLimit) return;
    void sendAll();
  };

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-fade-in" />
        <Dialog.Content className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-in">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div>
                <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white">
                  Previzualizare cereri
                </Dialog.Title>
                <Dialog.Description className="text-sm text-gray-500 dark:text-gray-400">
                  Verifică cererile înainte de trimitere
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button aria-label="Închide" className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </div>

            {/* Warning — always visible */}
            <div className="mx-6 mt-4 flex items-start gap-3 p-3 bg-activist-orange-50 dark:bg-activist-orange-900/10 border border-activist-orange-200 dark:border-activist-orange-800/30 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-activist-orange-600 dark:text-activist-orange-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-activist-orange-800 dark:text-activist-orange-300 space-y-1">
                <p>
                  Se vor trimite <strong>{selectedQuestions.length} emailuri separate</strong> către{' '}
                  <strong>{formData.institutionEmail}</strong>
                </p>
                {selectedQuestions.length > 1 && (
                  <p>
                    Între emailuri se aplică un interval de {SEND_DELAY_SECONDS} de secunde. Poți închide această fereastră:
                    trimiterea continuă în fundal, iar progresul apare în colțul paginii.{' '}
                    <strong>Nu reîncărca pagina în timpul trimiterii.</strong>
                  </p>
                )}
              </div>
            </div>

            {/* Rate limit info */}
            {!rateLimitLoading && rateLimit !== null && (
              <RateLimitNotice rateLimit={rateLimit} selectedCount={selectedQuestions.length} exceedsLimit={exceedsLimit} />
            )}

            {/* Scrollable content — dimmed during send */}
            <div className={`flex-1 overflow-y-auto px-6 py-4 space-y-3 scrollbar-modern transition-opacity duration-300 ${
              isSending ? 'opacity-30 pointer-events-none' : ''
            }`}>
              {selectedQuestions.map((q, i) => (
                <PreviewEmailCard
                  key={q.id}
                  index={i}
                  total={selectedQuestions.length}
                  question={q.text}
                  formData={formData}
                />
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              {sendError && (
                <p className="text-sm text-protest-red-600 dark:text-protest-red-400 mb-3">
                  {sendError}
                </p>
              )}

              {isSending ? (
                <div className="space-y-3">
                  <SendProgress sent={progress.sent} total={progress.total} secondsLeft={secondsLeft} />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors"
                    >
                      Închide, continuă în fundal
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <button
                    onClick={onClose}
                    className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors"
                  >
                    Anulează
                  </button>
                  <button
                    onClick={handleSendAll}
                    disabled={exceedsLimit || rateLimitLoading}
                    className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold bg-grassroots-green-600 hover:bg-grassroots-green-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:shadow-none"
                  >
                    <Send className="h-4 w-4" />
                    Trimite toate cele {selectedQuestions.length}
                  </button>
                </div>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

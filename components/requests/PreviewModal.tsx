'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Send, AlertTriangle, Loader2 } from 'lucide-react';
import { PreviewEmailCard } from './PreviewEmailCard';
import { formatEmailBodyHtml, FIXED_SUBJECT } from '@/lib/utils/emailTemplate';
import type { useRequestWizard } from '@/lib/hooks/useRequestWizard';

interface PreviewModalProps {
  wizard: ReturnType<typeof useRequestWizard>;
  onClose: () => void;
}

export function PreviewModal({ wizard, onClose }: PreviewModalProps) {
  const router = useRouter();
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ sent: 0, total: 0 });
  const [sendError, setSendError] = useState<string | null>(null);

  const selectedQuestions = wizard.getSelectedQuestions();
  const { formData, conversationId } = wizard;

  const handleSendAll = async () => {
    if (isSending) return;

    setIsSending(true);
    setSendError(null);
    setSendProgress({ sent: 0, total: selectedQuestions.length });

    try {
      // Step 1: Create session + requests
      const sessionResponse = await fetch('/api/sessions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: FIXED_SUBJECT,
          institution_name: formData.institutionName,
          institution_email: formData.institutionEmail,
          conversation_id: conversationId || undefined,
          questions: selectedQuestions.map(q => q.text),
        }),
      });

      if (!sessionResponse.ok) {
        const data = await sessionResponse.json();
        throw new Error(data.error || 'Eroare la crearea sesiunii');
      }

      const { requests } = await sessionResponse.json();

      if (!requests?.length) {
        throw new Error('Nu s-au creat cererile');
      }

      // Step 2: Send emails sequentially with delay
      let sentCount = 0;

      for (let i = 0; i < requests.length; i++) {
        const request = requests[i];
        const question = selectedQuestions[i];

        const emailBody = formatEmailBodyHtml(question.text, formData);

        const emailResponse = await fetch('/api/emails/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: formData.institutionEmail,
            subject: FIXED_SUBJECT,
            body: emailBody,
            request_id: request.id,
          }),
        });

        if (!emailResponse.ok) {
          console.error(`Failed to send email ${i + 1}:`, await emailResponse.text());
        } else {
          sentCount++;
        }

        setSendProgress({ sent: sentCount, total: requests.length });

        // Small delay between emails to avoid rate limiting
        if (i < requests.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 150));
        }
      }

      // Clear sessionStorage transfer data
      sessionStorage.removeItem('requestWizardData');

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (error) {
      console.error('Send error:', error);
      setSendError(error instanceof Error ? error.message : 'Eroare la trimitere');
      setIsSending(false);
    }
  };

  return (
    <Dialog.Root open onOpenChange={(open) => !open && !isSending && onClose()}>
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
              {!isSending && (
                <Dialog.Close asChild>
                  <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors">
                    <X className="h-5 w-5" />
                  </button>
                </Dialog.Close>
              )}
            </div>

            {/* Warning */}
            <div className="mx-6 mt-4 flex items-start gap-3 p-3 bg-activist-orange-50 dark:bg-activist-orange-900/10 border border-activist-orange-200 dark:border-activist-orange-800/30 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-activist-orange-600 dark:text-activist-orange-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-activist-orange-800 dark:text-activist-orange-300">
                Se vor trimite <strong>{selectedQuestions.length} emailuri separate</strong> către{' '}
                <strong>{formData.institutionEmail}</strong>
              </p>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 scrollbar-modern">
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
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-4 w-4 animate-spin text-civic-blue-600" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Trimitere: {sendProgress.sent}/{sendProgress.total}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-civic-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${sendProgress.total > 0 ? (sendProgress.sent / sendProgress.total) * 100 : 0}%` }}
                    />
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
                    className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold bg-grassroots-green-600 hover:bg-grassroots-green-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
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

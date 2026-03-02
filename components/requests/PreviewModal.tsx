'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Send, AlertTriangle, Loader2, Clock, Shield } from 'lucide-react';
import { PreviewEmailCard } from './PreviewEmailCard';
import { formatEmailBodyHtml, FIXED_SUBJECT } from '@/lib/utils/emailTemplate';
import type { useRequestWizard } from '@/lib/hooks/useRequestWizard';

const SEND_DELAY_MS = 30_000; // 30 seconds between emails
const SEND_DELAY_SECONDS = SEND_DELAY_MS / 1000;

const FOIA_MESSAGES = [
  'Transparența nu e un favor — e un drept garantat de Constituție.',
  'Art. 31: Dreptul la informație nu poate fi îngrădit.',
  'Legea 544/2001 — instrumentul cetățeanului într-o democrație funcțională.',
  'Instituțiile au 10 zile lucrătoare să răspundă. Ceasul deja ticăie.',
  'Lipsa semnăturii olografe nu e motiv de refuz. E lege, nu opinie.',
  'Fiecare cerere trimisă e un act civic. Felicitări.',
  'Accesul la informații publice e pilon al statului de drept.',
  'În 2001 s-a adoptat Legea 544. De atunci, dreptul tău e negru pe alb.',
  'Orice persoană, fără a justifica un interes, poate cere informații publice.',
  'Refuzul nejustificat poate fi atacat în instanță, fără taxă de timbru.',
  'Informația publică aparține cetățenilor. Instituțiile doar o administrează.',
  'O democrație sănătoasă se construiește cu întrebări, nu cu tăcere.',
  'HG 123/2002: cererile electronice au aceeași valoare ca cele pe hârtie.',
  'Dreptul de a întreba e primul pas spre dreptul de a schimba.',
  'Transparența nu slăbește instituțiile — le legitimează.',
];

interface PreviewModalProps {
  wizard: ReturnType<typeof useRequestWizard>;
  onClose: () => void;
  sessionName?: string;
}

export function PreviewModal({ wizard, onClose, sessionName }: PreviewModalProps) {
  const router = useRouter();
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ sent: 0, total: 0 });
  const [sendError, setSendError] = useState<string | null>(null);
  const [foiaIndex, setFoiaIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const selectedQuestions = wizard.getSelectedQuestions();
  const { formData, conversationId } = wizard;

  // Cycle FOIA messages every 4s while sending
  useEffect(() => {
    if (!isSending) return;
    const interval = setInterval(() => {
      setFoiaIndex((prev) => (prev + 1) % FOIA_MESSAGES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isSending]);

  // Countdown timer
  useEffect(() => {
    if (secondsLeft === null || secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => (s ?? 1) - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  // Warn before closing tab during send
  useEffect(() => {
    if (!isSending) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isSending]);

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
          name: sessionName || undefined,
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

      // Step 2: Send emails sequentially with 30s delay
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

        // 30s delay between emails to avoid spam filters
        if (i < requests.length - 1) {
          setSecondsLeft(SEND_DELAY_SECONDS);
          await new Promise(resolve => setTimeout(resolve, SEND_DELAY_MS));
          setSecondsLeft(null);
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
      setSecondsLeft(null);
    }
  };

  const progressPercent = sendProgress.total > 0
    ? (sendProgress.sent / sendProgress.total) * 100
    : 0;

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
                    Între emailuri se aplică un interval de {SEND_DELAY_SECONDS} de secunde.{' '}
                    <strong>Nu închide această pagină în timpul trimiterii.</strong>
                  </p>
                )}
              </div>
            </div>

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
                <div className="space-y-4">
                  {/* Progress header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-4 w-4 animate-spin text-civic-blue-600" />
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        Trimitere: {sendProgress.sent}/{sendProgress.total}
                      </span>
                    </div>
                    {sendProgress.sent < sendProgress.total && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                        <Shield className="h-3.5 w-3.5" />
                        <span>Nu închide pagina</span>
                      </div>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                    <div
                      className="bg-civic-blue-600 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  {/* FOIA civic message — cycling */}
                  <div className="min-h-[2.5rem] flex items-center justify-center">
                    <p
                      key={foiaIndex}
                      className="text-sm text-gray-600 dark:text-gray-400 italic text-center animate-fade-in"
                    >
                      &ldquo;{FOIA_MESSAGES[foiaIndex]}&rdquo;
                    </p>
                  </div>

                  {/* Countdown to next email */}
                  {secondsLeft !== null && secondsLeft > 0 && (
                    <div className="flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Următorul email în: <strong className="tabular-nums">{secondsLeft}s</strong></span>
                    </div>
                  )}
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

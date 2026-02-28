'use client';

import { useState } from 'react';
import { X, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Email } from '@/lib/types/email';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSent: (email: Email) => void;
  userEmail: string | null;
}

export default function ComposeModal({ isOpen, onClose, onSent, userEmail }: ComposeModalProps) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('Solicitare informatii publice - Legea 544/2001');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const canSend = to.trim() && subject.trim() && body.trim() && !sending;

  const handleSend = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: to.trim(), subject: subject.trim(), body: body.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Eroare la trimitere');
      onSent(data.email);
      // Reset form
      setTo('');
      setSubject('Solicitare informatii publice - Legea 544/2001');
      setBody('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eroare necunoscută');
    } finally {
      setSending(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl
                      border border-gray-200 dark:border-gray-700 animate-scale-in
                      flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Compune email</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300
                       hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* From (readonly) */}
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">De la</Label>
            <div className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700/50 rounded-lg text-gray-600 dark:text-gray-300">
              {userEmail || 'Nicio adresă configurată'}
            </div>
          </div>

          {/* To */}
          <div className="space-y-1">
            <Label htmlFor="compose-to">Către</Label>
            <Input
              id="compose-to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="registratura@institutie.ro"
            />
          </div>

          {/* Subject */}
          <div className="space-y-1">
            <Label htmlFor="compose-subject">Subiect</Label>
            <Input
              id="compose-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subiectul emailului"
            />
          </div>

          {/* Body */}
          <div className="space-y-1">
            <Label htmlFor="compose-body">Conținut</Label>
            <textarea
              id="compose-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Scrie conținutul emailului..."
              rows={8}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                         placeholder-gray-400 dark:placeholder-gray-500
                         focus:outline-none focus:ring-2 focus:ring-civic-blue-500/50 focus:border-civic-blue-500
                         resize-y min-h-[120px] transition-all duration-200"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-protest-red-600 bg-protest-red-50 dark:bg-protest-red-900/20
                           border border-protest-red-200 dark:border-protest-red-800 rounded-lg p-3">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Anulează
          </Button>
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold
                       bg-gradient-to-r from-civic-blue-600 to-civic-blue-700
                       hover:from-civic-blue-700 hover:to-civic-blue-800
                       text-white shadow-lg hover:shadow-xl
                       transition-all duration-300
                       disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed"
          >
            <Send className="h-4 w-4" />
            {sending ? 'Se trimite...' : 'Trimite'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Realtime subscription to the `emails` table. Wrapped so the hook can take a
 * fake in tests; the default uses the browser Supabase client.
 */
import { createBrowserClient } from '@m544/shared/db/browser-client';
import type { Email } from '@m544/shared/types/email';

export type EmailListener = (email: Email) => void;
export type SubscribeToEmails = (onInsert: EmailListener, onUpdate: EmailListener) => () => void;

export const subscribeToEmails: SubscribeToEmails = (onInsert, onUpdate) => {
  const supabase = createBrowserClient();

  const channel = supabase
    .channel('emails-realtime')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'emails' }, (payload) => {
      onInsert(payload.new as Email);
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'emails' }, (payload) => {
      onUpdate(payload.new as Email);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

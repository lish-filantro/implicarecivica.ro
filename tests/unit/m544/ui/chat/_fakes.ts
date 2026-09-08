import { vi } from 'vitest';
import type { Message, ConversationRow } from '@m544/shared/types/chat';
import { generateTitle } from '@m544/chat/queries.client';
import type { ConversationQueries } from '@m544/ui/chat/hooks/useConversationMessages';

/** In-memory stand-in for the chat Supabase queries; records every call. */
export function fakeQueries(existing: Message[] = []) {
  const saved: Array<{ convId: string; message: Message; seq: number }> = [];
  const titles: Array<{ convId: string; title: string }> = [];
  const steps: Array<{ convId: string; step: string }> = [];
  const conversation: ConversationRow = {
    id: 'conv-new',
    user_id: 'u1',
    title: 't',
    current_step: 'STEP_1',
    message_count: 0,
    created_at: '2026-09-08T10:00:00Z',
    updated_at: '2026-09-08T10:00:00Z',
  };
  const queries: ConversationQueries = {
    createConversation: vi.fn(async (title?: string) => ({ ...conversation, title: title || 't' })),
    loadMessages: vi.fn(async () => existing),
    saveMessage: vi.fn(async (convId: string, message: Message, seq: number) => {
      saved.push({ convId, message, seq });
    }),
    updateConversationTitle: vi.fn(async (convId: string, title: string) => {
      titles.push({ convId, title });
    }),
    updateConversationStep: vi.fn(async (convId: string, step: string) => {
      steps.push({ convId, step });
    }),
    generateTitle,
  };
  return { queries, saved, titles, steps };
}

export function persisted(id: string, sender: 'user' | 'bot', text: string): Message {
  return { id, sender, text, time: '10:00' };
}

export const fakeRouter = () => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
});

/** A realistic STEP_2 reply from the assistant (institution + email + marker). */
export const STEP_2_REPLY = `Am identificat instituția responsabilă pentru groapa de pe strada Libertății.

🏛️ **INSTITUȚIE_IDENTIFICATĂ:** **Primăria Municipiului Pitești**
📧 Email pentru cereri: primaria@primariapitesti.ro
🔗 Site: https://www.primariapitesti.ro

Confirmă dacă instituția este corectă.`;

/** The assistant's problem summary from STEP_1, as sent back in the history. */
export const PROBLEMA_DEFINITA =
  '✅PROBLEMA_DEFINITĂ: CE:[groapă în asfalt] UNDE:[Str. Libertății 5, Pitești, Argeș] DE_CÂND:[martie 2026]';

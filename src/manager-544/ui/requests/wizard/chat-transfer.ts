import type { ProblemContext } from './useQuestionGeneration';

/** What the chat page stores in sessionStorage before redirecting to /requests/new?from=chat. */
export interface ChatTransferData {
  institutionName?: string;
  institutionEmail?: string;
  problemContext?: ProblemContext;
  conversationId?: string;
}

export const CHAT_TRANSFER_KEY = 'requestWizardData';

type StorageLike = Pick<Storage, 'getItem'>;

/** Reads the chat hand-over; null unless `from=chat` and the stored JSON parses. */
export function readChatTransferData(fromChat: boolean, storage: StorageLike | null): ChatTransferData | null {
  if (!fromChat || !storage) return null;
  try {
    const raw = storage.getItem(CHAT_TRANSFER_KEY);
    if (raw) return JSON.parse(raw) as ChatTransferData;
  } catch {
    // ignore parse errors
  }
  return null;
}

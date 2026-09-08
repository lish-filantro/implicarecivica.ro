/**
 * Frontend history → Messages API messages. The API requires strictly
 * alternating user/assistant turns starting with a user turn, so consecutive
 * same-role messages are merged and a synthetic opener is prepended when the
 * history starts with the assistant.
 */
import type Anthropic from '@anthropic-ai/sdk';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export const CONVERSATION_START = '(start conversatie)';

type TextMessageParam = { role: 'user' | 'assistant'; content: string };

function pushOrMerge(list: TextMessageParam[], role: 'user' | 'assistant', content: string): void {
  const last = list[list.length - 1];
  if (last && last.role === role) {
    last.content = `${last.content}\n\n${content}`;
  } else {
    list.push({ role, content });
  }
}

export function normalizeHistory(history: ChatMessage[], currentMessage: string): Anthropic.Messages.MessageParam[] {
  const messages: TextMessageParam[] = [];

  for (const msg of history) {
    if (msg.role === 'system') continue;
    pushOrMerge(messages, msg.role, msg.content);
  }
  pushOrMerge(messages, 'user', currentMessage);

  if (messages[0].role !== 'user') {
    messages.unshift({ role: 'user', content: CONVERSATION_START });
  }
  return messages;
}

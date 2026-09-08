/**
 * Chat endpoint — Claude Haiku 4.5 + institution knowledge base (rag_search) +
 * Anthropic server-side web search.
 *   POST /api/chat-haiku  chat turn (logged-in users only)
 *   GET  /api/chat-haiku  health
 * Implementation: src/manager-544/chat.
 */
import { createChatHandler, createChatHealthHandler } from '@m544/chat/handler';
import { createChatDeps } from '@m544/chat/deps';

export const POST = createChatHandler(createChatDeps);
export const GET = createChatHealthHandler();

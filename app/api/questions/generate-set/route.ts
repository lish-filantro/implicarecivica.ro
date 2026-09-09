/**
 * POST /api/questions/generate-set — 5 × 5 strategic 544 questions on the chat
 * model, from a conversation (cached on its hand-off) or a request session.
 * Implementation: src/manager-544/questions/set-handler.ts
 */
import { createGenerateSetHandler, createGenerateSetDeps } from '@m544/questions/set-handler';

export const POST = createGenerateSetHandler(createGenerateSetDeps);

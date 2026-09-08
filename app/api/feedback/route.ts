/**
 * POST /api/feedback — save user feedback.
 * Implementation: src/manager-544/feedback/handler.ts
 */
import { createFeedbackHandler, createFeedbackDeps } from '@m544/feedback/handler';

export const POST = createFeedbackHandler(createFeedbackDeps);

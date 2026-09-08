/**
 * POST /api/questions/generate — 10 strategic 544 questions for one category.
 * Implementation: src/manager-544/questions/handler.ts
 */
import { createGenerateQuestionsHandler, createQuestionsDeps } from '@m544/questions/handler';

export const POST = createGenerateQuestionsHandler(createQuestionsDeps);

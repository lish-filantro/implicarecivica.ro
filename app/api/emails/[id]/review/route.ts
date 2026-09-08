/**
 * POST /api/emails/[id]/review — assign / reclassify / dismiss a received email.
 * Implementation: src/manager-544/emails/review/handler.ts
 */
import { createReviewEmailHandler } from '@m544/emails/review/handler';
import { createReviewDeps } from '@m544/emails/review/deps';

export const POST = createReviewEmailHandler(createReviewDeps);

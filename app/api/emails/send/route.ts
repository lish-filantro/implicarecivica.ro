/**
 * POST /api/emails/send — send a request/reply from the user's platform address.
 * Implementation: src/manager-544/emails/send.ts
 */
import { createSendEmailHandler, createSendEmailDeps } from '@m544/emails/send';

export const POST = createSendEmailHandler(createSendEmailDeps);

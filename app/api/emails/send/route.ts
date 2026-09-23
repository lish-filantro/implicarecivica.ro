/**
 * POST /api/emails/send — send a request/reply from the user's platform address.
 * Implementation: src/manager-544/emails/send.ts
 */
import { createSendEmailHandler, createSendEmailDeps } from '@m544/emails/send';

// Descărcarea a până la 20 MB din storage şi trimiterea lor spre Resend pot depăşi limita implicită.
export const maxDuration = 60;

export const POST = createSendEmailHandler(createSendEmailDeps);

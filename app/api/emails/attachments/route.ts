/**
 * GET /api/emails/attachments?path=<userId>/<emailId>/<filename>
 * Signed download URL for the caller's own attachment.
 * Implementation: src/manager-544/emails/attachments.ts
 */
import { createAttachmentUrlHandler, createAttachmentDeps } from '@m544/emails/attachments';

export const GET = createAttachmentUrlHandler(createAttachmentDeps);

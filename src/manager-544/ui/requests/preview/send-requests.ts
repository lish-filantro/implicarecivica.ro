/**
 * Pure builders for the two HTTP calls of a send: the session/requests creation
 * and one /api/emails/send body. Used by the send-queue store; tested directly.
 */
import { FIXED_SUBJECT, formatEmailBodyHtml } from '@m544/requests/email-template';
import type { QuestionItem, WizardFormData } from '../wizard/types';

export interface SendQueueInput {
  selectedQuestions: QuestionItem[];
  formData: WizardFormData;
  conversationId: string | null;
  /** When set, questions are appended to this session instead of creating a new one. */
  existingSessionId?: string;
}

/** Step 1 of the send: where and what to POST to create the requests. */
export function buildSessionRequest(input: SendQueueInput): { url: string; body: Record<string, unknown> } {
  const questions = input.selectedQuestions.map((q) => q.text);
  if (input.existingSessionId) {
    return { url: `/api/sessions/${input.existingSessionId}/add-requests`, body: { questions } };
  }
  const { formData } = input;
  return {
    url: '/api/sessions/create',
    body: {
      name: formData.sessionName || undefined,
      subject: FIXED_SUBJECT,
      institution_name: formData.institutionName,
      institution_email: formData.institutionEmail,
      conversation_id: input.conversationId || undefined,
      questions,
    },
  };
}

/** Step 2 of the send: the body of one /api/emails/send call. */
export function buildEmailRequest(question: string, formData: WizardFormData, requestId: string) {
  return {
    to: formData.institutionEmail,
    subject: FIXED_SUBJECT,
    body: formatEmailBodyHtml(question, formData),
    request_id: requestId,
  };
}

/**
 * Pure transition table: (current request, email category, registration number,
 * arrived-on-thread) → patch to apply. No I/O — apply.ts performs the writes.
 */
import type { AnalysisResult } from '@m544/pipeline/types';
import type { RequestPatch } from '@m544/shared/db/requests-repo';
import type { Request, RequestStatus } from '@m544/shared/types/request';
import { EXTENDED_DEADLINE_DAYS, extendedDeadline, standardDeadline } from './deadlines';

export type CurrentRequest = Pick<Request, 'status' | 'date_received' | 'registration_number' | 'deadline_date'>;

export interface TransitionInput {
  current: CurrentRequest;
  analysis: AnalysisResult;
  /** received_at of the incoming email (ISO). */
  emailReceivedAt: string;
  /** The email is a reply on the thread of an email we sent for this request. */
  viaThread: boolean;
}

export interface TransitionPlan {
  changes: RequestPatch;
  /** Status the request moves to, or null when the status is unchanged. */
  newStatus: RequestStatus | null;
  /** The transition is plausible but suspicious; flag the email for manual review. */
  needsReview: boolean;
  /** Present when nothing should be applied, with the reason. */
  skipped?: string;
}

const NO_CHANGE: Omit<TransitionPlan, 'skipped'> = { changes: {}, newStatus: null, needsReview: false };

function skip(reason: string): TransitionPlan {
  return { ...NO_CHANGE, skipped: reason };
}

function plan(changes: RequestPatch, needsReview = false): TransitionPlan {
  return { changes, newStatus: changes.status ?? null, needsReview };
}

function registered({ analysis, emailReceivedAt }: TransitionInput): TransitionPlan {
  const changes: RequestPatch = {};
  if (analysis.registration_number) changes.registration_number = analysis.registration_number;
  changes.date_received = emailReceivedAt;
  changes.deadline_date = standardDeadline(emailReceivedAt);
  changes.status = 'received';
  return plan(changes);
}

/** Extension: 30 business days in total from registration (extension_days = total, per HG 123/2002 art. 16). */
function extended({ current, analysis, emailReceivedAt }: TransitionInput): TransitionPlan {
  const base = current.date_received || emailReceivedAt;
  const changes: RequestPatch = {
    extension_date: extendedDeadline(base),
    extension_days: EXTENDED_DEADLINE_DAYS,
    status: 'extension',
  };
  if (analysis.extension_reason) changes.extension_reason = analysis.extension_reason;
  return plan(changes);
}

function redirected({ current, analysis, emailReceivedAt }: TransitionInput): TransitionPlan {
  const changes: RequestPatch = {};
  if (current.status === 'pending') changes.status = 'received';
  const dateReceived = current.date_received || emailReceivedAt;
  if (!current.date_received) changes.date_received = dateReceived;
  if (!current.deadline_date) changes.deadline_date = standardDeadline(dateReceived);
  if (analysis.redirected_to) changes.redirected_to = analysis.redirected_to;
  if (analysis.registration_number && !current.registration_number) {
    changes.registration_number = analysis.registration_number;
  }
  return plan(changes);
}

function answered(input: TransitionInput): TransitionPlan {
  const { current, analysis, emailReceivedAt, viaThread } = input;
  const hasRegistration = Boolean(analysis.registration_number || current.registration_number);
  const summary = analysis.answer_summary ? { answer_summary: analysis.answer_summary } : {};

  // A "final answer" to a request never registered, arriving off-thread, is suspicious:
  // treat it as the first sign of life (received) and ask for manual review.
  if (current.status === 'pending' && !viaThread && !hasRegistration) {
    return plan(
      {
        status: 'received',
        date_received: emailReceivedAt,
        deadline_date: standardDeadline(emailReceivedAt),
        ...summary,
      },
      true,
    );
  }

  return plan({ response_received_date: emailReceivedAt, status: 'answered', ...summary });
}

export function planTransition(input: TransitionInput): TransitionPlan {
  if (input.current.status === 'answered') return skip('already answered');

  switch (input.analysis.category) {
    case 'irelevant':
      return skip('irrelevant email');
    case 'trimise':
      return skip('outgoing email category');
    case 'inregistrate':
      return registered(input);
    case 'amanate':
      return extended(input);
    case 'redirectionat':
      return redirected(input);
    case 'raspunse':
    case 'intarziate':
      return answered(input);
  }
}

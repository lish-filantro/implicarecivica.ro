/**
 * Shared contracts of the inbound-email processing pipeline:
 *   OCR → analysis (classification) → matching → status update.
 * Defined here so the four modules can be built and tested independently.
 */
import type { AnswerSummary, EmailCategory } from '@m544/shared/types/request';

/** Result of classifying one received email (subject + body + OCR text). */
export interface AnalysisResult {
  category: EmailCategory;
  registration_number: string | null;
  registration_date: string | null;
  response_date: string | null;
  answer_summary: AnswerSummary | null;
  extension_days: number | null;
  extension_reason: string | null;
  /** For category 'redirectionat': the competent institution named by the sender. */
  redirected_to: string | null;
  evidence: string;
  confidence: number;
}

export type MatchStrategy = 'thread' | 'registration' | 'context';
export type MatchConfidence = 'high' | 'medium' | 'low';

export interface MatchResult {
  requestId: string;
  strategy: MatchStrategy;
  confidence: MatchConfidence;
}

/** Outcome of the matcher: a match, or none — possibly flagged for manual review (ambiguous candidates). */
export interface MatchOutcome {
  match: MatchResult | null;
  needsReview: boolean;
  reason: string;
}

/** Minimal email shape the matcher needs. */
export interface MatchableEmail {
  id: string;
  user_id: string;
  parent_email_id: string | null;
  from_email: string;
  subject: string;
}

export interface StatusUpdateResult {
  previousStatus: string;
  newStatus: string;
  changes: Record<string, unknown>;
  needsReview: boolean;
}

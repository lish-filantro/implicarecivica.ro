/**
 * Rebuilds the classifier's AnalysisResult from what the pipeline saved in
 * `emails.ai_extracted_data.analysis`, so a manual review can re-run the
 * status transition without calling the model again. Tolerant: any missing
 * or malformed field becomes null; only the category is mandatory.
 */
import type { AnalysisResult } from '@m544/pipeline/types';
import type { Email } from '@m544/shared/types/email';
import type { AnswerSummary, EmailCategory } from '@m544/shared/types/request';

export const EMAIL_CATEGORIES: readonly EmailCategory[] = [
  'trimise',
  'inregistrate',
  'amanate',
  'raspunse',
  'intarziate',
  'irelevant',
  'redirectionat',
];

export function isEmailCategory(value: unknown): value is EmailCategory {
  return typeof value === 'string' && (EMAIL_CATEGORIES as readonly string[]).includes(value);
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function summary(v: unknown): AnswerSummary | null {
  if (typeof v === 'string') return v.trim() ? v : null;
  if (v && typeof v === 'object' && typeof (v as { type?: unknown }).type === 'string') return v as AnswerSummary;
  return null;
}

/** Minimal analysis for an email whose saved analysis is unusable: category + known registration number. */
export function fallbackAnalysis(category: EmailCategory, email: Email): AnalysisResult {
  return {
    category,
    registration_number: email.registration_number ?? null,
    registration_date: null,
    response_date: null,
    answer_summary: null,
    extension_days: null,
    extension_reason: null,
    redirected_to: null,
    evidence: '',
    confidence: 1,
  };
}

export function analysisFromEmail(email: Email): AnalysisResult | null {
  const raw = email.ai_extracted_data?.analysis;
  const saved: Record<string, unknown> = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  if (raw !== undefined && raw !== null && typeof raw !== 'object') return null;

  const category = 'category' in saved ? saved.category : email.category;
  if (!isEmailCategory(category)) return null;

  return {
    category,
    registration_number: str(saved.registration_number) ?? email.registration_number ?? null,
    registration_date: str(saved.registration_date),
    response_date: str(saved.response_date),
    answer_summary: summary(saved.answer_summary),
    extension_days: num(saved.extension_days),
    extension_reason: str(saved.extension_reason),
    redirected_to: str(saved.redirected_to),
    evidence: str(saved.evidence) ?? '',
    confidence: num(saved.confidence) ?? 0,
  };
}

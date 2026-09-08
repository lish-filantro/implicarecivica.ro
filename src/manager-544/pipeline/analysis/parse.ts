/**
 * Turns the classifier's raw text into a validated AnalysisResult.
 * Pure functions, no I/O — every branch is unit-tested against real model outputs.
 */
import type { AnswerSummary, EmailCategory } from '@m544/shared/types/request';
import type { AnalysisResult } from '@m544/pipeline/types';
import { validateRegistrationNumber } from './registration';

export class AnalysisParseError extends Error {
  readonly raw: string;

  constructor(raw: string, detail?: string) {
    super(`Failed to parse analysis JSON: ${raw.slice(0, 200)}${detail ? ` (${detail})` : ''}`);
    this.name = 'AnalysisParseError';
    this.raw = raw;
  }
}

/** Categories the classifier may return; anything else is treated as `irelevant`. */
const CLASSIFIER_CATEGORIES: ReadonlySet<string> = new Set<EmailCategory>([
  'inregistrate',
  'amanate',
  'raspunse',
  'intarziate',
  'irelevant',
  'redirectionat',
]);

const FENCED_JSON = /```(?:json)?\s*([\s\S]*?)```/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Strict JSON first; otherwise the first fenced ```json block; otherwise AnalysisParseError. */
export function parseAnalysisJson(raw: string): Record<string, unknown> {
  let parsed = tryParse(raw);
  if (parsed === undefined) {
    const fenced = FENCED_JSON.exec(raw);
    if (!fenced) throw new AnalysisParseError(raw);
    parsed = tryParse(fenced[1]);
    if (parsed === undefined) throw new AnalysisParseError(raw, 'invalid JSON in fenced block');
  }
  if (!isRecord(parsed)) throw new AnalysisParseError(raw, 'not a JSON object');
  return parsed;
}

/** Lowercased/trimmed category; null, empty or unknown values become `irelevant`. */
export function normalizeCategory(value: unknown): EmailCategory {
  if (typeof value !== 'string') return 'irelevant';
  const normalized = value.toLowerCase().trim();
  return CLASSIFIER_CATEGORIES.has(normalized) ? (normalized as EmailCategory) : 'irelevant';
}

/** Structured answer_summary (text | list | table) or null when the shape is not recognised. */
export function parseAnswerSummary(value: unknown): AnswerSummary | null {
  if (!isRecord(value)) return null;
  if (value.type === 'text' && typeof value.content === 'string') {
    return { type: 'text', content: value.content };
  }
  if (value.type === 'list' && Array.isArray(value.content)) {
    return { type: 'list', content: value.content as string[] };
  }
  if (value.type === 'table' && Array.isArray(value.headers) && Array.isArray(value.rows)) {
    return { type: 'table', headers: value.headers as string[], rows: value.rows as string[][] };
  }
  return null;
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function redirectedTo(value: unknown, category: EmailCategory): string | null {
  if (category !== 'redirectionat' || typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Assemble the AnalysisResult from the parsed JSON.
 * `fullText` is the text the model saw; the registration number must appear in it.
 */
export function toAnalysisResult(parsed: Record<string, unknown>, fullText: string): AnalysisResult {
  const category = normalizeCategory(parsed.category);
  const candidate = typeof parsed.registration_number === 'string' ? parsed.registration_number : null;

  return {
    category,
    registration_number: validateRegistrationNumber(candidate, fullText),
    registration_date: optionalString(parsed.registration_date),
    response_date: optionalString(parsed.response_date),
    answer_summary: parseAnswerSummary(parsed.answer_summary),
    extension_days: optionalNumber(parsed.extension_days),
    extension_reason: optionalString(parsed.extension_reason),
    redirected_to: redirectedTo(parsed.redirected_to, category),
    evidence: typeof parsed.evidence === 'string' ? parsed.evidence : '',
    confidence: optionalNumber(parsed.confidence) ?? 0,
  };
}

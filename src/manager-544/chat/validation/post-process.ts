/**
 * Post-processing of the model's final text, in this order:
 *   1. STEP_2: score the emails found in the answer; append a warning when the
 *      best one has low confidence.
 *   2. Output validation: redact system-prompt leaks; replace an (almost) empty
 *      answer with the step fallback.
 *   3. Harvest URLs from the text into the sources list (no duplicates).
 *   4. STEP_2/STEP_3: read the identified institution (name, email, confidence, source).
 */
import type { Step } from '@m544/chat/guardrails/steps';
import type { ChatSource, ParsedResponse } from '@m544/chat/anthropic/parse';
import { extractEmails, scoreEmailConfidence, type EmailValidationResult } from './email';
import { validateOutput, sanitizeOutput, getFallbackResponse } from './output';
import { extractInstitution } from './institution';
import type { ChatInstitution } from '@m544/shared/types/chat';

export const LOW_CONFIDENCE_WARNING =
  '\n\n⚠️ **ATENȚIE:** Nivelul de încredere pentru acest email este scăzut. Te rugăm SĂ VERIFICI manual emailul pe site-ul oficial al instituției înainte de a trimite cererea.';

/** Answers shorter than this are considered empty and replaced by the fallback. */
const MIN_ANSWER_LENGTH = 10;

const CONFIDENCE_ORDER = { high: 3, medium: 2, low: 1 } as const;

function bestEmail(emails: string[], sourceUrls: string[], text: string): EmailValidationResult {
  // Institution name is not passed: the model already picked it, only the domain signals count here.
  const scored = emails.map((e) => scoreEmailConfidence(e, '', sourceUrls, text));
  scored.sort((a, b) => CONFIDENCE_ORDER[b.confidence] - CONFIDENCE_ORDER[a.confidence]);
  return scored[0];
}

export function appendEmailWarning(text: string, step: Step, sourceUrls: string[]): string {
  if (step !== 'STEP_2') return text;
  const emails = extractEmails(text);
  if (emails.length === 0) return text;

  const best = bestEmail(emails, sourceUrls, text);
  console.log(`  Email validation: ${best.email} (${best.confidence}) — ${best.confidenceReasons.join('; ')}`);
  return best.confidence === 'low' ? text + LOW_CONFIDENCE_WARNING : text;
}

export function finalizeText(text: string, step: Step): string {
  let out = text;
  if (validateOutput(out, step).containsSystemLeak) {
    console.error('SYSTEM PROMPT LEAK DETECTED');
    out = sanitizeOutput(out);
  }
  return out.length < MIN_ANSWER_LENGTH ? getFallbackResponse(step) : out;
}

/** http(s) URLs in the text, with trailing punctuation/brackets removed. */
export function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s)>\]]+/g) ?? [];
  return matches.map((raw) => raw.replace(/[).\],;:]+$/, ''));
}

export function addUrlSources(text: string, sources: ChatSource[]): ChatSource[] {
  const out = [...sources];
  for (const url of extractUrls(text)) {
    if (!out.some((s) => s.url === url)) out.push({ url, title: 'Sursa' });
  }
  return out;
}

export interface PostProcessed {
  text: string;
  sources: ChatSource[];
  /** The identified institution (STEP_2, or a re-identification at STEP_3); null otherwise. */
  institution: ChatInstitution | null;
}

export function postProcessResponse(parsed: ParsedResponse, step: Step): PostProcessed {
  const sourceUrls = parsed.sources.map((s) => s.url);
  const institution = step === 'STEP_1' ? null : extractInstitution(parsed.text, [...sourceUrls, ...extractUrls(parsed.text)]);
  // With a named institution the confidence is scored once (domain vs. name counts); the warning follows it.
  const withWarning = institution?.email
    ? step === 'STEP_2' && institution.confidence === 'low'
      ? parsed.text + LOW_CONFIDENCE_WARNING
      : parsed.text
    : appendEmailWarning(parsed.text, step, sourceUrls);
  const text = finalizeText(withWarning, step);
  return { text, sources: addUrlSources(text, parsed.sources), institution };
}

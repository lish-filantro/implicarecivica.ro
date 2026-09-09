/**
 * The institution the assistant identified, read from a STEP_2 answer:
 * name from the INSTITUȚIE_IDENTIFICATĂ marker, email = the best-scored address
 * in the text (scoreEmailConfidence), source = the URL whose host matches the
 * email domain (else the first non-search-engine URL). Computed server-side so
 * the UI and the hand-off never parse the text themselves.
 */
import type { ChatInstitution } from '@m544/shared/types/chat';
import { extractEmails, scoreEmailConfidence } from './email';

export const INSTITUTION_MARKER = 'INSTITUȚIE_IDENTIFICATĂ';

/** "🏛 **INSTITUȚIE_IDENTIFICATĂ:** **Primăria X**" / "INSTITUȚIE_IDENTIFICATĂ: Tip: Consiliul Y" → the name up to the line end or the next icon. */
const NAME_PATTERN = /INSTITUȚIE_IDENTIFICATĂ[:\s*]+(?:Tip:)?\s*(.+?)(?:\r?\n|📧|🔗|\/\s|$)/i;

const CONFIDENCE_ORDER = { high: 3, medium: 2, low: 1 } as const;
const SEARCH_ENGINE = /(^|\.)(google|bing|duckduckgo)\./i;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function sourceFor(email: string, sourceUrls: string[]): string | null {
  const domain = (email.split('@')[1] ?? '').toLowerCase().replace(/^www\./, '');
  const sameDomain = domain ? sourceUrls.find((u) => hostOf(u).endsWith(domain)) : undefined;
  if (sameDomain) return sameDomain;
  return sourceUrls.find((u) => !SEARCH_ENGINE.test(hostOf(u))) ?? null;
}

export function extractInstitution(text: string, sourceUrls: string[]): ChatInstitution | null {
  if (!text.includes(INSTITUTION_MARKER)) return null;

  const nameMatch = text.match(NAME_PATTERN);
  const name = nameMatch ? nameMatch[1].replace(/\*+/g, '').trim() : '';
  if (!name) return null;

  const emails = extractEmails(text);
  if (emails.length === 0) return { name, email: null, confidence: null, sourceUrl: null };

  const best = emails
    .map((e) => scoreEmailConfidence(e, name, sourceUrls, text))
    .sort((a, b) => CONFIDENCE_ORDER[b.confidence] - CONFIDENCE_ORDER[a.confidence])[0];

  return { name, email: best.email, confidence: best.confidence, sourceUrl: sourceFor(best.email, sourceUrls) };
}

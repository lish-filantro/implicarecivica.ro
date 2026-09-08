/**
 * Question extraction from request bodies: text cleanup, template matching
 * for the Romanian 544 request templates and a keyword-scoring fallback.
 */
import type { Request } from '@m544/shared/types/request';

const BULLET_REGEX = /[-*•‒–—]/u;
const QUESTION_REGEX = /\?/;

const KEYWORD_PATTERNS = [/solicit/i, /cer/i, /informa/i, /răspuns/i, /\bnr\./i, /număr/i, /registr/i];

const PENALTY_PATTERNS = [
  /^(solicitant|adres[ăa]|email|telefon|cu st(?:ime|imă)|mulțumesc|cooperare)/i,
  /datele de contact/i,
];

/** Standard template: "Solicitare:" header … blank line … "Aștept". */
const TEMPLATE_PATTERN = /solicitare[^:\n]*:\s*\n+([\s\S]*?)(?:\n{2,}\s*(?:Aștept|Astept)\b)/i;

/** Law 544/2001 long form: "…privind liberul acces la informațiile de interes public:" … closing formula. */
const LONG_FORM_PATTERN =
  /privind liberul acces la informațiile de interes public:[\s\S]*?\n([\s\S]*?)(?:\n\s*(?:Aștept|Astept|Cu stimă|Vă mulțumesc))/i;

/** Normalize line breaks and nbsp, trim every line, drop blank lines. */
export function sanitizeText(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ') // non-breaking space
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

/** Collapse to a single line with single spaces. */
export function formatSummary(text: string): string {
  if (!text) return '';
  return text.replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

/** Cut at `limit` characters and append "..." (trimmed). */
export function truncateText(value: string, limit: number = 220): string {
  if (!value) return '';
  const text = String(value).trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).trimEnd()}...`;
}

/**
 * Extract the question from a templated request body: the "Solicitare:" block,
 * the 544 long form, or the first line containing a question mark.
 */
export function extractTemplateQuestion(text: string | null | undefined): string {
  if (!text) return '';
  const normalized = String(text).replace(/\r\n/g, '\n');

  const templateMatch = normalized.match(TEMPLATE_PATTERN);
  if (templateMatch) return sanitizeText(templateMatch[1]);

  const longMatch = normalized.match(LONG_FORM_PATTERN);
  if (longMatch) return sanitizeText(longMatch[1]);

  const questionLine = normalized
    .split('\n')
    .map((line) => line.trim())
    .find((line) => QUESTION_REGEX.test(line));
  return questionLine ? sanitizeText(questionLine) : '';
}

/**
 * Pick the most relevant lines by score: questions and bullets score high,
 * request keywords add points, polite formulas / contact lines are penalized.
 */
export function extractKeyLines(
  text: string | null | undefined,
  options: { favorQuestions?: boolean; maxLines?: number } = {},
): string {
  const { favorQuestions = false, maxLines = 3 } = options;
  const cleaned = sanitizeText(text);
  if (!cleaned) return '';

  const scored = cleaned
    .split('\n')
    .map((rawLine) => rawLine.trim())
    .filter(Boolean)
    .map((line) => {
      const lower = line.toLowerCase();
      let score = 0;
      if (QUESTION_REGEX.test(line)) score += 3;
      if (BULLET_REGEX.test(line)) score += 2;
      if (favorQuestions && QUESTION_REGEX.test(line)) score += 3;
      for (const pattern of KEYWORD_PATTERNS) if (pattern.test(lower)) score += 2;
      if (line.length > 120) score -= 1;
      for (const pattern of PENALTY_PATTERNS) if (pattern.test(line)) score -= 5;
      return { line, score };
    });

  if (!scored.length) return cleaned;
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxLines).map((entry) => entry.line).join('\n');
}

/**
 * The question of a request, as one line. Cascade: template in request_body,
 * template in body, key lines in request_body, key lines in body, summary, "".
 */
export function getRequestQuestion(request: Request): string {
  const primary = request.request_body || '';
  const fallback = request.body || '';
  const question =
    extractTemplateQuestion(primary) ||
    extractTemplateQuestion(fallback) ||
    extractKeyLines(primary, { favorQuestions: true }) ||
    extractKeyLines(fallback, { favorQuestions: true }) ||
    request.summary ||
    '';
  return formatSummary(sanitizeText(question));
}

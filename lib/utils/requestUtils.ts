/**
 * Request Utilities
 * Smart question extraction and text processing
 * Based on proven implementation from React app
 */

import type { Request } from '../types/request';

// Regex patterns for question extraction
const BULLET_REGEX = /[-*•‒–—]/u;
const QUESTION_REGEX = /\?/;

const KEYWORD_PATTERNS = [
  /solicit/i,
  /cer/i,
  /informa/i,
  /răspuns/i,
  /\bnr\./i,
  /număr/i,
  /registr/i,
];

const PENALTY_PATTERNS = [
  /^(solicitant|adres[ăa]|email|telefon|cu st(?:ime|imă)|mulțumesc|cooperare)/i,
  /datele de contact/i,
];

/**
 * Sanitize text - remove extra whitespace, normalize line breaks
 */
export function sanitizeText(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";

  return String(value)
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ") // non-breaking space
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

/**
 * Format summary - collapse to single line, remove extra spaces
 */
export function formatSummary(text: string): string {
  if (!text) return "";

  return text
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Truncate text to specified limit with ellipsis
 */
export function truncateText(value: string, limit: number = 220): string {
  if (!value) return "";

  const text = String(value).trim();
  if (text.length <= limit) return text;

  return `${text.slice(0, limit).trimEnd()}...`;
}

/**
 * Extract question from template patterns
 * Handles common Romanian request templates
 */
export function extractTemplateQuestion(text: string | null | undefined): string {
  if (!text) return "";

  const normalized = String(text).replace(/\r\n/g, "\n");

  // PATTERN 1: Standard template with "Solicitare:" header
  // Example: "Solicitare:\nVă rog să...\n\nAștept cu interes"
  const templatePattern =
    /solicitare[^:\n]*:\s*\n+([\s\S]*?)(?:\n{2,}\s*(?:Aștept|Astept)\b)/i;
  const templateMatch = normalized.match(templatePattern);
  if (templateMatch) {
    return sanitizeText(templateMatch[1]);
  }

  // PATTERN 2: Law 544/2001 specific long form
  // Example: "privind liberul acces la informațiile de interes public:\n[content]\nCu stimă"
  const longPattern =
    /privind liberul acces la informațiile de interes public:[\s\S]*?\n([\s\S]*?)(?:\n\s*(?:Aștept|Astept|Cu stimă|Vă mulțumesc))/i;
  const longMatch = normalized.match(longPattern);
  if (longMatch) {
    return sanitizeText(longMatch[1]);
  }

  // FALLBACK: Find first line with question mark
  const questionLine = normalized
    .split("\n")
    .map((line) => line.trim())
    .find((line) => QUESTION_REGEX.test(line));

  if (questionLine) {
    return sanitizeText(questionLine);
  }

  return "";
}

/**
 * Extract key lines using intelligent scoring system
 * Prioritizes questions, bullet points, and relevant keywords
 */
export function extractKeyLines(
  text: string | null | undefined,
  options: { favorQuestions?: boolean; maxLines?: number } = {}
): string {
  const { favorQuestions = false, maxLines = 3 } = options;
  const cleaned = sanitizeText(text);

  if (!cleaned) return "";

  const lines = cleaned.split("\n");

  // Score each line based on relevance
  const scored = lines
    .map((rawLine) => {
      const line = rawLine.trim();
      if (!line) return null;

      const lower = line.toLowerCase();
      let score = 0;

      // POSITIVE SCORING
      if (QUESTION_REGEX.test(line)) score += 3;           // Has question mark
      if (BULLET_REGEX.test(line)) score += 2;             // Is bullet point
      if (favorQuestions && QUESTION_REGEX.test(line)) score += 3; // Extra boost for questions

      // Keyword matching
      KEYWORD_PATTERNS.forEach((pattern) => {
        if (pattern.test(lower)) score += 2;
      });

      // NEGATIVE SCORING
      if (line.length > 120) score -= 1;                   // Too long

      PENALTY_PATTERNS.forEach((pattern) => {
        if (pattern.test(line)) score -= 5;                // Polite formulas, contact info
      });

      return { line, score };
    })
    .filter((item): item is { line: string; score: number } => item !== null);

  if (!scored.length) return cleaned;

  // Sort by score (highest first) and take top N lines
  scored.sort((a, b) => b.score - a.score);
  const chosen = scored.slice(0, maxLines).map((entry) => entry.line);

  return chosen.join("\n");
}

/**
 * Get question from request using cascading extraction logic
 * Tries multiple strategies in order of preference
 */
export function getRequestQuestion(request: Request): string {
  const primarySource = request.request_body || "";
  const fallbackSource = request.body || "";

  // Cascading extraction with fallbacks
  const question =
    extractTemplateQuestion(primarySource) ||        // 1. Template in request_body
    extractTemplateQuestion(fallbackSource) ||       // 2. Template in body
    extractKeyLines(primarySource, { favorQuestions: true }) ||  // 3. Scoring in request_body
    extractKeyLines(fallbackSource, { favorQuestions: true }) || // 4. Scoring in body
    request.summary ||                               // 5. Summary from DB
    "";                                              // 6. Empty string

  return formatSummary(sanitizeText(question));
}

/**
 * Get effective deadline (extension_date if exists, else deadline_date)
 */
export function getEffectiveDeadline(request: Request): string | null {
  return request.extension_date || request.deadline_date || null;
}

/**
 * Calculate days until deadline
 * Returns null if no deadline, negative if overdue
 */
export function getDaysUntilDeadline(deadline: string | null): number | null {
  if (!deadline) return null;

  const deadlineDate = new Date(deadline);
  const now = new Date();

  // Reset time to midnight for accurate day comparison
  deadlineDate.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  const diffTime = deadlineDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Check if request is critical (deadline <= 3 days)
 */
export function isCriticalRequest(request: Request): boolean {
  if (request.status === 'answered') return false;

  const deadline = getEffectiveDeadline(request);
  if (!deadline) return false;

  const days = getDaysUntilDeadline(deadline);
  return days !== null && days >= 0 && days <= 3;
}

/**
 * Check if request is overdue
 */
export function isOverdueRequest(request: Request): boolean {
  if (request.status === 'answered') return false;

  const deadline = getEffectiveDeadline(request);
  if (!deadline) return false;

  const days = getDaysUntilDeadline(deadline);
  return days !== null && days < 0;
}

/**
 * Get days since request was sent (for pending registration tracking)
 */
export function getDaysSinceSent(request: Request): number {
  if (!request.date_sent) return 0;

  const sentDate = new Date(request.date_sent);
  const now = new Date();

  sentDate.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  const diffTime = now.getTime() - sentDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Get status label in Romanian
 */
export function getStatusLabel(status: Request['status']): string {
  const labels = {
    pending: 'Așteaptă nr. înreg.',
    received: 'Înregistrată',
    extension: 'Prelungită',
    answered: 'Răspuns primit',
    delayed: 'Întârziată',
  };

  return labels[status] || status;
}

/**
 * Get status color theme
 */
export function getStatusColor(status: Request['status']): string {
  const colors = {
    pending: 'blue',
    received: 'emerald',
    extension: 'purple',
    answered: 'green',
    delayed: 'red',
  };

  return colors[status] || 'gray';
}

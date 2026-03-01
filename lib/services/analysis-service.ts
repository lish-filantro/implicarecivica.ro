/**
 * Email Analysis Service — Mistral Large for email classification & data extraction
 *
 * Analyzes email content (subject + body + OCR text) and returns:
 * - category (inregistrate / amanate / raspunse / intarziate)
 * - registration_number
 * - answer_summary (structured: text | list | table)
 * - confidence score
 */

import { Mistral } from '@mistralai/mistralai';
import { MISTRAL_ANALYSIS_MODEL, EMAIL_ANALYSIS_SYSTEM_PROMPT } from '@/lib/mistral/constants';
import type { EmailCategory, AnswerSummary } from '@/lib/types/request';

let _client: Mistral | null = null;

function getMistralClient(): Mistral {
  if (!_client) {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) throw new Error('MISTRAL_API_KEY is not configured');
    _client = new Mistral({ apiKey });
  }
  return _client;
}

export interface AnalysisResult {
  category: EmailCategory;
  registration_number: string | null;
  registration_date: string | null;
  response_date: string | null;
  answer_summary: AnswerSummary | null;
  extension_days: number | null;
  extension_reason: string | null;
  evidence: string;
  confidence: number;
}

/**
 * Validate that a registration number actually appears in the source text.
 * Prevents hallucinated registration numbers.
 */
function validateRegistrationNumber(
  candidate: string | null,
  fullText: string,
): string | null {
  if (!candidate || candidate.length < 3) return null;

  // Don't accept "544/2001" — that's the law, not a registration number
  if (/^544\/?2001$/i.test(candidate.trim())) return null;

  // Normalize for comparison
  const normCandidate = candidate.toLowerCase().replace(/\s+/g, '').replace(/\./g, '');
  const normText = fullText.toLowerCase().replace(/\s+/g, '');

  if (normText.includes(normCandidate)) {
    return candidate.trim();
  }

  // Try just the numeric part (e.g., "1234" from "Nr. 1234/2025")
  const numericMatch = candidate.match(/\d+/);
  if (numericMatch && numericMatch[0].length >= 3) {
    if (normText.includes(numericMatch[0])) {
      return candidate.trim();
    }
  }

  return null;
}

/**
 * Analyze an email's content using Mistral Large.
 * Returns structured classification and extracted data.
 */
export async function analyzeEmailContent(input: {
  subject: string;
  body: string;
  ocrText?: string;
  fromEmail: string;
}): Promise<AnalysisResult> {
  const client = getMistralClient();

  // Build analysis context
  const parts: string[] = [];
  parts.push(`De la: ${input.fromEmail}`);
  parts.push(`Subiect: ${input.subject}`);
  if (input.body) {
    parts.push(`\nConținut email:\n${input.body.slice(0, 3000)}`);
  }
  if (input.ocrText) {
    parts.push(`\nConținut PDF (OCR):\n${input.ocrText.slice(0, 5000)}`);
  }

  const userMessage = parts.join('\n');

  const response = await client.chat.complete({
    model: MISTRAL_ANALYSIS_MODEL,
    messages: [
      { role: 'system', content: EMAIL_ANALYSIS_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.1, // Low temperature for deterministic extraction
    responseFormat: { type: 'json_object' },
  });

  const rawContent = response.choices?.[0]?.message?.content;
  if (!rawContent || typeof rawContent !== 'string') {
    throw new Error('Empty response from Mistral analysis');
  }

  // Parse JSON response
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    // Try to extract JSON from markdown code block
    const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1]);
    } else {
      throw new Error(`Failed to parse analysis JSON: ${rawContent.slice(0, 200)}`);
    }
  }

  // Validate category
  const validCategories: EmailCategory[] = ['inregistrate', 'amanate', 'raspunse', 'intarziate'];
  const category = (parsed.category as string || '').toLowerCase().trim() as EmailCategory;
  if (!validCategories.includes(category)) {
    throw new Error(`Invalid category: ${parsed.category}`);
  }

  // Validate registration number against source text
  const fullText = userMessage;
  const registrationNumber = validateRegistrationNumber(
    parsed.registration_number as string | null,
    fullText,
  );

  // Parse answer_summary
  let answerSummary: AnswerSummary | null = null;
  if (parsed.answer_summary && typeof parsed.answer_summary === 'object') {
    const summary = parsed.answer_summary as Record<string, unknown>;
    if (summary.type === 'text' && typeof summary.content === 'string') {
      answerSummary = { type: 'text', content: summary.content };
    } else if (summary.type === 'list' && Array.isArray(summary.content)) {
      answerSummary = { type: 'list', content: summary.content as string[] };
    } else if (
      summary.type === 'table' &&
      Array.isArray(summary.headers) &&
      Array.isArray(summary.rows)
    ) {
      answerSummary = {
        type: 'table',
        headers: summary.headers as string[],
        rows: summary.rows as string[][],
      };
    }
  }

  return {
    category,
    registration_number: registrationNumber,
    registration_date: (parsed.registration_date as string) || null,
    response_date: (parsed.response_date as string) || null,
    answer_summary: answerSummary,
    extension_days: (parsed.extension_days as number) || null,
    extension_reason: (parsed.extension_reason as string) || null,
    evidence: (parsed.evidence as string) || '',
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
  };
}

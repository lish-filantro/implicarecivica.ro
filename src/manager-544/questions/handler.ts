/**
 * POST /api/questions/generate
 *
 * Generates 10 strategic Law 544/2001 questions for one category from the
 * problem context (CE / UNDE / CÂND) and the identified institution. Called
 * 5x in parallel (one per category) by useQuestionGeneration.
 *
 * Responses (unchanged from the legacy route):
 *   401 no session · 400 bad JSON / category / context · 503 key not configured
 *   502 Anthropic 401 · 429 Anthropic 429 · 500 other · 200 { category, questions }
 */
import type { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { requireUser, type AuthClient } from '@m544/shared/auth';
import { json, httpError, withErrorBoundary } from '@m544/shared/http';
import { EnvError, requireSecret } from '@m544/shared/env';
import { createServerClient } from '@m544/shared/db/clients';
import { HAIKU_MODEL, SYSTEM_PROMPT, VALID_CATEGORIES, isQuestionCategory, buildUserPrompt } from './prompt';
import { parseQuestions } from './parse';

export interface MessageCreateArgs {
  model: string;
  max_tokens: number;
  temperature: number;
  system: string;
  messages: Array<{ role: 'user'; content: string }>;
}

export interface MessageLike {
  content: Array<{ type: string; text?: string }>;
}

/** The slice of the Anthropic SDK we use (`new Anthropic(...)` satisfies it). */
export interface AnthropicClient {
  messages: { create(args: MessageCreateArgs): Promise<MessageLike> };
}

export interface GenerateQuestionsDeps<C extends AuthClient = AuthClient> {
  createClient: () => Promise<C>;
  /** Read only after validation; the default getter throws EnvError when the key is missing. */
  readonly anthropic: AnthropicClient;
}

interface RawBody {
  category?: unknown;
  problemContext?: { ce?: unknown; unde?: unknown; cand?: unknown } | null;
  institutionName?: unknown;
}

const MAX_QUESTIONS = 10;
const MAX_TOKENS = 1500;
const TEMPERATURE = 0.5;

/** Cap free-text inputs so a malicious client cannot inflate the prompt. */
function clip(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max).trim() : '';
}

function textOf(response: MessageLike): string {
  return response.content
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n');
}

function unavailable(category: string, status: number, error: string) {
  return json({ category, questions: [], error }, status);
}

/** Surface auth/rate-limit problems instead of silently returning an empty list. */
function mapProviderError(error: unknown) {
  const err = error as { status?: number; message?: string };
  console.error('[questions/generate] Error:', err.message || error);
  if (err.status === 401) return unavailable('unknown', 502, 'Cheia Anthropic este invalidă');
  if (err.status === 429) return unavailable('unknown', 429, 'Limită de rată atinsă. Reîncearcă în câteva secunde.');
  return unavailable('unknown', 500, 'Eroare la generarea întrebărilor');
}

export function createGenerateQuestionsHandler<C extends AuthClient>(getDeps: () => GenerateQuestionsDeps<C>) {
  return withErrorBoundary(async (request: NextRequest) => {
    const deps = getDeps();
    const guard = await requireUser({ createClient: deps.createClient });
    if (!guard.ok) return guard.response;

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return httpError(400, 'Body JSON invalid');
    }
    const body: RawBody = typeof raw === 'object' && raw !== null ? (raw as RawBody) : {};

    const { category } = body;
    if (!isQuestionCategory(category)) {
      return httpError(400, `Categorie invalidă. Categorii valide: ${VALID_CATEGORIES.join(', ')}`);
    }

    const ce = clip(body.problemContext?.ce, 600);
    const unde = clip(body.problemContext?.unde, 300);
    const cand = clip(body.problemContext?.cand, 200);
    const institutie = clip(body.institutionName, 200);
    if (!ce || !unde) return httpError(400, 'problemContext.ce și problemContext.unde sunt obligatorii');

    let client: AnthropicClient;
    try {
      client = deps.anthropic;
    } catch (err) {
      if (!(err instanceof EnvError)) throw err;
      console.error(`[questions/generate] ${err.message}`);
      return unavailable(category, 503, 'Serviciul de generare nu este configurat');
    }

    try {
      const response = await client.messages.create({
        model: HAIKU_MODEL,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserPrompt(ce, unde, cand, institutie, category) }],
      });
      const text = textOf(response);
      const questions = parseQuestions(text).slice(0, MAX_QUESTIONS);
      if (questions.length === 0) {
        console.warn(`[questions/generate] Empty result for ${category}:`, text.slice(0, 200));
      }
      return json({ category, questions });
    } catch (error) {
      return mapProviderError(error);
    }
  }, 'questions/generate');
}

let cachedAnthropic: Anthropic | null = null;

function defaultAnthropic(): AnthropicClient {
  if (!cachedAnthropic) cachedAnthropic = new Anthropic({ apiKey: requireSecret('ANTHROPIC_API_KEY') });
  return cachedAnthropic;
}

export function createQuestionsDeps(): GenerateQuestionsDeps {
  return {
    createClient: createServerClient,
    get anthropic() {
      return defaultAnthropic();
    },
  };
}

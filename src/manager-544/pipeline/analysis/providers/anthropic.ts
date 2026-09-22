/**
 * Claude Haiku as the email classifier.
 *
 * No JSON mode: the system prompt demands a bare JSON object and `parseAnalysisJson`
 * also accepts a fenced ```json block. The SDK is injected through a structural slice
 * so tests never touch the network; production builds the real client from
 * ANTHROPIC_API_KEY (a placeholder key is an EnvError, not a silent fallback).
 */
import Anthropic from '@anthropic-ai/sdk';
import { requireSecret } from '@m544/shared/env';
import type { AnalysisClient } from '../client';

export const HAIKU_ANALYSIS_MODEL = 'claude-haiku-4-5-20251001';
export const ANTHROPIC_MAX_TOKENS = 2048;

/**
 * Plafonul API-ului e de 32 MB pe întreaga cerere; lăsăm loc pentru prompt şi pentru
 * creşterea de ~33% a codării base64. Un PDF peste limită opreşte apelul cu o eroare
 * explicită, în loc să fie tăcut ignorat — emailul ajunge atunci în `failed`, cu motivul
 * scris în `error_log`, unde se poate vedea şi acţiona.
 */
export const MAX_PDF_BYTES = 20 * 1024 * 1024;

/** Low temperature for deterministic extraction. */
const ANALYSIS_TEMPERATURE = 0.1;

/** The part of the Anthropic SDK the analyser uses (`new Anthropic(...)` satisfies it). */
export interface AnthropicMessagesSdk {
  messages: {
    create(params: Anthropic.Messages.MessageCreateParamsNonStreaming): Promise<Anthropic.Messages.Message>;
  };
}

export interface AnthropicAnalysisOptions {
  /** Explicit key; defaults to ANTHROPIC_API_KEY. Ignored when `sdk` is given. */
  apiKey?: string;
  /** Defaults to HAIKU_ANALYSIS_MODEL. */
  model?: string;
  /** Injected SDK (tests); defaults to a real client. */
  sdk?: AnthropicMessagesSdk;
}

function textOf(message: Anthropic.Messages.Message): string {
  return message.content
    .filter((block): block is Anthropic.Messages.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

export function createAnthropicAnalysisClient(opts: AnthropicAnalysisOptions = {}): AnalysisClient {
  const model = opts.model ?? HAIKU_ANALYSIS_MODEL;
  const sdk = opts.sdk ?? new Anthropic({ apiKey: opts.apiKey ?? requireSecret('ANTHROPIC_API_KEY') });

  return {
    async complete(system, user, pdf) {
      const response = await sdk.messages.create({
        model,
        max_tokens: ANTHROPIC_MAX_TOKENS,
        temperature: ANALYSIS_TEMPERATURE,
        system,
        messages: [{ role: 'user', content: userContent(user, pdf) }],
      });
      return textOf(response);
    },
  };
}

/**
 * Textul singur când nu e ataşament; altfel blocul `document` ÎNAINTEA textului —
 * ordinea cerută de documentaţie. Serverul redă fiecare pagină ca imagine şi îi dă
 * modelului şi textul extras, deci ştampilele, semnăturile şi numerele de înregistrare
 * scrise de mână rămân vizibile, spre deosebire de un OCR care întoarce doar text.
 */
function userContent(
  user: string,
  pdf?: Uint8Array,
): Anthropic.Messages.MessageParam['content'] {
  if (!pdf) return user;
  if (pdf.byteLength > MAX_PDF_BYTES) {
    throw new Error(
      `PDF prea mare pentru analiză: ${Math.round(pdf.byteLength / 1024 / 1024)} MB > ${MAX_PDF_BYTES / 1024 / 1024} MB`,
    );
  }
  return [
    {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: Buffer.from(pdf).toString('base64') },
    },
    { type: 'text', text: user },
  ];
}

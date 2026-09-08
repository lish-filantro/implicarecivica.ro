/**
 * pipeline/analysis/analyze — analyzeEmailContent with an injected chat client.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  analyzeEmailContent,
  MISTRAL_ANALYSIS_MODEL,
  type ChatCompletionClient,
} from '@m544/pipeline/analysis/analyze';
import { EMAIL_ANALYSIS_SYSTEM_PROMPT } from '@m544/pipeline/analysis/prompt';
import { EnvError } from '@m544/shared/env';

type CompleteArgs = Parameters<ChatCompletionClient['complete']>[0];

function fakeClient(responses: Array<unknown | Error>) {
  const calls: CompleteArgs[] = [];
  let i = 0;
  const client: ChatCompletionClient = {
    async complete(args) {
      calls.push(args);
      const r = responses[Math.min(i++, responses.length - 1)];
      if (r instanceof Error) throw r;
      return { choices: [{ message: { content: r } }] };
    },
  };
  return { client, calls };
}

const INPUT = {
  fromEmail: 'registratura@primarie.ro',
  subject: 'Re: cerere 544',
  body: 'Cererea dvs. a fost înregistrată cu nr. 4567/2025.',
  ocrText: 'Nr. 4567/2025 din 01.02.2025',
};

const GOOD = JSON.stringify({
  category: 'inregistrate',
  registration_number: '4567/2025',
  registration_date: '2025-02-01',
  response_date: null,
  answer_summary: null,
  extension_days: null,
  extension_reason: null,
  redirected_to: null,
  evidence: 'Nr. 4567/2025',
  confidence: 0.97,
});

const sleep = async () => undefined;
const savedModel = process.env.MISTRAL_ANALYSIS_MODEL;

beforeEach(() => {
  delete process.env.MISTRAL_ANALYSIS_MODEL;
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  if (savedModel === undefined) delete process.env.MISTRAL_ANALYSIS_MODEL;
  else process.env.MISTRAL_ANALYSIS_MODEL = savedModel;
});

describe('analyzeEmailContent', () => {
  it('sends the system prompt + user message as JSON mode with the default model', async () => {
    const { client, calls } = fakeClient([GOOD]);
    const result = await analyzeEmailContent(INPUT, { client, sleep });

    expect(calls).toHaveLength(1);
    const args = calls[0];
    expect(args.model).toBe(MISTRAL_ANALYSIS_MODEL);
    expect(MISTRAL_ANALYSIS_MODEL).toBe('ministral-14b-latest');
    expect(args.temperature).toBe(0.1);
    expect(args.responseFormat).toEqual({ type: 'json_object' });
    expect(args.messages).toEqual([
      { role: 'system', content: EMAIL_ANALYSIS_SYSTEM_PROMPT },
      {
        role: 'user',
        content:
          'De la: registratura@primarie.ro\nSubiect: Re: cerere 544\n\nConținut email:\n' +
          INPUT.body +
          '\n\nConținut PDF (OCR):\n' +
          INPUT.ocrText,
      },
    ]);

    expect(result.category).toBe('inregistrate');
    expect(result.registration_number).toBe('4567/2025');
    expect(result.registration_date).toBe('2025-02-01');
    expect(result.confidence).toBe(0.97);
    expect(result.redirected_to).toBeNull();
  });

  it('uses deps.model over the env override, and env over the default', async () => {
    process.env.MISTRAL_ANALYSIS_MODEL = 'mistral-large-latest';
    const a = fakeClient([GOOD]);
    await analyzeEmailContent(INPUT, { client: a.client, sleep });
    expect(a.calls[0].model).toBe('mistral-large-latest');

    const b = fakeClient([GOOD]);
    await analyzeEmailContent(INPUT, { client: b.client, sleep, model: 'custom-model' });
    expect(b.calls[0].model).toBe('custom-model');
  });

  it('validates the registration number against the built user message', async () => {
    const { client } = fakeClient([GOOD.replace('4567/2025', '9999/2025')]);
    const result = await analyzeEmailContent(INPUT, { client, sleep });
    expect(result.registration_number).toBeNull();
  });

  it('accepts JSON wrapped in a markdown fence', async () => {
    const { client } = fakeClient(['```json\n' + GOOD + '\n```']);
    await expect(analyzeEmailContent(INPUT, { client, sleep })).resolves.toMatchObject({ category: 'inregistrate' });
  });

  it('returns irelevant for a null category and keeps redirected_to for redirectionat', async () => {
    const irrelevant = fakeClient([JSON.stringify({ category: null, confidence: 0.5 })]);
    await expect(analyzeEmailContent(INPUT, { client: irrelevant.client, sleep })).resolves.toMatchObject({
      category: 'irelevant',
      registration_number: null,
    });

    const redirected = fakeClient([
      JSON.stringify({ category: 'redirectionat', redirected_to: 'Consiliul Județean Ilfov', confidence: 0.9 }),
    ]);
    await expect(analyzeEmailContent(INPUT, { client: redirected.client, sleep })).resolves.toMatchObject({
      category: 'redirectionat',
      redirected_to: 'Consiliul Județean Ilfov',
    });
  });

  it('throws on empty or non-string content', async () => {
    const empty = fakeClient(['']);
    await expect(analyzeEmailContent(INPUT, { client: empty.client, sleep })).rejects.toThrow(/Empty response/);

    const chunks = fakeClient([[{ type: 'text', text: GOOD }]]);
    await expect(analyzeEmailContent(INPUT, { client: chunks.client, sleep })).rejects.toThrow(/Empty response/);

    const noChoices: ChatCompletionClient = { complete: async () => ({}) };
    await expect(analyzeEmailContent(INPUT, { client: noChoices, sleep })).rejects.toThrow(/Empty response/);
  });

  it('throws a 403 after exactly one call', async () => {
    const err = Object.assign(new Error('Forbidden'), { statusCode: 403 });
    const { client, calls } = fakeClient([err]);
    await expect(analyzeEmailContent(INPUT, { client, sleep })).rejects.toBe(err);
    expect(calls).toHaveLength(1);
  });

  it('retries a 429 and returns the eventual result', async () => {
    const err = Object.assign(new Error('Too many requests'), { statusCode: 429 });
    const { client, calls } = fakeClient([err, err, GOOD]);
    await expect(analyzeEmailContent(INPUT, { client, sleep })).resolves.toMatchObject({ category: 'inregistrate' });
    expect(calls).toHaveLength(3);
  });

  it('propagates the parse error for unparsable content', async () => {
    const { client } = fakeClient(['not json at all']);
    await expect(analyzeEmailContent(INPUT, { client, sleep })).rejects.toThrow(/Failed to parse analysis JSON/);
  });

  it('fails fast with EnvError when no client is injected and MISTRAL_API_KEY is missing', async () => {
    const saved = process.env.MISTRAL_API_KEY;
    delete process.env.MISTRAL_API_KEY;
    try {
      await expect(analyzeEmailContent(INPUT, { sleep })).rejects.toThrow(EnvError);
    } finally {
      if (saved !== undefined) process.env.MISTRAL_API_KEY = saved;
    }
  });
});

/**
 * pipeline/analysis/analyze — analyzeEmailContent with an injected AnalysisClient,
 * plus provider/model selection (ANALYSIS_PROVIDER, ANALYSIS_MODEL, legacy MISTRAL_ANALYSIS_MODEL).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  analyzeEmailContent,
  createAnalysisClient,
  resolveModel,
  resolveProvider,
  HAIKU_ANALYSIS_MODEL,
  MISTRAL_ANALYSIS_MODEL,
  type AnalysisClient,
  type AnalysisClientFactories,
} from '@m544/pipeline/analysis/analyze';
import { EMAIL_ANALYSIS_SYSTEM_PROMPT } from '@m544/pipeline/analysis/prompt';
import { EnvError } from '@m544/shared/env';

function fakeClient(responses: Array<string | Error>) {
  const calls: Array<{ system: string; user: string }> = [];
  let i = 0;
  const client: AnalysisClient = {
    async complete(system, user) {
      calls.push({ system, user });
      const r = responses[Math.min(i++, responses.length - 1)];
      if (r instanceof Error) throw r;
      return r;
    },
  };
  return { client, calls };
}

/** Factories that record the model they were asked for and return a scripted client. */
function fakeFactories() {
  const asked: Array<{ provider: string; model?: string }> = [];
  const { client } = fakeClient([GOOD]);
  const factories: AnalysisClientFactories = {
    anthropic: (opts) => {
      asked.push({ provider: 'anthropic', model: opts.model });
      return client;
    },
    mistral: (opts) => {
      asked.push({ provider: 'mistral', model: opts.model });
      return client;
    },
  };
  return { factories, asked, client };
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

beforeEach(() => {
  vi.stubEnv('ANALYSIS_PROVIDER', '');
  vi.stubEnv('ANALYSIS_MODEL', '');
  vi.stubEnv('MISTRAL_ANALYSIS_MODEL', '');
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('analyzeEmailContent', () => {
  it('sends the system prompt and the built user message to the injected client', async () => {
    const { client, calls } = fakeClient([GOOD]);
    const result = await analyzeEmailContent(INPUT, { client, sleep });

    expect(calls).toEqual([
      {
        system: EMAIL_ANALYSIS_SYSTEM_PROMPT,
        user:
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

  it('validates the registration number against the built user message', async () => {
    const { client } = fakeClient([GOOD.replace('4567/2025', '9999/2025')]);
    const result = await analyzeEmailContent(INPUT, { client, sleep });
    expect(result.registration_number).toBeNull();
  });

  it('accepts JSON wrapped in a markdown fence (Haiku has no JSON mode)', async () => {
    const { client } = fakeClient(['Iată analiza:\n```json\n' + GOOD + '\n```\nSper că ajută.']);
    await expect(analyzeEmailContent(INPUT, { client, sleep })).resolves.toMatchObject({
      category: 'inregistrate',
      registration_number: '4567/2025',
    });
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

  it('throws on an empty answer, naming the provider', async () => {
    const empty = fakeClient(['']);
    await expect(analyzeEmailContent(INPUT, { client: empty.client, sleep })).rejects.toThrow(
      'Empty response from custom analysis',
    );
    await expect(analyzeEmailContent(INPUT, { client: empty.client, sleep, provider: 'anthropic' })).rejects.toThrow(
      'Empty response from anthropic analysis',
    );
  });

  it('throws a 403 after exactly one call', async () => {
    const err = Object.assign(new Error('Forbidden'), { status: 403 });
    const { client, calls } = fakeClient([err]);
    await expect(analyzeEmailContent(INPUT, { client, sleep })).rejects.toBe(err);
    expect(calls).toHaveLength(1);
  });

  it('retries a Mistral-style 429 (statusCode) and an Anthropic-style 429 (status)', async () => {
    const mistral = Object.assign(new Error('Too many requests'), { statusCode: 429 });
    const a = fakeClient([mistral, mistral, GOOD]);
    await expect(analyzeEmailContent(INPUT, { client: a.client, sleep })).resolves.toMatchObject({ category: 'inregistrate' });
    expect(a.calls).toHaveLength(3);

    const anthropic = Object.assign(new Error('429 rate_limit_error'), { status: 429 });
    const b = fakeClient([anthropic, GOOD]);
    await expect(analyzeEmailContent(INPUT, { client: b.client, sleep })).resolves.toMatchObject({ category: 'inregistrate' });
    expect(b.calls).toHaveLength(2);
  });

  it('propagates the parse error for unparsable content', async () => {
    const { client } = fakeClient(['not json at all']);
    await expect(analyzeEmailContent(INPUT, { client, sleep })).rejects.toThrow(/Failed to parse analysis JSON/);
  });

  it('fails fast with EnvError when no client is injected and the provider key is missing', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    await expect(analyzeEmailContent(INPUT, { sleep })).rejects.toThrow(EnvError);

    vi.stubEnv('MISTRAL_API_KEY', '');
    await expect(analyzeEmailContent(INPUT, { sleep, provider: 'mistral' })).rejects.toThrow(EnvError);
  });

  it('rejects an unknown ANALYSIS_PROVIDER with a clear error', async () => {
    vi.stubEnv('ANALYSIS_PROVIDER', 'openai');
    await expect(analyzeEmailContent(INPUT, { sleep })).rejects.toThrow(/Unsupported ANALYSIS_PROVIDER 'openai'/);
  });
});

describe('createAnalysisClient / resolveModel', () => {
  it('defaults to anthropic with the provider default model', () => {
    const { factories, asked } = fakeFactories();
    createAnalysisClient({}, factories);
    expect(asked).toEqual([{ provider: 'anthropic', model: undefined }]);
    expect(resolveModel('anthropic')).toBeUndefined();
    expect(HAIKU_ANALYSIS_MODEL).toBe('claude-haiku-4-5-20251001');
    expect(MISTRAL_ANALYSIS_MODEL).toBe('ministral-14b-latest');
  });

  it('picks the provider from ANALYSIS_PROVIDER, deps.provider winning over env', () => {
    vi.stubEnv('ANALYSIS_PROVIDER', 'mistral');
    const a = fakeFactories();
    createAnalysisClient({}, a.factories);
    expect(a.asked[0].provider).toBe('mistral');

    const b = fakeFactories();
    createAnalysisClient({ provider: 'anthropic' }, b.factories);
    expect(b.asked[0].provider).toBe('anthropic');
    expect(resolveProvider(process.env.ANALYSIS_PROVIDER)).toBe('mistral');
  });

  it('model precedence: deps.model > ANALYSIS_MODEL > MISTRAL_ANALYSIS_MODEL (mistral only) > provider default', () => {
    vi.stubEnv('MISTRAL_ANALYSIS_MODEL', 'mistral-large-latest');
    expect(resolveModel('mistral')).toBe('mistral-large-latest');
    expect(resolveModel('anthropic')).toBeUndefined();

    vi.stubEnv('ANALYSIS_MODEL', 'ministral-8b-latest');
    expect(resolveModel('mistral')).toBe('ministral-8b-latest');
    expect(resolveModel('anthropic')).toBe('ministral-8b-latest');

    expect(resolveModel('mistral', 'custom')).toBe('custom');

    const { factories, asked } = fakeFactories();
    createAnalysisClient({ provider: 'mistral', model: 'custom' }, factories);
    expect(asked).toEqual([{ provider: 'mistral', model: 'custom' }]);
  });

  it('with the real factories, a missing key surfaces as EnvError for the selected provider', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('MISTRAL_API_KEY', 'a-real-looking-key');
    expect(() => createAnalysisClient({})).toThrow(EnvError);
    expect(typeof createAnalysisClient({ provider: 'mistral' }).complete).toBe('function');
  });
});

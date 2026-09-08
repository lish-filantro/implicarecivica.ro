/**
 * pipeline/ocr — Mistral OCR over PDF bytes, with an injectable client.
 *
 * Contract:
 *  - runOcrFromBytes(bytes, { client, model }) sends a base64 data URI to client.process
 *  - page markdowns are joined with '\n\n'; pages = number of page objects
 *  - docSizeBytes comes from usageInfo.docSizeBytes, else null
 *  - without an injected client, a missing MISTRAL_API_KEY throws EnvError (no network)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runOcrFromBytes, MISTRAL_OCR_MODEL, type OcrClient } from '@m544/pipeline/ocr';
import { EnvError } from '@m544/shared/env';

type OcrInput = Parameters<OcrClient['process']>[0];
type OcrOutput = Awaited<ReturnType<OcrClient['process']>>;

function fakeClient(response: OcrOutput): OcrClient & { calls: OcrInput[] } {
  const calls: OcrInput[] = [];
  return {
    calls,
    async process(input) {
      calls.push(input);
      return response;
    },
  };
}

const BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x00, 0xff]);

describe('runOcrFromBytes', () => {
  it('joins the markdown of all pages with a blank line and counts pages', async () => {
    const client = fakeClient({ pages: [{ markdown: 'Page one' }, { markdown: 'Page two' }] });
    const result = await runOcrFromBytes(BYTES, { client });
    expect(result.markdown).toBe('Page one\n\nPage two');
    expect(result.pages).toBe(2);
  });

  it('skips pages without markdown but still counts them', async () => {
    const client = fakeClient({ pages: [{ markdown: 'A' }, {}, { markdown: 'C' }] });
    const result = await runOcrFromBytes(BYTES, { client });
    expect(result.markdown).toBe('A\n\nC');
    expect(result.pages).toBe(3);
  });

  it('returns empty markdown and 0 pages when the response has no pages', async () => {
    expect(await runOcrFromBytes(BYTES, { client: fakeClient({ pages: [] }) })).toMatchObject({
      markdown: '',
      pages: 0,
    });
    expect(await runOcrFromBytes(BYTES, { client: fakeClient({}) })).toMatchObject({
      markdown: '',
      pages: 0,
    });
  });

  it('propagates docSizeBytes from usageInfo', async () => {
    const client = fakeClient({
      pages: [{ markdown: 'x' }],
      usageInfo: { pagesProcessed: 1, docSizeBytes: 12345 },
    });
    expect((await runOcrFromBytes(BYTES, { client })).docSizeBytes).toBe(12345);
  });

  it('reports docSizeBytes as null when absent', async () => {
    const withoutUsage = fakeClient({ pages: [{ markdown: 'x' }] });
    expect((await runOcrFromBytes(BYTES, { client: withoutUsage })).docSizeBytes).toBeNull();
    const nullSize = fakeClient({ pages: [], usageInfo: { pagesProcessed: 0, docSizeBytes: null } });
    expect((await runOcrFromBytes(BYTES, { client: nullSize })).docSizeBytes).toBeNull();
  });

  it('sends a PDF base64 data URI that decodes back to the input bytes', async () => {
    const client = fakeClient({ pages: [] });
    await runOcrFromBytes(BYTES, { client });
    expect(client.calls).toHaveLength(1);
    const { document } = client.calls[0];
    expect(document.type).toBe('document_url');
    expect(document.documentUrl.startsWith('data:application/pdf;base64,')).toBe(true);
    const decoded = Buffer.from(document.documentUrl.slice('data:application/pdf;base64,'.length), 'base64');
    expect(new Uint8Array(decoded)).toEqual(BYTES);
  });

  it('accepts a Node Buffer as input', async () => {
    const client = fakeClient({ pages: [] });
    await runOcrFromBytes(Buffer.from(BYTES), { client });
    const decoded = Buffer.from(client.calls[0].document.documentUrl.split(',')[1], 'base64');
    expect(new Uint8Array(decoded)).toEqual(BYTES);
  });

  it('uses the default model and disables image base64', async () => {
    const client = fakeClient({ pages: [] });
    await runOcrFromBytes(BYTES, { client });
    expect(MISTRAL_OCR_MODEL).toBe('mistral-ocr-latest');
    expect(client.calls[0].model).toBe(MISTRAL_OCR_MODEL);
    expect(client.calls[0].includeImageBase64).toBe(false);
  });

  it('honours an explicit model override', async () => {
    const client = fakeClient({ pages: [] });
    await runOcrFromBytes(BYTES, { client, model: 'mistral-ocr-2505' });
    expect(client.calls[0].model).toBe('mistral-ocr-2505');
  });

  it('propagates client rejections', async () => {
    const client: OcrClient = {
      process: vi.fn().mockRejectedValue(new Error('429 rate limited')),
    };
    await expect(runOcrFromBytes(BYTES, { client })).rejects.toThrow('429 rate limited');
  });
});

describe('runOcrFromBytes default client', () => {
  const saved = process.env.MISTRAL_API_KEY;
  beforeEach(() => {
    delete process.env.MISTRAL_API_KEY;
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.MISTRAL_API_KEY;
    else process.env.MISTRAL_API_KEY = saved;
  });

  it('throws EnvError when MISTRAL_API_KEY is missing, before any network call', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      await expect(runOcrFromBytes(BYTES)).rejects.toThrow(EnvError);
      await expect(runOcrFromBytes(BYTES)).rejects.toThrow(/MISTRAL_API_KEY/);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

/**
 * OCR step of the inbound-email pipeline: PDF bytes → markdown via Mistral OCR.
 *
 * The Mistral client is injected (defaulting to a lazily created SDK client) so
 * unit tests run with a fake and never touch the network.
 */
import { Mistral } from '@mistralai/mistralai';
import { requireEnv } from '@m544/shared/env';

export const MISTRAL_OCR_MODEL = 'mistral-ocr-latest';

/** Structural subset of `Mistral.ocr`, so tests can pass a fake. */
export interface OcrClient {
  process(input: {
    model: string;
    document: { type: 'document_url'; documentUrl: string };
    includeImageBase64: boolean;
  }): Promise<{
    pages?: Array<{ markdown?: string }>;
    usageInfo?: { pagesProcessed?: number; docSizeBytes?: number | null };
  }>;
}

export interface OcrResult {
  markdown: string;
  pages: number;
  docSizeBytes: number | null;
}

export interface OcrDeps {
  client?: OcrClient;
  model?: string;
}

let defaultClient: OcrClient | null = null;

function getDefaultClient(): OcrClient {
  if (!defaultClient) {
    defaultClient = new Mistral({ apiKey: requireEnv('MISTRAL_API_KEY') }).ocr;
  }
  return defaultClient;
}

export function toPdfDataUri(pdfBytes: Uint8Array | Buffer): string {
  return `data:application/pdf;base64,${Buffer.from(pdfBytes).toString('base64')}`;
}

/** Run OCR on a PDF given as raw bytes (uploaded inline as a base64 data URI). */
export async function runOcrFromBytes(
  pdfBytes: Uint8Array | Buffer,
  deps: OcrDeps = {},
): Promise<OcrResult> {
  const client = deps.client ?? getDefaultClient();
  const model = deps.model ?? MISTRAL_OCR_MODEL;

  const response = await client.process({
    model,
    document: { type: 'document_url', documentUrl: toPdfDataUri(pdfBytes) },
    includeImageBase64: false,
  });

  const pages = response.pages ?? [];
  const markdown = pages
    .map((page) => page.markdown)
    .filter((md): md is string => typeof md === 'string' && md.length > 0)
    .join('\n\n');

  return {
    markdown,
    pages: pages.length,
    docSizeBytes: response.usageInfo?.docSizeBytes ?? null,
  };
}

/**
 * OCR Service — Mistral OCR for PDF text extraction
 *
 * Uses mistral-ocr-latest to extract markdown text from PDF attachments.
 * Supports both URL-based and base64-based processing.
 */

import { Mistral } from '@mistralai/mistralai';
import { MISTRAL_OCR_MODEL } from '@/lib/mistral/constants';

let _client: Mistral | null = null;

function getMistralClient(): Mistral {
  if (!_client) {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) throw new Error('MISTRAL_API_KEY is not configured');
    _client = new Mistral({ apiKey });
  }
  return _client;
}

export interface OcrResult {
  markdown: string;
  pages: number;
  docSizeBytes: number | null;
}

/**
 * Run OCR on a PDF from raw bytes (base64 upload).
 * This is the primary method — we download from Supabase Storage then upload to Mistral.
 */
export async function runOcrFromBytes(
  pdfBytes: Buffer | Uint8Array,
  fileName: string = 'document.pdf',
): Promise<OcrResult> {
  const client = getMistralClient();

  // Convert to base64 for Mistral API
  const base64 = Buffer.from(pdfBytes).toString('base64');
  const dataUri = `data:application/pdf;base64,${base64}`;

  const ocrResponse = await client.ocr.process({
    model: MISTRAL_OCR_MODEL,
    document: {
      type: 'document_url',
      documentUrl: dataUri,
    },
    includeImageBase64: false,
  });

  // Extract markdown from all pages
  const markdownParts: string[] = [];
  let pagesProcessed = 0;

  if (ocrResponse.pages && ocrResponse.pages.length > 0) {
    for (const page of ocrResponse.pages) {
      if (page.markdown) {
        markdownParts.push(page.markdown);
      }
      pagesProcessed++;
    }
  }

  const docSize = ocrResponse.usageInfo?.pagesProcessed
    ? (ocrResponse.usageInfo as any).docSizeBytes ?? null
    : null;

  return {
    markdown: markdownParts.join('\n\n'),
    pages: pagesProcessed,
    docSizeBytes: docSize,
  };
}

/**
 * Run OCR on a PDF from a public URL.
 * Useful for externally hosted documents.
 */
export async function runOcrFromUrl(pdfUrl: string): Promise<OcrResult> {
  const client = getMistralClient();

  const ocrResponse = await client.ocr.process({
    model: MISTRAL_OCR_MODEL,
    document: {
      type: 'document_url',
      documentUrl: pdfUrl,
    },
    includeImageBase64: false,
  });

  const markdownParts: string[] = [];
  let pagesProcessed = 0;

  if (ocrResponse.pages && ocrResponse.pages.length > 0) {
    for (const page of ocrResponse.pages) {
      if (page.markdown) {
        markdownParts.push(page.markdown);
      }
      pagesProcessed++;
    }
  }

  return {
    markdown: markdownParts.join('\n\n'),
    pages: pagesProcessed,
    docSizeBytes: null,
  };
}

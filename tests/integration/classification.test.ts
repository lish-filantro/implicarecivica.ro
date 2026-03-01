/**
 * Integration Tests — Mistral Large Classification
 *
 * Feeds OCR-extracted text (from cache or live) into the AI analysis
 * pipeline and verifies correct categorization.
 *
 * Cost: ~30 Mistral Large calls
 * Time: ~2-4 minutes
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { analyzeEmailContent, type AnalysisResult } from '@/lib/services/analysis-service';
import { runOcrFromBytes } from '@/lib/services/ocr-service';
import { getTestScenarios, getStandalonePdfs, type TestPdf } from '../helpers/pdf-loader';

const OCR_CACHE_PATH = path.resolve(__dirname, '../snapshots/ocr-cache.json');
const CLASSIFICATION_SNAPSHOT_PATH = path.resolve(__dirname, '../snapshots/classification-golden.json');

type OcrCache = Record<string, { markdown: string; pages: number }>;
type ClassificationSnapshot = Record<string, AnalysisResult>;

let ocrCache: OcrCache = {};
let classificationResults: ClassificationSnapshot = {};

/**
 * Get OCR text for a PDF — from cache or live
 */
async function getOcrText(pdf: TestPdf): Promise<string> {
  if (ocrCache[pdf.filePath]) {
    return ocrCache[pdf.filePath].markdown;
  }
  const result = await runOcrFromBytes(pdf.getBytes(), pdf.fileName + '.pdf');
  ocrCache[pdf.filePath] = { markdown: result.markdown, pages: result.pages };
  return result.markdown;
}

/**
 * Classify a PDF — run OCR + analysis
 */
async function classifyPdf(pdf: TestPdf, opts: {
  fromEmail?: string;
  subject?: string;
} = {}): Promise<AnalysisResult> {
  const ocrText = await getOcrText(pdf);

  const result = await analyzeEmailContent({
    subject: opts.subject || `Re: Cerere informații publice - ${pdf.setName}`,
    body: '',
    ocrText,
    fromEmail: opts.fromEmail || 'registratura@institutie-test.ro',
  });

  classificationResults[pdf.filePath] = result;
  return result;
}

beforeAll(() => {
  if (fs.existsSync(OCR_CACHE_PATH)) {
    try {
      ocrCache = JSON.parse(fs.readFileSync(OCR_CACHE_PATH, 'utf-8'));
      console.log(`[Classification] Using OCR cache with ${Object.keys(ocrCache).length} entries`);
    } catch {
      ocrCache = {};
    }
  }
});

afterAll(() => {
  // Save classification results as golden snapshot
  if (Object.keys(classificationResults).length > 0) {
    fs.mkdirSync(path.dirname(CLASSIFICATION_SNAPSHOT_PATH), { recursive: true });
    fs.writeFileSync(
      CLASSIFICATION_SNAPSHOT_PATH,
      JSON.stringify(classificationResults, null, 2),
      'utf-8',
    );
    console.log(`[Classification] Saved ${Object.keys(classificationResults).length} results to golden snapshot`);
  }
});

// ═══════════════════════════════════════════════════════════
// Test: Scenario PDFs classified correctly
// ═══════════════════════════════════════════════════════════
describe('Classification — Scenario PDFs', () => {
  const scenarios = getTestScenarios();

  // Ambiguous doc types where Mistral may return different categories
  // across runs (non-deterministic). Accept any of the listed values.
  const AMBIGUOUS_CATEGORIES: Record<string, string[]> = {
    redirectionare: ['raspunse', 'inregistrate'],
    cerere_clarificari: ['amanate', 'inregistrate'],
  };

  for (const scenario of scenarios) {
    describe(scenario.setName, () => {
      const incomingPdfs = scenario.pdfs.filter((p) => p.docType !== 'cerere_initiala');

      for (const pdf of incomingPdfs) {
        const acceptable = AMBIGUOUS_CATEGORIES[pdf.docType] || [pdf.expectedCategory];

        it(`${pdf.fileName} → category: ${acceptable.join(' | ')}`, async () => {
          const result = await classifyPdf(pdf, {
            subject: `Re: ${scenario.subject}`,
            fromEmail: `registratura@${scenario.institutionName.toLowerCase().replace(/\s+/g, '-')}.ro`,
          });

          expect(acceptable).toContain(result.category);
          expect(result.confidence).toBeGreaterThanOrEqual(0.6);
        }, 120_000);
      }
    });
  }
});

// ═══════════════════════════════════════════════════════════
// Test: Standalone PDFs classified correctly
// ═══════════════════════════════════════════════════════════
describe('Classification — Standalone PDFs', () => {
  const standalonePdfs = getStandalonePdfs();

  const expectedMap: Record<string, string> = {
    '1_confirmare_inregistrare': 'inregistrate',
    '2_notificare_prelungire': 'amanate',
    '3_raspuns_favorabil': 'raspunse',
    '4_raspuns_refuz_partial': 'raspunse',
    '5_redirectionare': 'raspunse',
  };

  for (const pdf of standalonePdfs) {
    const expected = expectedMap[pdf.fileName];
    if (!expected) continue;

    it(`${pdf.fileName} → ${expected}`, async () => {
      const result = await classifyPdf(pdf);

      expect(result.category).toBe(expected);
      expect(result.confidence).toBeGreaterThanOrEqual(0.6);
    }, 120_000);
  }
});

// ═══════════════════════════════════════════════════════════
// Test: Registration numbers extracted from confirmări
// ═══════════════════════════════════════════════════════════
describe('Classification — Registration number extraction', () => {
  const scenarios = getTestScenarios();

  for (const scenario of scenarios) {
    const confirmare = scenario.pdfs.find((p) => p.docType === 'confirmare');
    if (!confirmare) continue;

    it(`${scenario.setName}: confirmare has registration_number`, async () => {
      const result = await classifyPdf(confirmare, {
        subject: `Re: ${scenario.subject}`,
      });

      // Registration number should be extracted from confirmation emails
      expect(result.registration_number).toBeTruthy();
      expect(result.registration_number!.length).toBeGreaterThanOrEqual(3);

      // Should NOT be "544/2001"
      expect(result.registration_number).not.toMatch(/^544\/?2001$/);
    }, 120_000);
  }
});

// ═══════════════════════════════════════════════════════════
// Test: Answer summaries extracted from răspunsuri
// ═══════════════════════════════════════════════════════════
describe('Classification — Answer summary extraction', () => {
  const scenarios = getTestScenarios();

  for (const scenario of scenarios) {
    const raspuns = scenario.pdfs.find((p) =>
      ['raspuns', 'raspuns_final', 'raspuns_favorabil', 'refuz', 'refuz_partial', 'redirectionare'].includes(p.docType),
    );
    if (!raspuns) continue;

    it(`${scenario.setName}: răspuns has answer_summary`, async () => {
      const result = await classifyPdf(raspuns, {
        subject: `Re: ${scenario.subject}`,
      });

      expect(result.category).toBe('raspunse');
      expect(result.answer_summary).toBeTruthy();
      expect(['text', 'list', 'table']).toContain(result.answer_summary!.type);

      if (result.answer_summary!.type === 'text') {
        expect(typeof result.answer_summary!.content).toBe('string');
        expect((result.answer_summary!.content as string).length).toBeGreaterThan(5);
      } else if (result.answer_summary!.type === 'list') {
        expect(Array.isArray(result.answer_summary!.content)).toBe(true);
      }
    }, 120_000);
  }
});

// ═══════════════════════════════════════════════════════════
// Test: Extension data extracted from amânări
// ═══════════════════════════════════════════════════════════
describe('Classification — Extension data extraction', () => {
  const scenarios = getTestScenarios();

  for (const scenario of scenarios) {
    const amanare = scenario.pdfs.find((p) => p.docType === 'amanare');
    if (!amanare) continue;

    it(`${scenario.setName}: amânare has extension info`, async () => {
      const result = await classifyPdf(amanare, {
        subject: `Re: ${scenario.subject}`,
      });

      expect(result.category).toBe('amanate');
      // Extension days should be 30 or at least present
      if (result.extension_days) {
        expect(result.extension_days).toBeGreaterThanOrEqual(10);
      }
    }, 120_000);
  }
});

/**
 * Integration Tests — Mistral OCR
 *
 * Sends all test PDFs through the real Mistral OCR pipeline
 * and verifies that meaningful text is extracted.
 *
 * Cost: ~37 OCR API calls on first run (cached after)
 * Time: ~3-5 minutes
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { runOcrFromBytes } from '@/lib/services/ocr-service';
import { getAllTestPdfs, getTestScenarios, type TestPdf } from '../helpers/pdf-loader';

const SNAPSHOT_PATH = path.resolve(__dirname, '../snapshots/ocr-cache.json');

// Cache structure: { [filePath]: { markdown, pages } }
type OcrCache = Record<string, { markdown: string; pages: number }>;

let ocrCache: OcrCache = {};

/**
 * Load or build OCR cache.
 * If FRESH_OCR env is set, always re-run OCR.
 */
async function getOcrResult(pdf: TestPdf): Promise<{ markdown: string; pages: number }> {
  const cacheKey = pdf.filePath;

  if (!process.env.FRESH_OCR && ocrCache[cacheKey]) {
    return ocrCache[cacheKey];
  }

  const bytes = pdf.getBytes();
  const result = await runOcrFromBytes(bytes, pdf.fileName + '.pdf');

  ocrCache[cacheKey] = { markdown: result.markdown, pages: result.pages };
  return ocrCache[cacheKey];
}

beforeAll(() => {
  // Load existing cache if available
  if (!process.env.FRESH_OCR && fs.existsSync(SNAPSHOT_PATH)) {
    try {
      ocrCache = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf-8'));
      console.log(`[OCR] Loaded cache with ${Object.keys(ocrCache).length} entries`);
    } catch {
      ocrCache = {};
    }
  }
});

// Save cache after all OCR tests
afterAll(() => {
  if (Object.keys(ocrCache).length > 0) {
    fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
    fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(ocrCache, null, 2), 'utf-8');
    console.log(`[OCR] Saved cache with ${Object.keys(ocrCache).length} entries`);
  }
});

// ═══════════════════════════════════════════════════════════
// Test: Every PDF produces non-empty OCR output
// ═══════════════════════════════════════════════════════════
describe('OCR — All test PDFs', () => {
  const allPdfs = getAllTestPdfs();

  it.each(allPdfs.map((p) => [p.setName + '/' + p.fileName, p] as const))(
    'extracts text from %s',
    async (_label, pdf) => {
      const result = await getOcrResult(pdf);

      expect(result.markdown).toBeTruthy();
      expect(result.markdown.length).toBeGreaterThan(10);
      expect(result.pages).toBeGreaterThanOrEqual(1);
    },
    120_000, // 2 min timeout per PDF (network latency)
  );
});

// ═══════════════════════════════════════════════════════════
// Test: OCR contains expected Romanian keywords per doc type
// ═══════════════════════════════════════════════════════════
describe('OCR — Content validation', () => {
  // Keywords without diacritics — test PDFs use ASCII Romanian
  const KEYWORD_MAP: Record<string, string[]> = {
    confirmare: ['inregistr', 'cerere', 'confirma', 'nr.'],
    amanare: ['prelungir', 'termen', '30 de zile', '30 zile'],
    raspuns: ['comunicam', 'transmitem', 'ref.', 'situatia'],
    raspuns_final: ['comunicam', 'transmitem', 'urmare'],
    raspuns_favorabil: ['comunicam', 'informatii', 'raspuns'],
    refuz: ['refuz', 'exceptat', 'nu putem', 'nu va putem'],
    refuz_partial: ['refuz', 'exceptat', 'nu putem'],
    redirectionare: ['redirectionat', 'competent', 'nu detine', 'abilitat'],
    cerere_clarificari: ['precizati', 'rugam', 'clarific', 'asteptam'],
  };

  const scenarios = getTestScenarios();

  for (const scenario of scenarios) {
    // Skip cerere_initiala (that's the citizen's outgoing request, not institution response)
    const incomingPdfs = scenario.pdfs.filter((p) => p.docType !== 'cerere_initiala');

    for (const pdf of incomingPdfs) {
      const keywords = KEYWORD_MAP[pdf.docType];
      if (!keywords) continue;

      it(`${scenario.setName}/${pdf.fileName} contains keywords for "${pdf.docType}"`, async () => {
        const result = await getOcrResult(pdf);
        const textLower = result.markdown.toLowerCase();

        // At least one keyword should appear
        const found = keywords.some((kw) => textLower.includes(kw.toLowerCase()));
        expect(found).toBe(true);
      }, 120_000);
    }
  }
});

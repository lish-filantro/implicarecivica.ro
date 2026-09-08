/**
 * Integration Tests — email classification on the real AI provider
 *
 * Feeds OCR-extracted text (from cache or live) into the AI analysis pipeline
 * and verifies correct categorization, then compares every result with the
 * golden snapshot of the provider under test.
 *
 * How to run:
 *   npx vitest run tests/integration/classification.test.ts
 *     ANALYSIS_PROVIDER=anthropic   (default) → Claude Haiku, snapshot tests/snapshots/classification-golden.anthropic.json
 *     ANALYSIS_PROVIDER=mistral               → ministral, snapshot tests/snapshots/classification-golden.mistral.json
 *                                               (falls back to reading the legacy classification-golden.json)
 *     UPDATE_GOLDEN=1                         → (re)write the provider's snapshot instead of comparing to it.
 *   The snapshot is also written automatically when the provider has none yet.
 *   ANALYSIS_MODEL overrides the provider's default model, as in production.
 *
 * Cost: ~35 provider calls (OCR comes from tests/snapshots/ocr-cache.json)
 * Time: ~2-4 minutes
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { analyzeEmailContent, resolveProvider, type AnalysisResult } from '@m544/pipeline/analysis';
import { runOcrFromBytes } from '@m544/pipeline/ocr';
import { optionalEnv } from '@m544/shared/env';
import { getTestScenarios, getStandalonePdfs, type TestPdf } from '../helpers/pdf-loader';

const SNAPSHOTS_DIR = path.resolve(__dirname, '../snapshots');
const OCR_CACHE_PATH = path.join(SNAPSHOTS_DIR, 'ocr-cache.json');
const LEGACY_GOLDEN_PATH = path.join(SNAPSHOTS_DIR, 'classification-golden.json');

const PROVIDER = resolveProvider(optionalEnv('ANALYSIS_PROVIDER'));
const GOLDEN_PATH = path.join(SNAPSHOTS_DIR, `classification-golden.${PROVIDER}.json`);
const UPDATE_GOLDEN = optionalEnv('UPDATE_GOLDEN') === '1';

type OcrCache = Record<string, { markdown: string; pages: number }>;
type ClassificationSnapshot = Record<string, AnalysisResult>;

let ocrCache: OcrCache = {};
let classificationResults: ClassificationSnapshot = {};
/** Golden of the provider under test (null → none yet, the run will create it). */
let golden: ClassificationSnapshot | null = null;

/** The provider's golden file; for mistral the pre-provider legacy file is accepted as fallback. */
function goldenReadPath(): string | null {
  if (fs.existsSync(GOLDEN_PATH)) return GOLDEN_PATH;
  if (PROVIDER === 'mistral' && fs.existsSync(LEGACY_GOLDEN_PATH)) return LEGACY_GOLDEN_PATH;
  return null;
}

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
  } catch {
    return null;
  }
}

/**
 * Get OCR text for a PDF — from cache or live
 */
async function getOcrText(pdf: TestPdf): Promise<string> {
  if (ocrCache[pdf.filePath]) {
    return ocrCache[pdf.filePath].markdown;
  }
  const result = await runOcrFromBytes(pdf.getBytes());
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
  console.log(`[Classification] Provider: ${PROVIDER}${optionalEnv('ANALYSIS_MODEL') ? ` (model ${optionalEnv('ANALYSIS_MODEL')})` : ''}`);
  if (fs.existsSync(OCR_CACHE_PATH)) {
    ocrCache = readJson<OcrCache>(OCR_CACHE_PATH) ?? {};
    console.log(`[Classification] Using OCR cache with ${Object.keys(ocrCache).length} entries`);
  }
  const goldenFile = goldenReadPath();
  golden = goldenFile ? readJson<ClassificationSnapshot>(goldenFile) : null;
  if (goldenFile) console.log(`[Classification] Golden: ${path.basename(goldenFile)} (${Object.keys(golden ?? {}).length} entries)`);
  else console.log(`[Classification] No golden for ${PROVIDER} yet — this run will create ${path.basename(GOLDEN_PATH)}`);
});

afterAll(() => {
  // Write the provider's golden snapshot when asked to, or when it does not exist yet.
  if (Object.keys(classificationResults).length === 0) return;
  if (!UPDATE_GOLDEN && golden !== null) return;
  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  fs.writeFileSync(GOLDEN_PATH, JSON.stringify(classificationResults, null, 2), 'utf-8');
  console.log(`[Classification] Saved ${Object.keys(classificationResults).length} results to ${path.basename(GOLDEN_PATH)}`);
});

// ═══════════════════════════════════════════════════════════
// Test: Scenario PDFs classified correctly
// ═══════════════════════════════════════════════════════════
describe('Classification — Scenario PDFs', () => {
  const scenarios = getTestScenarios();

  // Ambiguous doc types where the model may return different categories
  // across runs (non-deterministic). Accept any of the listed values.
  const AMBIGUOUS_CATEGORIES: Record<string, string[]> = {
    redirectionare: ['redirectionat'],
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
    '5_redirectionare': 'redirectionat',
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
      ['raspuns', 'raspuns_final', 'raspuns_favorabil', 'refuz', 'refuz_partial'].includes(p.docType),
    );
    if (!raspuns) continue;

    it(`${scenario.setName}: răspuns has answer_summary`, async () => {
      const result = await classifyPdf(raspuns, {
        subject: `Re: ${scenario.subject}`,
      });

      expect(result.category).toBe('raspunse');
      expect(result.answer_summary).toBeTruthy();
      // analyzeEmailContent always returns the structured form (never the legacy string)
      const summary = result.answer_summary as Exclude<typeof result.answer_summary, string | null>;
      expect(['text', 'list', 'table']).toContain(summary.type);

      if (summary.type === 'text') {
        expect(typeof summary.content).toBe('string');
        expect(summary.content.length).toBeGreaterThan(5);
      } else if (summary.type === 'list') {
        expect(Array.isArray(summary.content)).toBe(true);
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

// ═══════════════════════════════════════════════════════════
// Test: Redirecționări name the competent institution
// ═══════════════════════════════════════════════════════════
describe('Classification — Redirect extraction', () => {
  const redirects = [
    ...getStandalonePdfs().filter((p) => p.docType === 'redirectionare'),
    ...getTestScenarios().flatMap((s) => s.pdfs.filter((p) => p.docType === 'redirectionare')),
  ];

  for (const pdf of redirects) {
    it(`${pdf.setName}/${pdf.fileName}: redirectionat with redirected_to`, async () => {
      const result = await classifyPdf(pdf);
      expect(result.category).toBe('redirectionat');
      expect(result.redirected_to).toBeTruthy();
    }, 120_000);
  }
});

// ═══════════════════════════════════════════════════════════
// Test: Golden check — every result matches the provider's snapshot
// ═══════════════════════════════════════════════════════════
describe(`Classification — Golden snapshot (${PROVIDER})`, () => {
  it('category and registration_number match the golden for every classified PDF', () => {
    if (UPDATE_GOLDEN || golden === null) {
      console.log('[Classification] Golden check skipped (snapshot is being written)');
      return;
    }
    const current = golden;
    const differences: string[] = [];
    for (const [file, result] of Object.entries(classificationResults)) {
      const expected = current[file];
      const name = path.basename(path.dirname(file)) + '/' + path.basename(file);
      if (!expected) {
        differences.push(`${name}: not in golden`);
        continue;
      }
      if (expected.category !== result.category) {
        differences.push(`${name}: category ${expected.category} → ${result.category}`);
      }
      if (expected.registration_number !== result.registration_number) {
        differences.push(`${name}: registration_number ${expected.registration_number} → ${result.registration_number}`);
      }
    }
    const report = `Differences vs ${path.basename(GOLDEN_PATH)} (UPDATE_GOLDEN=1 to accept):\n${differences.join('\n')}`;
    expect(differences, report).toEqual([]);
  });
});

/**
 * PDF Loader — Reads test PDFs from the external test_data_pdfs directory
 *
 * Provides structured access to all test scenarios with their expected
 * categories and workflow sequences.
 */
import fs from 'fs';
import path from 'path';

const TEST_PDFS_ROOT = 'D:/implicare civica/544-FULL-APP/django-544-backend/test_data_pdfs';

export type ExpectedCategory = 'inregistrate' | 'amanate' | 'raspunse';

export interface TestPdf {
  /** Full file path */
  filePath: string;
  /** Just the filename */
  fileName: string;
  /** The set/scenario this belongs to */
  setName: string;
  /** Sequential order in the workflow (0 = cerere, 1 = confirmare, etc.) */
  order: number;
  /** Expected AI classification category */
  expectedCategory: ExpectedCategory;
  /** Human-readable document type */
  docType: string;
  /** PDF bytes (lazy-loaded) */
  getBytes: () => Buffer;
}

export interface TestScenario {
  /** Directory name */
  setName: string;
  /** Human description */
  description: string;
  /** Institution name for this scenario */
  institutionName: string;
  /** Subject line for emails */
  subject: string;
  /** Ordered sequence of PDFs */
  pdfs: TestPdf[];
  /** Expected final request status after processing all emails */
  expectedFinalStatus: string;
}

/**
 * Infer expected category from filename
 */
function inferCategory(fileName: string): ExpectedCategory {
  const lower = fileName.toLowerCase();
  if (lower.includes('confirmare') || lower.includes('inregistrare')) return 'inregistrate';
  if (lower.includes('amanare') || lower.includes('prelungire')) return 'amanate';
  // Clarificări: Mistral classifies as 'inregistrate' (administrative action, not delay)
  if (lower.includes('clarificari')) return 'inregistrate';
  if (
    lower.includes('raspuns') ||
    lower.includes('refuz')
  ) return 'raspunse';
  // Redirecționare: Mistral classifies as 'inregistrate' (forwarding, not final answer)
  if (lower.includes('redirectionare')) return 'inregistrate';
  // cerere_initiala is sent BY the citizen, not classified as incoming
  return 'inregistrate'; // fallback
}

/**
 * Infer document type from filename
 */
function inferDocType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.includes('cerere_initiala')) return 'cerere_initiala';
  if (lower.includes('confirmare') || lower.includes('inregistrare')) return 'confirmare';
  if (lower.includes('amanare') || lower.includes('prelungire')) return 'amanare';
  if (lower.includes('raspuns_final')) return 'raspuns_final';
  if (lower.includes('raspuns_favorabil')) return 'raspuns_favorabil';
  if (lower.includes('raspuns_refuz') || lower.includes('refuz_partial')) return 'refuz_partial';
  if (lower.includes('raspuns')) return 'raspuns';
  if (lower.includes('refuz')) return 'refuz';
  if (lower.includes('redirectionare')) return 'redirectionare';
  if (lower.includes('clarificari')) return 'cerere_clarificari';
  return 'unknown';
}

/**
 * Load a single PDF file as a TestPdf object
 */
function loadPdf(filePath: string, setName: string): TestPdf {
  const fileName = path.basename(filePath, '.pdf');
  const orderMatch = fileName.match(/^(\d+)/);
  const order = orderMatch ? parseInt(orderMatch[1], 10) : 0;

  return {
    filePath,
    fileName,
    setName,
    order,
    expectedCategory: inferCategory(fileName),
    docType: inferDocType(fileName),
    getBytes: () => fs.readFileSync(filePath),
  };
}

/**
 * Load all PDFs from a scenario directory
 */
function loadSetPdfs(dirPath: string, setName: string): TestPdf[] {
  if (!fs.existsSync(dirPath)) return [];

  return fs.readdirSync(dirPath)
    .filter((f) => f.endsWith('.pdf'))
    .sort()
    .map((f) => loadPdf(path.join(dirPath, f), setName));
}

/**
 * All defined test scenarios with expected outcomes
 */
export function getTestScenarios(): TestScenario[] {
  return [
    {
      setName: 'Set_1_Happy_Path_Parcuri',
      description: 'Happy path: confirmare → răspuns final',
      institutionName: 'Primăria Sectorului 3 București',
      subject: 'Cerere informații publice - Parcuri și spații verzi',
      pdfs: loadSetPdfs(path.join(TEST_PDFS_ROOT, 'Set_1_Happy_Path_Parcuri'), 'Set_1_Happy_Path_Parcuri'),
      expectedFinalStatus: 'answered',
    },
    {
      setName: 'Set_1_Contracte_Achizitii',
      description: 'Full flow: cerere → confirmare → amânare → răspuns',
      institutionName: 'Primăria Municipiului Cluj-Napoca',
      subject: 'Cerere informații publice - Contracte achiziții publice',
      pdfs: loadSetPdfs(path.join(TEST_PDFS_ROOT, 'Set_1_Contracte_Achizitii'), 'Set_1_Contracte_Achizitii'),
      expectedFinalStatus: 'answered',
    },
    {
      setName: 'Set_2_Delayed_Achizitii',
      description: 'Delayed: confirmare → prelungire → răspuns final',
      institutionName: 'Consiliul Județean Iași',
      subject: 'Cerere informații publice - Achiziții cu întârziere',
      pdfs: loadSetPdfs(path.join(TEST_PDFS_ROOT, 'Set_2_Delayed_Achizitii'), 'Set_2_Delayed_Achizitii'),
      expectedFinalStatus: 'answered',
    },
    {
      setName: 'Set_2_Salarii_Functionari',
      description: 'Full flow: cerere → confirmare → amânare → răspuns cu tabel',
      institutionName: 'Primăria Municipiului Timișoara',
      subject: 'Cerere informații publice - Salarii funcționari publici',
      pdfs: loadSetPdfs(path.join(TEST_PDFS_ROOT, 'Set_2_Salarii_Functionari'), 'Set_2_Salarii_Functionari'),
      expectedFinalStatus: 'answered',
    },
    {
      setName: 'Set_3_Cheltuieli_Deplasari',
      description: 'Full flow: cerere → confirmare → amânare → răspuns',
      institutionName: 'Consiliul Județean Constanța',
      subject: 'Cerere informații publice - Cheltuieli deplasări',
      pdfs: loadSetPdfs(path.join(TEST_PDFS_ROOT, 'Set_3_Cheltuieli_Deplasari'), 'Set_3_Cheltuieli_Deplasari'),
      expectedFinalStatus: 'answered',
    },
    {
      setName: 'Set_3_Refusal_Salarii',
      description: 'Refuz: confirmare → refuz',
      institutionName: 'Primăria Municipiului Brașov',
      subject: 'Cerere informații publice - Salarii (refuzat)',
      pdfs: loadSetPdfs(path.join(TEST_PDFS_ROOT, 'Set_3_Refusal_Salarii'), 'Set_3_Refusal_Salarii'),
      expectedFinalStatus: 'answered',
    },
    {
      setName: 'Set_4_Investitii_Infrastructura',
      description: 'Full flow: cerere → confirmare → amânare → răspuns',
      institutionName: 'Primăria Municipiului Craiova',
      subject: 'Cerere informații publice - Investiții infrastructură',
      pdfs: loadSetPdfs(path.join(TEST_PDFS_ROOT, 'Set_4_Investitii_Infrastructura'), 'Set_4_Investitii_Infrastructura'),
      expectedFinalStatus: 'answered',
    },
    {
      setName: 'Set_4_Redirection_Metro',
      description: 'Redirecționare: confirmare → redirecționare',
      institutionName: 'Primăria Municipiului București',
      subject: 'Cerere informații publice - Metrou',
      pdfs: loadSetPdfs(path.join(TEST_PDFS_ROOT, 'Set_4_Redirection_Metro'), 'Set_4_Redirection_Metro'),
      expectedFinalStatus: 'answered',
    },
    {
      setName: 'Set_5_Angajari_Personal',
      description: 'Full flow: cerere → confirmare → amânare → răspuns',
      institutionName: 'Consiliul Județean Alba',
      subject: 'Cerere informații publice - Angajări personal',
      pdfs: loadSetPdfs(path.join(TEST_PDFS_ROOT, 'Set_5_Angajari_Personal'), 'Set_5_Angajari_Personal'),
      expectedFinalStatus: 'answered',
    },
    {
      setName: 'Set_5_Clarification_Scoli',
      description: 'Clarificări: confirmare → cerere clarificări → răspuns final',
      institutionName: 'Inspectoratul Școlar Județean Dolj',
      subject: 'Cerere informații publice - Școli',
      pdfs: loadSetPdfs(path.join(TEST_PDFS_ROOT, 'Set_5_Clarification_Scoli'), 'Set_5_Clarification_Scoli'),
      expectedFinalStatus: 'answered',
    },
  ];
}

/**
 * Load standalone root-level test PDFs
 */
export function getStandalonePdfs(): TestPdf[] {
  return fs.readdirSync(TEST_PDFS_ROOT)
    .filter((f) => f.endsWith('.pdf'))
    .sort()
    .map((f) => loadPdf(path.join(TEST_PDFS_ROOT, f), 'standalone'));
}

/**
 * Get ALL PDFs across all scenarios + standalone
 */
export function getAllTestPdfs(): TestPdf[] {
  const all: TestPdf[] = [...getStandalonePdfs()];
  for (const scenario of getTestScenarios()) {
    all.push(...scenario.pdfs);
  }
  return all;
}

/**
 * Quick validation — ensure all PDF files exist and are readable
 */
export function validateTestPdfs(): { total: number; missing: string[] } {
  const all = getAllTestPdfs();
  const missing = all.filter((p) => !fs.existsSync(p.filePath)).map((p) => p.filePath);
  return { total: all.length, missing };
}

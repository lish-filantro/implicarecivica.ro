/**
 * Romanian institutional email validation and confidence scoring.
 * Used in STEP_2 after web search returns results to validate
 * that the found email is legitimate and trustworthy.
 */

// Regex for extracting email addresses from unstructured text
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Known Romanian institutional email domain patterns
const INSTITUTIONAL_PATTERNS = [
  /primari[ae].*\.ro$/i,
  /cj[a-z]*\.ro$/i,
  /consiliu.*\.ro$/i,
  /minister.*\.ro$/i,
  /prefectur.*\.ro$/i,
  /agenti.*\.ro$/i,
  /directi.*\.ro$/i,
  /inspectorat.*\.ro$/i,
  /anaf\.ro$/i,
  /mai\.gov\.ro$/i,
  /just\.ro$/i,
  /edu\.ro$/i,
  /ms\.ro$/i,
  /gov\.ro$/i,
];

export interface EmailValidationResult {
  email: string;
  isValid: boolean;
  domain: string;
  confidence: 'high' | 'medium' | 'low';
  confidenceReasons: string[];
  isGovRo: boolean;
  domainMatchesInstitution: boolean;
}

/**
 * Extract all email addresses from text
 */
export function extractEmails(text: string): string[] {
  const matches = text.match(EMAIL_REGEX);
  if (!matches) return [];
  return [...new Set(matches.map(e => e.toLowerCase()))];
}

/**
 * Basic email format validation
 */
export function isValidEmailFormat(email: string): boolean {
  const parts = email.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (local.length === 0 || domain.length === 0) return false;
  if (!domain.includes('.')) return false;
  if (/\.{2,}/.test(email)) return false;
  return true;
}

/**
 * Check if domain ends with a trusted Romanian suffix
 */
export function isTrustedRomanianDomain(domain: string): boolean {
  return domain.endsWith('.gov.ro') || domain.endsWith('.ro');
}

/**
 * Check if email domain plausibly matches the institution name.
 * e.g., "Primăria Pitești" should match domains containing "pitesti"
 */
export function domainMatchesInstitution(email: string, institution: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() || '';
  const instLower = institution
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Extract significant words (3+ chars, skip common filler words)
  const skipWords = ['din', 'ale', 'cel', 'sau', 'pentru', 'municipiului', 'orasului', 'comunei', 'judetul', 'judetean'];
  const keywords = instLower
    .split(/\s+/)
    .filter(w => w.length >= 3)
    .filter(w => !skipWords.includes(w));

  return keywords.some(kw => domain.includes(kw));
}

/**
 * Score email confidence based on multiple signals.
 * Returns a structured result with confidence level and reasons.
 */
export function scoreEmailConfidence(
  email: string,
  institution: string,
  sourceUrls: string[],
  searchText: string
): EmailValidationResult {
  const domain = email.split('@')[1] || '';
  const reasons: string[] = [];
  let score = 0;

  // Factor 1: Valid format (+1)
  const validFormat = isValidEmailFormat(email);
  if (validFormat) {
    score += 1;
    reasons.push('Format email valid');
  } else {
    reasons.push('Format email INVALID');
  }

  // Factor 2: .gov.ro domain (+3) or .ro domain (+1)
  const isGovRo = domain.endsWith('.gov.ro');
  if (isGovRo) {
    score += 3;
    reasons.push('Domeniu .gov.ro (foarte de încredere)');
  } else if (domain.endsWith('.ro')) {
    score += 1;
    reasons.push('Domeniu .ro');
  } else {
    reasons.push('Domeniu non-.ro (suspect)');
  }

  // Factor 3: Domain matches institution name (+2)
  const domainMatch = domainMatchesInstitution(email, institution);
  if (domainMatch) {
    score += 2;
    reasons.push('Domeniu corespunde cu numele instituției');
  }

  // Factor 4: Source URL is from official site (+2)
  const hasOfficialSource = sourceUrls.some(url =>
    url.includes('.gov.ro') || url.includes('.primaria') || url.includes('.ro/')
  );
  if (hasOfficialSource) {
    score += 2;
    reasons.push('Sursa este un site oficial .ro');
  }

  // Factor 5: Search text mentions "544" or "transparenta" near the email (+1)
  const textLower = searchText.toLowerCase();
  if (textLower.includes('544') || textLower.includes('transparen')) {
    score += 1;
    reasons.push('Menționat în context Legea 544 / transparență');
  }

  // Factor 6: Known institutional domain pattern (+1)
  if (INSTITUTIONAL_PATTERNS.some(p => p.test(domain))) {
    score += 1;
    reasons.push('Domeniu recunoscut ca instituțional');
  }

  // Map score to confidence level: 0-3 LOW, 4-6 MEDIUM, 7+ HIGH
  let confidence: 'high' | 'medium' | 'low';
  if (score >= 7) confidence = 'high';
  else if (score >= 4) confidence = 'medium';
  else confidence = 'low';

  return {
    email,
    isValid: validFormat,
    domain,
    confidence,
    confidenceReasons: reasons,
    isGovRo,
    domainMatchesInstitution: domainMatch,
  };
}

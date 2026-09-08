/**
 * Strategy 2 — registration number, in decreasing strictness:
 *   exact equality              → high
 *   substring either direction  → medium  ("31884" vs "Nr. 31884 / 01.12.2025")
 *   same numeric core           → high    ("29702/14.11.2025" vs "29702/22.11.2025")
 */
import type { RequestsRepo } from '@m544/shared/db/requests-repo';
import type { MatchResult } from '@m544/pipeline/types';
import { extractRegNumberCore } from './normalize';

type Candidate = { id: string; registration_number: string };

const hit = (requestId: string, confidence: MatchResult['confidence']): MatchResult => ({
  requestId,
  strategy: 'registration',
  confidence,
});

function findSubstring(reg: string, candidates: Candidate[]): Candidate | undefined {
  return candidates.find((c) => c.registration_number.includes(reg) || reg.includes(c.registration_number));
}

function findSameCore(reg: string, candidates: Candidate[]): Candidate | undefined {
  const core = extractRegNumberCore(reg);
  if (!core) return undefined;
  return candidates.find((c) => extractRegNumberCore(c.registration_number) === core);
}

export async function matchByRegistration(
  userId: string,
  reg: string,
  requests: RequestsRepo,
): Promise<MatchResult | null> {
  const exactId = await requests.findByRegistrationNumber(userId, reg);
  if (exactId) return hit(exactId, 'high');

  const candidates = (await requests.listWithRegistration(userId)).filter((c) => !!c.registration_number);

  const fuzzy = findSubstring(reg, candidates);
  if (fuzzy) return hit(fuzzy.id, 'medium');

  const core = findSameCore(reg, candidates);
  if (core) return hit(core.id, 'high');

  return null;
}

/**
 * lib/institutii/cazuri — popular Law 544 use cases, diverse across domains.
 */
import { describe, it, expect } from 'vitest';
import { getCazuriPopulare } from '@/lib/institutii/cazuri';
import { getInstitutieBySlug } from '@/lib/institutii/load';

describe('getCazuriPopulare', () => {
  it('returns at most `limit` entries, one per domain first', () => {
    const cazuri = getCazuriPopulare(8);
    expect(cazuri).toHaveLength(8);
    const domains = cazuri.map((c) => c.domeniuId);
    expect(new Set(domains).size).toBe(8);
  });

  it('skips templates and placeholder texts, and links back to a real institution', () => {
    for (const caz of getCazuriPopulare(20)) {
      expect(caz.text).not.toMatch(/\{/);
      const inst = getInstitutieBySlug(caz.institutieSlug);
      expect(inst?.is_template).toBe(false);
      expect(inst?.nume_scurt).toBe(caz.institutieNume);
    }
  });

  it('defaults the limit to 8', () => {
    expect(getCazuriPopulare()).toHaveLength(8);
  });
});

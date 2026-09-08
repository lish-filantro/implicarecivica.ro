/**
 * lib/institutii — the barrel keeps every pre-split export reachable from '@/lib/institutii'.
 */
import { describe, it, expect } from 'vitest';
import * as barrel from '@/lib/institutii';
import { getAllInstitutii } from '@/lib/institutii/load';
import { DOMENII } from '@/lib/institutii/domenii';
import type { Institutie, SearchEntry } from '@/lib/institutii';

describe('lib/institutii barrel', () => {
  it('re-exports the loader, domains, cazuri and search index', () => {
    expect(barrel.getAllInstitutii).toBe(getAllInstitutii);
    expect(barrel.DOMENII).toBe(DOMENII);
    expect(typeof barrel.getInstitutieBySlug).toBe('function');
    expect(typeof barrel.getInstitutiiByNivel).toBe('function');
    expect(typeof barrel.getInstitutiiByDomeniu).toBe('function');
    expect(typeof barrel.getDomeniuForInstitutie).toBe('function');
    expect(typeof barrel.getCazuriPopulare).toBe('function');
    expect(typeof barrel.getSearchIndex).toBe('function');
  });

  it('re-exports the types', () => {
    const inst: Institutie = barrel.getAllInstitutii()[0];
    const entry: SearchEntry = barrel.getSearchIndex()[0];
    expect(entry.slug).toBe(inst.slug);
  });
});

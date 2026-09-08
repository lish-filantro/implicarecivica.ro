/**
 * lib/institutii/domenii — thematic grouping by institution-id prefix.
 */
import { describe, it, expect } from 'vitest';
import { DOMENII, getInstitutiiByDomeniu, getDomeniuForInstitutie } from '@/lib/institutii/domenii';
import { getAllInstitutii } from '@/lib/institutii/load';
import type { Institutie } from '@/lib/institutii/types';

describe('DOMENII', () => {
  it('has 10 domains with unique ids and non-empty patterns', () => {
    expect(DOMENII).toHaveLength(10);
    expect(new Set(DOMENII.map((d) => d.id)).size).toBe(10);
    expect(DOMENII.every((d) => d.patterns.length > 0 && d.label && d.icon)).toBe(true);
  });
});

describe('getInstitutiiByDomeniu', () => {
  it('matches institutions whose id starts with a domain pattern', () => {
    const finante = getInstitutiiByDomeniu('finante');
    expect(finante.length).toBeGreaterThan(0);
    expect(finante.some((i) => i.id.toUpperCase().startsWith('ANAF'))).toBe(true);
  });

  it('returns [] for an unknown domain', () => {
    expect(getInstitutiiByDomeniu('nu-exista')).toEqual([]);
  });
});

describe('getDomeniuForInstitutie', () => {
  it('returns the first matching domain, or undefined', () => {
    const anaf = getAllInstitutii().find((i) => i.id.toUpperCase().startsWith('ANAF'));
    expect(anaf && getDomeniuForInstitutie(anaf)?.id).toBe('finante');
    const fake = { id: 'XYZ_NECUNOSCUT' } as Institutie;
    expect(getDomeniuForInstitutie(fake)).toBeUndefined();
  });
});

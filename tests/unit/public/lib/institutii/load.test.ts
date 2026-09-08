/**
 * lib/institutii/load — reads data/institutii/*.json into Institutie records (cached).
 */
import { describe, it, expect } from 'vitest';
import { getAllInstitutii, getInstitutieBySlug, getInstitutiiByNivel } from '@/lib/institutii/load';

describe('getAllInstitutii', () => {
  it('loads every JSON file, sorted by nume_scurt, and caches the array', () => {
    const all = getAllInstitutii();
    expect(all.length).toBeGreaterThan(50);
    expect(getAllInstitutii()).toBe(all);
    const names = all.map((i) => i.nume_scurt);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'ro')));
  });

  it('derives slug, template flag and nivel_categorie', () => {
    const all = getAllInstitutii();
    for (const inst of all) {
      expect(inst.slug).toMatch(/^[a-z0-9-]+$/);
      expect(inst.slug.endsWith('-template')).toBe(false);
      expect(['National', 'Județean', 'Local']).toContain(inst.nivel_categorie);
      expect(Array.isArray(inst.atributii_principale)).toBe(true);
      expect(Array.isArray(inst.cazuri_utilizare_544)).toBe(true);
      if (inst.is_template) {
        expect(inst.nume_oficial).not.toMatch(/\{/);
        expect(inst.nume_scurt).not.toMatch(/\{/);
      }
    }
    expect(all.some((i) => i.is_template)).toBe(true);
    expect(all.filter((i) => i.nivel_categorie === 'National').length).toBeGreaterThan(0);
    expect(all.filter((i) => i.nivel_categorie === 'Local').length).toBeGreaterThan(0);
  });
});

describe('getInstitutieBySlug / getInstitutiiByNivel', () => {
  it('finds an institution by slug and returns undefined for unknown slugs', () => {
    const first = getAllInstitutii()[0];
    expect(getInstitutieBySlug(first.slug)).toBe(first);
    expect(getInstitutieBySlug('nu-exista')).toBeUndefined();
  });

  it('filters by nivel_categorie', () => {
    const locale = getInstitutiiByNivel('Local');
    expect(locale.length).toBeGreaterThan(0);
    expect(locale.every((i) => i.nivel_categorie === 'Local')).toBe(true);
  });
});

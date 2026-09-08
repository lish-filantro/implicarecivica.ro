/**
 * lib/institutii/search-index — normalized haystack + unique words per institution (cached).
 */
import { describe, it, expect } from 'vitest';
import { getSearchIndex } from '@/lib/institutii/search-index';
import { getAllInstitutii } from '@/lib/institutii/load';

describe('getSearchIndex', () => {
  it('has one entry per institution, in the same order, and is cached', () => {
    const index = getSearchIndex();
    const all = getAllInstitutii();
    expect(index.map((e) => e.slug)).toEqual(all.map((i) => i.slug));
    expect(getSearchIndex()).toBe(index);
  });

  it('normalizes diacritics and lowercases the haystack; words are unique and 3+ chars', () => {
    for (const entry of getSearchIndex()) {
      expect(entry.haystack).toBe(entry.haystack.toLowerCase());
      expect(entry.haystack).not.toMatch(/[ăâîșşțţ]/);
      expect(new Set(entry.words).size).toBe(entry.words.length);
      expect(entry.words.every((w) => w.length >= 3 && /^[a-z]+$/.test(w))).toBe(true);
    }
  });

  it('includes the name, use cases and search keywords in the haystack', () => {
    const inst = getAllInstitutii().find((i) => i.keywords_cautare?.termeni_populari?.length);
    expect(inst).toBeDefined();
    const entry = getSearchIndex().find((e) => e.slug === inst!.slug)!;
    expect(entry.numeScurt).toBe(inst!.nume_scurt);
    expect(entry.numeOficial).toBe(inst!.nume_oficial);
    const kw = inst!.keywords_cautare!.termeni_populari![0]
      .toLowerCase()
      .replace(/[ăâ]/g, 'a')
      .replace(/[îï]/g, 'i')
      .replace(/[șş]/g, 's')
      .replace(/[țţ]/g, 't');
    expect(entry.haystack).toContain(kw);
    if (inst!.cazuri_utilizare_544[0]) {
      expect(entry.haystack).toContain(inst!.cazuri_utilizare_544[0].toLowerCase().slice(0, 10).replace(/[ăâ]/g, 'a'));
    }
  });
});

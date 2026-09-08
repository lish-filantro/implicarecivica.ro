/**
 * Unit tests — institution knowledge base search (zero API calls)
 *
 * Covers the shared keyword engine (lib/institutii-search) and the chat
 * `rag_search` backend (src/manager-544/chat/rag/institutii-rag) against the real
 * data/institutii JSON files.
 */
import { describe, it, expect } from 'vitest';
import { normalizeRo, tokenizeQuery, searchEntries } from '@/lib/institutii-search';
import { getSearchIndex, getAllInstitutii } from '@/lib/institutii';
import { searchInstitutii, getInstitutieDetail } from '@m544/chat/rag/institutii-rag';

const index = getSearchIndex();

function topSlugs(query: string, k = 3): string[] {
  return searchEntries(index, query, k).map((s) => s.entry.slug);
}

describe('normalizeRo / tokenizeQuery', () => {
  it('strips both comma-below and cedilla diacritics', () => {
    expect(normalizeRo('Școală Țară şţ')).toBe('scoala tara st');
  });

  it('drops stop words but keeps meaningful terms', () => {
    expect(tokenizeQuery('Vreau informații despre groapa din strada Mihai Viteazu')).toEqual(
      expect.arrayContaining(['groapa', 'mihai', 'viteazu']),
    );
    expect(tokenizeQuery('Vreau informații despre groapa din strada')).not.toContain('strada');
  });

  it('falls back to raw words when everything is a stop word', () => {
    expect(tokenizeQuery('informații despre')).toEqual(['informatii', 'despre']);
  });
});

describe('data/institutii integrity', () => {
  it('loads all 86 institutions with unique slugs', () => {
    const all = getAllInstitutii();
    expect(all.length).toBe(86);
    expect(new Set(all.map((i) => i.slug)).size).toBe(86);
  });

  it('every institution has attributions, 544 use cases and a search haystack', () => {
    for (const inst of getAllInstitutii()) {
      expect(inst.atributii_principale.length, inst.id).toBeGreaterThan(0);
      expect(inst.cazuri_utilizare_544.length, inst.id).toBeGreaterThan(0);
    }
    for (const e of index) {
      expect(e.haystack.length, e.slug).toBeGreaterThan(200);
    }
  });

  it('templates expose a name pattern for instantiation', () => {
    const templates = getAllInstitutii().filter((i) => i.is_template);
    expect(templates.length).toBeGreaterThan(30);
    const withPattern = templates.filter((i) => i.template_pattern?.nume_format);
    expect(withPattern.length / templates.length).toBeGreaterThan(0.9);
  });

  it('no cedilla characters remain in the corpus', () => {
    for (const e of index) {
      // haystack is normalized, so check the source names instead
      expect(e.numeOficial + e.numeScurt).not.toMatch(/[şţŞŢ]/);
    }
  });
});

describe('jurisdiction routing — typical citizen problems', () => {
  it('pothole in a local street → Primărie', () => {
    expect(topSlugs('groapă în asfalt pe strada, trotuar spart')).toContain('primarie');
  });

  it('county road → Consiliul Județean', () => {
    expect(topSlugs('drum județean deteriorat DJ')).toContain('consiliu-judetean');
  });

  it('school heating problem → ISJ or the school itself', () => {
    const slugs = topSlugs('școală fără încălzire elevi clase frig', 4);
    expect(slugs.some((s) => s === 'isj' || s === 'scoala-publica')).toBe(true);
  });

  it('garbage not collected → salubritate or Primărie', () => {
    const slugs = topSlugs('nu se ridică gunoiul, colectare deșeuri', 4);
    expect(slugs.some((s) => s === 'serviciu-salubritate' || s === 'primarie')).toBe(true);
  });

  it('air pollution from a factory → APM / ANPM / Garda de Mediu', () => {
    const slugs = topSlugs('poluare aer fabrică emisii miros', 4);
    expect(slugs.some((s) => ['apm', 'anpm', 'garda-mediu-comisariat'].includes(s))).toBe(true);
  });

  it('income tax question → ANAF', () => {
    expect(topSlugs('impozit pe venit declarație fiscală ANAF')[0]).toBe('anaf');
  });

  it('hospital waiting times → spital județean or DSP', () => {
    const slugs = topSlugs('spital liste de așteptare medici urgență', 4);
    expect(slugs.some((s) => ['spital-judetean', 'dsp', 'ministerul-sanatatii', 'cjas'].includes(s))).toBe(true);
  });

  it('returns nothing for an off-topic query', () => {
    expect(searchEntries(index, 'xyzzy qwertyuiop', 5)).toEqual([]);
  });
});

describe('rag_search backend (chat/rag/institutii-rag)', () => {
  it('returns rich results with the fields Haiku needs', () => {
    const results = searchInstitutii('groapă asfalt strada', { topK: 3 });
    expect(results.length).toBeGreaterThan(0);
    const r = results[0];
    expect(r).toMatchObject({
      slug: expect.any(String),
      nume: expect.any(String),
      atributii: expect.any(Array),
      exemple_cereri_544: expect.any(Array),
    });
    expect(r.atributii.length).toBeGreaterThan(0);
    expect(r.atributii.length).toBeLessThanOrEqual(8);
  });

  it('fills locality placeholders for template institutions', () => {
    const primarie = searchInstitutii('groapă asfalt strada', { topK: 5, localitate: 'Pitești', judet: 'Argeș' })
      .find((r) => r.slug === 'primarie');
    expect(primarie).toBeDefined();
    expect(primarie!.este_sablon).toBe(true);
    expect(primarie!.nume).toContain('Pitești');
    expect(primarie!.nume).not.toContain('{');
    // email patterns are slugified (no diacritics, lowercase)
    expect(primarie!.contact_cereri_544).toContain('pitesti');
    expect(primarie!.contact_cereri_544).not.toContain('{');
  });

  it('keeps placeholders visible when locality is unknown, and says so', () => {
    const cj = getInstitutieDetail('consiliu-judetean');
    expect(cj).not.toBeNull();
    expect(cj!.nume).toContain('{');
    expect(cj!.nota_instantiere).toMatch(/completeaz/i);
  });

  it('caps topK to 10', () => {
    expect(searchInstitutii('primărie consiliu minister agenție', { topK: 50 }).length).toBeLessThanOrEqual(10);
  });

  it('concrete national institutions carry a real contact email', () => {
    const anaf = getInstitutieDetail('anaf');
    expect(anaf!.este_sablon).toBe(false);
    expect(anaf!.contact_cereri_544 || anaf!.email_sediu).toMatch(/@/);
  });
});

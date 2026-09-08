/**
 * chat/rag/tool-executor — the rag_search tool executor: argument mapping
 * (defaults, top_k cap, conversation locality fallback) and the empty-result note.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRagSearchExecutor } from '@m544/chat/rag/tool-executor';
import type { RagInstitutionResult } from '@m544/chat/rag/institutii-rag';

const hit = { slug: 'primarie', nume: 'Primăria Pitești' } as RagInstitutionResult;

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('createRagSearchExecutor', () => {
  it('maps query/top_k/localitate/judet, defaulting top_k to 5', () => {
    const search = vi.fn(() => [hit]);
    const exec = createRagSearchExecutor(undefined, search);
    expect(exec({ query: 'groapa asfalt', localitate: 'Pitești', judet: 'Argeș' })).toEqual([hit]);
    expect(search).toHaveBeenCalledWith('groapa asfalt', { topK: 5, localitate: 'Pitești', judet: 'Argeș' });
  });

  it('caps top_k at 10', () => {
    const search = vi.fn(() => [hit]);
    createRagSearchExecutor(undefined, search)({ query: 'q', top_k: 50 });
    expect(search).toHaveBeenCalledWith('q', { topK: 10, localitate: undefined, judet: undefined });
  });

  it('falls back to the conversation locality when the tool input has none', () => {
    const search = vi.fn(() => [hit]);
    createRagSearchExecutor('Cluj-Napoca', search)({ query: 'q' });
    expect(search).toHaveBeenCalledWith('q', { topK: 5, localitate: 'Cluj-Napoca', judet: undefined });
    createRagSearchExecutor('Cluj-Napoca', search)({ query: 'q', localitate: 'Iași' });
    expect(search).toHaveBeenLastCalledWith('q', { topK: 5, localitate: 'Iași', judet: undefined });
  });

  it('returns the "nicio institutie" note instead of an empty array', () => {
    const exec = createRagSearchExecutor(undefined, () => []);
    expect(exec({ query: 'xyz' })).toEqual({
      rezultate: [],
      nota: 'Nicio institutie gasita pentru acesti termeni. Reformuleaza cu alte cuvinte cheie despre problema sau foloseste web_search.',
    });
  });

  it('tolerates malformed input (searches with an empty query)', () => {
    const search = vi.fn(() => []);
    createRagSearchExecutor(undefined, search)('not an object');
    expect(search).toHaveBeenCalledWith('', { topK: 5, localitate: undefined, judet: undefined });
  });

  it('uses the real knowledge base by default', () => {
    const out = createRagSearchExecutor('Pitești')({ query: 'groapă asfalt strada', top_k: 3 });
    expect(Array.isArray(out)).toBe(true);
    expect((out as RagInstitutionResult[]).length).toBeGreaterThan(0);
  });
});

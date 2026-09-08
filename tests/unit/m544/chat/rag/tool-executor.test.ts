/**
 * chat/rag/tool-executor — the rag_search tool executor: argument mapping
 * (defaults, top_k cap, conversation locality fallback), the empty-result note
 * and the optional enrichment with verified addresses from institutii_locale.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRagSearchExecutor } from '@m544/chat/rag/tool-executor';
import type { RagInstitutionResult } from '@m544/chat/rag/institutii-rag';
import type { KnownInstitution } from '@m544/shared/db/institutions-repo';

const hit = { slug: 'primarie', nume: 'Primăria Pitești' } as RagInstitutionResult;
const known: KnownInstitution = {
  nume: 'Primăria Pitești',
  email: 'registratura@primariapitesti.ro',
  verificat_la: '2026-09-01T10:00:00.000Z',
  nr_confirmari: 2,
  sursa: 'raspuns',
};

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('createRagSearchExecutor', () => {
  it('maps query/top_k/localitate/judet, defaulting top_k to 5', async () => {
    const search = vi.fn(() => [hit]);
    const exec = createRagSearchExecutor(undefined, search);
    expect(await exec({ query: 'groapa asfalt', localitate: 'Pitești', judet: 'Argeș' })).toEqual([hit]);
    expect(search).toHaveBeenCalledWith('groapa asfalt', { topK: 5, localitate: 'Pitești', judet: 'Argeș' });
  });

  it('caps top_k at 10', async () => {
    const search = vi.fn(() => [hit]);
    await createRagSearchExecutor(undefined, search)({ query: 'q', top_k: 50 });
    expect(search).toHaveBeenCalledWith('q', { topK: 10, localitate: undefined, judet: undefined });
  });

  it('falls back to the conversation locality when the tool input has none', async () => {
    const search = vi.fn(() => [hit]);
    await createRagSearchExecutor('Cluj-Napoca', search)({ query: 'q' });
    expect(search).toHaveBeenCalledWith('q', { topK: 5, localitate: 'Cluj-Napoca', judet: undefined });
    await createRagSearchExecutor('Cluj-Napoca', search)({ query: 'q', localitate: 'Iași' });
    expect(search).toHaveBeenLastCalledWith('q', { topK: 5, localitate: 'Iași', judet: undefined });
  });

  it('returns the "nicio institutie" note instead of an empty array', async () => {
    const exec = createRagSearchExecutor(undefined, () => []);
    expect(await exec({ query: 'xyz' })).toEqual({
      rezultate: [],
      nota: 'Nicio institutie gasita pentru acesti termeni. Reformuleaza cu alte cuvinte cheie despre problema sau foloseste web_search.',
    });
  });

  it('tolerates malformed input (searches with an empty query)', async () => {
    const search = vi.fn(() => []);
    await createRagSearchExecutor(undefined, search)('not an object');
    expect(search).toHaveBeenCalledWith('', { topK: 5, localitate: undefined, judet: undefined });
  });

  it('enriches hits with email_verificat when a lookup is provided', async () => {
    const lookup = vi.fn(async () => [known]);
    const out = await createRagSearchExecutor('Pitești', () => [hit], lookup)({ query: 'q' });
    expect(lookup).toHaveBeenCalledWith('Primăria Pitești');
    expect(out).toEqual([
      expect.objectContaining({ slug: 'primarie', email_verificat: known.email, verificat_la: known.verificat_la }),
    ]);
  });

  it('does not call the lookup when there are no hits', async () => {
    const lookup = vi.fn(async () => [known]);
    await createRagSearchExecutor(undefined, () => [], lookup)({ query: 'q' });
    expect(lookup).not.toHaveBeenCalled();
  });

  it('uses the real knowledge base by default', async () => {
    const out = await createRagSearchExecutor('Pitești')({ query: 'groapă asfalt strada', top_k: 3 });
    expect(Array.isArray(out)).toBe(true);
    expect((out as RagInstitutionResult[]).length).toBeGreaterThan(0);
  });
});

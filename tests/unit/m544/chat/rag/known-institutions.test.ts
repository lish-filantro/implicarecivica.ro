/**
 * chat/rag/known-institutions — enriches rag_search results with the verified
 * 544 address learned from received answers (`institutii_locale`).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { enrichWithKnownEmails } from '@m544/chat/rag/known-institutions';
import type { RagInstitutionResult } from '@m544/chat/rag/institutii-rag';
import type { KnownInstitution } from '@m544/shared/db/institutions-repo';

const known: KnownInstitution = {
  nume: 'Primăria Municipiului Pitești',
  email: 'registratura@primariapitesti.ro',
  verificat_la: '2026-09-01T10:00:00.000Z',
  nr_confirmari: 3,
  sursa: 'raspuns',
};
const primarie = { slug: 'primarie', nume: 'Primăria Municipiului Pitești', nota_instantiere: 'generic' } as RagInstitutionResult;
const cj = { slug: 'cj', nume: 'Consiliul Județean Argeș', nota_instantiere: null } as RagInstitutionResult;

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('enrichWithKnownEmails', () => {
  it('adds email_verificat + verificat_la from the first known match and replaces the "verify via web_search" note', async () => {
    const lookup = vi.fn(async (name: string) => (name === primarie.nume ? [known] : []));
    const out = await enrichWithKnownEmails([primarie, cj], lookup);
    expect(lookup).toHaveBeenCalledWith(primarie.nume);
    expect(lookup).toHaveBeenCalledWith(cj.nume);
    expect(out[0]).toMatchObject({ slug: 'primarie', email_verificat: known.email, verificat_la: known.verificat_la });
    expect(out[0].nota_instantiere).toMatch(/email_verificat/);
    expect(out[1]).toEqual(cj);
    expect('email_verificat' in out[1]).toBe(false);
  });

  it('skips templates whose name still has unfilled placeholders', async () => {
    const lookup = vi.fn(async () => [known]);
    const tpl = { slug: 'p', nume: 'Primăria {localitate}' } as RagInstitutionResult;
    const out = await enrichWithKnownEmails([tpl], lookup);
    expect(lookup).not.toHaveBeenCalled();
    expect(out).toEqual([tpl]);
  });

  it('is best-effort: a failing lookup leaves the result untouched and logs a warning', async () => {
    const out = await enrichWithKnownEmails([primarie], async () => {
      throw new Error('db down');
    });
    expect(out).toEqual([primarie]);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('known institutions'), 'db down');
  });

  it('returns [] for []', async () => {
    expect(await enrichWithKnownEmails([], async () => [known])).toEqual([]);
  });
});

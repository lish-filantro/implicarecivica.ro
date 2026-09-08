/**
 * shared/db/institutions-repo — verified 544 addresses learned from answers
 * (`institutii_locale`). Contract run against the in-memory fake and the
 * Supabase implementation over a recording query builder (no network).
 */
import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  SupabaseInstitutionsRepo,
  isInstitutionalAddress,
  type InstitutionsRepo,
} from '@m544/shared/db/institutions-repo';
import { FakeInstitutionsRepo } from '../../_fakes/fake-institutions-repo';
import { fakeSupabase, type RecordedQuery } from '../../emails/_fake-client';

const NOW = new Date('2026-09-08T10:00:00.000Z');

describe('isInstitutionalAddress', () => {
  it('rejects strings without @ and personal mailbox domains (forwarding clerks)', () => {
    expect(isInstitutionalAddress('registratura')).toBe(false);
    expect(isInstitutionalAddress('ion.popescu@gmail.com')).toBe(false);
    expect(isInstitutionalAddress('Ion@YAHOO.com')).toBe(false);
    expect(isInstitutionalAddress('x@hotmail.com')).toBe(false);
    expect(isInstitutionalAddress('x@outlook.com')).toBe(false);
    expect(isInstitutionalAddress('x@protonmail.com')).toBe(false);
    expect(isInstitutionalAddress('x@yahoo.ro')).toBe(false);
  });

  it('accepts institutional domains', () => {
    expect(isInstitutionalAddress('registratura@primariapitesti.ro')).toBe(true);
    expect(isInstitutionalAddress('relatii.publice@mai.gov.ro')).toBe(true);
  });
});

describe('FakeInstitutionsRepo contract', () => {
  function repo(): InstitutionsRepo & FakeInstitutionsRepo {
    return new FakeInstitutionsRepo(() => NOW);
  }

  it('records a new institution with nr_confirmari 1 and sursa raspuns by default', async () => {
    const r = repo();
    await r.recordVerifiedEmail({ name: 'Primăria Municipiului Pitești', email: 'Registratura@PrimariaPitesti.ro' });
    expect(await r.findByName('primaria municipiului pitesti')).toEqual([
      {
        nume: 'Primăria Municipiului Pitești',
        email: 'registratura@primariapitesti.ro',
        verificat_la: NOW.toISOString(),
        nr_confirmari: 1,
        sursa: 'raspuns',
      },
    ]);
  });

  it('same email again → nr_confirmari + 1; different email → replaced and reset to 1', async () => {
    const r = repo();
    await r.recordVerifiedEmail({ name: 'Primăria Pitești', email: 'a@primariapitesti.ro' });
    await r.recordVerifiedEmail({ name: 'PRIMARIA PITESTI', email: 'a@primariapitesti.ro' });
    expect((await r.findByName('Primăria Pitești'))[0]).toMatchObject({ email: 'a@primariapitesti.ro', nr_confirmari: 2 });
    await r.recordVerifiedEmail({ name: 'Primăria Pitești', email: 'b@primariapitesti.ro', source: 'manual' });
    expect((await r.findByName('Primăria Pitești'))[0]).toMatchObject({ email: 'b@primariapitesti.ro', nr_confirmari: 1, sursa: 'manual' });
  });

  it('skips personal addresses and blank names', async () => {
    const r = repo();
    await r.recordVerifiedEmail({ name: 'Primăria Pitești', email: 'clerk@gmail.com' });
    await r.recordVerifiedEmail({ name: '   ', email: 'x@primarie.ro' });
    expect(r.rows.size).toBe(0);
  });

  it('findByName: exact normalized match wins; otherwise substring matches, limited', async () => {
    const r = repo();
    await r.recordVerifiedEmail({ name: 'Primăria Pitești', email: 'a@pitesti.ro' });
    await r.recordVerifiedEmail({ name: 'Primăria Municipiului Pitești', email: 'b@pitesti.ro' });
    await r.recordVerifiedEmail({ name: 'Primăria Mioveni', email: 'c@mioveni.ro' });
    expect((await r.findByName('primaria pitesti')).map((k) => k.email)).toEqual(['a@pitesti.ro']);
    expect((await r.findByName('Pitești')).map((k) => k.email).sort()).toEqual(['a@pitesti.ro', 'b@pitesti.ro']);
    expect(await r.findByName('Pitești', 1)).toHaveLength(1);
    expect(await r.findByName('Brașov')).toEqual([]);
    expect(await r.findByName('')).toEqual([]);
  });
});

describe('SupabaseInstitutionsRepo', () => {
  const filters = (q: RecordedQuery) =>
    Object.fromEntries(q.filters.map((f) => [`${f.op}:${String(f.args[0])}`, f.args[1]]));

  it('inserts when no row exists for the normalized name', async () => {
    const sb = fakeSupabase(null, () => ({ data: null, error: null }));
    const repo = new SupabaseInstitutionsRepo(sb as unknown as SupabaseClient, () => NOW);
    await repo.recordVerifiedEmail({ name: 'Primăria Pitești', email: 'Reg@PrimariaPitesti.ro', judet: 'Argeș', localitate: 'Pitești' });
    expect(sb.queries.map((q) => q.op)).toEqual(['select', 'insert']);
    expect(filters(sb.queries[0])).toEqual({ 'eq:nume_normalizat': 'primaria pitesti' });
    expect(sb.queries[1].table).toBe('institutii_locale');
    expect(sb.queries[1].payload).toEqual({
      nume_normalizat: 'primaria pitesti',
      nume: 'Primăria Pitești',
      email: 'reg@primariapitesti.ro',
      judet: 'Argeș',
      localitate: 'Pitești',
      sursa: 'raspuns',
      verificat_la: NOW.toISOString(),
      nr_confirmari: 1,
    });
  });

  it('same email → increments nr_confirmari; different email → replaces and resets', async () => {
    const existing = { id: 'i1', email: 'reg@primariapitesti.ro', nr_confirmari: 2 };
    const sb = fakeSupabase(null, (q) => (q.op === 'select' ? { data: existing, error: null } : { data: null, error: null }));
    const repo = new SupabaseInstitutionsRepo(sb as unknown as SupabaseClient, () => NOW);
    await repo.recordVerifiedEmail({ name: 'Primăria Pitești', email: 'reg@primariapitesti.ro' });
    expect(sb.queries[1].op).toBe('update');
    expect(sb.queries[1].payload).toEqual({ nr_confirmari: 3, verificat_la: NOW.toISOString() });
    expect(filters(sb.queries[1])).toEqual({ 'eq:id': 'i1' });

    await repo.recordVerifiedEmail({ name: 'Primăria Pitești', email: 'nou@primariapitesti.ro', source: 'manual' });
    expect(sb.queries[3].op).toBe('update');
    expect(sb.queries[3].payload).toEqual({
      email: 'nou@primariapitesti.ro',
      nume: 'Primăria Pitești',
      sursa: 'manual',
      nr_confirmari: 1,
      verificat_la: NOW.toISOString(),
    });
  });

  it('does not touch the database for personal addresses', async () => {
    const sb = fakeSupabase(null);
    await new SupabaseInstitutionsRepo(sb as unknown as SupabaseClient).recordVerifiedEmail({ name: 'Primăria X', email: 'a@gmail.com' });
    expect(sb.queries).toHaveLength(0);
  });

  it('propagates query errors', async () => {
    const sb = fakeSupabase(null, () => ({ data: null, error: { message: 'boom' } }));
    await expect(
      new SupabaseInstitutionsRepo(sb as unknown as SupabaseClient).recordVerifiedEmail({ name: 'Primăria X', email: 'a@x.ro' }),
    ).rejects.toMatchObject({ message: 'boom' });
  });

  it('findByName: exact hit returned alone; otherwise ilike %normalized% limited and ordered by confirmations', async () => {
    const row = { nume: 'Primăria Pitești', email: 'a@x.ro', verificat_la: NOW.toISOString(), nr_confirmari: 4, sursa: 'raspuns' };
    const exact = fakeSupabase(null, () => ({ data: [row], error: null }));
    const repoExact = new SupabaseInstitutionsRepo(exact as unknown as SupabaseClient);
    expect(await repoExact.findByName('Primăria Pitești')).toEqual([row]);
    expect(exact.queries).toHaveLength(1);
    expect(filters(exact.queries[0])).toEqual({ 'eq:nume_normalizat': 'primaria pitesti' });

    const fuzzy = fakeSupabase(null, (q) =>
      q.filters.some((f) => f.op === 'ilike') ? { data: [row], error: null } : { data: [], error: null },
    );
    const repoFuzzy = new SupabaseInstitutionsRepo(fuzzy as unknown as SupabaseClient);
    expect(await repoFuzzy.findByName('Pitești', 3)).toEqual([row]);
    expect(fuzzy.queries).toHaveLength(2);
    expect(filters(fuzzy.queries[1])).toEqual({ 'ilike:nume_normalizat': '%pitesti%' });
    expect(fuzzy.queries[1].modifiers).toContain('limit:3');
    expect(fuzzy.queries[1].modifiers.some((m) => m.startsWith('order:nr_confirmari'))).toBe(true);
  });

  it('findByName: blank name → [] without querying', async () => {
    const sb = fakeSupabase(null);
    expect(await new SupabaseInstitutionsRepo(sb as unknown as SupabaseClient).findByName(' ')).toEqual([]);
    expect(sb.queries).toHaveLength(0);
  });
});

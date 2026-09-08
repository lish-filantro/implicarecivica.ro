/**
 * public-stats/repo — PostgREST `or` filter builder (input sanitising) and the Supabase repo.
 */
import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildOrFilter,
  sanitizeFilterValue,
  MAX_FILTER_LENGTH,
  SupabasePublicStatsRepo,
  STAT_COLUMNS,
} from '@m544/public-stats/repo';
import { fakeSupabase } from './_fake-client';

describe('sanitizeFilterValue', () => {
  it('strips the PostgREST filter syntax characters and trims', () => {
    expect(sanitizeFilterValue('  Prim%ăria, (Pitești) * ')).toBe('Primăria Pitești');
  });

  it('caps the length at 100 characters', () => {
    expect(MAX_FILTER_LENGTH).toBe(100);
    expect(sanitizeFilterValue('a'.repeat(150))).toHaveLength(100);
  });

  it('collapses inner whitespace', () => {
    expect(sanitizeFilterValue('Consiliul   Județean')).toBe('Consiliul Județean');
  });
});

describe('buildOrFilter — short names', () => {
  it('ignores a name shorter than 3 characters', () => {
    expect(buildOrFilter({ nume: 'ab' })).toBeNull();
    expect(buildOrFilter({ nume: 'ab', slug: 'anaf' })).toBe('institution_id.eq.anaf');
  });
});

describe('buildOrFilter', () => {
  it('combines slug equality and name ilike', () => {
    expect(buildOrFilter({ nume: 'Primăria Pitești', slug: 'primarie' })).toBe(
      'institution_id.eq.primarie,institution_name.ilike.%Primăria Pitești%',
    );
  });

  it('uses only the present parameter', () => {
    expect(buildOrFilter({ nume: 'ANAF' })).toBe('institution_name.ilike.%ANAF%');
    expect(buildOrFilter({ slug: 'anaf' })).toBe('institution_id.eq.anaf');
  });

  it('returns null when nothing usable remains', () => {
    expect(buildOrFilter({})).toBeNull();
    expect(buildOrFilter({ nume: '%,()', slug: '  ' })).toBeNull();
  });

  it('never lets injected separators reach the filter', () => {
    const f = buildOrFilter({ nume: 'x,status.eq.answered', slug: 'a)b(c' });
    expect(f).toBe('institution_id.eq.abc,institution_name.ilike.%xstatus.eq.answered%');
  });
});

describe('SupabasePublicStatsRepo', () => {
  it('selects only the stat columns filtered by the or expression', async () => {
    const rows = [{ status: 'answered', date_sent: '2026-08-01' }];
    const sb = fakeSupabase({ data: rows, error: null });
    const repo = new SupabasePublicStatsRepo(sb as unknown as SupabaseClient);
    expect(await repo.listRows({ nume: 'ANAF', slug: 'anaf' })).toEqual(rows);
    expect(sb.queries).toHaveLength(1);
    expect(sb.queries[0].table).toBe('requests');
    expect(sb.queries[0].modifiers).toContain(`select:${STAT_COLUMNS}`);
    expect(sb.queries[0].filters).toEqual([
      { op: 'or', args: ['institution_id.eq.anaf,institution_name.ilike.%ANAF%'] },
    ]);
  });

  it('returns [] without querying when the filter is empty', async () => {
    const sb = fakeSupabase({ data: [], error: null });
    const repo = new SupabasePublicStatsRepo(sb as unknown as SupabaseClient);
    expect(await repo.listRows({ nume: '%' })).toEqual([]);
    expect(sb.queries).toHaveLength(0);
  });

  it('throws on a database error', async () => {
    const sb = fakeSupabase({ data: null, error: { message: 'boom' } });
    const repo = new SupabasePublicStatsRepo(sb as unknown as SupabaseClient);
    await expect(repo.listRows({ slug: 'anaf' })).rejects.toMatchObject({ message: 'boom' });
  });
});

/**
 * public-stats/deps — production wiring: service-role Supabase repo + wall clock.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createPublicStatsDeps } from '@m544/public-stats/deps';
import { SupabasePublicStatsRepo } from '@m544/public-stats/repo';

const saved = { ...process.env };
beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key-for-tests';
});
afterEach(() => {
  process.env = { ...saved };
});

describe('createPublicStatsDeps', () => {
  it('wires the Supabase repo and a real clock', () => {
    const deps = createPublicStatsDeps();
    expect(deps.repo).toBeInstanceOf(SupabasePublicStatsRepo);
    const before = Date.now();
    expect(deps.now().getTime()).toBeGreaterThanOrEqual(before);
  });
});

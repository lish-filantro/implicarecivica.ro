/**
 * cron/deps — the real factory wires reconcile without inline processing.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDailyCronDeps } from '@m544/cron/deps';

describe('createDailyCronDeps', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key-for-tests');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('builds pipeline repos and reconcile functions', () => {
    const deps = createDailyCronDeps();
    expect(deps.pipeline.emails).toBeDefined();
    expect(deps.pipeline.requests).toBeDefined();
    expect(typeof deps.reconcile.list).toBe('function');
    expect(typeof deps.reconcile.head).toBe('function');
    expect(typeof deps.reconcile.ingest).toBe('function');
  });
});

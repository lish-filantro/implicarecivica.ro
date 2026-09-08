import { describe, it, expect } from 'vitest';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createReviewDeps } from '@m544/emails/review/deps';
import { SupabaseReviewRepo } from '@m544/emails/review/repo';
import { SupabaseEmailsRepo } from '@m544/shared/db/emails-repo';
import { SupabaseRequestsRepo } from '@m544/shared/db/requests-repo';
import { fakeSupabase } from '../_fake-client';

describe('createReviewDeps', () => {
  it('builds every repo on the client it is given (session client, RLS)', async () => {
    const deps = createReviewDeps();
    const sb = fakeSupabase({ id: 'u1' } as User) as unknown as SupabaseClient;
    expect(deps.emails(sb)).toBeInstanceOf(SupabaseEmailsRepo);
    expect(deps.requests(sb)).toBeInstanceOf(SupabaseRequestsRepo);
    expect(deps.review(sb)).toBeInstanceOf(SupabaseReviewRepo);
    expect(typeof deps.createClient).toBe('function');
  });
});

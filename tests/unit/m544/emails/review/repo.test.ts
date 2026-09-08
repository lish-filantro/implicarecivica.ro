import { describe, it, expect } from 'vitest';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { SupabaseReviewRepo, type FeedbackRow } from '@m544/emails/review/repo';
import { fakeSupabase } from '../_fake-client';

const alice = { id: 'u1' } as User;
const row: FeedbackRow = { email_id: 'e1', user_id: 'u1', previous_category: 'raspunse', new_category: 'amanate', note: 'x' };

describe('SupabaseReviewRepo', () => {
  it('inserts the feedback row into classification_feedback', async () => {
    const sb = fakeSupabase(alice);
    await new SupabaseReviewRepo(sb as unknown as SupabaseClient).insertFeedback(row);
    expect(sb.queries).toEqual([{ table: 'classification_feedback', op: 'insert', payload: row, filters: [], modifiers: [] }]);
  });

  it('throws the Supabase error', async () => {
    const sb = fakeSupabase(alice, () => ({ data: null, error: { message: 'rls' } }));
    await expect(new SupabaseReviewRepo(sb as unknown as SupabaseClient).insertFeedback(row)).rejects.toEqual({
      message: 'rls',
    });
  });
});

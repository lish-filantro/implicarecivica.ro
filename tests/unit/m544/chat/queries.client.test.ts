/**
 * chat/queries.client — the hand-off column on conversations, read and
 * written through an injected Supabase client (the browser one in production).
 */
import { describe, it, expect } from 'vitest';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import {
  getConversationHandoff,
  updateConversationHandoff,
  markHandoffSession,
} from '@m544/chat/queries.client';
import type { ConversationHandoff } from '@m544/shared/types/chat';
import { fakeSupabase, byTable } from '../emails/_fake-client';

const alice = { id: 'u1' } as User;
const sb = (r?: Parameters<typeof fakeSupabase>[1]) => {
  const fake = fakeSupabase(alice, r);
  return { fake, client: fake as unknown as SupabaseClient };
};

const handoff: ConversationHandoff = {
  institutionName: 'Primăria Pitești',
  institutionEmail: 'primaria@primariapitesti.ro',
  emailConfidence: 'high',
  sourceUrl: 'https://primariapitesti.ro/contact',
  problemContext: { ce: 'groapă', unde: 'Str. X 5, Pitești, Argeș', cand: 'martie 2026' },
  identifiedAt: '2026-09-09T10:00:00.000Z',
  confirmedAt: null,
  sessionId: null,
  questions: null,
  questionsModel: null,
};

describe('getConversationHandoff', () => {
  it('reads the handoff column of the conversation', async () => {
    const { fake, client } = sb(byTable({ conversations: { data: { handoff } } }));
    expect(await getConversationHandoff('c1', client)).toEqual(handoff);
    expect(fake.queries[0]).toMatchObject({
      table: 'conversations',
      op: 'select',
      filters: [{ op: 'eq', args: ['id', 'c1'] }],
      modifiers: ['select:handoff', 'single'],
    });
  });

  it('is null when the row has no handoff', async () => {
    const { client } = sb(byTable({ conversations: { data: { handoff: null } } }));
    expect(await getConversationHandoff('c1', client)).toBeNull();
  });

  it('throws on a query error (e.g. migration 018 not applied)', async () => {
    const { client } = sb(() => ({ data: null, error: { message: 'column handoff does not exist' } }));
    await expect(getConversationHandoff('c1', client)).rejects.toMatchObject({ message: 'column handoff does not exist' });
  });
});

describe('updateConversationHandoff', () => {
  it('writes the handoff on the conversation', async () => {
    const { fake, client } = sb();
    await updateConversationHandoff('c1', handoff, client);
    expect(fake.queries[0]).toMatchObject({
      table: 'conversations',
      op: 'update',
      payload: { handoff },
      filters: [{ op: 'eq', args: ['id', 'c1'] }],
    });
  });

  it('throws on a write error', async () => {
    const { client } = sb(() => ({ data: null, error: { message: 'denied' } }));
    await expect(updateConversationHandoff('c1', handoff, client)).rejects.toMatchObject({ message: 'denied' });
  });
});

describe('markHandoffSession', () => {
  it('reads the handoff, then writes it back with the session id', async () => {
    const { fake, client } = sb(byTable({ 'conversations:select': { data: { handoff } } }));
    await markHandoffSession('c1', 's9', client);
    expect(fake.queries.map((q) => q.op)).toEqual(['select', 'update']);
    expect(fake.queries[1].payload).toEqual({ handoff: { ...handoff, sessionId: 's9' } });
  });

  it('does nothing when the conversation has no handoff', async () => {
    const { fake, client } = sb(byTable({ conversations: { data: { handoff: null } } }));
    await markHandoffSession('c1', 's9', client);
    expect(fake.queries.map((q) => q.op)).toEqual(['select']);
  });
});

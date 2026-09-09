/**
 * Context for the question-set generator, loaded server-side with the user's
 * Supabase client (RLS): the conversation transcript and hand-off, or the
 * session's institution and already-sent questions. The client never sends a
 * transcript itself.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConversationHandoff } from '@m544/shared/types/chat';
import { extractProblemContext } from '@m544/chat/guardrails/context';

/** The slice of the Supabase client the loaders use (fakes implement it in tests). */
export type QueryClient = Pick<SupabaseClient, 'from'>;

export interface ProblemContextFields {
  ce: string;
  unde: string;
  cand: string;
}

export interface SetContext {
  institutionName: string;
  problemContext: ProblemContextFields | null;
  /** "user: …" / "assistant: …" lines, trimmed from the start to MAX_TRANSCRIPT_CHARS. */
  transcript: string;
  /** Questions already sent in the session (never repeated by the generator). */
  existingQuestions: string[];
}

export interface ConversationContext {
  ctx: SetContext;
  handoff: ConversationHandoff | null;
}

export const MAX_TRANSCRIPT_CHARS = 12_000;

interface MessageRowLite {
  sender: 'user' | 'bot';
  text: string;
}

export function buildTranscript(rows: MessageRowLite[], max: number = MAX_TRANSCRIPT_CHARS): string {
  const full = rows
    .map((r) => `${r.sender === 'user' ? 'user' : 'assistant'}: ${(r.text ?? '').trim()}`)
    .join('\n');
  return full.length <= max ? full : '…' + full.slice(full.length - max);
}

function problemContextFrom(handoff: ConversationHandoff | null, rows: MessageRowLite[]): ProblemContextFields | null {
  const fromHandoff = handoff?.problemContext;
  if (fromHandoff && (fromHandoff.ce || fromHandoff.unde)) return fromHandoff;
  const ctx = extractProblemContext(
    rows.map((r) => ({ role: r.sender === 'user' ? 'user' : 'assistant', content: r.text ?? '' })),
  );
  if (!ctx.ce && !ctx.unde) return null;
  return { ce: ctx.ce ?? '', unde: ctx.unde ?? '', cand: ctx.cand ?? '' };
}

async function loadMessageRows(sb: QueryClient, conversationId: string): Promise<MessageRowLite[]> {
  const { data, error } = await sb
    .from('messages')
    .select('sender, text')
    .eq('conversation_id', conversationId)
    .order('sequence_number', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as MessageRowLite[]).filter((r) => r && typeof r.text === 'string');
}

/** The user's conversation (null when it does not exist or belongs to someone else). */
export async function loadConversationContext(
  sb: QueryClient,
  conversationId: string,
  userId: string,
): Promise<ConversationContext | null> {
  const { data, error } = await sb
    .from('conversations')
    .select('id, user_id, handoff')
    .eq('id', conversationId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const handoff = ((data as { handoff?: ConversationHandoff | null }).handoff as ConversationHandoff | null) ?? null;
  const rows = await loadMessageRows(sb, conversationId);
  return {
    handoff,
    ctx: {
      institutionName: handoff?.institutionName ?? '',
      problemContext: problemContextFrom(handoff, rows),
      transcript: buildTranscript(rows),
      existingQuestions: [],
    },
  };
}

/** The user's request session: institution, questions already sent, and the linked conversation when there is one. */
export async function loadSessionContext(sb: QueryClient, sessionId: string, userId: string): Promise<SetContext | null> {
  const { data, error } = await sb
    .from('request_sessions')
    .select('id, user_id, institution_name, conversation_id')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const session = data as { institution_name: string; conversation_id: string | null };

  const { data: requests, error: requestsError } = await sb.from('requests').select('request_body').eq('session_id', sessionId);
  if (requestsError) throw requestsError;
  const existingQuestions = ((requests ?? []) as Array<{ request_body?: string | null }>)
    .map((r) => (r.request_body ?? '').trim())
    .filter((q) => q.length > 0);

  const conversation = session.conversation_id ? await loadConversationContext(sb, session.conversation_id, userId) : null;
  return {
    institutionName: session.institution_name,
    problemContext: conversation?.ctx.problemContext ?? null,
    transcript: conversation?.ctx.transcript ?? '',
    existingQuestions,
  };
}

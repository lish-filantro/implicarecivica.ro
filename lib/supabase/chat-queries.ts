import { createClient } from '@/lib/supabase/client';
import type { ConversationRow, Message, ConversationListItem } from '@/lib/types/chat';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Conversations
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function createConversation(title?: string): Promise<ConversationRow> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_id: user.id, title: title || 'Conversație nouă' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function listConversations(): Promise<ConversationListItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('conversations')
    .select('id, title, updated_at, message_count, current_step')
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data || []).map(row => ({
    id: row.id,
    title: row.title,
    updatedAt: row.updated_at,
    messageCount: row.message_count,
    currentStep: row.current_step,
  }));
}

export async function updateConversationTitle(id: string, title: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('conversations')
    .update({ title })
    .eq('id', id);
  if (error) throw error;
}

export async function updateConversationStep(
  id: string,
  step: 'STEP_1' | 'STEP_2' | 'STEP_3',
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('conversations')
    .update({ current_step: step })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteConversation(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Messages
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function loadMessages(conversationId: string): Promise<Message[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('sequence_number', { ascending: true });

  if (error) throw error;
  return (data || []).map(row => ({
    id: row.id,
    sender: row.sender,
    text: row.text,
    time: new Date(row.created_at).toLocaleTimeString('ro-RO', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    webSources: row.web_sources || [],
    webSearches: row.web_searches || [],
  }));
}

export async function saveMessage(
  conversationId: string,
  message: Message,
  sequenceNumber: number,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender: message.sender,
      text: message.text,
      web_sources: message.webSources || [],
      web_searches: message.webSearches || [],
      sequence_number: sequenceNumber,
    });

  if (error) throw error;

  // Update message_count on conversation
  await supabase
    .from('conversations')
    .update({ message_count: sequenceNumber })
    .eq('id', conversationId);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function generateTitle(firstMessage: string): string {
  const clean = firstMessage.trim().replace(/\s+/g, ' ');
  if (clean.length <= 50) return clean;
  const truncated = clean.substring(0, 50);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 20 ? truncated.substring(0, lastSpace) : truncated) + '...';
}

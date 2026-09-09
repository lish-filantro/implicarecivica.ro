import type { QuestionSet } from "./questions";

export interface Message {
  id?: string;
  sender: 'user' | 'bot';
  text: string;
  time: string;
  webSources?: Array<{ url: string; title: string; description?: string }>;
  webSearches?: string[];
  isError?: boolean;
}

export interface ConversationRow {
  id: string;
  user_id: string;
  title: string;
  current_step: 'STEP_1' | 'STEP_2' | 'STEP_3';
  message_count: number;
  handoff?: ConversationHandoff | null;
  created_at: string;
  updated_at: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender: 'user' | 'bot';
  text: string;
  web_sources: Array<{ url: string; title: string; description?: string }>;
  web_searches: string[];
  sequence_number: number;
  created_at: string;
}

export interface ConversationListItem {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
  currentStep: 'STEP_1' | 'STEP_2' | 'STEP_3';
}

export type EmailConfidence = 'high' | 'medium' | 'low';

/** The institution the assistant identified in a STEP_2 reply, computed server-side. */
export interface ChatInstitution {
  name: string;
  email: string | null;
  confidence: EmailConfidence | null;
  sourceUrl: string | null;
}

/**
 * Chat → wizard hand-off, persisted on conversations.handoff. Written when the
 * institution is identified, when the user confirms it, when the request session
 * is created, and by the question-set generator (cache).
 */
export interface ConversationHandoff {
  institutionName: string;
  institutionEmail: string | null;
  emailConfidence: EmailConfidence | null;
  sourceUrl: string | null;
  problemContext: { ce: string; unde: string; cand: string };
  /** ISO timestamp of the reply that identified the institution. */
  identifiedAt: string;
  /** ISO timestamp of the user's "Pregătește cererile"; null while unconfirmed. */
  confirmedAt: string | null;
  /** The request session created from this conversation, once it exists. */
  sessionId: string | null;
  /** Generated questions, cached so reopening the wizard does not call the model again. */
  questions: QuestionSet | null;
  questionsModel: string | null;
}

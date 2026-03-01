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

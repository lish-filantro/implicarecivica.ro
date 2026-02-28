export type FeedbackCategory = 'bug' | 'sugestie' | 'utilizare' | 'altele';

export type FeedbackStatus = 'nou' | 'in_lucru' | 'rezolvat' | 'respins';

export interface Feedback {
  id: string;
  user_id: string | null;
  category: FeedbackCategory;
  message: string;
  page_url: string | null;
  status: FeedbackStatus;
  created_at: string;
}

export interface CreateFeedbackPayload {
  category: FeedbackCategory;
  message: string;
  page_url?: string;
}

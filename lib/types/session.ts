/**
 * Request Session Types
 * A session groups multiple requests under one subject/institution
 */

import type { Request } from './request';

export type SessionStatus =
  | 'pending'          // all sent, no response yet
  | 'in_progress'      // at least 1 registration confirmation
  | 'partial_answered'  // some answered, some not
  | 'completed'        // all answered
  | 'overdue';         // at least 1 deadline exceeded without answer

export interface RequestSession {
  id: string;
  user_id: string;
  conversation_id?: string;

  // Core
  name?: string;
  subject: string;
  institution_name: string;
  institution_email?: string;

  // Cache (derived from requests)
  cached_status: SessionStatus;
  total_requests: number;
  answered_requests: number;
  nearest_deadline?: string;

  // Timestamps
  created_at: string;
  updated_at: string;
}

/**
 * Session with its requests loaded (for expanded card view)
 */
export interface RequestSessionWithRequests extends RequestSession {
  requests: Request[];
}

/**
 * Payload for creating a new session with requests
 */
export interface CreateSessionPayload {
  name?: string;
  subject: string;
  institution_name: string;
  institution_email?: string;
  conversation_id?: string;
  questions: string[];  // each question becomes a separate request
}

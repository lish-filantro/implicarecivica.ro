/**
 * Request and Answer Types
 * Based on Supabase schema and existing implementation
 */

export type RequestStatus = 'pending' | 'received' | 'extension' | 'answered' | 'delayed';

export type EmailCategory = 'trimise' | 'inregistrate' | 'amanate' | 'raspunse' | 'intarziate';

/**
 * Answer Summary Formats
 * Supports multiple structured formats + legacy string
 */
export type AnswerSummary =
  | { type: 'text'; content: string }
  | { type: 'list'; content: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | string; // Legacy format: "item1; item2; item3"

/**
 * Public Information Request
 * Main entity for tracking requests under Law 544/2001
 */
export interface Request {
  id: string;
  user_id: string;

  // Institution details
  institution_id?: string;
  institution_name: string;
  institution_email?: string;

  // Request content
  subject: string;
  request_body?: string; // Primary source for question extraction
  body?: string;         // Fallback source
  summary?: string;      // AI-generated or manual summary

  // Status and registration
  status: RequestStatus;
  registration_number?: string;

  // Dates
  date_initiated: string;
  date_sent?: string;
  date_received?: string;
  deadline_date?: string;
  extension_date?: string;
  response_received_date?: string;

  // Extension details
  extension_days?: number;
  extension_reason?: string;

  // Answer (when status='answered')
  answer_summary?: AnswerSummary;

  // Metadata
  created_at: string;
  updated_at: string;
}

/**
 * Request with computed fields for dashboard display
 */
export interface DashboardRequest extends Request {
  days_without_registration?: number;
  effective_deadline?: string;
  days_until_deadline?: number | null;
  is_critical?: boolean;
  is_overdue?: boolean;
}

/**
 * Dashboard Statistics
 */
export interface DashboardStats {
  total: number;
  this_month: number;
  registered: number;
  waiting: number;
  by_status: {
    pending: number;
    received: number;
    extension: number;
    answered: number;
    delayed: number;
  };
}

/**
 * Dashboard Alert
 */
export interface DashboardAlert {
  type: 'critical' | 'warning' | 'info';
  message: string;
  count?: number;
}

/**
 * Dashboard API Response
 */
export interface DashboardData {
  stats: DashboardStats;
  alerts: {
    critical_deadlines: DashboardRequest[];
    pending_registration: DashboardRequest[];
    overdue: DashboardRequest[];
  };
  recent_requests: DashboardRequest[];
  upcoming_deadlines: Array<{
    date: string;
    request_id: string;
    registration_number?: string;
    institution: string;
    days_remaining: number;
    urgency: 'critical' | 'warning' | 'normal';
  }>;
}

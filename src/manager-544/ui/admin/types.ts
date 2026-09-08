/** Shapes returned by /api/admin/stats and /api/admin/users/pending, as consumed by the admin UI. */

export interface StatsData {
  users: {
    total: number;
    new_7d: number;
    new_30d: number;
    active_30d: number;
    pending_approval: number;
  };
  dailySignups: { day: string; count: number }[];
  activity: {
    requests_30d: number;
    sessions_30d: number;
    messages_30d: number;
    feedback_30d: number;
    campaigns_active: number;
  };
  requestStatus: Record<string, number>;
  feedbackStatus: Record<string, number>;
  topInstitutions: { name: string; total: number; answered: number }[];
  emails: { pending: number; failed: number; needs_review: number; last_inbound_at: string | null };
}

export interface PendingUser {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  created_at: string;
}

export const STATUS_LABELS: Record<string, string> = {
  pending: 'În așteptare',
  received: 'Primite',
  answered: 'Răspunse',
  extension: 'Prelungite',
  delayed: 'Întârziate',
  nou: 'Noi',
  in_lucru: 'În lucru',
  rezolvat: 'Rezolvate',
  respins: 'Respinse',
};

/** `fetch`-compatible function, injectable for tests. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export const defaultFetch: FetchLike = (input, init) => fetch(input, init);

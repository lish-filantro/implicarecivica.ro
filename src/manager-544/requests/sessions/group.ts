/**
 * Pure grouping of requests under their sessions (dashboard listing).
 */
import type { RequestSession, RequestSessionWithRequests } from '@m544/shared/types/session';
import type { Request } from '@m544/shared/types/request';

/**
 * Attach to every session the requests whose `session_id` matches it, keeping
 * the incoming order of both lists. Requests without a listed session are dropped.
 */
export function groupRequestsBySession(sessions: RequestSession[], requests: Request[]): RequestSessionWithRequests[] {
  const bySession = new Map<string, Request[]>();
  for (const req of requests) {
    if (!req.session_id) continue;
    const list = bySession.get(req.session_id) ?? [];
    list.push(req);
    bySession.set(req.session_id, list);
  }
  return sessions.map((session) => ({ ...session, requests: bySession.get(session.id) ?? [] }));
}

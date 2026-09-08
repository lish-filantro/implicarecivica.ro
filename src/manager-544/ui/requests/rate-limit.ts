/**
 * Browser-side client for GET /api/rate-limit/check (daily limit per user per institution).
 * The check is keyed by institution email, falling back to the institution name when the
 * session has no email (same rule the server applies in sessions/create).
 */

export interface RateLimitInfo {
  sent_today: number;
  remaining: number;
  limit: number;
}

export interface RateLimitInstitution {
  email?: string | null;
  name?: string | null;
}

export function rateLimitCheckUrl(institution: RateLimitInstitution): string | null {
  const email = institution.email?.trim();
  if (email) return `/api/rate-limit/check?email=${encodeURIComponent(email)}`;
  const name = institution.name?.trim();
  if (name) return `/api/rate-limit/check?name=${encodeURIComponent(name)}`;
  return null;
}

const defaultFetch: typeof fetch = (...args) => fetch(...args);

/** null when there is nothing to check, the server refuses, or the network fails (sending stays allowed). */
export async function fetchRateLimit(
  institution: RateLimitInstitution,
  fetchFn: typeof fetch = defaultFetch,
): Promise<RateLimitInfo | null> {
  const url = rateLimitCheckUrl(institution);
  if (!url) return null;
  try {
    const res = await fetchFn(url);
    if (!res.ok) return null;
    return (await res.json()) as RateLimitInfo;
  } catch {
    return null;
  }
}

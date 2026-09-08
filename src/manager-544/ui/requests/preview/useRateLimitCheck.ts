'use client';

import { useState, useEffect } from 'react';
import { fetchRateLimit, rateLimitCheckUrl } from '../rate-limit';
import type { RateLimitInfo, RateLimitInstitution } from '../rate-limit';

/**
 * Loads the daily limit for the target institution once on mount.
 * Failures leave `rateLimit` null (sending stays allowed, as before).
 */
export function useRateLimitCheck(institution: RateLimitInstitution, fetchFn?: typeof fetch) {
  const url = rateLimitCheckUrl(institution);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);
  const [rateLimitLoading, setRateLimitLoading] = useState(url !== null);

  useEffect(() => {
    if (!url) {
      setRateLimitLoading(false);
      return;
    }
    let cancelled = false;
    fetchRateLimit(institution, fetchFn).then((info) => {
      if (cancelled) return;
      if (info) setRateLimit(info);
      setRateLimitLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // The URL captures both email and name; fetchFn is a stable injected dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return { rateLimit, rateLimitLoading };
}

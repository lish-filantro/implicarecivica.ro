'use client';

import { useState, useEffect, useRef } from 'react';
import { getSessionWithRequests } from '@m544/requests/sessions/queries.client';
import { getProfile } from '@m544/emails/profile-queries.client';
import type { RequestSessionWithRequests } from '@m544/shared/types/session';
import { fetchRateLimit } from '../rate-limit';
import type { RateLimitInfo } from '../rate-limit';
import type { RequestWizard } from '../wizard/useRequestWizard';
import type { WizardProfile } from '../wizard/types';

export interface AddRequestsPageDeps {
  getSession?: (id: string) => Promise<RequestSessionWithRequests | null>;
  getProfile?: () => Promise<WizardProfile | null>;
  fetch?: typeof fetch;
}

const defaultDeps: Required<AddRequestsPageDeps> = {
  getSession: (id) => getSessionWithRequests(id),
  getProfile: () => getProfile(),
  fetch: (...args) => fetch(...args),
};

type AddWizard = Pick<RequestWizard, 'initFormFromProfile' | 'updateFormField'>;

/**
 * Data of /requests/add: the existing session, the profile (to pre-fill the
 * wizard) and the daily limit for that institution (by email, else by name).
 */
export function useAddRequestsPage(sessionId: string | null, wizard: AddWizard, deps: AddRequestsPageDeps = {}) {
  const [session, setSession] = useState<RequestSessionWithRequests | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);

  // Wizard callbacks are stable and deps are injected once; refs keep the effect keyed on sessionId only.
  const wizardRef = useRef(wizard);
  wizardRef.current = wizard;
  const depsRef = useRef({ ...defaultDeps, ...deps });
  depsRef.current = { ...defaultDeps, ...deps };

  useEffect(() => {
    if (!sessionId) {
      setError('Sesiune nespecificată');
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function loadData(id: string) {
      const { getSession, getProfile: loadProfile, fetch: fetchFn } = depsRef.current;
      try {
        const [sessionData, profile] = await Promise.all([getSession(id), loadProfile()]);
        if (cancelled) return;

        if (!sessionData) {
          setError('Sesiunea nu a fost găsită');
          return;
        }
        setSession(sessionData);

        // Pre-fill wizard with session data
        const w = wizardRef.current;
        if (profile) w.initFormFromProfile(profile);
        w.updateFormField('institutionName', sessionData.institution_name);
        w.updateFormField('institutionEmail', sessionData.institution_email || '');
        w.updateFormField('sessionName', sessionData.name || sessionData.subject);

        const limit = await fetchRateLimit(
          { email: sessionData.institution_email, name: sessionData.institution_name },
          fetchFn,
        );
        if (!cancelled && limit) setRateLimit(limit);
      } catch (err) {
        console.error('Failed to load session:', err);
        if (!cancelled) setError('Eroare la încărcarea sesiunii');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData(sessionId);
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return { session, loading, error, rateLimit };
}

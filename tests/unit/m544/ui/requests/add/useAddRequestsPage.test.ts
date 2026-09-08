// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAddRequestsPage } from '@m544/ui/requests/add/useAddRequestsPage';
import type { RequestSessionWithRequests } from '@m544/shared/types/session';

const SESSION: RequestSessionWithRequests = {
  id: 'S1',
  user_id: 'u1',
  name: 'Transparență',
  subject: 'Cerere informații publice - Legea 544/2001',
  institution_name: 'Primăria Pitești',
  institution_email: 'registratura@primaria.ro',
  cached_status: 'pending',
  total_requests: 3,
  answered_requests: 0,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  requests: [],
};

const PROFILE = { display_name: 'Ion', mailcow_email: 'ion@cereri544.ro', address: 'Adresa' };
const LIMIT = { sent_today: 3, remaining: 7, limit: 10 };

function fakeWizard() {
  return { initFormFromProfile: vi.fn(), updateFormField: vi.fn() };
}

function okFetch(body: unknown = LIMIT) {
  return vi.fn(async () => new Response(JSON.stringify(body))) as unknown as typeof fetch & { mock: { calls: unknown[][] } };
}

afterEach(() => vi.restoreAllMocks());

describe('useAddRequestsPage', () => {
  it('reports a missing session id without loading anything', () => {
    const getSession = vi.fn();
    const { result } = renderHook(() => useAddRequestsPage(null, fakeWizard(), { getSession }));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('Sesiune nespecificată');
    expect(getSession).not.toHaveBeenCalled();
  });

  it('loads session + profile, pre-fills the wizard and checks the limit by email', async () => {
    const wizard = fakeWizard();
    const fetchFn = okFetch();
    const { result } = renderHook(() =>
      useAddRequestsPage('S1', wizard, { getSession: async () => SESSION, getProfile: async () => PROFILE, fetch: fetchFn }),
    );
    expect(result.current.loading).toBe(true);
    await act(async () => {});

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.session).toEqual(SESSION);
    expect(result.current.rateLimit).toEqual(LIMIT);
    expect(wizard.initFormFromProfile).toHaveBeenCalledWith(PROFILE);
    expect(wizard.updateFormField).toHaveBeenCalledWith('institutionName', 'Primăria Pitești');
    expect(wizard.updateFormField).toHaveBeenCalledWith('institutionEmail', 'registratura@primaria.ro');
    expect(wizard.updateFormField).toHaveBeenCalledWith('sessionName', 'Transparență');
    expect(fetchFn.mock.calls[0][0]).toBe('/api/rate-limit/check?email=registratura%40primaria.ro');
  });

  it('falls back to the institution name when the session has no email', async () => {
    const wizard = fakeWizard();
    const fetchFn = okFetch();
    const session = { ...SESSION, institution_email: undefined, name: undefined };
    const { result } = renderHook(() =>
      useAddRequestsPage('S1', wizard, { getSession: async () => session, getProfile: async () => null, fetch: fetchFn }),
    );
    await act(async () => {});

    expect(fetchFn.mock.calls[0][0]).toBe('/api/rate-limit/check?name=Prim%C4%83ria%20Pite%C8%99ti');
    expect(result.current.rateLimit).toEqual(LIMIT);
    expect(wizard.initFormFromProfile).not.toHaveBeenCalled();
    expect(wizard.updateFormField).toHaveBeenCalledWith('institutionEmail', '');
    expect(wizard.updateFormField).toHaveBeenCalledWith('sessionName', SESSION.subject);
  });

  it('leaves rateLimit null when the check fails, but the session is still usable', async () => {
    const fetchFn = vi.fn(async () => new Response('x', { status: 500 })) as unknown as typeof fetch;
    const { result } = renderHook(() =>
      useAddRequestsPage('S1', fakeWizard(), { getSession: async () => SESSION, getProfile: async () => PROFILE, fetch: fetchFn }),
    );
    await act(async () => {});
    expect(result.current.session).toEqual(SESSION);
    expect(result.current.rateLimit).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('reports a session that does not exist', async () => {
    const wizard = fakeWizard();
    const fetchFn = okFetch();
    const { result } = renderHook(() =>
      useAddRequestsPage('nope', wizard, { getSession: async () => null, getProfile: async () => PROFILE, fetch: fetchFn }),
    );
    await act(async () => {});
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('Sesiunea nu a fost găsită');
    expect(result.current.session).toBeNull();
    expect(wizard.updateFormField).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('reports a loading failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() =>
      useAddRequestsPage('S1', fakeWizard(), {
        getSession: async () => { throw new Error('rls'); },
        getProfile: async () => PROFILE,
        fetch: okFetch(),
      }),
    );
    await act(async () => {});
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('Eroare la încărcarea sesiunii');
    expect(console.error).toHaveBeenCalledWith('Failed to load session:', expect.any(Error));
  });
});

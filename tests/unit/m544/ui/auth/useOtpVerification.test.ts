// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useOtpVerification,
  mapOtpError,
  OTP_INCOMPLETE_ERROR,
  OTP_INVALID_ERROR,
  OTP_RESENT_MESSAGE,
  type OtpAuthClient,
} from '@m544/ui/auth/useOtpVerification';

const EMAIL = 'ion@example.com';
const submit = { preventDefault: vi.fn() } as unknown as React.FormEvent;

function fakeAuth(overrides: Partial<OtpAuthClient> = {}) {
  const auth: OtpAuthClient = {
    verifyOtp: vi.fn(async () => ({ error: null })),
    resend: vi.fn(async () => ({ error: null })),
    ...overrides,
  };
  return auth;
}

function setup(auth: OtpAuthClient, email = EMAIL) {
  const router = { push: vi.fn(), refresh: vi.fn() };
  const createAuthClient = vi.fn(() => auth);
  const hook = renderHook(() => useOtpVerification({ email, router, createAuthClient }));
  return { ...hook, router, createAuthClient };
}

describe('mapOtpError', () => {
  it('translates the expired/invalid token error and passes the rest through', () => {
    expect(mapOtpError('Token has expired or is invalid')).toBe(OTP_INVALID_ERROR);
    expect(mapOtpError('Rate limit exceeded')).toBe('Rate limit exceeded');
  });
});

describe('useOtpVerification', () => {
  it('starts with an empty 8-digit code and no messages', () => {
    const { result } = setup(fakeAuth());
    expect(result.current.code).toEqual(['', '', '', '', '', '', '', '']);
    expect(result.current.error).toBe('');
    expect(result.current.loading).toBe(false);
    expect(result.current.resendLoading).toBe(false);
    expect(result.current.resendMessage).toBe('');
  });

  it('refuses to verify an incomplete code without calling Supabase', async () => {
    const auth = fakeAuth();
    const { result } = setup(auth);
    act(() => result.current.setCode(['1', '2', '3', '', '', '', '', '']));
    await act(async () => {
      await result.current.handleVerify(submit);
    });
    expect(result.current.error).toBe(OTP_INCOMPLETE_ERROR);
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it('success: verifies the signup token and goes to /pending-approval', async () => {
    const auth = fakeAuth();
    const { result, router, createAuthClient } = setup(auth);
    act(() => result.current.setCode([...'12345678']));
    await act(async () => {
      await result.current.handleVerify(submit);
    });
    expect(createAuthClient).toHaveBeenCalled();
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: EMAIL, token: '12345678', type: 'signup' });
    expect(router.push).toHaveBeenCalledWith('/pending-approval');
    expect(router.refresh).toHaveBeenCalled();
    expect(result.current.error).toBe('');
    expect(result.current.loading).toBe(true); // stays true while the navigation happens
  });

  it('maps the expired-token error and stops loading', async () => {
    const auth = fakeAuth({
      verifyOtp: vi.fn(async () => ({ error: { message: 'Token has expired or is invalid' } })),
    });
    const { result, router } = setup(auth);
    act(() => result.current.setCode([...'00000000']));
    await act(async () => {
      await result.current.handleVerify(submit);
    });
    expect(result.current.error).toBe(OTP_INVALID_ERROR);
    expect(result.current.loading).toBe(false);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('shows other Supabase errors verbatim', async () => {
    const auth = fakeAuth({ verifyOtp: vi.fn(async () => ({ error: { message: 'Too many requests' } })) });
    const { result } = setup(auth);
    act(() => result.current.setCode([...'12345678']));
    await act(async () => {
      await result.current.handleVerify(submit);
    });
    expect(result.current.error).toBe('Too many requests');
  });

  it('resend: success shows the confirmation, error shows the message, no email does nothing', async () => {
    const ok = fakeAuth();
    const { result } = setup(ok);
    await act(async () => {
      await result.current.handleResend();
    });
    expect(ok.resend).toHaveBeenCalledWith({ type: 'signup', email: EMAIL });
    expect(result.current.resendMessage).toBe(OTP_RESENT_MESSAGE);
    expect(result.current.resendLoading).toBe(false);

    const failing = fakeAuth({ resend: vi.fn(async () => ({ error: { message: 'Rate limit exceeded' } })) });
    const { result: r2 } = setup(failing);
    await act(async () => {
      await r2.current.handleResend();
    });
    expect(r2.current.error).toBe('Rate limit exceeded');
    expect(r2.current.resendMessage).toBe('');

    const noEmail = fakeAuth();
    const { result: r3 } = setup(noEmail, '');
    await act(async () => {
      await r3.current.handleResend();
    });
    expect(noEmail.resend).not.toHaveBeenCalled();
  });
});

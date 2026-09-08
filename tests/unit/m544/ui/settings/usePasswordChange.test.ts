// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePasswordChange } from '@m544/ui/settings/usePasswordChange';

describe('usePasswordChange', () => {
  it('rejects mismatched passwords without calling the updater', async () => {
    const updatePassword = vi.fn();
    const { result } = renderHook(() => usePasswordChange(updatePassword));
    act(() => {
      result.current.setNewPassword('abcdef');
      result.current.setConfirmPassword('abcdeg');
    });
    await act(() => result.current.submit());
    expect(result.current.message).toEqual({ type: 'error', text: 'Parolele nu coincid.' });
    expect(updatePassword).not.toHaveBeenCalled();
  });

  it('rejects passwords shorter than 6 characters', async () => {
    const updatePassword = vi.fn();
    const { result } = renderHook(() => usePasswordChange(updatePassword));
    act(() => {
      result.current.setNewPassword('abc');
      result.current.setConfirmPassword('abc');
    });
    await act(() => result.current.submit());
    expect(result.current.message?.type).toBe('error');
    expect(updatePassword).not.toHaveBeenCalled();
  });

  it('clears the fields and shows success', async () => {
    const updatePassword = vi.fn(async () => ({ error: null }));
    const { result } = renderHook(() => usePasswordChange(updatePassword));
    act(() => {
      result.current.setNewPassword('parola1');
      result.current.setConfirmPassword('parola1');
    });
    await act(() => result.current.submit());
    expect(updatePassword).toHaveBeenCalledWith('parola1');
    expect(result.current.message).toEqual({ type: 'success', text: 'Parola a fost schimbată cu succes.' });
    expect(result.current.newPassword).toBe('');
    expect(result.current.confirmPassword).toBe('');
  });

  it('translates the "same password" error and passes other errors through', async () => {
    const same = vi.fn(async () => ({
      error: { message: 'New password should be different from the old password.' },
    }));
    const { result } = renderHook(() => usePasswordChange(same));
    act(() => {
      result.current.setNewPassword('parola1');
      result.current.setConfirmPassword('parola1');
    });
    await act(() => result.current.submit());
    expect(result.current.message?.text).toBe('Parola nouă trebuie să fie diferită de cea veche.');

    const other = vi.fn(async () => ({ error: { message: 'Weak password' } }));
    const r2 = renderHook(() => usePasswordChange(other));
    act(() => {
      r2.result.current.setNewPassword('parola1');
      r2.result.current.setConfirmPassword('parola1');
    });
    await act(() => r2.result.current.submit());
    expect(r2.result.current.message?.text).toBe('Weak password');
  });

  it('shows a generic error when the updater throws', async () => {
    const boom = vi.fn(async () => { throw new Error('network'); });
    const { result } = renderHook(() => usePasswordChange(boom));
    act(() => {
      result.current.setNewPassword('parola1');
      result.current.setConfirmPassword('parola1');
    });
    await act(() => result.current.submit());
    expect(result.current.message?.text).toBe('Nu am putut schimba parola. Încearcă din nou.');
  });
});
